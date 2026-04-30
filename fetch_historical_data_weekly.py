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
        df['Date'] = pd.to_datetime(df['Date'], utc=True)
        
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
        
        # Normalize Date column to UTC so we never get mixed-timezone errors
        # when concatenating data fetched at different times of year (DST changes).
        hist['Date'] = pd.to_datetime(hist['Date'], utc=True)
        
        # Add ticker and name columns
        hist['Ticker'] = ticker
        hist['Name'] = stock_name
        
        # Select columns
        columns_to_keep = ['Date', 'Ticker', 'Name', 'Open', 'High', 'Low', 'Close', 'Volume']
        
        # Check if Adj Close exists and add it
        if 'Adj Close' in hist.columns:
            columns_to_keep.insert(6, 'Adj Close')
        
        hist = hist[columns_to_keep]
