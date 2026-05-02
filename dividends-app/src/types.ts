export interface Stock {
  name: string;
  ticker: string;
  isin: string;
  market: string;
  scraped_date: string;
}

export interface OHLCV {
  /** Unix seconds (UTC) */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockSummary {
  ticker: string;
  name: string;
  market: string;
  latestClose: number | null;
  changePct: number | null; // 1-day change in %
}

export type Theme = 'light' | 'dark';

export type Interval = '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'ALL';

export type ChartStyle = 'candle' | 'line';

export interface DividendBar {
  date: string;   // 'YYYY-MM-DD'
  amount: number; // NOK
}
