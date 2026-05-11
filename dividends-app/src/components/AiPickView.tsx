import { useEffect, useState } from 'react';
import { getAiPick, type AiPickData, type AiPickMetrics } from '../lib/aiPickData';

interface Props {
  onSelectStock: (ticker: string) => void;
}

function ConfidenceBadge({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const colors: Record<string, string> = {
    HIGH:   'var(--green)',
    MEDIUM: 'var(--accent)',
    LOW:    '#f59e0b',
  };
  return (
    <span className="ai-confidence-badge" style={{ background: colors[level] ?? 'var(--accent)' }}>
      {level} CONFIDENCE
    </span>
  );
}

function MetricChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`ai-metric-chip${highlight ? ' highlight' : ''}`}>
      <div className="ai-metric-label">{label}</div>
      <div className="ai-metric-value">{value}</div>
    </div>
  );
}

function ReasoningCard({ title, icon, text }: { title: string; icon: string; text: string }) {
  return (
    <div className="ai-reasoning-card">
      <div className="ai-reasoning-title">
        <span className="ai-reasoning-icon">{icon}</span>
        {title}
      </div>
      <p className="ai-reasoning-text">{text}</p>
    </div>
  );
}

function fmt(v: number | null, suffix = '', decimals = 1): string {
  if (v === null || v === undefined) return '—';
  return `${v.toFixed(decimals)}${suffix}`;
}

function buildMetrics(m: AiPickMetrics) {
  return [
    { label: 'Dividend Yield',    value: fmt(m.dividend_yield_pct, '%'),    highlight: (m.dividend_yield_pct ?? 0) >= 4 },
    { label: 'P/E Ratio',         value: fmt(m.pe_ratio, 'x'),              highlight: false },
    { label: 'ROE',               value: fmt(m.roe_pct, '%'),               highlight: (m.roe_pct ?? 0) >= 15 },
    { label: '5Y Div Growth',     value: fmt(m.avg_5y_div_growth_pct, '%'), highlight: (m.avg_5y_div_growth_pct ?? 0) >= 10 },
    { label: 'Consistency',       value: fmt(m.consistency_pct, '%', 0),    highlight: (m.consistency_pct ?? 0) >= 80 },
    { label: 'Annual Dividend',   value: m.latest_annual_dividend != null ? `${m.latest_annual_dividend.toFixed(2)} NOK` : '—', highlight: false },
    { label: 'Company Score',     value: m.company_score != null ? `${m.company_score}/100` : '—', highlight: (m.company_score ?? 0) >= 70 },
    { label: 'Dividend Score',    value: m.dividend_score != null ? `${m.dividend_score}/100` : '—', highlight: (m.dividend_score ?? 0) >= 70 },
  ];
}

export function AiPickView({ onSelectStock }: Props) {
  const [data, setData]     = useState<AiPickData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    getAiPick()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="rank-view">
      <div className="div-loading"><div className="spinner" />Loading AI recommendation…</div>
    </div>
  );

  if (error || !data) return (
    <div className="rank-view">
      <div className="rank-no-data">
        <div style={{ fontSize: 40 }}>🤖</div>
        <div className="rank-no-data-title">No AI recommendation yet</div>
        <div className="rank-no-data-sub">
          Run the weekly AI pick action to generate this week's recommendation.<br />
          Requires dividend and financial data, plus an Anthropic API key.
        </div>
      </div>
    </div>
  );

  const r = data.recommendation;
  const metrics = buildMetrics(r.key_metrics);

  // Parse week label e.g. "2026-W19" → "Week 19, 2026"
  const [weekYear, weekNum] = data.week.split('-W');
  const weekLabel = `Week ${weekNum}, ${weekYear}`;

  return (
    <div className="rank-view ai-pick-view">

      {/* ── Header ── */}
      <div className="rank-header">
        <div>
          <div className="rank-title">🤖 Weekly AI Pick</div>
          <div className="rank-subtitle">
            Claude analyses all Oslo Børs dividend and financial data every Sunday to find the best risk-adjusted buy
          </div>
        </div>
        <div className="rank-meta-pills">
          <div className="rank-pill">
            <div className="rank-pill-label">Period</div>
            <div className="rank-pill-value">{weekLabel}</div>
          </div>
          <div className="rank-pill">
            <div className="rank-pill-label">Stocks analysed</div>
            <div className="rank-pill-value">{data.candidates_analyzed}</div>
          </div>
          <div className="rank-pill">
            <div className="rank-pill-label">Generated</div>
            <div className="rank-pill-value">{data.generated_at.slice(0, 10)}</div>
          </div>
        </div>
      </div>

      {/* ── Hero card ── */}
      <div className="rank-section">
        <div className="ai-hero-card">
          <div className="ai-hero-left">
            <div className="ai-hero-action">{r.action}</div>
            <div
              className="ai-hero-ticker"
              onClick={() => onSelectStock(r.ticker)}
              title="Open stock detail"
            >
              {r.ticker}
            </div>
            <div className="ai-hero-name">{r.name}</div>
            <ConfidenceBadge level={r.confidence} />
          </div>
          <div className="ai-hero-right">
            <div className="ai-hold-row">
              <div className="ai-hold-item">
                <div className="ai-hold-label">Hold period</div>
                <div className="ai-hold-value">{r.hold_period}</div>
              </div>
              <div className="ai-hold-item">
                <div className="ai-hold-label">Estimated return</div>
                <div className="ai-hold-value up">{r.estimated_upside}</div>
              </div>
            </div>
            <div className="ai-summary">{r.summary}</div>
          </div>
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

      {/* ── Footer ── */}
      <div className="div-footer ai-disclaimer">
        <strong>Disclaimer:</strong> This recommendation is generated by an AI model (Claude {data.model}) using historical and publicly available data.
        It is <strong>not</strong> financial advice. Always do your own research before investing.
        Data as of {r.data_as_of} · Generated {data.generated_at}
      </div>

    </div>
  );
}
