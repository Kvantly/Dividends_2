import { useEffect, useState } from 'react';
import {
  getFinancials,
  fmtLargeNumber,
  fmtPct,
  fmtX,
  fmtNum,
  type FinancialData,
} from '../lib/financialData';

interface Props { ticker: string; }

// ─── Reusable row components ─────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <tr className="fin-section-header">
      <td colSpan={2}>{title}</td>
    </tr>
  );
}

function Row({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: 'positive' | 'negative' | 'neutral';
}) {
  const cls = highlight === 'positive' ? 'up' : highlight === 'negative' ? 'down' : '';
  return (
    <tr className="fin-row">
      <td className="fin-label">{label}</td>
      <td className={`fin-value ${cls}`}>
        {value}
        {sub && <span className="fin-value-sub">{sub}</span>}
      </td>
    </tr>
  );
}

// ─── 52-week range bar ────────────────────────────────────────────────────────

function RangeBar({ low, high, current }: { low: number; high: number; current: number }) {
  const pct = high > low ? Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100)) : 50;
  return (
    <div className="fin-range-wrap">
      <span className="fin-range-end">{low.toFixed(2)}</span>
      <div className="fin-range-track">
        <div className="fin-range-fill" style={{ width: `${pct}%` }} />
        <div className="fin-range-dot" style={{ left: `${pct}%` }} />
      </div>
      <span className="fin-range-end">{high.toFixed(2)}</span>
    </div>
  );
}

// ─── Score badge: quick health signal ────────────────────────────────────────

