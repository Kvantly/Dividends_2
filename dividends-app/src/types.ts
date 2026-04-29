export interface Stock {
  name: string;
  ticker: string;
  isin: string;
  market: string;
  scraped_date: string;
}

export interface PriceData {
  current: number;
  weekAgo: number | null;
  changePercent: number | null;
  currency: string;
}

export interface StockPick extends Stock {
  price: PriceData | null;
}

export type Theme = 'light' | 'dark';
