import { useEffect, useState } from 'react';
import type { Stock } from '../types';

interface State {
  stocks: Stock[];
  loading: boolean;
  error: string | null;
}

export function useStockList(): State {
  const [state, setState] = useState<State>({
    stocks: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/oslo_stocks.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Stock[] = await res.json();
        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
        if (!cancelled) {
          setState({ stocks: sorted, loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            stocks: [],
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load stocks',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
