export interface DividendRankEntry {
  rank: number;
  ticker: string;
  name: string;
  avg_growth_5y: number;
  composite_score: number;
  years_in_window: number;
  streak: number;
  consistency_pct: number;
  latest_annual: number;
  yearly: { year: string; total: number; growth_pct: number | null; yield_pct: number | null; yield_growth_pct: number | null }[];
}

export interface DividendRankData {
  generated_at: string;
  count: number;
  rankings: DividendRankEntry[];
}

export interface ScoreBreakdown {
  momentum: number;
  golden_cross: number;
  pe: number;
  roe: number;
  debt: number;
  dividend: number;
  revenue_growth: number;
  profit_margin: number;
  low_beta: number;
  eps_growth: number;
}

export interface CompanyRankEntry {
  rank: number;
  ticker: string;
  name: string;
  score: number;
  scores: ScoreBreakdown;
  metrics: {
    pe: number | null;
    roe: number | null;
    profit_margin: number | null;
    revenue_growth: number | null;
    earnings_growth: number | null;
    debt_to_equity: number | null;
    current_ratio: number | null;
    beta: number | null;
    price_vs_200d: number | null;
    market_cap: number | null;
  };
}

export interface CompanyRankData {
  generated_at: string;
  count: number;
  rankings: CompanyRankEntry[];
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  return res.json() as Promise<T>;
}

let divRankCache: DividendRankData | null | undefined;
let coRankCache: CompanyRankData | null | undefined;

export async function getDividendRank(): Promise<DividendRankData | null> {
  if (divRankCache !== undefined) return divRankCache;
  divRankCache = await fetchJson<DividendRankData>('/rankings/dividend_rank.json');
  return divRankCache;
}

export async function getCompanyRank(): Promise<CompanyRankData | null> {
  if (coRankCache !== undefined) return coRankCache;
  coRankCache = await fetchJson<CompanyRankData>('/rankings/company_rank.json');
  return coRankCache;
}

export function fmtGrowth(n: number | null): string {
  if (n === null) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export function fmtMetric(n: number | null, suffix = '', decimals = 1): string {
  if (n === null) return '—';
  return `${n.toFixed(decimals)}${suffix}`;
}

export function scoreTier(score: number, max = 10): 'high' | 'mid' | 'low' {
  const pct = score / max;
  if (pct >= 0.7) return 'high';
  if (pct >= 0.4) return 'mid';
  return 'low';
}

export const SCORE_LABELS: Record<keyof ScoreBreakdown, string> = {
  momentum:       'Momentum (200D)',
  golden_cross:   'Golden Cross',
  pe:             'P/E Value',
  roe:            'Return on Equity',
  debt:           'Debt Health',
  dividend:       'Dividend Growth',
  revenue_growth: 'Revenue Growth',
  profit_margin:  'Profit Margin',
  low_beta:       'Low Volatility',
  eps_growth:     'EPS Growth',
};
