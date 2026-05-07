import { useEffect, useState } from 'react';
import {
  getCompanyRank,
  fmtMetric,
  scoreTier,
  SCORE_LABELS,
  type CompanyRankEntry,
  type ScoreBreakdown,
} from '../lib/rankingData';
import { fmtLargeNumber } from '../lib/financialData';

interface Props {
  onSelectStock: (ticker: string) => void;
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min((score / max) * 100, 100);
  const color = pct >= 65 ? 'var(--green)' : pct >= 40 ? 'var(--accent)' : '#f59e0b';
  return (
    <div className="co-score-bar-wrap">
      <div className="co-score-bar-track">
        <div className="co-score-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="co-score-num" style={{ color }}>{score}</span>
    </div>
  );
}

// ─── Score detail popup ───────────────────────────────────────────────────────

function ScoreDetail({ scores }: { scores: ScoreBreakdown }) {
  const keys = Object.keys(scores) as (keyof ScoreBreakdown)[];
  return (
    <div className="co-score-detail">
      {keys.map((k) => {
        const tier = scoreTier(scores[k]);
        return (
          <div key={k} className="co-score-detail-row">
            <span className="co-score-detail-label">{SCORE_LABELS[k]}</span>
            <div className="co-score-detail-bar-wrap">
              <div
                className="co-score-detail-bar"
                style={{
                  width: `${scores[k] * 10}%`,
                  background: tier === 'high' ? 'var(--green)' : tier === 'mid' ? 'var(--accent)' : '#f59e0b',
                }}
              />
            </div>
            <span className="co-score-detail-num">{scores[k]}/10</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function CompanyRankView({ onSelectStock }: Props) {
  const [data, setData]         = useState<Awaited<ReturnType<typeof getCompanyRank>>>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    getCompanyRank()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="rank-view">
      <div className="div-loading"><div className="spinner" />Loading company rankings…</div>
    </div>
  );

  if (error || !data) return (
    <div className="rank-view">
      <div className="rank-no-data">
        <div style={{ fontSize: 36 }}>🏆</div>
        <div className="rank-no-data-title">Company rankings not available yet</div>
        <div className="rank-no-data-sub">
          Run the daily rankings action to generate this data.<br />
          Requires financial data from the weekly financials fetch.
        </div>
      </div>
    </div>
  );

  const top = data.rankings[0];
  const avgScore = data.rankings.slice(0, 10).reduce((s, r) => s + r.score, 0) / Math.min(data.rankings.length, 10);

  return (
    <div className="rank-view">
      {/* ── Header ── */}
      <div className="rank-header">
        <div>
          <div className="rank-title">Company Ranking</div>
          <div className="rank-subtitle">
            Composite score across 10 metrics: momentum, value, quality, growth, stability & dividend health
          </div>
        </div>
        <div className="rank-meta-pills">
          <div className="rank-pill">
            <div className="rank-pill-label">Companies ranked</div>
            <div className="rank-pill-value">{data.count}</div>
          </div>
          <div className="rank-pill">
            <div className="rank-pill-label">Top score</div>
            <div className="rank-pill-value up">{top?.score ?? '—'}/100</div>
          </div>
          <div className="rank-pill">
            <div className="rank-pill-label">Avg score (top 10)</div>
            <div className="rank-pill-value">{avgScore.toFixed(0)}/100</div>
          </div>
          <div className="rank-pill">
            <div className="rank-pill-label">Updated</div>
            <div className="rank-pill-value">{data.generated_at.slice(0, 10)}</div>
          </div>
        </div>
      </div>

      {/* ── Scoring legend ── */}
      <div className="rank-section">
        <div className="rank-section-title">Scoring Criteria (10 metrics, max 10 pts each = 100 total)</div>
        <div className="co-legend-grid">
          {(Object.entries(SCORE_LABELS) as [string, string][]).map(([k, label]) => (
            <div key={k} className="co-legend-item">
              <span className="co-legend-dot" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="rank-section">
        <div className="rank-section-title">
          Rankings — click a row to expand scores, click ticker to view stock
        </div>
        <div className="rank-table-wrap">
          <table className="rank-table">
            <thead>
              <tr>
                <th className="rank-th">#</th>
                <th className="rank-th left">Ticker</th>
                <th className="rank-th left">Company</th>
                <th className="rank-th" style={{ minWidth: 140 }}>Score / 100</th>
                <th className="rank-th num">P/E</th>
                <th className="rank-th num">ROE</th>
                <th className="rank-th num">Margin</th>
                <th className="rank-th num">Rev Grw</th>
                <th className="rank-th num">D/E</th>
                <th className="rank-th num">Beta</th>
                <th className="rank-th num">vs 200D</th>
                <th className="rank-th num">Mkt Cap</th>
              </tr>
            </thead>
            <tbody>
              {data.rankings.map((row: CompanyRankEntry) => {
                const m   = row.metrics;
                const isOpen = expanded === row.ticker;
                return (
                  <>
                    <tr
                      key={row.ticker}
                      className={`rank-row${isOpen ? ' rank-row-open' : ''}`}
                      onClick={() => setExpanded(isOpen ? null : row.ticker)}
                    >
                      <td className="rank-td muted">{row.rank}</td>
                      <td
                        className="rank-td bold accent"
                        onClick={(e) => { e.stopPropagation(); onSelectStock(row.ticker); }}
                        title="Open stock detail"
                        style={{ cursor: 'pointer' }}
                      >
                        {row.ticker}
                      </td>
                      <td className="rank-td name-cell">{row.name}</td>
                      <td className="rank-td">
                        <ScoreBar score={row.score} />
                      </td>
                      <td className="rank-td num">{fmtMetric(m.pe, 'x')}</td>
                      <td className={`rank-td num ${m.roe !== null ? (m.roe >= 15 ? 'up' : m.roe < 0 ? 'down' : '') : ''}`}>
                        {fmtMetric(m.roe, '%')}
                      </td>
                      <td className={`rank-td num ${m.profit_margin !== null ? (m.profit_margin >= 10 ? 'up' : m.profit_margin < 0 ? 'down' : '') : ''}`}>
                        {fmtMetric(m.profit_margin, '%')}
                      </td>
                      <td className={`rank-td num ${m.revenue_growth !== null ? (m.revenue_growth > 0 ? 'up' : 'down') : ''}`}>
                        {m.revenue_growth !== null ? `${m.revenue_growth > 0 ? '+' : ''}${m.revenue_growth.toFixed(1)}%` : '—'}
                      </td>
                      <td className={`rank-td num ${m.debt_to_equity !== null ? (m.debt_to_equity < 50 ? 'up' : m.debt_to_equity > 150 ? 'down' : '') : ''}`}>
                        {fmtMetric(m.debt_to_equity, '', 0)}
                      </td>
                      <td className="rank-td num">{fmtMetric(m.beta)}</td>
                      <td className={`rank-td num ${m.price_vs_200d !== null ? (m.price_vs_200d > 0 ? 'up' : 'down') : ''}`}>
                        {m.price_vs_200d !== null ? `${m.price_vs_200d > 0 ? '+' : ''}${m.price_vs_200d.toFixed(1)}%` : '—'}
                      </td>
                      <td className="rank-td num muted">{fmtLargeNumber(m.market_cap)}</td>
                    </tr>
                    {isOpen && (
                      <tr key={`${row.ticker}-detail`} className="rank-row-detail">
                        <td colSpan={12} style={{ padding: '0 16px 12px 48px' }}>
                          <div className="co-detail-title">Score breakdown for {row.ticker}</div>
                          <ScoreDetail scores={row.scores} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="div-footer" style={{ padding: '12px 24px 0' }}>
        Rankings generated: {data.generated_at} · Click ticker to view full stock detail · Click row to expand score breakdown
      </div>
    </div>
  );
}
