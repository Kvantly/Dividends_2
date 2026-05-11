export interface AiPickReasoning {
  dividends: string;
  valuation: string;
  momentum:  string;
  risks:     string;
}

export interface AiPickMetrics {
  dividend_yield_pct:     number | null;
  pe_ratio:               number | null;
  roe_pct:                number | null;
  avg_5y_div_growth_pct:  number | null;
  consistency_pct:        number | null;
  latest_annual_dividend: number | null;
  company_score:          number | null;
  dividend_score:         number | null;
}

export interface AiRecommendation {
  ticker:           string;
  name:             string;
  action:           string;
  hold_period:      string;
  confidence:       'HIGH' | 'MEDIUM' | 'LOW';
  estimated_upside: string;
  summary:          string;
  reasoning:        AiPickReasoning;
  key_metrics:      AiPickMetrics;
  data_as_of:       string;
}

export interface AiPickData {
  generated_at:        string;
  week:                string;
  recommendation:      AiRecommendation;
  model:               string;
  candidates_analyzed: number;
}

let cache: AiPickData | null | undefined;

export async function getAiPick(): Promise<AiPickData | null> {
  if (cache !== undefined) return cache;
  const res = await fetch('/ai_pick.json');
  if (res.status === 404) { cache = null; return null; }
  if (!res.ok) throw new Error(`Failed to load AI pick (${res.status})`);
  cache = await res.json() as AiPickData;
  return cache;
}
