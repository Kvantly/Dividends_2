import { useStockPick } from '../hooks/useStockPick';
import { StockCard } from './StockCard';
import { Loading } from './Loading';

interface Props {
  onBack: () => void;
}

export function StockView({ onBack }: Props) {
  const { pick, loading, error } = useStockPick(true);

  return (
    <section className="stock-section">
      <button className="back-button" onClick={onBack}>
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back
      </button>

      {error && <div className="error">Failed to load pick: {error}</div>}

      {!pick && loading && <Loading message="Analyzing market data..." />}

      {pick && <StockCard pick={pick} priceLoading={loading} />}
    </section>
  );
}
