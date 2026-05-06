export interface FinancialSection {
  [key: string]: number | string | null;
}

export interface FinancialData {
  ticker: string;
  name: string;
  last_updated: string;
  valuation: {
    market_cap: number | null;
    enterprise_value: number | null;
    trailing_pe: number | null;
    forward_pe: number | null;
    peg_ratio: number | null;
    price_to_sales: number | null;
    price_to_book: number | null;
    ev_to_revenue: number | null;
    ev_to_ebitda: number | null;
  };
  per_share: {
    current_price: number | null;
    eps_trailing: number | null;
    eps_forward: number | null;
    book_value: number | null;
    revenue_per_share: number | null;
    currency: string | null;
  };
  profitability: {
    profit_margin: number | null;
    operating_margin: number | null;
    gross_margin: number | null;
    ebitda_margin: number | null;
    roe: number | null;
    roa: number | null;
  };
  income: {
    total_revenue: number | null;
    revenue_growth: number | null;
    gross_profits: number | null;
    ebitda: number | null;
    net_income: number | null;
    earnings_growth: number | null;
  };
  balance_sheet: {
    total_cash: number | null;
    cash_per_share: number | null;
    total_debt: number | null;
    debt_to_equity: number | null;
    current_ratio: number | null;
    quick_ratio: number | null;
  };
  trading: {
    beta: number | null;
    week52_high: number | null;
    week52_low: number | null;
    avg50d: number | null;
    avg200d: number | null;
    avg_volume: number | null;
    avg_volume_10d: number | null;
    shares_outstanding: number | null;
    float_shares: number | null;
    insider_ownership: number | null;
    institutional_ownership: number | null;
    short_ratio: number | null;
  };
}

const cache = new Map<string, FinancialData | null>();
const inflight = new Map<string, Promise<FinancialData | null>>();

export async function getFinancials(ticker: string): Promise<FinancialData | null> {
  const key = ticker.toUpperCase();

  if (cache.has(key)) return cache.get(key)!;

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const res = await fetch(`/financials/${encodeURIComponent(key)}.json`);
    if (res.status === 404) { cache.set(key, null); return null; }
    if (!res.ok) throw new Error(`Could not load financials (${res.status})`);
    const data: FinancialData = await res.json();
    cache.set(key, data);
    return data;
  })();

  inflight.set(key, promise);
  try { return await promise; } finally { inflight.delete(key); }
}

export function fmtLargeNumber(n: number | null): string {
  if (n === null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6)  return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3)  return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(2);
}

export function fmtPct(n: number | null): string {
  if (n === null) return '—';
  return `${(n * 100).toFixed(2)}%`;
}

export function fmtX(n: number | null, decimals = 2): string {
  if (n === null) return '—';
  return `${n.toFixed(decimals)}x`;
}

export function fmtNum(n: number | null, decimals = 2): string {
  if (n === null) return '—';
  return n.toFixed(decimals);
}
