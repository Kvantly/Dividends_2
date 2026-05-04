import { useEffect, useState } from 'react';
import type { Stock, OHLCV, Theme, Interval, ChartStyle } from '../types';
import {
  filterByInterval,
  getBars,
  latestSummary,
} from '../lib/priceData';
import {
  changeClass,
  formatPct,
  formatPrice,
  formatVolume,
} from '../lib/format';
import { PriceChart } from './PriceChart';
import { DividendTab } from './DividendTab';

interface Props {
  stock: Stock | null;
  theme: Theme;
}

const INTERVALS: Interval[] = ['1W', '1M', '3M', '6M', '1Y', '5Y', 'ALL'];
const MA_OPTIONS = [20, 50, 200];
type PaneTab = 'chart' | 'dividends';

export function StockPane({ stock, theme }: Props) {
  const [allBars, setAllBars] = useState<OHLCV[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState<Interval>('6M');
  const [style, setStyle] = useState<ChartStyle>('candle');
  const [activeMAs, setActiveMAs] = useState<number[]>([20, 50]);
  const [activeTab, setActiveTab] = useState<PaneTab>('chart');

  // Reset tab when stock changes
  useEffect(() => {
    setActiveTab('chart');
  }, [stock?.ticker]);

  // Load bars when stock changes
  useEffect(() => {
    if (!stock) {
      setAllBars([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getBars(stock.ticker)
      .then((bars) => {
        if (cancelled) return;
        setAllBars(bars);
        if (bars.length === 0) {
          setError('No price history available for this stock.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load prices');
        setAllBars([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stock]);

  if (!stock) {
    return (
      <div className="pane">
        <div className="pane-empty">
          ← Select a stock from the list to view its chart
        </div>
      </div>
    );
  }

  const visibleBars = filterByInterval(allBars, interval);
  const summary = latestSummary(allBars);
  const last = visibleBars[visibleBars.length - 1];

  const toggleMA = (period: number) => {
    setActiveMAs((curr) =>
      curr.includes(period) ? curr.filter((p) => p !== period) : [...curr, period].sort((a, b) => a - b)
    );
  };

  return (
    <div className="pane">
      {/* ── Stock header ── */}
      <div className="pane-header">
        <div className="pane-title">
          <h1>
            {stock.ticker}{' '}
            <span style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}>
              · {stock.name}
            </span>
          </h1>
          <div className="sub">
            {stock.market} · ISIN {stock.isin}
          </div>
        </div>
        <div className="price-block">
          <div className="price-big">{formatPrice(summary.latestClose)} NOK</div>
          <div className="price-change-row">
            <span className={changeClass(summary.changePct)}>
              {formatPct(summary.changePct)}
            </span>
            <span style={{ color: 'var(--text-tertiary)' }}>1D</span>
          </div>
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div className="pane-tabs">
        <button
          className={`pane-tab${activeTab === 'chart' ? ' active' : ''}`}
          onClick={() => setActiveTab('chart')}
        >
          Chart
        </button>
        <button
          className={`pane-tab${activeTab === 'dividends' ? ' active' : ''}`}
          onClick={() => setActiveTab('dividends')}
        >
          Dividends
        </button>
      </div>

      {/* ── Chart tab ── */}
      {activeTab === 'chart' && (
        <>
          <div className="toolbar">
            <div className="toolbar-group">
              <span className="toolbar-label">Range</span>
              {INTERVALS.map((iv) => (
                <button
                  key={iv}
                  className={`btn${iv === interval ? ' active' : ''}`}
                  onClick={() => setInterval(iv)}
                >
                  {iv}
                </button>
              ))}
            </div>

            <div className="toolbar-group">
              <span className="toolbar-label">Type</span>
              <button
                className={`btn${style === 'candle' ? ' active' : ''}`}
                onClick={() => setStyle('candle')}
              >
                Candles
              </button>
              <button
                className={`btn${style === 'line' ? ' active' : ''}`}
                onClick={() => setStyle('line')}
              >
                Line
              </button>
            </div>

            <div className="toolbar-group">
              <span className="toolbar-label">MA</span>
              {MA_OPTIONS.map((p) => (
                <button
                  key={p}
                  className={`btn toggle${activeMAs.includes(p) ? ' active' : ''}`}
                  onClick={() => toggleMA(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="error-banner">{error}</div>}

          <div className="chart-wrap">
            {loading && (
              <div className="chart-loading">
                <div className="spinner" />
                Loading price history…
              </div>
            )}
            {!loading && visibleBars.length === 0 && !error && (
              <div className="chart-empty">No data in this range. Try a longer period.</div>
            )}
            <PriceChart
              bars={visibleBars}
              theme={theme}
              style={style}
              movingAverages={activeMAs}
            />
          </div>

          <div className="info-strip">
            <div className="info-cell">
              <div className="info-label">Open</div>
              <div className="info-value">{formatPrice(last?.open ?? null)}</div>
            </div>
            <div className="info-cell">
              <div className="info-label">High</div>
              <div className="info-value">{formatPrice(last?.high ?? null)}</div>
            </div>
            <div className="info-cell">
              <div className="info-label">Low</div>
              <div className="info-value">{formatPrice(last?.low ?? null)}</div>
            </div>
            <div className="info-cell">
              <div className="info-label">Close</div>
              <div className="info-value">{formatPrice(last?.close ?? null)}</div>
            </div>
            <div className="info-cell">
              <div className="info-label">Volume</div>
              <div className="info-value">{formatVolume(last?.volume)}</div>
            </div>
            <div className="info-cell">
              <div className="info-label">Bars in view</div>
              <div className="info-value">{visibleBars.length}</div>
            </div>
          </div>
        </>
      )}

      {/* ── Dividends tab ── */}
      {activeTab === 'dividends' && (
        <div className="div-tab-wrap">
          <DividendTab ticker={stock.ticker} />
        </div>
      )}
    </div>
  );
}
