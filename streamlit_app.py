import streamlit as st
import pandas as pd
import json
from datetime import datetime
import os

# Page configuration
st.set_page_config(
    page_title="Oslo Stock Exchange",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Title
st.title("📈 Oslo Stock Exchange Dashboard")

# Create tabs
tab1, tab2 = st.tabs(["📋 Stock List", "📊 Historical Data"])

# Load stock list
@st.cache_data
def load_stock_list():
    try:
        with open('oslo_stocks.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        df = pd.DataFrame(data)
        return df
    except FileNotFoundError:
        try:
            df = pd.read_csv('oslo_stocks.csv')
            return df
        except FileNotFoundError:
            return None

# Load historical data
@st.cache_data
def load_historical_data():
    try:
        df = pd.read_csv('all_stocks_historical_data.csv')
        df['Date'] = pd.to_datetime(df['Date'])
        return df
    except FileNotFoundError:
        return None

# Load data
stock_list = load_stock_list()
historical_data = load_historical_data()

# TAB 1: Stock List
with tab1:
    st.markdown("### Current Stock Listings")
    st.markdown("All stocks listed on Oslo Børs, Euronext Growth Oslo, and Euronext Expand Oslo")
    
    if stock_list is None or stock_list.empty:
        st.error("⚠️ No stock list available. Please run the scraper first.")
    else:
        # Show last update
        if 'scraped_date' in stock_list.columns and not stock_list['scraped_date'].isna().all():
            last_update = stock_list['scraped_date'].iloc[0]
            st.success(f"📅 Last updated: {last_update}")
        
        # Sidebar filters
        st.sidebar.header("🔍 Filters")
        search_term = st.sidebar.text_input("Search by name or ticker", "")
        markets = ['All'] + sorted(stock_list['market'].unique().tolist())
        selected_market = st.sidebar.selectbox("Filter by market", markets)
        
        # Apply filters
        filtered_df = stock_list.copy()
        
        if search_term:
            filtered_df = filtered_df[
                filtered_df['name'].str.contains(search_term, case=False, na=False) |
                filtered_df['ticker'].str.contains(search_term, case=False, na=False)
            ]
        
        if selected_market != 'All':
            filtered_df = filtered_df[filtered_df['market'] == selected_market]
        
        # Display statistics
        st.sidebar.markdown("---")
        st.sidebar.header("📊 Statistics")
        st.sidebar.metric("Total Stocks", len(stock_list))
        st.sidebar.metric("Stocks Displayed", len(filtered_df))
        
        # Market breakdown
        st.sidebar.markdown("### Market Breakdown")
        market_counts = stock_list['market'].value_counts()
        for market, count in market_counts.items():
            st.sidebar.write(f"**{market}**: {count}")
        
        # Display table
        st.markdown(f"### Showing {len(filtered_df)} of {len(stock_list)} stocks")
        
        col1, col2 = st.columns([1, 3])
        with col1:
            show_isin = st.checkbox("Show ISIN", value=True)
        
        # Prepare columns
        display_columns = ['name', 'ticker']
        if show_isin:
            display_columns.append('isin')
        display_columns.append('market')
        
        # Display dataframe
        st.dataframe(
            filtered_df[display_columns],
            hide_index=True,
            use_container_width=True,
            height=500
        )
        
        # Download buttons
        st.markdown("---")
        col1, col2 = st.columns(2)
        
        with col1:
            csv = filtered_df.to_csv(index=False).encode('utf-8')
            st.download_button(
                label="📥 Download as CSV",
                data=csv,
                file_name=f'oslo_stocks_{datetime.now().strftime("%Y%m%d")}.csv',
                mime='text/csv',
            )
        
        with col2:
            json_str = filtered_df.to_json(orient='records', indent=2)
            st.download_button(
                label="📥 Download as JSON",
                data=json_str,
                file_name=f'oslo_stocks_{datetime.now().strftime("%Y%m%d")}.json',
                mime='application/json',
            )

# TAB 2: Historical Data
with tab2:
    st.markdown("### Historical Stock Data")
    st.markdown("10 years of historical price and volume data")
    
    if historical_data is None:
        st.warning("📊 No historical data available yet.")
        st.info("""
        **To fetch historical data:**
        1. Go to your GitHub repository
        2. Click on the "Actions" tab
        3. Select "Fetch Historical Stock Data"
        4. Click "Run workflow"
        5. Wait 5-10 minutes for completion
        6. Refresh this page
        """)
        
        # Check if summary exists
        if os.path.exists('historical_data_summary.json'):
            try:
                with open('historical_data_summary.json', 'r') as f:
                    summary = json.load(f)
                st.success("✅ Historical data files found locally!")
                st.json(summary)
            except:
                pass
    else:
        # Load summary if available
        summary = None
        if os.path.exists('historical_data_summary.json'):
            try:
                with open('historical_data_summary.json', 'r') as f:
                    summary = json.load(f)
            except:
                pass
        
        if summary:
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.metric("Total Stocks", summary.get('successful', 'N/A'))
            with col2:
                st.metric("Data Points", f"{summary.get('total_data_points', 0):,}")
            with col3:
                st.metric("Start Date", summary.get('date_range', {}).get('start', 'N/A'))
            with col4:
                st.metric("End Date", summary.get('date_range', {}).get('end', 'N/A'))
            
            st.success(f"📅 Last fetched: {summary.get('fetch_date', 'Unknown')}")
        
        st.markdown("---")
        
        # Stock selector
        available_tickers = sorted(historical_data['Ticker'].unique())
        
        col1, col2 = st.columns([2, 1])
        with col1:
            selected_ticker = st.selectbox(
                "Select a stock to view historical data",
                available_tickers,
                index=0 if available_tickers else None
            )
        
        with col2:
            date_range = st.selectbox(
                "Date range",
                ["10 Years", "5 Years", "3 Years", "1 Year", "6 Months", "3 Months"],
                index=2
            )
        
        if selected_ticker:
            # Filter data for selected stock
            stock_data = historical_data[historical_data['Ticker'] == selected_ticker].copy()
            stock_data = stock_data.sort_values('Date')
            
            # Apply date range filter
            end_date = stock_data['Date'].max()
            if date_range == "6 Months":
                start_date = end_date - pd.DateOffset(months=6)
            elif date_range == "3 Months":
                start_date = end_date - pd.DateOffset(months=3)
            elif date_range == "1 Year":
                start_date = end_date - pd.DateOffset(years=1)
            elif date_range == "3 Years":
                start_date = end_date - pd.DateOffset(years=3)
            elif date_range == "5 Years":
                start_date = end_date - pd.DateOffset(years=5)
            else:  # 10 Years
                start_date = stock_data['Date'].min()
            
            stock_data = stock_data[stock_data['Date'] >= start_date]
            
            # Display stock info
            stock_name = stock_data['Name'].iloc[0] if len(stock_data) > 0 else "Unknown"
            st.subheader(f"{stock_name} ({selected_ticker})")
            
            # Summary statistics
            if len(stock_data) > 0:
                col1, col2, col3, col4, col5 = st.columns(5)
                
                latest_close = stock_data['Close'].iloc[-1]
                earliest_close = stock_data['Close'].iloc[0]
                total_return = ((latest_close - earliest_close) / earliest_close) * 100
                
                with col1:
                    st.metric("Current Price", f"{latest_close:.2f} NOK")
                with col2:
                    st.metric("Period Return", f"{total_return:+.2f}%")
                with col3:
                    st.metric("High", f"{stock_data['High'].max():.2f} NOK")
                with col4:
                    st.metric("Low", f"{stock_data['Low'].min():.2f} NOK")
                with col5:
                    avg_volume = stock_data['Volume'].mean()
                    st.metric("Avg Volume", f"{avg_volume:,.0f}")
                
                st.markdown("---")
                
                # Price chart
                st.markdown("#### 📈 Price Chart")
                chart_data = stock_data.set_index('Date')[['Close', 'High', 'Low']]
                st.line_chart(chart_data, height=400)
                
                # Volume chart
                st.markdown("#### 📊 Volume Chart")
                volume_data = stock_data.set_index('Date')[['Volume']]
                st.bar_chart(volume_data, height=200)
                
                # Data table
                st.markdown("#### 📋 Raw Data")
                st.dataframe(
                    stock_data[['Date', 'Open', 'High', 'Low', 'Close', 'Volume']],
                    hide_index=True,
                    use_container_width=True,
                    height=300
                )
                
                # Download individual stock data
                st.markdown("---")
                csv = stock_data.to_csv(index=False).encode('utf-8')
                st.download_button(
                    label=f"📥 Download {selected_ticker} Historical Data (CSV)",
                    data=csv,
                    file_name=f'{selected_ticker}_historical_{datetime.now().strftime("%Y%m%d")}.csv',
                    mime='text/csv',
                )
            else:
                st.warning("No data available for selected date range")

# Footer
st.markdown("---")
st.markdown("""
<div style='text-align: center; color: gray;'>
    <p>Data sourced from <a href='https://live.euronext.com/nb/markets/oslo/equities/list' target='_blank'>Euronext Oslo</a> 
    and <a href='https://finance.yahoo.com' target='_blank'>Yahoo Finance</a></p>
    <p>Stock list updates monthly • Historical data updates on demand</p>
</div>
""", unsafe_allow_html=True)
