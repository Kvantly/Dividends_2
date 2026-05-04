import yfinance as yf
import pandas as pd
import json
import time
import os
from datetime import datetime, timedelta

SUMMARY_FILE = 'dividend_data_summary.json'
OUTPUT_DIR = 'dividends-app/public/dividends'


def load_stock_tickers():
    print("=" * 60)
    print("Loading stock tickers from oslo_stocks.json...")
    print("=" * 60)
    with open('oslo_stocks.json', 'r', encoding='utf-8') as f:
        stocks = json.load(f)
    print(f"✅ Loaded {len(stocks)} stocks")
    return stocks


def is_first_run():
    return not os.path.exists(SUMMARY_FILE)


def fetch_dividends_for_ticker(ticker, name):
    """Fetch all available dividend history from yfinance."""
    yahoo_ticker = f"{ticker}.OL"
    try:
        stock = yf.Ticker(yahoo_ticker)
        divs = stock.dividends

        if divs is None or divs.empty:
            return None

        records = []
        for ts, amount in divs.items():
            if amount > 0:
                records.append({
                    'date': ts.strftime('%Y-%m-%d'),
                    'amount': round(float(amount), 6),
                })

        if not records:
            return None

        return {
            'ticker': ticker,
            'name': name,
            'dividends': sorted(records, key=lambda x: x['date']),
        }

    except Exception as e:
        print(f"  ❌ {ticker}: {e}")
        return None


def load_existing(ticker):
    path = os.path.join(OUTPUT_DIR, f"{ticker}.json")
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None


def save_ticker_file(data, ticker):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, f"{ticker}.json")
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)


def merge_dividends(existing_records, new_records):
    """Merge new records into existing, dedup by date, keep newest amount."""
    by_date = {r['date']: r['amount'] for r in existing_records}
    for r in new_records:
        by_date[r['date']] = r['amount']
    return sorted(
        [{'date': d, 'amount': a} for d, a in by_date.items()],
        key=lambda x: x['date'],
    )


def main():
    print("\n" + "=" * 60)
    print("OSLO STOCK EXCHANGE - DIVIDEND DATA FETCHER")
    print("=" * 60 + "\n")

    stocks = load_stock_tickers()
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    first_run = is_first_run()
    cutoff_date = None

    if first_run:
        print("🚀 FIRST RUN — fetching up to 10 years of dividend history")
        cutoff_str = (datetime.now() - timedelta(days=365 * 10)).strftime('%Y-%m-%d')
        mode = "FULL"
    else:
        print("🔄 INCREMENTAL UPDATE — merging last 6 months of dividends")
        cutoff_str = (datetime.now() - timedelta(days=180)).strftime('%Y-%m-%d')
        cutoff_date = pd.Timestamp(cutoff_str, tz='UTC')
        mode = "INCREMENTAL"

    successful = 0
    failed = 0
    with_dividends = 0

    for i, stock in enumerate(stocks, 1):
        ticker = stock['ticker']
        name = stock['name']

        fetched = fetch_dividends_for_ticker(ticker, name)

        if first_run:
            if fetched is not None:
                # Filter to last 10 years
                fetched['dividends'] = [
                    r for r in fetched['dividends'] if r['date'] >= cutoff_str
                ]
                fetched['last_updated'] = datetime.now().strftime('%Y-%m-%d')
                if fetched['dividends']:
                    save_ticker_file(fetched, ticker)
                    with_dividends += 1
            successful += 1
        else:
            existing = load_existing(ticker)

            if existing is None:
                # No file yet — save everything we got (full history for this ticker)
                if fetched is not None and fetched['dividends']:
                    fetched['last_updated'] = datetime.now().strftime('%Y-%m-%d')
                    save_ticker_file(fetched, ticker)
                    with_dividends += 1
            else:
                # Merge: only use new records that fall within the 6-month window
                new_records = []
                if fetched is not None:
                    new_records = [
                        r for r in fetched['dividends'] if r['date'] >= cutoff_str
                    ]
                existing['dividends'] = merge_dividends(
                    existing.get('dividends', []), new_records
                )
                existing['last_updated'] = datetime.now().strftime('%Y-%m-%d')
                save_ticker_file(existing, ticker)
                if existing['dividends']:
                    with_dividends += 1

            successful += 1

        if i % 50 == 0 or i == len(stocks):
            print(
                f"📊 Progress: {i}/{len(stocks)} | "
                f"✅ {successful} | ❌ {failed} | 💰 {with_dividends} with dividends"
            )

        if i < len(stocks):
            time.sleep(0.3)

    summary = {
        'mode': mode,
        'fetch_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'total_stocks': len(stocks),
        'successful': successful,
        'failed': failed,
        'stocks_with_dividends': with_dividends,
    }
    with open(SUMMARY_FILE, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)

    print("\n" + "=" * 60)
    print(f"✅ {mode} COMPLETED")
    print(f"   Stocks processed : {len(stocks)}")
    print(f"   Successful       : {successful}")
    print(f"   Failed           : {failed}")
    print(f"   With dividends   : {with_dividends}")
    print("=" * 60 + "\n")


if __name__ == '__main__':
    main()
