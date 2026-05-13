import { useEffect, useState } from 'react';
import { getAiPick, type AiPickData, type ScoreBreakdown, type EquityCurvePoint, type Trade } from '../lib/aiPickData';

interface Props { onSelectStock: (ticker: string) => void; }

// ─── Score pillar ─────────────────────────────────────────────────────────────

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

// ─── Equity curve SVG ─────────────────────────────────────────────────────────

function EquityCurve({ curve }: { curve: EquityCurvePoint[] }) {
  if (curve.length < 2) return null;
  const W = 700, H = 160, PAD = { t: 12, r: 12, b: 28, l: 44 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const values = curve.map(p => p.value);
  const minV   = Math.min(...values);
  const maxV   = Math.max(...values);
  const range  = maxV - minV || 1;

  const xOf = (i: number) => PAD.l + (i / (curve.length - 1)) * iW;
  const yOf = (v: number) => PAD.t + iH - ((v - minV) / range) * iH;

  const points = curve.map((p, i) => `${xOf(i)},${yOf(p.value)}`).join(' ');
  const area   = `M${PAD.l},${PAD.t + iH} ` +
                 curve.map((p, i) => `L${xOf(i)},${yOf(p.value)}`).join(' ') +
                 ` L${PAD.l + iW},${PAD.t + iH} Z`;

  const finalVal  = values[values.length - 1];
  const lineColor = finalVal >= 100 ? 'var(--green)' : 'var(--red)';

  // Tick labels
  const ticks = [minV, 100, maxV].filter((v, i, arr) => arr.indexOf(v) === i);

  // Date labels: first and last
  const fmt = (d: string) => d.slice(0, 7);

  return (
    <div className="ai-equity-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="ai-equity-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ecGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Baseline at 100 */}
        <line
          x1={PAD.l} y1={yOf(100)} x2={PAD.l + iW} y2={yOf(100)}
          stroke="var(--border)" strokeDasharray="4 3" strokeWidth={1}
        />
        {/* Area fill */}
        <path d={area} fill="url(#ecGrad)" />
        {/* Line */}
        <polyline points={points} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" />
        {/* Y ticks */}
        {ticks.map(v => (
          <g key={v}>
            <line x1={PAD.l - 4} y1={yOf(v)} x2={PAD.l} y2={yOf(v)} stroke="var(--text-tertiary)" strokeWidth={1} />
            <text x={PAD.l - 6} y={yOf(v) + 4} textAnchor="end" fontSize={9} fill="var(--text-tertiary)">{v.toFixed(0)}</text>
          </g>
        ))}
        {/* X labels */}
        <text x={PAD.l} y={H - 4} fontSize={9} fill="var(--text-tertiary)">{fmt(curve[0].date)}</text>
        <text x={PAD.l + iW} y={H - 4} textAnchor="end" fontSize={9} fill="var(--text-tertiary)">{fmt(curve[curve.length - 1].date)}</text>
      </svg>
      <div className="ai-equity-stat">
        <span style={{ color: finalVal >= 100 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
          {finalVal >= 100 ? '+' : ''}{(finalVal - 100).toFixed(1)}%
        </span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}> total return (simulated, base 100)</span>
      </div>
    </div>
  );
}

// ─── Trades table ─────────────────────────────────────────────────────────────

function TradesTable({ trades, onSelectStock }: { trades: Trade[]; onSelectStock: (t: string) => void }) {
  if (!trades.length) return null;
  const rows = [...trades].reverse(); // newest first
  return (
    <div className="rank-table-wrap">
      <table className="rank-table">
        <thead>
          <tr>
            <th className="rank-th">Date</th>
            <th className="rank-th">Action</th>
            <th className="rank-th left">Ticker</th>
            <th className="rank-th num">Price (NOK)</th>
            <th className="rank-th num">Return</th>
            <th className="rank-th left">Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => {
            const isSell = t.action === 'SELL';
            const ret    = t.return_pct ?? null;
            const win    = ret !== null && ret >= 0;
            return (
              <tr
                key={i}
                className={`rank-row${isSell ? (win ? ' bt-win' : ' bt-loss') : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectStock(t.ticker)}
              >
                <td className="rank-td muted">{t.date}</td>
                <td className="rank-td bold" style={{ color: isSell ? (win ? 'var(--green)' : 'var(--red)') : 'var(--accent)' }}>
                  {t.action}
                </td>
                <td className="rank-td bold accent">{t.ticker}</td>
                <td className="rank-td num">{t.price?.toFixed(2)}</td>
                <td className="rank-td num" style={{ color: ret === null ? undefined : ret >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: ret !== null ? 700 : undefined }}>
                  {ret !== null ? `${ret > 0 ? '+' : ''}${ret.toFixed(1)}%` : '—'}
                </td>
                <td className="rank-td muted" style={{ fontSize: 11 }}>{t.exit_reason ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, suffix = '', dec = 1) {
  if (v == null) return '—';
  return `${v.toFixed(dec)}${suffix}`;
}

// ─── Position card ────────────────────────────────────────────────────────────

function PositionCard({ pos, onSelectStock }: { pos: NonNullable<AiPickData['recommendation']['position']>; onSelectStock: (t: string) => void }) {
  const pctColor = pos.unrealized_pct >= 0 ? 'var(--green)' : 'var(--red)';
  return (
    <div className="ai-position-card">
      <div className="ai-position-header">Current Position</div>
      <div className="ai-position-row">
        <div className="ai-position-ticker" onClick={() => onSelectStock(pos.ticker)} title="Open stock detail">
          {pos.ticker}
        </div>
        <div className="ai-position-pct" style={{ color: pctColor }}>
          {pos.unrealized_pct > 0 ? '+' : ''}{pos.unrealized_pct.toFixed(1)}%
        </div>
      </div>
      <div className="ai-position-grid">
        <div className="ai-position-item">
          <div className="ai-position-item-label">Entry price</div>
          <div className="ai-position-item-value">{pos.entry_price?.toFixed(2)} NOK</div>
        </div>
        <div className="ai-position-item">
          <div className="ai-position-item-label">Current price</div>
          <div className="ai-position-item-value">{pos.current_price?.toFixed(2)} NOK</div>
        </div>
        <div className="ai-position-item">
          <div className="ai-position-item-label">Entry date</div>
          <div className="ai-position-item-value">{pos.entry_date}</div>
        </div>
        <div className="ai-position-item">
          <div className="ai-position-item-label">Weeks held</div>
          <div className="ai-position-item-value">{pos.weeks_held}w</div>
        </div>
        <div className="ai-position-item">
          <div className="ai-position-item-label">Take profit</div>
          <div className="ai-position-item-value" style={{ color: 'var(--green)' }}>
            {pos.take_profit_at != null ? `${pos.take_profit_at.toFixed(2)} NOK` : '—'}
          </div>
        </div>
        <div className="ai-position-item">
          <div className="ai-position-item-label">Stop loss</div>
          <div className="ai-position-item-value" style={{ color: 'var(--red)' }}>
            {pos.stop_loss_at != null ? `${pos.stop_loss_at.toFixed(2)} NOK` : '—'}
          </div>
        </div>
      </div>
    </div>
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

  const r   = data.recommendation;
  const bt  = data.backtest;
  const bs  = bt.summary;
  const pos = r.position;
  const ex  = r.exit_signal;
  const er  = data.exit_rules;

  const [weekYear, weekNum] = data.week.split('-W');
  const m = r.key_metrics;

  const isHold = r.action === 'HOLD';
  const isBuy  = r.action === 'BUY';

  const actionColor = isHold ? 'var(--accent)' : isBuy ? 'var(--green)' : 'var(--accent)';

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
            <div className="rank-pill-label">Backtest return</div>
            <div className={`rank-pill-value${(bs.total_return_pct ?? 0) >= 0 ? ' up' : ' down'}`}>
              {bs.total_return_pct != null ? `${bs.total_return_pct > 0 ? '+' : ''}${bs.total_return_pct}%` : '—'}
            </div>
          </div>
          <div className="rank-pill">
            <div className="rank-pill-label">Win rate</div>
            <div className="rank-pill-value up">{bs.win_rate_pct != null ? `${bs.win_rate_pct.toFixed(0)}%` : '—'}</div>
          </div>
          <div className="rank-pill">
            <div className="rank-pill-label">Generated</div>
            <div className="rank-pill-value">{data.generated_at.slice(0, 10)}</div>
          </div>
        </div>
      </div>

      {/* ── Exit signal banner ── */}
      {ex && (
        <div className="rank-section">
          <div className="ai-exit-banner">
            <span className="ai-exit-icon">🔄</span>
            <div>
              <div className="ai-exit-title">Exited {ex.prev_ticker}</div>
              <div className="ai-exit-detail">
                {ex.return_pct > 0 ? '+' : ''}{ex.return_pct.toFixed(1)}% — {ex.reason}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      <div className="rank-section">
        <div className="ai-hero-card">
          <div className="ai-hero-left">
            <div className="ai-hero-action" style={{ background: actionColor }}>{r.action}</div>
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
                <div className="ai-hold-label">Hold strategy</div>
                <div className="ai-hold-value" style={{ fontSize: 13 }}>{r.hold_period}</div>
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

      {/* ── Current position card (HOLD / SELL_BUY) ── */}
      {pos && (
        <div className="rank-section">
          <PositionCard pos={pos} onSelectStock={onSelectStock} />
        </div>
      )}

      {/* ── Exit rules ── */}
      {er && (
        <div className="rank-section">
          <div className="rank-section-title">Exit Rules</div>
          <div className="ai-exit-rules">
            <div className="ai-exit-rule">
              <span className="ai-exit-rule-icon" style={{ color: 'var(--green)' }}>✓</span>
              Take profit at <strong>+{er.take_profit_pct}%</strong>
            </div>
            <div className="ai-exit-rule">
              <span className="ai-exit-rule-icon" style={{ color: 'var(--red)' }}>✗</span>
              Stop loss at <strong>−{er.stop_loss_pct}%</strong>
            </div>
            <div className="ai-exit-rule">
              <span className="ai-exit-rule-icon" style={{ color: 'var(--accent)' }}>↻</span>
              Rotate if best alt scores <strong>{er.rotation_gap}+ pts</strong> higher
            </div>
            <div className="ai-exit-rule">
              <span className="ai-exit-rule-icon" style={{ color: 'var(--text-tertiary)' }}>⏱</span>
              Min hold <strong>{er.min_hold_weeks} weeks</strong>
            </div>
          </div>
        </div>
      )}

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

      {/* ── Backtest equity curve ── */}
      <div className="rank-section">
        <div className="rank-section-title">
          Backtest — simulated equity curve (~2 years of weekly signals)
        </div>
        <EquityCurve curve={bt.equity_curve} />

        {/* Summary pills */}
        <div className="ai-bt-summary" style={{ marginTop: 16 }}>
          <div className="ai-bt-pill">
            <div className="ai-bt-pill-label">Total return</div>
            <div className={`ai-bt-pill-value${(bs.total_return_pct ?? 0) >= 0 ? ' up' : ' down'}`}>
              {bs.total_return_pct != null ? `${bs.total_return_pct > 0 ? '+' : ''}${bs.total_return_pct}%` : '—'}
            </div>
          </div>
          <div className="ai-bt-pill">
            <div className="ai-bt-pill-label">Win rate</div>
            <div className="ai-bt-pill-value up">{bs.win_rate_pct != null ? `${bs.win_rate_pct.toFixed(0)}%` : '—'}</div>
          </div>
          <div className="ai-bt-pill">
            <div className="ai-bt-pill-label">Total trades</div>
            <div className="ai-bt-pill-value">{bs.total_trades ?? '—'}</div>
          </div>
          <div className="ai-bt-pill">
            <div className="ai-bt-pill-label">Max drawdown</div>
            <div className="ai-bt-pill-value down">
              {bs.max_drawdown_pct != null ? `${bs.max_drawdown_pct.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div className="ai-bt-pill">
            <div className="ai-bt-pill-label">Start</div>
            <div className="ai-bt-pill-value">{bs.start_date?.slice(0, 10) ?? '—'}</div>
          </div>
          <div className="ai-bt-pill">
            <div className="ai-bt-pill-label">End</div>
            <div className="ai-bt-pill-value">{bs.end_date?.slice(0, 10) ?? '—'}</div>
          </div>
        </div>
      </div>

      {/* ── Trade history ── */}
      {bt.trades.length > 0 && (
        <div className="rank-section">
          <div className="rank-section-title">Trade History</div>
          <TradesTable trades={bt.trades} onSelectStock={onSelectStock} />
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8, lineHeight: 1.5 }}>
            {bt.note}
          </div>
        </div>
      )}

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
        Backtest results use simulated weekly signals and do not account for trading costs or slippage.
        Always do your own research before investing. Data as of {r.data_as_of}.
      </div>

    </div>
  );
}
