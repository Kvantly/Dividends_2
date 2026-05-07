import { useEffect, useState } from 'react';
import { useTheme } from './hooks/useTheme';
import { useStockList } from './hooks/useStockList';
import { TopBar } from './components/TopBar';
import { Sidebar, type MainView } from './components/Sidebar';
import { StockPane } from './components/StockPane';
import { DividendRankView } from './components/DividendRankView';
import { CompanyRankView } from './components/CompanyRankView';
import { preloadBars } from './lib/priceData';
import type { Stock } from './types';

export default function App() {
  const [theme, toggleTheme]   = useTheme();
  const { stocks, loading, error } = useStockList();
  const [selected, setSelected]    = useState<Stock | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mainView, setMainView]    = useState<MainView>('stocks');

  useEffect(() => {
    if (stocks.length > 0) preloadBars();
  }, [stocks.length]);

  useEffect(() => {
    if (!selected && stocks.length > 0) setSelected(stocks[0]);
  }, [stocks, selected]);

  // Called from ranking views when a user clicks a stock row
  const handleSelectFromRanking = (ticker: string) => {
    const stock = stocks.find((s) => s.ticker === ticker);
    if (stock) {
      setSelected(stock);
      setMainView('stocks');
    }
  };

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
          mainView={mainView}
          onViewChange={setMainView}
        />

        {/* ── Main content area ── */}
        {mainView === 'dividend_rank' && (
          <div className="pane rank-pane">
            <DividendRankView onSelectStock={handleSelectFromRanking} />
          </div>
        )}

        {mainView === 'company_rank' && (
          <div className="pane rank-pane">
            <CompanyRankView onSelectStock={handleSelectFromRanking} />
          </div>
        )}

        {mainView === 'stocks' && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
