import { useMemo, useState } from 'react';
import type { Stock } from '../types';

export type MainView = 'stocks' | 'dividend_rank' | 'company_rank';

interface Props {
  stocks: Stock[];
  selectedTicker: string | null;
  onSelect: (s: Stock) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mainView: MainView;
  onViewChange: (v: MainView) => void;
}

const NAV_TABS: { id: MainView; label: string; icon: string }[] = [
  { id: 'stocks',        label: 'Stocks',      icon: '📈' },
  { id: 'dividend_rank', label: 'Div Rank',    icon: '💰' },
  { id: 'company_rank',  label: 'Co Rank',     icon: '🏆' },
];

export function Sidebar({
  stocks, selectedTicker, onSelect,
  collapsed, onToggleCollapse,
  mainView, onViewChange,
}: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stocks;
    return stocks.filter(
      (s) => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }, [query, stocks]);

  const handleNavClick = (id: MainView) => {
    if (collapsed) onToggleCollapse(); // auto-expand
    onViewChange(id);
  };

  return (
    <aside className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>

      {/* ── Nav tab bar + collapse toggle ── */}
      <div className="sidebar-nav">
        {!collapsed && NAV_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`sidebar-nav-tab${mainView === tab.id ? ' active' : ''}`}
            onClick={() => handleNavClick(tab.id)}
            title={tab.label}
          >
            <span className="sidebar-nav-icon">{tab.icon}</span>
            <span className="sidebar-nav-label">{tab.label}</span>
          </button>
        ))}
        <button
          className="sidebar-toggle"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* ── Stock list (only in stocks mode) ── */}
      {!collapsed && mainView === 'stocks' && (
        <>
          <div className="search-wrap">
            <input
              className="search-input"
              type="search"
              placeholder="Search ticker or name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="sidebar-meta">{filtered.length} stocks</div>
          <div className="stock-list">
            {filtered.map((s) => (
              <div
                key={s.ticker + s.isin}
                className={`stock-row${s.ticker === selectedTicker ? ' active' : ''}`}
                onClick={() => { onSelect(s); onViewChange('stocks'); }}
              >
                <div className="stock-ticker">{s.ticker}</div>
                <div className="stock-name">{s.name}</div>
                <div />
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                No matches
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Rank mode placeholder in sidebar ── */}
      {!collapsed && mainView !== 'stocks' && (
        <div className="sidebar-rank-hint">
          {NAV_TABS.find((t) => t.id === mainView)?.icon}{' '}
          {NAV_TABS.find((t) => t.id === mainView)?.label}
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
            Showing in main panel →
          </div>
        </div>
      )}
    </aside>
  );
}
