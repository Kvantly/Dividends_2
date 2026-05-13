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

export interface Position {
  ticker:          string;
  entry_date:      string;
  entry_price:     number;
  entry_score:     number;
  current_price:   number;
  current_score:   number;
  unrealized_pct:  number;
  weeks_held:      number;
  take_profit_at:  number | null;
  stop_loss_at:    number | null;
}

export interface ExitSignal {
  reason:       string;
  prev_ticker:  string;
  return_pct:   number;
}

export interface AiRecommendation {
  action:           string;
  ticker:           string;
  name:             string;
  confidence:       'HIGH' | 'MEDIUM' | 'LOW';
  hold_period:      string;
  estimated_upside: string;
  summary:          string;
  reasoning:        AiPickReasoning;
  key_metrics:      AiPickMetrics;
  score_breakdown:  ScoreBreakdown;
  total_score:      number;
  max_score:        number;
  position:         Position | null;
  exit_signal:      ExitSignal | null;
  data_as_of:       string;
}

export interface EquityCurvePoint {
  date:   string;
  value:  number;
  ticker: string | null;
}

export interface Trade {
  action:       'BUY' | 'SELL';
  ticker:       string;
  name:         string;
  date:         string;
  price:        number;
  score?:       number;
  entry_price?: number;
  entry_date?:  string;
  return_pct?:  number;
  exit_reason?: string;
}

export interface BacktestSummary {
  wins?:                  number;
  win_rate_pct?:          number;
  avg_trade_return_pct?:  number | null;
  best_trade_pct?:        number | null;
  worst_trade_pct?:       number | null;
  total_trades?:          number;
  avg_hold_weeks?:        number;
  start_date?:            string | null;
  end_date?:              string | null;
  final_value?:           number;
  total_return_pct?:      number;
  max_drawdown_pct?:      number | null;
}

export interface ExitRules {
  take_profit_pct: number;
  stop_loss_pct:   number;
  rotation_gap:    number;
  min_hold_weeks:  number;
}

export interface AiPickData {
  generated_at:      string;
  week:              string;
  model_type:        string;
  model_version:     string;
  recommendation:    AiRecommendation;
  candidates_scored: number;
  top5_scores:       { ticker: string; name: string; score: number }[];
  exit_rules:        ExitRules;
  backtest: {
    summary:      BacktestSummary;
    equity_curve: EquityCurvePoint[];
    trades:       Trade[];
    note:         string;
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
