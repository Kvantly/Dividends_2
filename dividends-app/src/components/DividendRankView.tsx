import { useEffect, useRef, useState, type JSX } from 'react';
import { getDividendRank, fmtGrowth, type DividendRankEntry } from '../lib/rankingData';

interface Props {
  onSelectStock: (ticker: string) => void;
}

// ─── Horizontal bar chart (top N companies) ──────────────────────────────────

function GrowthBarChart({ data }: { data: DividendRankEntry[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((e) => setWidth(e[0].contentRect.width));
    ro.observe(containerRef.current);
    setWidth(containerRef.current.clientWidth);
    return () => ro.disconnect();
  }, []);

  const top = data.slice(0, 15);
  if (top.length === 0) return null;

  const maxGrowth = Math.max(...top.map((d) => d.avg_growth_5y), 1);
  const rowH      = 28;
  const padLeft   = 64;
  const padRight  = 60;
  const padTop    = 12;
  const padBottom = 16;
  const chartW    = Math.max(width - padLeft - padRight, 10);
  const height    = padTop + top.length * rowH + padBottom;

  return (
    <div ref={containerRef} className="div-barchart-wrap">
      <svg width={width} height={height} style={{ display: 'block' }}>
        {top.map((d, i) => {
          const barW = (d.avg_growth_5y / maxGrowth) * chartW;
          const y    = padTop + i * rowH;
          const fill = d.consistency_pct >= 80 ? 'var(--green)'
                     : d.consistency_pct >= 60 ? 'var(--accent)'
                     : '#f59e0b';
          return (
            <g key={d.ticker} style={{ cursor: 'pointer' }}>
              {/* Ticker label */}
              <text x={padLeft - 6} y={y + rowH * 0.62}
                textAnchor="end" fontSize={11} fontWeight={700} fill="var(--text)">
                {d.ticker}
              </text>
              {/* Background track */}
              <rect x={padLeft} y={y + 6} width={chartW} height={rowH - 12}
                fill="var(--bg-tertiary)" rx={3} />
              {/* Value bar */}
              <rect x={padLeft} y={y + 6} width={barW} height={rowH - 12}
                fill={fill} rx={3} opacity={0.85} />
              {/* Value label */}
              <text x={padLeft + barW + 6} y={y + rowH * 0.62}
                fontSize={11} fontWeight={600} fill="var(--text-secondary)">
                {fmtGrowth(d.avg_growth_5y)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Growth cell coloring ─────────────────────────────────────────────────────

function GrowthCell({ value }: { value: number | null }) {
  if (value === null) return <td className="rank-td num muted">—</td>;
  const cls = value > 10 ? 'up strong' : value > 0 ? 'up' : value < 0 ? 'down' : '';
  return <td className={`rank-td num ${cls}`}>{fmtGrowth(value)}</td>;
}

function YieldCell({ value }: { value: number | null }) {
  if (value === null) return <td className="rank-td num muted">—</td>;
  const cls = value >= 5 ? 'up strong' : value >= 2 ? 'up' : '';
  return <td className={`rank-td num ${cls}`}>{value.toFixed(1)}%</td>;
}

function YieldGrowthCell({ value }: { value: number | null }) {
  if (value === null) return <td className="rank-td num muted">—</td>;
  if (value > 0) return (
    <td className="rank-td num" style={{ color: 'var(--green)', fontWeight: 600 }}>
      +{value.toFixed(1)}%
    </td>
  );
  return (
    <td className="rank-td num" style={{ color: 'var(--red)', fontWeight: 600 }}>
      {value.toFixed(1)}%
    </td>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

type RankMode = 'composite' | 'yield' | 'yield_growth';

export function DividendRankView({ onSelectStock }: Props) {
  const [data, setData]         = useState<ReturnType<typeof getDividendRank> extends Promise<infer T> ? T : never>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [yearMode, setYearMode] = useState<'growth' | 'yield' | 'yield_growth'>('growth');
  const [rankMode, setRankMode] = useState<RankMode>('composite');

  useEffect(() => {
    getDividendRank()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Collect all years present in the data for column headers
  const allYears = (() => {
    if (!data) return [];
    const s = new Set<string>();
    data.rankings.forEach((r) => r.yearly.forEach((y) => s.add(y.year)));
    return Array.from(s).sort();
  })();

  // Re-sort a copy of the rankings according to the selected rank mode
  const sortedRankings = (() => {
    if (!data) return [];
    const copy = [...data.rankings];
    if (rankMode === 'yield') {
      copy.sort((a, b) => (b.latest_yield ?? -1) - (a.latest_yield ?? -1));
    } else if (rankMode === 'yield_growth') {
      copy.sort((a, b) => (b.yield_composite_score ?? 0) - (a.yield_composite_score ?? 0));
    }
    // 'composite' keeps the original server-side order
    return copy.map((r, i) => ({ ...r, rank: i + 1 }));
  })();

  if (loading) return (
    <div className="rank-view">
      <div className="div-loading"><div className="spinner" />Loading dividend rankings…</div>
    </div>
  );

  if (error || !data) return (
    <div className="rank-view">
      <div className="rank-no-data">
        <div style={{ fontSize: 36 }}>💰</div>
        <div className="rank-no-data-title">Dividend rankings not available yet</div>
        <div className="rank-no-data-sub">
          Run the daily rankings action to generate this data.<br />
          Requires dividend data from the weekly dividend fetch.
        </div>
      </div>
    </div>
  );

  const top10 = sortedRankings.slice(0, 10);
  const avgGrowth = top10.length
    ? (top10.reduce((s, r) => s + r.avg_growth_5y, 0) / top10.length).toFixed(1)
    : '—';

  return (
    <div className="rank-view">
      {/* ── Header ── */}
      <div className="rank-header">
        <div>
          <div className="rank-title">Dividend Growth Ranking</div>
          <div className="rank-subtitle">
            Ranked by stable, compounding dividend growth — must be at all-time high dividend with majority of years showing increases
          </div>
        </div>
        <div className="rank-meta-pills">
          <div className="rank-pill">
            <div className="rank-pill-label">Companies ranked</div>
            <div className="rank-pill-value">{data.count}</div>
          </div>
          <div className="rank-pill">
            <div className="rank-pill-label">Avg growth (top 10)</div>
            <div className="rank-pill-value up">{avgGrowth}%</div>
          </div>
          <div className="rank-pill">
            <div className="rank-pill-label">Updated</div>
            <div className="rank-pill-value">{data.generated_at.slice(0, 10)}</div>
          </div>
        </div>
      </div>

      {/* ── Scoring methodology ── */}
      <div className="rank-section">
        <div className="rank-section-title">
          How companies are scored
          <span className="div-legend" style={{ fontWeight: 400, fontSize: 11 }}>
            Only companies at their all-time dividend high qualify
          </span>
        </div>
        <div className="co-legend-grid">
          <div className="co-legend-item"><span className="co-legend-dot" /><span>35% Consistency — % of years with positive growth</span></div>
          <div className="co-legend-item"><span className="co-legend-dot" /><span>30% Stability — smooth, predictable growth (low variance)</span></div>
          <div className="co-legend-item"><span className="co-legend-dot" /><span>25% Recency — avg growth in the last 2 years</span></div>
          <div className="co-legend-item"><span className="co-legend-dot" /><span>10% Streak — current unbroken run of increases</span></div>
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="rank-section">
        <div className="rank-section-title">
          Top 15 by Composite Score
          <span className="div-legend">
            <span className="div-legend-dot" style={{ background: 'var(--green)' }} /> ≥80% consistent
            <span className="div-legend-dot" style={{ background: 'var(--accent)' }} /> ≥60%
            <span className="div-legend-dot" style={{ background: '#f59e0b' }} /> &lt;60%
          </span>
        </div>
        <GrowthBarChart data={sortedRankings} />
      </div>

      {/* ── Table ── */}
      <div className="rank-section">
        <div className="rank-section-title" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>Rank by</span>
            <div className="div-mode-toggle">
              <button
                className={`div-mode-btn${rankMode === 'composite' ? ' active' : ''}`}
                onClick={() => setRankMode('composite')}
              >
                Div Growth
              </button>
              <button
                className={`div-mode-btn${rankMode === 'yield' ? ' active' : ''}`}
                onClick={() => setRankMode('yield')}
              >
                Highest Yield
              </button>
              <button
                className={`div-mode-btn${rankMode === 'yield_growth' ? ' active' : ''}`}
                onClick={() => setRankMode('yield_growth')}
              >
                Yield Growth
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>Show years as</span>
            <div className="div-mode-toggle">
            <button
              className={`div-mode-btn${yearMode === 'growth' ? ' active' : ''}`}
              onClick={() => setYearMode('growth')}
            >
              Div Growth %
            </button>
            <button
              className={`div-mode-btn${yearMode === 'yield' ? ' active' : ''}`}
              onClick={() => setYearMode('yield')}
            >
              Yield %
            </button>
            <button
              className={`div-mode-btn${yearMode === 'yield_growth' ? ' active' : ''}`}
              onClick={() => setYearMode('yield_growth')}
            >
              Yield Growth %
            </button>
          </div>
          </div>
        </div>
        <div className="rank-table-wrap">
          <table className="rank-table">
            <thead>
              <tr>
                <th className="rank-th">#</th>
                <th className="rank-th left">Ticker</th>
                <th className="rank-th left">Company</th>
                <th className="rank-th num">
                  {rankMode === 'composite' ? 'Div Score' : rankMode === 'yield' ? 'Yield %' : 'Yield Score'}
                </th>
                <th className="rank-th num">Avg 5Y Growth</th>
                <th className="rank-th num">Consistency</th>
                <th className="rank-th num">Streak</th>
                <th className="rank-th num">Yrs</th>
                {allYears.map((y) => (
                  <th key={y} className="rank-th num">{y}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRankings.map((row) => {
                const growthByYear:      Record<string, number | null> = {};
                const yieldByYear:       Record<string, number | null> = {};
                const yieldGrowthByYear: Record<string, number | null> = {};
                row.yearly.forEach((y) => {
                  growthByYear[y.year]      = y.growth_pct;
                  yieldByYear[y.year]       = y.yield_pct;
                  yieldGrowthByYear[y.year] = y.yield_growth_pct;
                });

                const yearCells: JSX.Element[] = allYears.map((y) => {
                  if (yearMode === 'growth')       return <GrowthCell      key={y} value={growthByYear[y]      ?? null} />;
                  if (yearMode === 'yield')        return <YieldCell       key={y} value={yieldByYear[y]       ?? null} />;
                  return                                  <YieldGrowthCell key={y} value={yieldGrowthByYear[y] ?? null} />;
                });

                return (
                  <tr
                    key={row.ticker}
                    className="rank-row"
                    onClick={() => onSelectStock(row.ticker)}
                    title={`Open ${row.ticker} detail`}
                  >
                    <td className="rank-td muted">{row.rank}</td>
                    <td className="rank-td bold accent">{row.ticker}</td>
                    <td className="rank-td name-cell">{row.name}</td>
                    <td className="rank-td num bold">
                      {rankMode === 'yield' ? (
                        <span className={row.latest_yield !== null && row.latest_yield >= 5 ? 'up strong' : row.latest_yield !== null && row.latest_yield >= 2 ? 'up' : ''}>
                          {row.latest_yield !== null ? `${row.latest_yield.toFixed(1)}%` : '—'}
                        </span>
                      ) : (() => {
                        const sc = rankMode === 'yield_growth' ? (row.yield_composite_score ?? 0) : (row.composite_score ?? 0);
                        const color = sc >= 65 ? 'var(--green)' : sc >= 45 ? 'var(--accent)' : '#f59e0b';
                        return <span style={{ color }}>{sc.toFixed(0)}</span>;
                      })()}
                    </td>
                    <td className="rank-td num up">{fmtGrowth(row.avg_growth_5y)}</td>
                    <td className="rank-td num">
                      <span className={row.consistency_pct >= 80 ? 'up' : row.consistency_pct >= 60 ? '' : 'down'}>
                        {row.consistency_pct.toFixed(0)}%
                      </span>
                    </td>
                    <td className="rank-td num">{row.streak}y</td>
                    <td className="rank-td num muted">{row.years_in_window}</td>
                    {yearCells}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="div-footer" style={{ padding: '12px 24px 0' }}>
        Rankings generated: {data.generated_at} · Click any row to view stock detail
      </div>
    </div>
  );
}
