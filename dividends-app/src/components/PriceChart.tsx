import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { OHLCV, Theme, ChartStyle } from '../types';
import { sma } from '../lib/priceData';

interface Props {
  bars: OHLCV[];
  theme: Theme;
  style: ChartStyle;
  movingAverages: number[]; // periods to overlay, e.g. [20, 50, 200]
}

const MA_COLORS = ['#2563eb', '#f59e0b', '#a855f7'];

export function PriceChart({ bars, theme, style, movingAverages }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const maSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: theme === 'dark' ? '#94a3b8' : '#64748b',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: theme === 'dark' ? '#1f2a44' : '#e2e8f0' },
        horzLines: { color: theme === 'dark' ? '#1f2a44' : '#e2e8f0' },
      },
      rightPriceScale: {
        borderColor: theme === 'dark' ? '#334155' : '#cbd5e1',
      },
      timeScale: {
        borderColor: theme === 'dark' ? '#334155' : '#cbd5e1',
        timeVisible: false,
        secondsVisible: false,
      },
      crosshair: { mode: CrosshairMode.Magnet },
      autoSize: true,
      handleScale: { axisPressedMouseMove: true },
    });
    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
      maSeriesRef.current = [];
    };
  }, [theme]);

  // Rebuild series whenever style or theme changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Clean previous series
    if (mainSeriesRef.current) chart.removeSeries(mainSeriesRef.current);
    if (volumeSeriesRef.current) chart.removeSeries(volumeSeriesRef.current);
    for (const s of maSeriesRef.current) chart.removeSeries(s);
    maSeriesRef.current = [];

    // Main price series
    if (style === 'candle') {
      mainSeriesRef.current = chart.addCandlestickSeries({
        upColor: '#16a34a',
        downColor: '#dc2626',
        borderUpColor: '#16a34a',
        borderDownColor: '#dc2626',
        wickUpColor: '#16a34a',
        wickDownColor: '#dc2626',
      });
    } else {
      mainSeriesRef.current = chart.addLineSeries({
        color: theme === 'dark' ? '#60a5fa' : '#2563eb',
        lineWidth: 2,
        priceLineVisible: true,
      });
    }

    // Volume histogram on its own scale
    volumeSeriesRef.current = chart.addHistogramSeries({
      color: theme === 'dark' ? '#1f2a44' : '#cbd5e1',
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
  }, [style, theme]);

  // Push bar data into the series
  useEffect(() => {
    const main = mainSeriesRef.current;
    const vol = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!main || !vol || !chart) return;

    if (bars.length === 0) {
      main.setData([]);
      vol.setData([]);
      return;
    }

    if (style === 'candle') {
      (main as ISeriesApi<'Candlestick'>).setData(
        bars.map((b) => ({
          time: b.time as UTCTimestamp,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        }))
      );
    } else {
      (main as ISeriesApi<'Line'>).setData(
        bars.map((b) => ({
          time: b.time as UTCTimestamp,
          value: b.close,
        }))
      );
    }

    vol.setData(
      bars.map((b) => ({
        time: b.time as UTCTimestamp,
        value: b.volume,
        color:
          b.close >= b.open
            ? theme === 'dark'
              ? 'rgba(34, 197, 94, 0.4)'
              : 'rgba(22, 163, 74, 0.35)'
            : theme === 'dark'
              ? 'rgba(248, 113, 113, 0.4)'
              : 'rgba(220, 38, 38, 0.35)',
      }))
    );

    chart.timeScale().fitContent();
  }, [bars, style, theme]);

  // Moving averages
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Remove old MA lines
    for (const s of maSeriesRef.current) chart.removeSeries(s);
    maSeriesRef.current = [];

    movingAverages.forEach((period, i) => {
      const data = sma(bars, period);
      if (data.length === 0) return;
      const series = chart.addLineSeries({
        color: MA_COLORS[i % MA_COLORS.length],
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        title: `MA${period}`,
      });
      series.setData(
        data.map((d) => ({
          time: d.time as Time,
          value: d.value,
        }))
      );
      maSeriesRef.current.push(series);
    });
  }, [bars, movingAverages]);

  return <div ref={containerRef} className="chart-host" />;
}
