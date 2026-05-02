import { useEffect, useState } from 'react';
import type { Stock, DividendBar, Theme } from '../types';
import { getDividends } from '../lib/dividendData';
import { formatPrice } from '../lib/format';

interface Props {
  stock: Stock | null;
  theme: Theme;
}

interface YearTotal {
  year: number;
  total: number;
  count: number;
}

export function DividendsPane({ stock }: Props) {
  const [dividends, setDividends] = useState<DividendBar[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!stock) return;
    setLoading(true);
    setDividends([]);
    getDividends(stock.ticker).then((data) => {
      setDividends(data);
      setLoading(false);
    });
  }, [stock?.ticker]);

  if (!stock) {
    return (
      <div className="pane">
        <div className="pane-empty">Select a stock from the sidebar to view dividend history</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pane">
        <div className="pane-empty">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (dividends.length === 0) {
    return (
      <div className="pane">
        <div className="pane-header">
          <div className="pane-title">
            <h1>{stock.ticker}</h1>
            <div className="sub">{stock.name} · Dividend History</div>
          </div>
        </div>
        <div className="pane-empty">No dividend data available for {stock.ticker}</div>
      </div>
    );
  }

  // Aggregate by year
  const yearMap = new Map<number, YearTotal>();
  for (const d of dividends) {
    const year = parseInt(d.date.slice(0, 4), 10);
    const prev = yearMap.get(year) ?? { year, total: 0, count: 0 };
    yearMap.set(year, { year, total: prev.total + d.amount, count: prev.count + 1 });
  }
  const yearlyTotals = Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
  const maxAnnual = yearlyTotals.reduce((m, y) => Math.max(m, y.total), 0);
  const avgAnnual = yearlyTotals.reduce((s, y) => s + y.total, 0) / yearlyTotals.length;
  const lastDividend = dividends[dividends.length - 1];

  return (
    <div className="pane">
      <div className="pane-header">
        <div className="pane-title">
          <h1>{stock.ticker}</h1>
          <div className="sub">{stock.name} · Dividend History (10 years)</div>
        </div>
      </div>

      <div className="info-strip">
        <div className="info-cell">
          <div className="info-label">Last Dividend</div>
          <div className="info-value">{formatPrice(lastDividend.amount)} NOK</div>
        </div>
        <div className="info-cell">
          <div className="info-label">Last Date</div>
          <div className="info-value">{lastDividend.date}</div>
        </div>
        <div className="info-cell">
          <div className="info-label">Avg / Year</div>
          <div className="info-value">{formatPrice(avgAnnual)} NOK</div>
        </div>
        <div className="info-cell">
          <div className="info-label">Total Payments</div>
          <div className="info-value">{dividends.length}</div>
        </div>
      </div>

      <div className="div-chart-wrap">
        <div className="div-chart-title">Annual Dividends (NOK)</div>
        <DividendChart yearlyTotals={yearlyTotals} maxAnnual={maxAnnual} />
      </div>

      <div className="div-table-wrap">
        <table className="div-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount (NOK)</th>
            </tr>
          </thead>
          <tbody>
            {[...dividends].reverse().map((d, i) => (
              <tr key={i}>
                <td>{d.date}</td>
                <td className="div-amount">{formatPrice(d.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DividendChart({ yearlyTotals, maxAnnual }: { yearlyTotals: YearTotal[]; maxAnnual: number }) {
  const W = 700;
  const H = 180;
  const padL = 54;
  const padR = 16;
  const padT = 12;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = yearlyTotals.length;
  const slotW = plotW / n;
  const barW = Math.max(4, slotW * 0.55);
  const Y_TICKS = 4;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="div-svg"
    >
      {/* Gridlines + Y labels */}
      {Array.from({ length: Y_TICKS + 1 }, (_, i) => {
        const y = padT + (plotH * i) / Y_TICKS;
        const val = maxAnnual * (1 - i / Y_TICKS);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeWidth="1" />
            <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-tertiary)">
              {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {yearlyTotals.map((yt, i) => {
        const barH = maxAnnual > 0 ? (yt.total / maxAnnual) * plotH : 0;
        const cx = padL + i * slotW + slotW / 2;
        const x = cx - barW / 2;
        const y = padT + plotH - barH;
        return (
          <g key={yt.year}>
            <rect x={x} y={y} width={barW} height={barH} fill="var(--accent)" opacity="0.85" rx="2">
              <title>{`${yt.year}: ${yt.total.toFixed(2)} NOK (${yt.count} payment${yt.count !== 1 ? 's' : ''})`}</title>
            </rect>
            <text x={cx} y={H - padB + 14} textAnchor="middle" fontSize="10" fill="var(--text-tertiary)">
              {yt.year}
            </text>
          </g>
        );
      })}

      {/* X axis */}
      <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="var(--border-strong)" strokeWidth="1" />
    </svg>
  );
}
