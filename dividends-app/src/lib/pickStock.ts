import type { Stock } from '../types';

/**
 * ISO 8601 week number for the given date (UTC).
 * Week 1 is the week containing the first Thursday of the year.
 */
export function getISOWeek(date: Date): { year: number; week: number } {
  // Copy date so we don't mutate the input
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  // Make it Thursday in current week. Sunday = 0 in JS, so map Sun -> 7.
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  // Year of the Thursday is the ISO year
  const isoYear = d.getUTCFullYear();
  // Get first day of the ISO year
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  // Calculate full weeks between the Thursday and Jan 1
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
  );
  return { year: isoYear, week: weekNo };
}

/**
 * Simple deterministic 32-bit hash for a string.
 * Used to spread picks across the catalog so consecutive weeks
 * don't pick adjacent stocks.
 */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Pick a single stock for the current ISO week. Stable across all
 * users for 7 days, then changes on Monday 00:00 UTC.
 */
export function pickWeeklyStock(stocks: Stock[], now: Date = new Date()): Stock {
  if (stocks.length === 0) {
    throw new Error('Cannot pick from empty stock list');
  }
  const { year, week } = getISOWeek(now);
  const seed = hash(`${year}-W${week}`);
  return stocks[seed % stocks.length];
}
