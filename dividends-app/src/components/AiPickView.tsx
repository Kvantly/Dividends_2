import { useEffect, useState } from 'react';
import { getAiPick, type AiPickData, type ScoreBreakdown } from '../lib/aiPickData';

interface Props { onSelectStock: (ticker: string) => void; }

// ─── Score bar ────────────────────────────────────────────────────────────────

const SCORE_LABELS: Record<keyof ScoreBreakdown, string> = {
  consistency:  'Consistency',
  streak:       'Streak',
  yield:        'Yield level',
  yield_trend:  'Yield trend',
  roe:          'ROE',
  margin:       'Profit margin',
  momentum:     'Price momentum',
};

function ScorePillar({ label, score, max = 10 }: { label: string; score: number | null; max?: number }) {
  if (score === null) return null;
  const pct   = Math.min((score / max) * 100, 100);
  const color = pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--accent)' : '#f59e0b';
  return (
    <div className="ai-score-pillar">
      <div className="ai-score-pillar-label">{label}</div>
      <div className="ai-score-pillar-track">
        <div className="ai-score-pillar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="ai-score-pillar-num" style={{ color }}>{score}/10</span>
    </div>
  );
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const colors = { HIGH: 'var(--green)', MEDIUM: 'var(--accent)', LOW: '#f59e0b' };
  return (
    <span className="ai-confidence-badge" style={{ background: colors[level] }}>
      {level} CONFIDENCE
    </span>
  );
}

// ─── Metric chip ──────────────────────────────────────────────────────────────

function MetricChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`ai-metric-chip${highlight ? ' highlight' : ''}`}>
      <div className="ai-metric-label">{label}</div>
      <div className="ai-metric-value">{value}</div>
    </div>
  );
}

// ─── Reasoning card ───────────────────────────────────────────────────────────

