export interface AiPickReasoning {
  dividends: string;
  valuation:  string;
  momentum:   string;
  risks:      string;
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

export interface ScoreBreakdown {
  consistency:  number | null;
  streak:       number | null;
  yield:        number | null;
  yield_trend:  number | null;
  roe:          number | null;
  margin:       number | null;
  momentum:     number | null;
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
  score_breakdown:  ScoreBreakdown;
  total_score:      number;
  max_score:        number;
  data_as_of:       string;
}

export interface BacktestPick {
  year:                    string;
  ticker:                  string;
  name:                    string;
  model_score:             number;
  consistency_pct:         number;
  streak:                  number;
  yield_at_pick_pct:       number | null;
  entry_price:             number | null;
  exit_price:              number | null;
  div_received:            number | null;
  price_return_pct:        number | null;
  div_yield_realized_pct:  number | null;
  total_return_pct:        number | null;
  outcome:                 'WIN' | 'LOSS' | 'NO_DATA';
}

export interface BacktestSummary {
  years_tested:          number;
  wins:                  number;
  win_rate_pct:          number;
  avg_total_return_pct:  number;
  best_return_pct:       number | null;
  worst_return_pct:      number | null;
}

export interface AiPickData {
  generated_at:       string;
  week:               string;
  model_type:         string;
  model_version:      string;
  recommendation:     AiRecommendation;
  candidates_scored:  number;
  top5_scores:        { ticker: string; name: string; score: number }[];
  backtest: {
    summary: BacktestSummary;
    picks:   BacktestPick[];
    note:    string;
  };
}

let cache: AiPickData | null | undefined;

export async function getAiPick(): Promise<AiPickData | null> {
  if (cache !== undefined) return cache;
  const res = await fetch('/ai_pick.json');
  if (res.status === 404) { cache = null; return null; }
  if (!res.ok) throw new Error(`Failed to load pick data (${res.status})`);
  cache = await res.json() as AiPickData;
  return cache;
}
