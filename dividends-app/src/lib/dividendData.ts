import type { DividendData, DividendPayment, YearlyDividend, YearlyYield } from '../types';
import type { OHLCV } from '../types';

const cache = new Map<string, DividendData | null>();
const inflight = new Map<string, Promise<DividendData | null>>();

export async function getDividends(ticker: string): Promise<DividendData | null> {
  const key = ticker.toUpperCase();

  if (cache.has(key)) return cache.get(key)!;

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const res = await fetch(`/dividends/${encodeURIComponent(key)}.json`);
    if (res.status === 404) {
      cache.set(key, null);
      return null;
    }
    if (!res.ok) throw new Error(`Could not load dividend data (${res.status})`);
    const data: DividendData = await res.json();
    cache.set(key, data);
    return data;
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

export function buildYearlyTotals(dividends: DividendPayment[]): YearlyDividend[] {
  const byYear = new Map<string, { total: number; payments: number }>();

  for (const d of dividends) {
    const year = d.date.slice(0, 4);
    const existing = byYear.get(year) ?? { total: 0, payments: 0 };
    byYear.set(year, {
      total: existing.total + d.amount,
      payments: existing.payments + 1,
    });
  }

  const sorted = Array.from(byYear.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, { total, payments }]) => ({ year, total, payments, growthPct: null as number | null }));

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].total;
    if (prev > 0) {
      sorted[i].growthPct = ((sorted[i].total - prev) / prev) * 100;
    }
  }

  return sorted;
}

/** Total dividends paid in the trailing 12 months */
export function trailingTwelveMonths(dividends: DividendPayment[]): number {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return dividends
    .filter((d) => d.date >= cutoffStr)
    .reduce((sum, d) => sum + d.amount, 0);
}

/**
 * For each year that has dividend data, look up the year-end closing price
 * from the OHLCV bars and compute yield % = (annual_dividend / year_end_price) * 100.
 */
export function buildYearlyYields(yearly: YearlyDividend[], bars: OHLCV[]): YearlyYield[] {
  if (bars.length === 0 || yearly.length === 0) return [];

  // Build a map: year -> last closing price of that year (bars are sorted asc)
  const lastClose = new Map<string, number>();
  for (const bar of bars) {
    const year = new Date(bar.time * 1000).getUTCFullYear().toString();
    lastClose.set(year, bar.close);
  }

  return yearly
    .map((row) => {
      const price = lastClose.get(row.year);
      if (!price || price <= 0) return null;
      return {
        year: row.year,
        yieldPct: (row.total / price) * 100,
        dividend: row.total,
        price,
      };
    })
    .filter((r): r is YearlyYield => r !== null);
}

/** Number of consecutive years (ending with the most recent) with positive dividends. */
export function consecutivePositiveYears(yearly: YearlyDividend[]): number {
  if (yearly.length === 0) return 0;
  let count = 0;
  for (let i = yearly.length - 1; i >= 1; i--) {
    if ((yearly[i].growthPct ?? 0) > 0) {
      count++;
    } else {
      break;
    }
  }
  return count;
}