function ReasoningCard({ title, icon, text }: { title: string; icon: string; text: string }) {
  return (
    <div className="ai-reasoning-card">
      <div className="ai-reasoning-title">
        <span className="ai-reasoning-icon">{icon}</span>{title}
      </div>
      <p className="ai-reasoning-text">{text}</p>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, suffix = '', dec = 1) {
  if (v == null) return '—';
  return `${v.toFixed(dec)}${suffix}`;
}

function ReturnCell({ value, outcome }: { value: number | null; outcome: string }) {
  if (value === null || outcome === 'NO_DATA') return <td className="rank-td num muted">—</td>;
  const color = value > 0 ? 'var(--green)' : 'var(--red)';
  return (
    <td className="rank-td num" style={{ color, fontWeight: 700 }}>
      {value > 0 ? '+' : ''}{value.toFixed(1)}%
    </td>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function AiPickView({ onSelectStock }: Props) {
  const [data, setData]       = useState<AiPickData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    getAiPick()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="rank-view">
      <div className="div-loading"><div className="spinner" />Loading recommendation…</div>
    </div>
  );

  if (error || !data) return (
    <div className="rank-view">
      <div className="rank-no-data">
        <div style={{ fontSize: 40 }}>📊</div>
        <div className="rank-no-data-title">No pick available yet</div>
        <div className="rank-no-data-sub">
          Run the weekly stock pick action to generate this week's recommendation.<br />
          Go to GitHub Actions → Weekly Stock Pick → Run workflow.
        </div>
      </div>
    </div>
  );

  const r  = data.recommendation;
  const bt = data.backtest;
  const bs = bt.summary;

  const [weekYear, weekNum] = data.week.split('-W');
  const m = r.key_metrics;

  const metrics = [
    { label: 'Dividend Yield',    value: fmt(m.dividend_yield_pct, '%'),    highlight: (m.dividend_yield_pct ?? 0) >= 4 },
    { label: 'P/E Ratio',         value: fmt(m.pe_ratio, 'x'),              highlight: false },
    { label: 'ROE',               value: fmt(m.roe_pct, '%'),               highlight: (m.roe_pct ?? 0) >= 15 },
    { label: '5Y Div Growth',     value: fmt(m.avg_5y_div_growth_pct, '%'), highlight: (m.avg_5y_div_growth_pct ?? 0) >= 10 },
    { label: 'Consistency',       value: fmt(m.consistency_pct, '%', 0),    highlight: (m.consistency_pct ?? 0) >= 80 },
    { label: 'Annual Dividend',   value: m.latest_annual_dividend != null ? `${m.latest_annual_dividend.toFixed(2)} NOK` : '—', highlight: false },
    { label: 'Company Score',     value: m.company_score != null ? `${m.company_score}/100` : '—', highlight: (m.company_score ?? 0) >= 70 },
    { label: 'Dividend Score',    value: m.dividend_score != null ? `${m.dividend_score}/100` : '—', highlight: (m.dividend_score ?? 0) >= 70 },
  ];

  return (
    <div className="rank-view ai-pick-view">

      {/* ── Header ── */}
      <div className="rank-header">
        <div>
          <div className="rank-title">📊 Weekly Stock Pick</div>
          <div className="rank-subtitle">
            Multi-factor model · v{data.model_version} · {data.candidates_scored} stocks scored · Week {weekNum}, {weekYear}
          </div>
        </div>
        <div className="rank-meta-pills">
          <div className="rank-pill">
            <div className="rank-pill-label">Backtest win rate</div>
            <div className="rank-pill-value up">{bs.win_rate_pct.toFixed(0)}%</div>
          </div>
          <div className="rank-pill">
            <div className="rank-pill-label">Avg return</div>
            <div className={`rank-pill-value${(bs.avg_total_return_pct ?? 0) >= 0 ? ' up' : ' down'}`}>
              {bs.avg_total_return_pct != null ? `${bs.avg_total_return_pct > 0 ? '+' : ''}${bs.avg_total_return_pct}%` : '—'}
            </div>
          </div>
          <div className="rank-pill">
            <div className="rank-pill-label">Generated</div>
            <div className="rank-pill-value">{data.generated_at.slice(0, 10)}</div>
          </div>
        </div>
      </div>

      {/* ── Hero ── */}
      <div className="rank-section">
        <div className="ai-hero-card">
          <div className="ai-hero-left">
            <div className="ai-hero-action">{r.action}</div>
            <div className="ai-hero-ticker" onClick={() => onSelectStock(r.ticker)} title="Open stock detail">
              {r.ticker}
            </div>
            <div className="ai-hero-name">{r.name}</div>
            <ConfidenceBadge level={r.confidence} />
            <div className="ai-score-total">
              {r.total_score.toFixed(0)}<span className="ai-score-max">/{r.max_score}</span>
            </div>
          </div>
          <div className="ai-hero-right">
            <div className="ai-hold-row">
              <div className="ai-hold-item">
                <div className="ai-hold-label">Hold period</div>
                <div className="ai-hold-value">{r.hold_period}</div>
              </div>
              <div className="ai-hold-item">
                <div className="ai-hold-label">Expected return</div>
                <div className="ai-hold-value up">{r.estimated_upside}</div>
              </div>
            </div>
            <div className="ai-summary">{r.summary}</div>
          </div>
        </div>
      </div>

      {/* ── Score breakdown ── */}
      <div className="rank-section">
        <div className="rank-section-title">
          Model Score Breakdown
          <span className="div-legend" style={{ fontWeight: 400, fontSize: 11 }}>
            Dividend factors (max 40) + Quality factors (max 30)
          </span>
        </div>
        <div className="ai-score-pillars">
          {(Object.keys(SCORE_LABELS) as (keyof ScoreBreakdown)[]).map((k) => (
            <ScorePillar key={k} label={SCORE_LABELS[k]} score={r.score_breakdown[k]} />
          ))}
        </div>
      </div>

      {/* ── Key metrics ── */}
      <div className="rank-section">
        <div className="rank-section-title">Key Metrics</div>
        <div className="ai-metrics-grid">
          {metrics.map((m) => (
            <MetricChip key={m.label} label={m.label} value={m.value} highlight={m.highlight} />
          ))}
        </div>
      </div>

      {/* ── Reasoning ── */}
      <div className="rank-section">
        <div className="rank-section-title">Analysis</div>
        <div className="ai-reasoning-grid">
          <ReasoningCard title="Dividends"  icon="💰" text={r.reasoning.dividends} />
          <ReasoningCard title="Valuation"  icon="📊" text={r.reasoning.valuation} />
          <ReasoningCard title="Momentum"   icon="📈" text={r.reasoning.momentum}  />
          <ReasoningCard title="Key Risks"  icon="⚠️"  text={r.reasoning.risks}    />
        </div>
      </div>

      {/* ── Backtest ── */}
      <div className="rank-section">
        <div className="rank-section-title">
          Historical Backtest — what would the model have picked each year?
        </div>

        {/* Summary pills */}
        <div className="ai-bt-summary">
          <div className="ai-bt-pill">
            <div className="ai-bt-pill-label">Years tested</div>
            <div className="ai-bt-pill-value">{bs.years_tested}</div>
          </div>
          <div className="ai-bt-pill">
            <div className="ai-bt-pill-label">Wins</div>
            <div className="ai-bt-pill-value up">{bs.wins}/{bs.years_tested}</div>
          </div>
          <div className="ai-bt-pill">
            <div className="ai-bt-pill-label">Win rate</div>
            <div className="ai-bt-pill-value up">{bs.win_rate_pct.toFixed(0)}%</div>
          </div>
          <div className="ai-bt-pill">
            <div className="ai-bt-pill-label">Avg total return</div>
            <div className={`ai-bt-pill-value${(bs.avg_total_return_pct ?? 0) >= 0 ? ' up' : ' down'}`}>
              {bs.avg_total_return_pct != null ? `${bs.avg_total_return_pct > 0 ? '+' : ''}${bs.avg_total_return_pct}%` : '—'}
            </div>
          </div>
          <div className="ai-bt-pill">
            <div className="ai-bt-pill-label">Best year</div>
            <div className="ai-bt-pill-value up">{bs.best_return_pct != null ? `+${bs.best_return_pct}%` : '—'}</div>
          </div>
          <div className="ai-bt-pill">
            <div className="ai-bt-pill-label">Worst year</div>
            <div className={`ai-bt-pill-value${(bs.worst_return_pct ?? 0) >= 0 ? ' up' : ' down'}`}>
              {bs.worst_return_pct != null ? `${bs.worst_return_pct > 0 ? '+' : ''}${bs.worst_return_pct}%` : '—'}
            </div>
          </div>
        </div>

        {/* Picks table */}
        <div className="rank-table-wrap" style={{ marginTop: 12 }}>
          <table className="rank-table">
            <thead>
              <tr>
                <th className="rank-th">Year</th>
                <th className="rank-th left">Pick</th>
                <th className="rank-th left">Company</th>
                <th className="rank-th num">Score</th>
                <th className="rank-th num">Consistency</th>
                <th className="rank-th num">Streak</th>
                <th className="rank-th num">Yield @ pick</th>
                <th className="rank-th num">Entry</th>
                <th className="rank-th num">Exit</th>
                <th className="rank-th num">Div received</th>
                <th className="rank-th num">Price return</th>
                <th className="rank-th num">Div yield</th>
                <th className="rank-th num">Total return</th>
              </tr>
            </thead>
            <tbody>
              {bt.picks.map((p) => (
                <tr
                  key={p.year}
                  className={`rank-row${p.outcome === 'WIN' ? ' bt-win' : p.outcome === 'LOSS' ? ' bt-loss' : ''}`}
                  onClick={() => onSelectStock(p.ticker)}
                  title={`Open ${p.ticker} detail`}
                >
                  <td className="rank-td bold">{p.year}</td>
                  <td className="rank-td bold accent">{p.ticker}</td>
                  <td className="rank-td name-cell">{p.name}</td>
                  <td className="rank-td num">{p.model_score}</td>
                  <td className="rank-td num">{fmt(p.consistency_pct, '%', 0)}</td>
                  <td className="rank-td num">{p.streak}y</td>
                  <td className="rank-td num">{fmt(p.yield_at_pick_pct, '%')}</td>
                  <td className="rank-td num muted">{p.entry_price != null ? `${p.entry_price} NOK` : '—'}</td>
                  <td className="rank-td num muted">{p.exit_price  != null ? `${p.exit_price}  NOK` : '—'}</td>
                  <td className="rank-td num muted">{p.div_received != null ? `${p.div_received} NOK` : '—'}</td>
                  <ReturnCell value={p.price_return_pct}       outcome={p.outcome} />
                  <ReturnCell value={p.div_yield_realized_pct} outcome={p.outcome} />
                  <ReturnCell value={p.total_return_pct}       outcome={p.outcome} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8, lineHeight: 1.5 }}>
          {bt.note}
        </div>
      </div>

      {/* ── Runner-up ── */}
      {data.top5_scores.length > 1 && (
        <div className="rank-section">
          <div className="rank-section-title">Runner-up scores this week</div>
          <div className="ai-metrics-grid">
            {data.top5_scores.map((s, i) => (
              <div
                key={s.ticker}
                className={`ai-metric-chip${i === 0 ? ' highlight' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectStock(s.ticker)}
                title={`Open ${s.ticker}`}
              >
                <div className="ai-metric-label">#{i + 1} {s.ticker}</div>
                <div className="ai-metric-value">{s.score.toFixed(0)}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>/70</span></div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{s.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="div-footer ai-disclaimer">
        <strong>Disclaimer:</strong> This is a quantitative model output, not financial advice.
        Past backtest performance does not guarantee future results.
        Always do your own research before investing. Data as of {r.data_as_of}.
      </div>

    </div>
  );
}
