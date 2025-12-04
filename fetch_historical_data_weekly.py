import yfinance as yf
import pandas as pd
import json
import time
from datetime import datetime, timedelta
import os

def load_stock_tickers():
    """Load stock tickers from oslo_stocks.json"""
    print("="*60)
    print("Loading stock tickers from oslo_stocks.json...")
    print("="*60)
    
    try:
        with open('oslo_stocks.json', 'r', encoding='utf-8') as f:
            stocks = json.load(f)
        
        print(f"✅ Loaded {len(stocks)} stocks")
        return stocks
    except FileNotFoundError:
        print("❌ Error: oslo_stocks.json not found!")
        print("Please run the scraper first to generate the stock list.")
        return []

def check_existing_data():
    """Check if historical data already exists"""
    if os.path.exists('all_stocks_historical_data.csv'):
        print("\n📁 Existing historical data found!")
        df = pd.read_csv('all_stocks_historical_data.csv')
        df['Date'] = pd.to_datetime(df['Date'])
        
        latest_date = df['Date'].max()
        earliest_date = df['Date'].min()
        
        print(f"   Date range: {earliest_date.strftime('%Y-%m-%d')} to {latest_date.strftime('%Y-%m-%d')}")
        print(f"   Total rows: {len(df):,}")
        print(f"   Unique stocks: {df['Ticker'].nunique()}")
        
        return df, latest_date
    else:
        print("\n📁 No existing data found - will perform full historical fetch (10 years)")
        return None, None

def fetch_stock_data(ticker, stock_name, period="10y", is_update=False):
    """Fetch historical data for a single stock"""
    try:
        # Add .OL suffix for Oslo Stock Exchange
        yahoo_ticker = f"{ticker}.OL"
        
        if not is_update:
            print(f"  📊 Fetching {ticker} ({stock_name})...")
        
        # Create yfinance Ticker object
        stock = yf.Ticker(yahoo_ticker)
        
        # Fetch historical data
        hist = stock.history(period=period)
        
        if hist.empty:
            if not is_update:
                print(f"  ⚠️  No data available for {ticker}")
            return None
        
        # Reset index to make Date a column
        hist.reset_index(inplace=True)
        
        # Add ticker and name columns
        hist['Ticker'] = ticker
        hist['Name'] = stock_name
        
        # Select columns
        columns_to_keep = ['Date', 'Ticker', 'Name', 'Open', 'High', 'Low', 'Close', 'Volume']
        
        # Check if Adj Close exists and add it
        if 'Adj Close' in hist.columns:
            columns_to_keep.insert(6, 'Adj Close')
        
        hist = hist[columns_to_keep]
        
        if not is_update:
            print(f"  ✅ Retrieved {len(hist)} days of data for {ticker}")
        
        return hist
        
    except Exception as e:
        if not is_update:
            print(f"  ❌ Error fetching {ticker}: {e}")
        return None

def full_fetch(stocks):
    """Perform full 10-year historical fetch"""
    print("\n" + "="*60)
    print("FULL HISTORICAL FETCH (10 YEARS)")
    print("="*60)
    print(f"🚀 Fetching 10 years of data for {len(stocks)} stocks...")
    print("This will take approximately 5-10 minutes\n")
    
    all_data = []
    successful = 0
    failed = 0
    
    # Create directory for individual stock files
    os.makedirs('stock_data', exist_ok=True)
    
    for i, stock in enumerate(stocks, 1):
        ticker = stock['ticker']
        name = stock['name']
        
        print(f"\n[{i}/{len(stocks)}] Processing {ticker}...")
        
        # Fetch 10 years of data
        data = fetch_stock_data(ticker, name, period="10y", is_update=False)
        
        if data is not None and not data.empty:
            all_data.append(data)
            successful += 1
            
            # Save individual stock file
            filename = f"stock_data/{ticker}.csv"
            data.to_csv(filename, index=False)
            print(f"  💾 Saved to {filename}")
        else:
            failed += 1
        
        # Rate limiting
        if i < len(stocks):
            time.sleep(0.5)
        
        # Progress update every 50 stocks
        if i % 50 == 0:
            print(f"\n📊 Progress: {i}/{len(stocks)} stocks processed")
            print(f"   ✅ Successful: {successful}")
            print(f"   ❌ Failed: {failed}\n")
    
    return all_data, successful, failed

