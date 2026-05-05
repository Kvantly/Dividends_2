import { useEffect, useRef, useState } from 'react';
import type { DividendData, YearlyDividend, YearlyYield } from '../types';
import {
  getDividends,
  buildYearlyTotals,
  buildYearlyYields,
  trailingTwelveMonths,
  consecutivePositiveYears,
} from '../lib/dividendData';
import { getBars } from '../lib/priceData';

interface Props {
  ticker: string;
}

// ─── SVG bar chart ────────────────────────────────────────────────────────────

interface BarChartProps {
  data: YearlyDividend[];
}

function YearlyBarChart({ data }: BarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(containerRef.current);
    setWidth(containerRef.current.clientWidth);
    return () => ro.disconnect();
  }, []);

  if (data.length === 0) return null;

  const height = 220;
  const padTop = 16;
  const padBottom = 48;
  const padLeft = 52;
  const padRight = 16;
  const chartW = Math.max(width - padLeft - padRight, 10);
  const chartH = height - padTop - padBottom;

  const maxVal = Math.max(...data.map((d) => d.total), 0.001);
  const barW = Math.max((chartW / data.length) * 0.6, 4);
  const gap = chartW / data.length;

  // Y-axis ticks (4 lines)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: padTop + chartH * (1 - t),
    label: (maxVal * t).toFixed(1),
  }));

  return (
    <div ref={containerRef} className="div-barchart-wrap">
      <svg width={width} height={height} style={{ display: 'block' }}>
        {/* Y gridlines + labels */}
        {ticks.map((t) => (
          <g key={t.label}>
            <line
              x1={padLeft}
              y1={t.y}
              x2={padLeft + chartW}
              y2={t.y}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={padLeft - 6}
              y={t.y + 4}
              textAnchor="end"
              fontSize={10}
              fill="var(--text-tertiary)"
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* Bars */}
        {data.map((d, i) => {
          const barH = (d.total / maxVal) * chartH;
          const x = padLeft + i * gap + gap / 2 - barW / 2;
          const y = padTop + chartH - barH;
          const isGrowth = (d.growthPct ?? 0) >= 0;
          const fill = d.growthPct === null
            ? 'var(--accent)'
            : isGrowth
            ? 'var(--green)'
            : 'var(--red)';

          return (
            <g key={d.year}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                fill={fill}
                rx={2}
                opacity={0.85}
              />
              {/* Value label on top of bar if space allows */}
              {barH > 20 && (
                <text
                  x={x + barW / 2}
                  y={y - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--text-secondary)"
                >
                  {d.total.toFixed(1)}
                </text>
              )}
              {/* X-axis label */}
              <text
                x={x + barW / 2}
                y={height - 6}
                textAnchor="middle"
                fontSize={10}
                fill="var(--text-tertiary)"
              >
                {d.year}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Per-payment sparkline bar chart ─────────────────────────────────────────

interface PaymentChartProps {
  payments: { date: string; amount: number }[];
}

function PaymentBars({ payments }: PaymentChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(containerRef.current);
    setWidth(containerRef.current.clientWidth);
    return () => ro.disconnect();
  }, []);

  if (payments.length === 0) return null;

  const height = 120;
  const padTop = 8;
  const padBottom = 28;
  const padLeft = 44;
  const padRight = 8;
  const chartW = Math.max(width - padLeft - padRight, 10);
  const chartH = height - padTop - padBottom;

  const maxAmt = Math.max(...payments.map((p) => p.amount), 0.001);
  const barW = Math.max((chartW / payments.length) * 0.6, 2);
  const gap = chartW / payments.length;

  return (
    <div ref={containerRef} className="div-barchart-wrap">
      <svg width={width} height={height} style={{ display: 'block' }}>
        <line
          x1={padLeft}
          y1={padTop}
          x2={padLeft}
          y2={padTop + chartH}
          stroke="var(--border)"
          strokeWidth={1}
        />
        <text x={padLeft - 4} y={padTop + 4} textAnchor="end" fontSize={9} fill="var(--text-tertiary)">
          {maxAmt.toFixed(1)}
        </text>
        <text x={padLeft - 4} y={padTop + chartH} textAnchor="end" fontSize={9} fill="var(--text-tertiary)">
          0
        </text>

        {payments.map((p, i) => {
          const barH = (p.amount / maxAmt) * chartH;
          const x = padLeft + i * gap + gap / 2 - barW / 2;
          const y = padTop + chartH - barH;
          return (
            <g key={`${p.date}-${i}`}>
              <rect x={x} y={y} width={barW} height={barH} fill="var(--accent)" rx={1} opacity={0.75} />
            </g>
          );
        })}

        {/* X-axis: show first and last dates */}
        <text x={padLeft} y={height - 4} fontSize={9} fill="var(--text-tertiary)">
          {payments[0].date.slice(0, 7)}
        </text>
        <text x={padLeft + chartW} y={height - 4} textAnchor="end" fontSize={9} fill="var(--text-tertiary)">
          {payments[payments.length - 1].date.slice(0, 7)}
        </text>
      </svg>
    </div>
  );
}

// ─── Yield % line + bar chart ─────────────────────────────────────────────────

interface YieldChartProps {
  data: YearlyYield[];
}

function YieldChart({ data }: YieldChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(containerRef.current);
    setWidth(containerRef.current.clientWidth);
    return () => ro.disconnect();
  }, []);

  if (data.length === 0) return (
    <div className="div-barchart-wrap" style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Price data not available to calculate yield</span>
    </div>
  );

  const height = 220;
  const padTop = 20;
  const padBottom = 48;
  const padLeft = 52;
  const padRight = 16;
  const chartW = Math.max(width - padLeft - padRight, 10);
  const chartH = height - padTop - padBottom;

  const maxYield = Math.max(...data.map((d) => d.yieldPct), 0.001);
  const avgYield = data.reduce((s, d) => s + d.yieldPct, 0) / data.length;
  const barW = Math.max((chartW / data.length) * 0.6, 4);
  const gap = chartW / data.length;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: padTop + chartH * (1 - t),
    label: (maxYield * t).toFixed(1) + '%',
  }));

  // Points for trend line
  const points = data.map((d, i) => {
    const cx = padLeft + i * gap + gap / 2;
    const cy = padTop + chartH * (1 - d.yieldPct / maxYield);
    return { cx, cy };
  });
  const polyline = points.map((p) => `${p.cx},${p.cy}`).join(' ');

  // Average line Y
  const avgY = padTop + chartH * (1 - avgYield / maxYield);

  return (
    <div ref={containerRef} className="div-barchart-wrap">
      <svg width={width} height={height} style={{ display: 'block' }}>
        {/* Y gridlines */}
        {ticks.map((t) => (
          <g key={t.label}>
            <line x1={padLeft} y1={t.y} x2={padLeft + chartW} y2={t.y} stroke="var(--border)" strokeWidth={1} />
            <text x={padLeft - 6} y={t.y + 4} textAnchor="end" fontSize={10} fill="var(--text-tertiary)">
              {t.label}
            </text>
          </g>
        ))}

        {/* Average line */}
        <line
          x1={padLeft} y1={avgY} x2={padLeft + chartW} y2={avgY}
          stroke="var(--text-tertiary)" strokeWidth={1} strokeDasharray="4 3"
        />
        <text x={padLeft + chartW + 4} y={avgY + 4} fontSize={9} fill="var(--text-tertiary)">avg</text>

        {/* Bars */}
        {data.map((d, i) => {
          const barH = (d.yieldPct / maxYield) * chartH;
          const x = padLeft + i * gap + gap / 2 - barW / 2;
          const y = padTop + chartH - barH;
          // Colour: above average = green, below = orange
          const fill = d.yieldPct >= avgYield ? 'var(--green)' : '#f59e0b';
          return (
            <g key={d.year}>
              <rect x={x} y={y} width={barW} height={barH} fill={fill} rx={2} opacity={0.7} />
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="var(--text-secondary)">
                {d.yieldPct.toFixed(1)}%
              </text>
              <text x={x + barW / 2} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--text-tertiary)">
                {d.year}
              </text>
            </g>
          );
        })}

        {/* Trend polyline */}
        {points.length > 1 && (
          <polyline
            points={polyline}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}

        {/* Dots on trend line */}
        {points.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r={3} fill="var(--accent)" />
        ))}
      </svg>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DividendTab({ ticker }: Props) {
  const [data, setData] = useState<DividendData | null>(null);
  const [yields, setYields] = useState<YearlyYield[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    setYields([]);

    Promise.all([getDividends(ticker), getBars(ticker)])
      .then(([d, bars]) => {
        if (cancelled) return;
        setData(d);
        if (d && d.dividends.length > 0) {
          const yearly = buildYearlyTotals(d.dividends);
          setYields(buildYearlyYields(yearly, bars));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load dividend data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [ticker]);

  if (loading) {
    return (
      <div className="div-loading">
        <div className="spinner" />
        Loading dividend data…
      </div>
    );
  }

  if (error) {
    return <div className="error-banner" style={{ margin: '20px 24px' }}>{error}</div>;
  }

  if (!data || data.dividends.length === 0) {
    return (
      <div className="div-empty">
        <div className="div-empty-icon">💰</div>
        <div>No dividend history available for {ticker}</div>
        <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-tertiary)' }}>
          This stock may not pay dividends, or data has not been collected yet.
        </div>
      </div>
    );
  }

  const yearly = buildYearlyTotals(data.dividends);
  const ttm = trailingTwelveMonths(data.dividends);
  const streak = consecutivePositiveYears(yearly);
  const latestPayment = data.dividends[data.dividends.length - 1];
  const totalPayments = data.dividends.length;
  const yearsWithDividends = yearly.length;
  const currentYear = yearly[yearly.length - 1];

  const fmt = (n: number) =>
    n.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtGrowth = (n: number | null) =>
    n === null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

  return (
    <div className="div-root">
      {/* ── Key metrics ── */}
      <div className="div-metrics">
        <div className="div-metric">
          <div className="div-metric-label">Latest Payment</div>
          <div className="div-metric-value">{fmt(latestPayment.amount)}</div>
          <div className="div-metric-sub">{latestPayment.date}</div>
        </div>
        <div className="div-metric">
          <div className="div-metric-label">Trailing 12M Total</div>
          <div className="div-metric-value">{fmt(ttm)}</div>
          <div className="div-metric-sub">local currency</div>
        </div>
        <div className="div-metric">
          <div className="div-metric-label">Current Year</div>
          <div className="div-metric-value">{fmt(currentYear?.total ?? 0)}</div>
          <div className="div-metric-sub">
            {currentYear?.payments ?? 0} payment{(currentYear?.payments ?? 0) !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="div-metric">
          <div className="div-metric-label">Growth Streak</div>
          <div className={`div-metric-value ${streak > 0 ? 'up' : ''}`}>{streak} yr{streak !== 1 ? 's' : ''}</div>
          <div className="div-metric-sub">consecutive growth</div>
        </div>
        <div className="div-metric">
          <div className="div-metric-label">Years Paying</div>
          <div className="div-metric-value">{yearsWithDividends}</div>
          <div className="div-metric-sub">{totalPayments} total payments</div>
        </div>
        {yields.length > 0 && (() => {
          const latest = yields[yields.length - 1];
          const avg = yields.reduce((s, y) => s + y.yieldPct, 0) / yields.length;
          return (
            <div className="div-metric">
              <div className="div-metric-label">Current Yield</div>
              <div className={`div-metric-value ${latest.yieldPct >= avg ? 'up' : 'down'}`}>
                {latest.yieldPct.toFixed(2)}%
              </div>
              <div className="div-metric-sub">avg {avg.toFixed(2)}% / yr</div>
            </div>
          );
        })()}
      </div>

      {/* ── Annual bar chart ── */}
      <div className="div-section">
        <div className="div-section-title">
          Annual Dividends
          <span className="div-legend">
            <span className="div-legend-dot" style={{ background: 'var(--green)' }} /> Growth
            <span className="div-legend-dot" style={{ background: 'var(--red)' }} /> Decline
            <span className="div-legend-dot" style={{ background: 'var(--accent)' }} /> First year
          </span>
        </div>
        <YearlyBarChart data={yearly} />
      </div>

      {/* ── Dividend yield % chart ── */}
      <div className="div-section">
        <div className="div-section-title">
          Dividend Yield % per Year
          <span className="div-legend">
            <span className="div-legend-dot" style={{ background: 'var(--green)' }} /> Above avg
            <span className="div-legend-dot" style={{ background: '#f59e0b' }} /> Below avg
            <span className="div-legend-dot" style={{ background: 'var(--accent)', borderRadius: '50%' }} /> Trend line
          </span>
        </div>
        <YieldChart data={yields} />
      </div>

      {/* ── Individual payments chart ── */}
      <div className="div-section">
        <div className="div-section-title">All Payments</div>
        <PaymentBars payments={data.dividends} />
      </div>

      {/* ── Annual summary table ── */}
      <div className="div-section">
        <div className="div-section-title">Year-by-Year Summary</div>
        <div className="div-table-wrap">
          <table className="div-table">
            <thead>
              <tr>
                <th>Year</th>
                <th className="num">Total</th>
                <th className="num">Payments</th>
                <th className="num">YoY Growth</th>
                <th className="num">Yield %</th>
              </tr>
            </thead>
            <tbody>
              {[...yearly].reverse().map((row) => {
                const yieldRow = yields.find((y) => y.year === row.year);
                return (
                  <tr key={row.year}>
                    <td className="bold">{row.year}</td>
                    <td className="num">{fmt(row.total)}</td>
                    <td className="num">{row.payments}</td>
                    <td className={`num ${row.growthPct === null ? '' : row.growthPct >= 0 ? 'up' : 'down'}`}>
                      {fmtGrowth(row.growthPct)}
                    </td>
                    <td className="num">
                      {yieldRow ? `${yieldRow.yieldPct.toFixed(2)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Payment history table ── */}
      <div className="div-section">
        <div className="div-section-title">Payment History</div>
        <div className="div-table-wrap div-table-scroll">
          <table className="div-table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {[...data.dividends].reverse().map((d, i) => (
                <tr key={`${d.date}-${i}`}>
                  <td>{d.date}</td>
                  <td className="num">{fmt(d.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="div-footer">
        Last updated: {data.last_updated} · Source: Yahoo Finance via yfinance · Local currency
      </div>
    </div>
  );
}
