import json
import os
import time

import yfinance as yf

STOCKS_FILE = 'oslo_stocks.json'
OUTPUT_DIR = 'dividends-app/public/dividends'


def load_stocks():
    print('=' * 60)
    print('Loading stock tickers from oslo_stocks.json...')
    print('=' * 60)
    with open(STOCKS_FILE, encoding='utf-8') as f:
        stocks = json.load(f)
    print(f'Loaded {len(stocks)} stocks')
    return stocks


def fetch_dividends(ticker: str) -> list[dict]:
    """
    Use history(actions=True) — the same reliable endpoint used for price data.
    Rows where the Dividends column is non-zero are ex-dividend dates.
    """
    t = yf.Ticker(f'{ticker}.OL')
    hist = t.history(period='10y', actions=True)

    if hist.empty or 'Dividends' not in hist.columns:
        return []

    div_rows = hist[hist['Dividends'] > 0]['Dividends']
    if div_rows.empty:
        return []

    return [
        {'date': idx.strftime('%Y-%m-%d'), 'amount': round(float(val), 6)}
        for idx, val in div_rows.items()
    ]


def main():
    stocks = load_stocks()
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    success = 0
    failed = 0
    has_data = 0

    for i, stock in enumerate(stocks, 1):
        ticker = stock['ticker']
        try:
            rows = fetch_dividends(ticker)
            out_path = os.path.join(OUTPUT_DIR, f'{ticker}.json')
            with open(out_path, 'w') as f:
                json.dump(rows, f)

            if rows:
                has_data += 1
                print(f'[{i}/{len(stocks)}] {ticker}: {len(rows)} dividends')
            else:
                print(f'[{i}/{len(stocks)}] {ticker}: no dividends')

            success += 1
        except Exception as e:
            print(f'[{i}/{len(stocks)}] {ticker}: FAILED - {e}')
            failed += 1

        if i < len(stocks):
            time.sleep(0.4)

        if i % 50 == 0:
            print(f'\n--- Progress: {i}/{len(stocks)} | OK: {success} | Failed: {failed} ---\n')

    print('\n' + '=' * 60)
    print('DIVIDEND FETCH COMPLETE')
    print('=' * 60)
    print(f'  Total:      {len(stocks)}')
    print(f'  Successful: {success}')
    print(f'  Failed:     {failed}')
    print(f'  With data:  {has_data}')
    print(f'  Output:     {OUTPUT_DIR}/')
    print('=' * 60)


if __name__ == '__main__':
    main()
