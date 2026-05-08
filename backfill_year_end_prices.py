"""
One-time backfill: add year_end_prices to all existing dividend JSON files.
Reads each file, fetches 10Y of daily price history from yfinance,
extracts the last trading-day close per calendar year, and writes it back.
Safe to re-run — existing year_end_prices values are preserved and updated.
"""

import yfinance as yf
import json
import os
import time

DIVIDENDS_DIR = 'dividends-app/public/dividends'


def fetch_year_end_prices(ticker):
    yahoo_ticker = f"{ticker}.OL"
    try:
        hist = yf.Ticker(yahoo_ticker).history(period='10y', interval='1d')
        if hist is None or hist.empty:
            return {}
        year_prices = {}
        for ts, row in hist.iterrows():
            year = str(ts.year)
            year_prices[year] = round(float(row['Close']), 4)
        return year_prices
    except Exception as e:
        print(f"  ⚠️  {ticker}: {e}")
        return {}


def main():
    if not os.path.exists(DIVIDENDS_DIR):
        print(f"❌  Directory not found: {DIVIDENDS_DIR}")
        return

    files = [f for f in os.listdir(DIVIDENDS_DIR) if f.endswith('.json')]
    print(f'Found {len(files)} dividend files to backfill\n')

    updated = 0
    skipped = 0

    for i, filename in enumerate(sorted(files), 1):
        ticker = filename[:-5]
        path = os.path.join(DIVIDENDS_DIR, filename)

        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        prices = fetch_year_end_prices(ticker)
        if not prices:
            skipped += 1
            print(f'  [{i}/{len(files)}] ⚠️  {ticker}: no price data')
        else:
            # Merge: overlay fresh prices on top of any existing ones
            existing = data.get('year_end_prices', {})
            existing.update(prices)
            data['year_end_prices'] = existing
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
            updated += 1
            if i % 25 == 0 or i == len(files):
                print(f'  [{i}/{len(files)}] ✅ {updated} updated, {skipped} skipped so far')

        time.sleep(0.25)

    print(f'\n✅ Done — {updated} files updated, {skipped} skipped')


if __name__ == '__main__':
    main()
