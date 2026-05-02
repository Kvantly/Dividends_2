import { useMemo, useState } from 'react';
import type { Stock } from '../types';

interface Props {
  stocks: Stock[];
  selectedTicker: string | null;
  onSelect: (s: Stock) => void;
  activeNav: string;
  onNavChange: (id: string) => void;
}

export const NAV_ITEMS = [
  { id: 'dividends', label: 'Dividends', icon: '₿' },
  { id: 'nav2', label: '—', icon: '·' },
  { id: 'nav3', label: '—', icon: '·' },
  { id: 'nav4', label: '—', icon: '·' },
  { id: 'nav5', label: '—', icon: '·' },
];

export function Sidebar({ stocks, selectedTicker, onSelect, activeNav, onNavChange }: Props) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stocks;
    return stocks.filter(
      (s) =>
        s.ticker.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q)
    );
  }, [query, stocks]);

  return (
    <aside className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
      <button
        className="sidebar-toggle"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {collapsed ? (
            <>
              <line x1="3" y1="4" x2="13" y2="4" />
              <line x1="3" y1="8" x2="13" y2="8" />
              <line x1="3" y1="12" x2="13" y2="12" />
            </>
          ) : (
            <polyline points="10,4 6,8 10,12" />
          )}
        </svg>
      </button>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-btn${activeNav === item.id ? ' active' : ''}`}
            onClick={() => onNavChange(item.id)}
            title={collapsed ? item.label : undefined}
          >
            <span className="nav-btn-icon">{item.icon}</span>
            {!collapsed && <span className="nav-btn-label">{item.label}</span>}
          </button>
        ))}
      </nav>

      {!collapsed && (
        <>
          <div className="sidebar-section-divider">
            <span>Stocks</span>
          </div>
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
                onClick={() => onSelect(s)}
              >
                <div className="stock-ticker">{s.ticker}</div>
                <div className="stock-name">{s.name}</div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                No matches
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
