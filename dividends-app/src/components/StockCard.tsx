import type { StockPick } from '../types';

interface Props {
  pick: StockPick;
  priceLoading: boolean;
}

function formatPrice(value: number, currency: string): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted} ${currency}`;
}

export function StockCard({ pick, priceLoading }: Props) {
  const { price } = pick;
  const isPositive = price?.changePercent != null && price.changePercent >= 0;

  return (
    <>
      <p className="section-label">This Week's Pick</p>
      <div className="stock-card">
        <div className="stock-header">
          <div className="stock-info">
            <h2>{pick.ticker}</h2>
            <span className="company-name">{pick.name}</span>
          </div>
          <div className="stock-change">
            {price ? (
              <>
                <span className="stock-price">
                  {formatPrice(price.current, price.currency)}
                </span>
                {price.changePercent != null && (
                  <span
                    className={`change-badge ${
                      isPositive ? 'positive' : 'negative'
                    }`}
                  >
                    <svg
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d={isPositive ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
                      />
                    </svg>
                    {isPositive ? '+' : ''}
                    {price.changePercent.toFixed(2)}%
                  </span>
                )}
              </>
            ) : priceLoading ? (
              <span className="stock-price unavailable">Loading price…</span>
            ) : (
              <span className="stock-price unavailable">Price N/A</span>
            )}
          </div>
        </div>

        <div className="stock-metrics">
          <div className="metric">
            <div className="metric-value">{pick.market}</div>
            <div className="metric-label">Market</div>
          </div>
          <div className="metric">
            <div className="metric-value" style={{ fontSize: 12 }}>
              {pick.isin}
            </div>
            <div className="metric-label">ISIN</div>
          </div>
          <div className="metric">
            <div className="metric-value">
              {price?.weekAgo != null
                ? formatPrice(price.weekAgo, price.currency)
                : '—'}
            </div>
            <div className="metric-label">7d Ago</div>
          </div>
        </div>

        <div className="stock-rationale">
          <div className="rationale-label">
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            About This Pick
          </div>
          <p>
            {pick.name} (ticker <strong>{pick.ticker}</strong>) is listed on the{' '}
            {pick.market} segment of Euronext Oslo. This week's selection is
            deterministic — every visitor sees the same pick until Monday.
          </p>
        </div>
      </div>

      <div className="disclaimer">
        ⚠️ This is not financial advice. Always do your own research before
        investing.
      </div>
    </>
  );
}
