import type { DividendBar } from '../types';

const cache = new Map<string, DividendBar[]>();

export async function getDividends(ticker: string): Promise<DividendBar[]> {
  if (cache.has(ticker)) return cache.get(ticker)!;
  try {
    const res = await fetch(`/dividends/${encodeURIComponent(ticker)}.json`);
    if (!res.ok) return [];
    const data: DividendBar[] = await res.json();
    cache.set(ticker, data);
    return data;
  } catch {
    return [];
  }
}
