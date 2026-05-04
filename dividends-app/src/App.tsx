import { useEffect, useState } from 'react';
import { useTheme } from './hooks/useTheme';
import { useStockList } from './hooks/useStockList';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { StockPane } from './components/StockPane';
import { preloadBars } from './lib/priceData';
import type { Stock } from './types';

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const { stocks, loading, error } = useStockList();
  const [selected, setSelected] = useState<Stock | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Once the stock list is ready, kick off the (slow) CSV parse in the background
  useEffect(() => {
    if (stocks.length > 0) preloadBars();
  }, [stocks.length]);

  // Auto-select the first stock once the list loads
  useEffect(() => {
    if (!selected && stocks.length > 0) {
      setSelected(stocks[0]);
    }
  }, [stocks, selected]);

  return (
    <div className="app">
      <TopBar theme={theme} onToggleTheme={toggleTheme} />
      <div className="main">
        <Sidebar
          stocks={stocks}
          selectedTicker={selected?.ticker ?? null}
          onSelect={setSelected}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        />
        {loading && (
          <div className="pane">
            <div className="pane-empty">Loading stock list…</div>
          </div>
        )}
        {error && (
          <div className="pane">
            <div className="error-banner">Could not load stock list: {error}</div>
          </div>
        )}
        {!loading && !error && <StockPane stock={selected} theme={theme} />}
      </div>
    </div>
  );
}