def incremental_update(stocks, existing_df):
    """Fetch only last 4 weeks and merge with existing data"""
    print("\n" + "="*60)
    print("INCREMENTAL UPDATE (LAST 4 WEEKS)")
    print("="*60)
    print(f"🔄 Updating {len(stocks)} stocks with recent data...")
    print("This will take approximately 2-3 minutes\n")
    
    new_data = []
    successful = 0
    failed = 0
    updated_stocks = []
    
    for i, stock in enumerate(stocks, 1):
        ticker = stock['ticker']
        name = stock['name']
        
        # Fetch last 1 month (which gives us ~4 weeks of trading days)
        data = fetch_stock_data(ticker, name, period="1mo", is_update=True)
        
        if data is not None and not data.empty:
            new_data.append(data)
            successful += 1
            updated_stocks.append(ticker)
            
            # Update individual stock file if it exists
            filename = f"stock_data/{ticker}.csv"
            if os.path.exists(filename):
                try:
                    # Load existing data
                    existing_stock_df = pd.read_csv(filename)
                    existing_stock_df['Date'] = pd.to_datetime(existing_stock_df['Date'])
                    
                    # Combine with new data
                    combined = pd.concat([existing_stock_df, data], ignore_index=True)
                    
                    # Remove duplicates, keeping the most recent
                    combined = combined.drop_duplicates(subset=['Date'], keep='last')
                    combined = combined.sort_values('Date')
                    
                    # Save updated file
                    combined.to_csv(filename, index=False)
                except Exception as e:
                    print(f"  ⚠️  Could not update {filename}: {e}")
            else:
                # File doesn't exist, create it
                data.to_csv(filename, index=False)
        else:
            failed += 1
        
        # Rate limiting
        if i < len(stocks):
            time.sleep(0.3)  # Faster for updates
        
        # Progress update
        if i % 100 == 0:
            print(f"📊 Progress: {i}/{len(stocks)} - Updated: {successful}, Failed: {failed}")
    
    if not new_data:
        print("\n⚠️  No new data fetched")
        return None, 0, len(stocks)
    
    # Combine all new data
    new_df = pd.concat(new_data, ignore_index=True)
    new_df['Date'] = pd.to_datetime(new_df['Date'])
    
    print(f"\n✅ Fetched {len(new_df):,} new data points")
    
    # Merge with existing data
    print("🔄 Merging with existing data...")
    
    # Combine old and new data
    combined_df = pd.concat([existing_df, new_df], ignore_index=True)
    
    # Remove duplicates (keeping the most recent)
    # This handles cases where a date might be updated with corrected values
    combined_df = combined_df.drop_duplicates(subset=['Date', 'Ticker'], keep='last')
    
    # Sort by ticker and date
    combined_df = combined_df.sort_values(['Ticker', 'Date'])
    
    rows_before = len(existing_df)
    rows_after = len(combined_df)
    new_rows = rows_after - rows_before
    
    print(f"   Before: {rows_before:,} rows")
    print(f"   After: {rows_after:,} rows")
    print(f"   New: {new_rows:,} rows added")
    
    return combined_df, successful, failed

def main():
    print("\n" + "="*60)
    print("OSLO STOCK EXCHANGE - HISTORICAL DATA MANAGER")
    print("="*60 + "\n")
    
    # Load stock list
    stocks = load_stock_tickers()
    
    if not stocks:
        print("No stocks to process. Exiting.")
        exit(1)
    
    # Check if existing data exists
    existing_df, latest_date = check_existing_data()
    
    # Determine whether to do full fetch or incremental update
    is_first_run = existing_df is None
    
    if is_first_run:
        # Full fetch (10 years)
        all_data, successful, failed = full_fetch(stocks)
        
        if all_data:
            combined_df = pd.concat(all_data, ignore_index=True)
            combined_df = combined_df.sort_values(['Ticker', 'Date'])
            mode = "FULL FETCH"
        else:
            print("\n❌ No data was successfully fetched.")
            exit(1)
    else:
        # Incremental update (last 4 weeks)
        combined_df, successful, failed = incremental_update(stocks, existing_df)
        
        if combined_df is None:
            print("\n❌ Update failed.")
            exit(1)
        
        mode = "INCREMENTAL UPDATE"
    
    # Save combined data
    print("\n💾 Saving combined data...")
    combined_df.to_csv('all_stocks_historical_data.csv', index=False)
    print(f"✅ Saved: all_stocks_historical_data.csv")
    print(f"   Total rows: {len(combined_df):,}")
    
    # Calculate file size
    file_size = os.path.getsize('all_stocks_historical_data.csv') / (1024 * 1024)
    print(f"   File size: {file_size:.1f} MB")
    
    # Create summary
    summary = {
        'mode': mode,
        'fetch_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'total_stocks': len(stocks),
        'successful': successful,
        'failed': failed,
        'total_data_points': len(combined_df),
        'date_range': {
            'start': combined_df['Date'].min().strftime('%Y-%m-%d'),
            'end': combined_df['Date'].max().strftime('%Y-%m-%d')
        }
    }
    
    with open('historical_data_summary.json', 'w') as f:
        json.dump(summary, f, indent=2)
    print(f"✅ Saved: historical_data_summary.json")
    
    # Show sample
    print("\n📋 Sample data (first 5 rows):")
    print(combined_df.head().to_string())
    
    print("\n" + "="*60)
    print(f"✅ {mode} COMPLETED SUCCESSFULLY")
    print("="*60)
    print(f"📊 Summary:")
    print(f"   Mode: {mode}")
    print(f"   Stocks processed: {len(stocks)}")
    print(f"   Successful: {successful}")
    print(f"   Failed: {failed}")
    print(f"   Total data points: {len(combined_df):,}")
    print(f"   Date range: {summary['date_range']['start']} to {summary['date_range']['end']}")
    print("="*60 + "\n")

if __name__ == '__main__':
    main()
