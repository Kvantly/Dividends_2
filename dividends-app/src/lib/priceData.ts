import type { OHLCV, Interval } from '../types';

/**
 * Per-stock data is at /data/{TICKER}.json. Each file is a small array of
 * OHLCV bars produced by split_data_for_dashboard.py during the weekly workflow.
 */

const cache = new Map<string, OHLCV[]>();
const inflight = new Map<string, Promise<OHLCV[]>>();

/** Fetch all bars for a single ticker. Caches results in memory. */
export async function getBars(ticker: string): Promise<OHLCV[]> {
  const key = ticker.toUpperCase();

  const cached = cache.get(key);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const res = await fetch(`/data/${encodeURIComponent(key)}.json`);
    if (res.status === 404) return [] as OHLCV[];
    if (!res.ok) throw new Error(`Could not load price data (${res.status})`);
    const bars: OHLCV[] = await res.json();
    cache.set(key, bars);
    return bars;
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

/** No-op kept for API compatibility — data now loads on demand per stock. */
export function preloadBars(): void {
  /* intentionally empty */
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

/** Simple Moving Average aligned to the closing prices in `bars`. */
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
