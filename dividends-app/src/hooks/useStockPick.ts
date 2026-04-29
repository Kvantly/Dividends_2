import { useEffect, useState } from 'react';
import type { Stock, StockPick } from '../types';
import { pickWeeklyStock } from '../lib/pickStock';
import { getPriceData } from '../lib/priceData';

interface State {
  pick: StockPick | null;
  loading: boolean;
  error: string | null;
}

export function useStockPick(enabled: boolean): State {
  const [state, setState] = useState<State>({
    pick: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function run() {
      setState({ pick: null, loading: true, error: null });
      try {
        const res = await fetch('/oslo_stocks.json');
        if (!res.ok) throw new Error(`Could not load stock list (${res.status})`);
        const stocks: Stock[] = await res.json();
        if (stocks.length === 0) throw new Error('Stock list is empty');

        const chosen = pickWeeklyStock(stocks);
        // Show the pick immediately; price loads after.
        if (!cancelled) {
          setState({
            pick: { ...chosen, price: null },
            loading: true,
            error: null,
          });
        }

        const price = await getPriceData(chosen.ticker);
        if (!cancelled) {
          setState({
            pick: { ...chosen, price },
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            pick: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
}
