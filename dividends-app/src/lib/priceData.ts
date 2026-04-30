import Papa from 'papaparse';
import type { OHLCV, Interval } from '../types';

const CSV_PATH = '/all_stocks_historical_data.csv';

/** Cache of full CSV rows grouped by ticker (built lazily on first request). */
let tickerIndex: Map<string, OHLCV[]> | null = null;
let inflight: Promise<Map<string, OHLCV[]>> | null = null;

interface RawRow {
  Date: string;
  Ticker: string;
  Name?: string;
  Open: string;
  High: string;
  Low: string;
  Close: string;
  Volume: string;
}

function parseRow(row: RawRow): { ticker: string; bar: OHLCV } | null {
  const ticker = (row.Ticker ?? '').trim();
  if (!ticker) return null;

  const open = parseFloat(row.Open);
  const high = parseFloat(row.High);
  const low = parseFloat(row.Low);
  const close = parseFloat(row.Close);
  const volume = parseFloat(row.Volume);
  const t = new Date(row.Date).getTime();

  if (
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close) ||
    !Number.isFinite(t)
  ) {
    return null;
  }

  return {
    ticker,
    bar: {
      time: Math.floor(t / 1000),
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume) ? volume : 0,
    },
  };
}

async function loadAndIndex(): Promise<Map<string, OHLCV[]>> {
  if (tickerIndex) return tickerIndex;
  if (inflight) return inflight;

  inflight = (async () => {
    const res = await fetch(CSV_PATH);
    if (!res.ok) {
      throw new Error(`Could not load price data (${res.status})`);
    }
    const text = await res.text();

    const index = new Map<string, OHLCV[]>();

    await new Promise<void>((resolve, reject) => {
      Papa.parse<RawRow>(text, {
        header: true,
        skipEmptyLines: true,
        worker: false,
        chunk: (results: Papa.ParseResult<RawRow>) => {
          for (const row of results.data) {
            const parsed = parseRow(row);
            if (!parsed) continue;
            let arr = index.get(parsed.ticker);
            if (!arr) {
              arr = [];
              index.set(parsed.ticker, arr);
            }
            arr.push(parsed.bar);
          }
        },
        complete: () => resolve(),
        error: (err: Error) => reject(err),
      });
    });

    // Sort each ticker chronologically
    for (const arr of index.values()) {
      arr.sort((a, b) => a.time - b.time);
    }

    tickerIndex = index;
    return index;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** Get all bars for a ticker (sorted oldest -> newest). */
export async function getBars(ticker: string): Promise<OHLCV[]> {
  const idx = await loadAndIndex();
  return idx.get(ticker.toUpperCase()) ?? idx.get(ticker) ?? [];
}

/** Pre-warm the data so the first stock click doesn't have to wait the full parse. */
export function preloadBars(): void {
  loadAndIndex().catch(() => {
    /* ignore — error surfaces on real fetch */
  });
}

/** Filter bars to a given interval relative to the most recent bar. */
export function filterByInterval(bars: OHLCV[], interval: Interval): OHLCV[] {
  if (bars.length === 0 || interval === 'ALL') return bars;
  const last = bars[bars.length - 1].time;
  const day = 86_400;
  const cutoff: Record<Exclude<Interval, 'ALL'>, number> = {
    '1W': last - 7 * day,
    '1M': last - 30 * day,
    '3M': last - 90 * day,
    '6M': last - 180 * day,
    '1Y': last - 365 * day,
    '5Y': last - 5 * 365 * day,
  };
  return bars.filter((b) => b.time >= cutoff[interval]);
}

/** Simple Moving Average — returns array of {time, value} aligned to bars. */
export function sma(
  bars: OHLCV[],
  period: number
): { time: number; value: number }[] {
  if (period <= 0 || bars.length < period) return [];
  const out: { time: number; value: number }[] = [];
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close;
    if (i >= period) sum -= bars[i - period].close;
    if (i >= period - 1) {
      out.push({ time: bars[i].time, value: sum / period });
    }
  }
  return out;
}

/** Latest close + 1-day percent change for a list of bars. */
export function latestSummary(
  bars: OHLCV[]
): { latestClose: number | null; changePct: number | null } {
  if (bars.length === 0) return { latestClose: null, changePct: null };
  const last = bars[bars.length - 1];
  if (bars.length < 2) {
    return { latestClose: last.close, changePct: null };
  }
  const prev = bars[bars.length - 2];
  return {
    latestClose: last.close,
    changePct: ((last.close - prev.close) / prev.close) * 100,
  };
}
