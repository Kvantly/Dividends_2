import Papa from 'papaparse';
import type { PriceData } from '../types';

/**
 * Expected CSV row shape from yfinance-based pipelines.
 * Common column names; adjust if your CSV differs.
 */
interface CsvRow {
  Date?: string;
  date?: string;
  Close?: string;
  close?: string;
  Ticker?: string;
  ticker?: string;
  Symbol?: string;
}

const HISTORICAL_CSV_PATH = '/all_stocks_historical_data.csv';

let cachedRows: CsvRow[] | null = null;
let inflight: Promise<CsvRow[]> | null = null;

async function loadAllRows(): Promise<CsvRow[]> {
  if (cachedRows) return cachedRows;
  if (inflight) return inflight;

  inflight = (async () => {
    const res = await fetch(HISTORICAL_CSV_PATH);
    if (!res.ok) {
      throw new Error(`Could not load historical CSV (${res.status})`);
    }
    const text = await res.text();
    const parsed = Papa.parse<CsvRow>(text, {
      header: true,
      skipEmptyLines: true,
    });
    cachedRows = parsed.data;
    return cachedRows;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

function pickField<T extends object>(row: T, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = (row as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

/**
 * Get current price + week-over-week change for a ticker.
 * Returns null if the CSV can't be loaded or the ticker has no data.
 */
export async function getPriceData(ticker: string): Promise<PriceData | null> {
  let rows: CsvRow[];
  try {
    rows = await loadAllRows();
  } catch (err) {
    console.warn('Historical CSV unavailable:', err);
    return null;
  }

  // Filter to this ticker, normalizing case + common Oslo suffix `.OL`
  const target = ticker.toUpperCase();
  const matching = rows.filter((row) => {
    const t = pickField(row, ['Ticker', 'ticker', 'Symbol'])?.toUpperCase() ?? '';
    return t === target || t === `${target}.OL` || t.replace('.OL', '') === target;
  });

  if (matching.length === 0) return null;

  // Sort by date ascending
  const points = matching
    .map((row) => {
      const dateStr = pickField(row, ['Date', 'date']);
      const closeStr = pickField(row, ['Close', 'close']);
      if (!dateStr || !closeStr) return null;
      const close = parseFloat(closeStr);
      const date = new Date(dateStr);
      if (Number.isNaN(close) || Number.isNaN(date.getTime())) return null;
      return { date, close };
    })
    .filter((p): p is { date: Date; close: number } => p !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (points.length === 0) return null;

  const latest = points[points.length - 1];
  // Find the price ~7 days before the latest point
  const targetTime = latest.date.getTime() - 7 * 86_400_000;
  let weekAgoPoint: { date: Date; close: number } | null = null;
  for (let i = points.length - 2; i >= 0; i--) {
    if (points[i].date.getTime() <= targetTime) {
      weekAgoPoint = points[i];
      break;
    }
  }

  const changePercent = weekAgoPoint
    ? ((latest.close - weekAgoPoint.close) / weekAgoPoint.close) * 100
    : null;

  return {
    current: latest.close,
    weekAgo: weekAgoPoint?.close ?? null,
    changePercent,
    currency: 'NOK', // Oslo Stock Exchange
  };
}
