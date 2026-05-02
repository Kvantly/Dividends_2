import { useEffect, useState } from 'react';
import { useTheme } from './hooks/useTheme';
import { useStockList } from './hooks/useStockList';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { StockPane } from './components/StockPane';
import { DividendsPane } from './components/DividendsPane';
import { preloadBars } from './lib/priceData';
import type { Stock } from './types';

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const { stocks, loading, error } = useStockList();
  const [selected, setSelected] = useState<Stock | null>(null);
  const [activeNav, setActiveNav] = useState('dividends');

  useEffect(() => {
    if (stocks.length > 0) preloadBars();
  }, [stocks.length]);

  useEffect(() => {
    if (!selected && stocks.length > 0) {
      setSelected(stocks[0]);
    }
  }, [stocks, selected]);

  const renderMain = () => {
    if (loading) {
      return (
        <div className="pane">
          <div className="pane-empty">Loading stock list…</div>
        </div>
      );
    }
    if (error) {
      return (
        <div className="pane">
          <div className="error-banner">Could not load stock list: {error}</div>
        </div>
      );
    }
    if (activeNav === 'dividends') {
      return <DividendsPane stock={selected} theme={theme} />;
    }
    return <StockPane stock={selected} theme={theme} />;
  };

  return (
    <div className="app">
      <TopBar theme={theme} onToggleTheme={toggleTheme} />
      <div className="main">
        <Sidebar
          stocks={stocks}
          selectedTicker={selected?.ticker ?? null}
          onSelect={setSelected}
          activeNav={activeNav}
          onNavChange={setActiveNav}
        />
        {renderMain()}
      </div>
    </div>
  );
}