function ScoreBadge({ data }: { data: FinancialData }) {
  let score = 0;
  const reasons: { text: string; good: boolean }[] = [];

  const pe = data.valuation.trailing_pe;
  if (pe !== null) {
    if (pe > 0 && pe < 15)  { score += 2; reasons.push({ text: `Low P/E (${pe.toFixed(1)}x)`, good: true }); }
    else if (pe > 30)       { score -= 1; reasons.push({ text: `High P/E (${pe.toFixed(1)}x)`, good: false }); }
  }

  const roe = data.profitability.roe;
  if (roe !== null) {
    if (roe > 0.15)  { score += 2; reasons.push({ text: `Strong ROE (${(roe * 100).toFixed(1)}%)`, good: true }); }
    else if (roe < 0){ score -= 1; reasons.push({ text: `Negative ROE`, good: false }); }
  }

  const de = data.balance_sheet.debt_to_equity;
  if (de !== null) {
    if (de < 50)  { score += 1; reasons.push({ text: `Low D/E (${de.toFixed(0)})`, good: true }); }
    else if (de > 200){ score -= 1; reasons.push({ text: `High D/E (${de.toFixed(0)})`, good: false }); }
  }

  const pm = data.profitability.profit_margin;
  if (pm !== null) {
    if (pm > 0.1) { score += 1; reasons.push({ text: `Healthy margin (${(pm * 100).toFixed(1)}%)`, good: true }); }
    else if (pm < 0){ score -= 2; reasons.push({ text: `Negative margin`, good: false }); }
  }

  const cr = data.balance_sheet.current_ratio;
  if (cr !== null) {
    if (cr >= 1.5) { score += 1; reasons.push({ text: `Current ratio ${cr.toFixed(1)}`, good: true }); }
    else if (cr < 1){ score -= 1; reasons.push({ text: `Current ratio < 1`, good: false }); }
  }

  const label = score >= 4 ? 'Strong' : score >= 2 ? 'Good' : score >= 0 ? 'Fair' : 'Weak';
  const color = score >= 4 ? 'var(--green)' : score >= 2 ? '#22c55e99' : score >= 0 ? '#f59e0b' : 'var(--red)';

  return (
    <div className="fin-score">
      <div className="fin-score-badge" style={{ borderColor: color, color }}>
        <div className="fin-score-label">Health</div>
        <div className="fin-score-value">{label}</div>
      </div>
      <div className="fin-score-reasons">
        {reasons.map((r, i) => (
          <div key={i} className={`fin-score-reason ${r.good ? 'up' : 'down'}`}>
            {r.good ? '▲' : '▼'} {r.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FinancialsTab({ ticker }: Props) {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    getFinancials(ticker)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [ticker]);

  if (loading) return (
    <div className="div-loading"><div className="spinner" />Loading financial data…</div>
  );
  if (error) return (
    <div className="error-banner" style={{ margin: '20px 24px' }}>{error}</div>
  );
  if (!data) return (
    <div className="div-empty">
      <div className="div-empty-icon">📊</div>
      <div>No financial data available for {ticker}</div>
      <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-tertiary)' }}>
        Run the weekly financials action to populate this data.
      </div>
    </div>
  );

  const v = data.valuation;
  const ps = data.per_share;
  const pr = data.profitability;
  const inc = data.income;
  const bs = data.balance_sheet;
  const tr = data.trading;
  const curr = ps.currency ?? 'NOK';

  return (
    <div className="fin-root">
      {/* ── Health score + 52W range ── */}
      <div className="fin-top">
        <ScoreBadge data={data} />

        {tr.week52_low !== null && tr.week52_high !== null && ps.current_price !== null && (
          <div className="fin-range-section">
            <div className="fin-range-title">52-Week Range ({curr})</div>
            <RangeBar low={tr.week52_low} high={tr.week52_high} current={ps.current_price} />
            <div className="fin-range-labels">
              <span>52W Low</span>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                Current: {ps.current_price.toFixed(2)}
              </span>
              <span>52W High</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Two-column layout ── */}
      <div className="fin-grid">

        {/* LEFT column */}
        <div className="fin-col">

          {/* Valuation */}
          <table className="fin-table">
            <tbody>
              <SectionHeader title="Valuation" />
              <Row label="Market Cap"       value={fmtLargeNumber(v.market_cap)}      sub={curr} />
              <Row label="Enterprise Value" value={fmtLargeNumber(v.enterprise_value)} sub={curr} />
              <Row label="Trailing P/E"     value={fmtX(v.trailing_pe)}
                highlight={v.trailing_pe !== null ? (v.trailing_pe > 0 && v.trailing_pe < 20 ? 'positive' : v.trailing_pe > 35 ? 'negative' : 'neutral') : undefined} />
              <Row label="Forward P/E"      value={fmtX(v.forward_pe)} />
              <Row label="PEG Ratio"        value={fmtNum(v.peg_ratio)}
                highlight={v.peg_ratio !== null ? (v.peg_ratio < 1 ? 'positive' : v.peg_ratio > 2 ? 'negative' : 'neutral') : undefined} />
              <Row label="Price / Sales"    value={fmtX(v.price_to_sales)} />
              <Row label="Price / Book"     value={fmtX(v.price_to_book)} />
              <Row label="EV / Revenue"     value={fmtX(v.ev_to_revenue)} />
              <Row label="EV / EBITDA"      value={fmtX(v.ev_to_ebitda)} />
            </tbody>
          </table>

          {/* Per Share */}
          <table className="fin-table">
            <tbody>
              <SectionHeader title="Per Share Data" />
              <Row label="Current Price"    value={ps.current_price !== null ? `${ps.current_price.toFixed(2)} ${curr}` : '—'} />
              <Row label="EPS (TTM)"        value={fmtNum(ps.eps_trailing)} sub={curr}
                highlight={ps.eps_trailing !== null ? (ps.eps_trailing > 0 ? 'positive' : 'negative') : undefined} />
              <Row label="EPS (Forward)"    value={fmtNum(ps.eps_forward)}  sub={curr}
                highlight={ps.eps_forward !== null ? (ps.eps_forward > 0 ? 'positive' : 'negative') : undefined} />
              <Row label="Book Value"       value={fmtNum(ps.book_value)}   sub={curr} />
              <Row label="Revenue / Share"  value={fmtNum(ps.revenue_per_share)} sub={curr} />
            </tbody>
          </table>

          {/* Trading */}
          <table className="fin-table">
            <tbody>
              <SectionHeader title="Trading Information" />
              <Row label="Beta"             value={fmtNum(tr.beta)}
                highlight={tr.beta !== null ? (tr.beta < 1 ? 'positive' : tr.beta > 1.5 ? 'negative' : 'neutral') : undefined} />
              <Row label="50-Day Avg"       value={tr.avg50d !== null ? tr.avg50d.toFixed(2) : '—'} sub={curr} />
              <Row label="200-Day Avg"      value={tr.avg200d !== null ? tr.avg200d.toFixed(2) : '—'} sub={curr} />
              <Row label="Avg Volume"       value={fmtLargeNumber(tr.avg_volume)} />
              <Row label="Avg Vol (10D)"    value={fmtLargeNumber(tr.avg_volume_10d)} />
              <Row label="Shares Out."      value={fmtLargeNumber(tr.shares_outstanding)} />
              <Row label="Float"            value={fmtLargeNumber(tr.float_shares)} />
              <Row label="Insider Own."     value={fmtPct(tr.insider_ownership)} />
              <Row label="Inst. Own."       value={fmtPct(tr.institutional_ownership)} />
              <Row label="Short Ratio"      value={fmtNum(tr.short_ratio)} />
            </tbody>
          </table>
        </div>

        {/* RIGHT column */}
        <div className="fin-col">

          {/* Profitability */}
          <table className="fin-table">
            <tbody>
              <SectionHeader title="Profitability" />
              <Row label="Gross Margin"     value={fmtPct(pr.gross_margin)}
                highlight={pr.gross_margin !== null ? (pr.gross_margin > 0.3 ? 'positive' : pr.gross_margin < 0 ? 'negative' : 'neutral') : undefined} />
              <Row label="Operating Margin" value={fmtPct(pr.operating_margin)}
                highlight={pr.operating_margin !== null ? (pr.operating_margin > 0 ? 'positive' : 'negative') : undefined} />
              <Row label="EBITDA Margin"    value={fmtPct(pr.ebitda_margin)} />
              <Row label="Profit Margin"    value={fmtPct(pr.profit_margin)}
                highlight={pr.profit_margin !== null ? (pr.profit_margin > 0 ? 'positive' : 'negative') : undefined} />
              <Row label="Return on Equity" value={fmtPct(pr.roe)}
                highlight={pr.roe !== null ? (pr.roe > 0.15 ? 'positive' : pr.roe < 0 ? 'negative' : 'neutral') : undefined} />
              <Row label="Return on Assets" value={fmtPct(pr.roa)}
                highlight={pr.roa !== null ? (pr.roa > 0.05 ? 'positive' : pr.roa < 0 ? 'negative' : 'neutral') : undefined} />
            </tbody>
          </table>

          {/* Income Statement */}
          <table className="fin-table">
            <tbody>
              <SectionHeader title="Income Statement (TTM)" />
              <Row label="Revenue"          value={fmtLargeNumber(inc.total_revenue)}   sub={curr} />
              <Row label="Revenue Growth"   value={fmtPct(inc.revenue_growth)}
                highlight={inc.revenue_growth !== null ? (inc.revenue_growth > 0 ? 'positive' : 'negative') : undefined} />
              <Row label="Gross Profit"     value={fmtLargeNumber(inc.gross_profits)}   sub={curr} />
              <Row label="EBITDA"           value={fmtLargeNumber(inc.ebitda)}           sub={curr} />
              <Row label="Net Income"       value={fmtLargeNumber(inc.net_income)}       sub={curr}
                highlight={inc.net_income !== null ? (inc.net_income > 0 ? 'positive' : 'negative') : undefined} />
              <Row label="Earnings Growth"  value={fmtPct(inc.earnings_growth)}
                highlight={inc.earnings_growth !== null ? (inc.earnings_growth > 0 ? 'positive' : 'negative') : undefined} />
            </tbody>
          </table>

          {/* Balance Sheet */}
          <table className="fin-table">
            <tbody>
              <SectionHeader title="Balance Sheet" />
              <Row label="Total Cash"       value={fmtLargeNumber(bs.total_cash)}       sub={curr} />
              <Row label="Cash / Share"     value={fmtNum(bs.cash_per_share)}            sub={curr} />
              <Row label="Total Debt"       value={fmtLargeNumber(bs.total_debt)}        sub={curr} />
              <Row label="Debt / Equity"    value={fmtNum(bs.debt_to_equity)}
                highlight={bs.debt_to_equity !== null ? (bs.debt_to_equity < 50 ? 'positive' : bs.debt_to_equity > 150 ? 'negative' : 'neutral') : undefined} />
              <Row label="Current Ratio"    value={fmtNum(bs.current_ratio)}
                highlight={bs.current_ratio !== null ? (bs.current_ratio >= 1.5 ? 'positive' : bs.current_ratio < 1 ? 'negative' : 'neutral') : undefined} />
              <Row label="Quick Ratio"      value={fmtNum(bs.quick_ratio)}
                highlight={bs.quick_ratio !== null ? (bs.quick_ratio >= 1 ? 'positive' : 'negative') : undefined} />
            </tbody>
          </table>
        </div>
      </div>

      <div className="div-footer">
        Last updated: {data.last_updated} · Source: Yahoo Finance via yfinance · All figures in {curr} unless noted
      </div>
    </div>
  );
}
