import { useMemo, useState } from 'react';
import type { Stock } from '../types';

interface Props {
  stocks: Stock[];
  selectedTicker: string | null;
  onSelect: (s: Stock) => void;
}

export function Sidebar({ stocks, selectedTicker, onSelect }: Props) {
  const [query, setQuery] = useState('');

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
    <aside className="sidebar">
      <div className="search-wrap">
        <input
          className="search-input"
          type="search"
          placeholder="Search ticker or name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="sidebar-meta">
        {filtered.length} stocks
      </div>
      <div className="stock-list">
        {filtered.map((s) => (
          <div
            key={s.ticker + s.isin}
            className={`stock-row${s.ticker === selectedTicker ? ' active' : ''}`}
            onClick={() => onSelect(s)}
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
    </aside>
  );
}
