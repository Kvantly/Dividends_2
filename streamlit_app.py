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
tab1, tab2 = st.tabs(["📋 Stock List", "📊 Historical Data & Charts"])

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
        st.sidebar.header("🔍 Stock List Filters")
        
        # Search box
        search_term = st.sidebar.text_input("Search by name or ticker:", "")
        
        # Market filter
        markets = ['All'] + sorted(stock_list['market'].unique().tolist())
        selected_market = st.sidebar.selectbox("Filter by market:", markets)
        
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
    st.markdown("### Historical Stock Data & Charts")
    
    if historical_data is None:
        st.warning("📊 No historical data available yet.")
        st.info("""
        **To fetch historical data:**
        1. Go to your GitHub repository
        2. Click on the "Actions" tab
        3. Select "Weekly Stock Data Update"
        4. Click "Run workflow"
        5. Wait 5-10 minutes for initial fetch
        6. Refresh this page
        
        After the first run, data updates automatically every Monday!
        """)
        
        # Check if summary exists
        if os.path.exists('historical_data_summary.json'):
            try:
                with open('historical_data_summary.json', 'r') as f:
                    summary = json.load(f)
                st.success("✅ Historical data files found!")
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
        
        # Display summary metrics
        if summary:
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.metric("Total Stocks", summary.get('successful', 'N/A'))
            with col2:
                st.metric("Data Points", f"{summary.get('total_data_points', 0):,}")
            with col3:
                st.metric("From", summary.get('date_range', {}).get('start', 'N/A'))
            with col4:
                st.metric("To", summary.get('date_range', {}).get('end', 'N/A'))
            
            st.success(f"📅 Last updated: {summary.get('fetch_date', 'Unknown')}")
        
        st.markdown("---")
        
        # Prepare stock selection options
        stock_options = historical_data[['Ticker', 'Name']].drop_duplicates().sort_values('Name')
        
        # Create display format: "Stock Name (TICKER)"
        stock_choices = [f"{row['Name']} ({row['Ticker']})" for _, row in stock_options.iterrows()]
        stock_dict = {f"{row['Name']} ({row['Ticker']})": row['Ticker'] 
                      for _, row in stock_options.iterrows()}
        
        # MAIN AREA: Stock selector with search
        st.markdown("### 🔍 Select Stock")
        
        col1, col2 = st.columns([3, 1])
        
        with col1:
            # Searchable combobox for stock selection by name
            selected_display = st.selectbox(
                "Search or select a stock by name:",
                options=stock_choices,
                index=0,
                help="Type to search, or scroll to browse all stocks"
            )
        
        with col2:
            # Quick jump to random stock (fun feature)
            if st.button("🎲 Random Stock"):
                import random
                selected_display = random.choice(stock_choices)
                st.rerun()
        
        # Get the ticker from selection
        selected_ticker = stock_dict[selected_display]
        selected_name = selected_display.split(' (')[0]
        
        # SIDEBAR: Chart settings
        st.sidebar.markdown("---")
        st.sidebar.header("📊 Chart Settings")
        
        # Date range selector
        date_range = st.sidebar.selectbox(
            "Time Period:",
            ["10 Years", "5 Years", "3 Years", "1 Year", "6 Months", "3 Months", "1 Month"],
            index=2
        )
        
        # Chart type selector
        st.sidebar.markdown("### Chart Options")
        show_volume = st.sidebar.checkbox("Show Volume Chart", value=True)
        show_high_low = st.sidebar.checkbox("Show High/Low Lines", value=False)
        
        st.markdown("---")
        
        # Filter data for selected stock
        stock_data = historical_data[historical_data['Ticker'] == selected_ticker].copy()
        stock_data = stock_data.sort_values('Date')
        
        # Apply date range filter
        end_date = stock_data['Date'].max()
        if date_range == "1 Month":
            start_date = end_date - pd.DateOffset(months=1)
        elif date_range == "3 Months":
            start_date = end_date - pd.DateOffset(months=3)
        elif date_range == "6 Months":
            start_date = end_date - pd.DateOffset(months=6)
        elif date_range == "1 Year":
            start_date = end_date - pd.DateOffset(years=1)
        elif date_range == "3 Years":
            start_date = end_date - pd.DateOffset(years=3)
        elif date_range == "5 Years":
            start_date = end_date - pd.DateOffset(years=5)
        else:  # 10 Years
            start_date = stock_data['Date'].min()
        
        stock_data = stock_data[stock_data['Date'] >= start_date]
        
        # Display stock header
        st.subheader(f"📈 {selected_name} ({selected_ticker})")
        
        # Summary statistics
        if len(stock_data) > 0:
            col1, col2, col3, col4, col5, col6 = st.columns(6)
            
            latest_close = stock_data['Close'].iloc[-1]
            earliest_close = stock_data['Close'].iloc[0]
            total_return = ((latest_close - earliest_close) / earliest_close) * 100
            
            with col1:
                st.metric("Latest Price", f"{latest_close:.2f} NOK")
            with col2:
                st.metric("Period Return", f"{total_return:+.2f}%", 
                         delta=f"{total_return:+.2f}%")
            with col3:
                st.metric("High", f"{stock_data['High'].max():.2f} NOK")
            with col4:
                st.metric("Low", f"{stock_data['Low'].min():.2f} NOK")
            with col5:
                avg_volume = stock_data['Volume'].mean()
                st.metric("Avg Volume", f"{avg_volume:,.0f}")
            with col6:
                st.metric("Trading Days", len(stock_data))
            
            st.markdown("---")
            
            # Price chart
            st.markdown("#### 💹 Price Chart")
            
            # Prepare chart data
            if show_high_low:
                chart_data = stock_data.set_index('Date')[['Close', 'High', 'Low']]
            else:
                chart_data = stock_data.set_index('Date')[['Close']]
            
            st.line_chart(chart_data, height=400)
            
            # Volume chart
            if show_volume:
                st.markdown("#### 📊 Volume Chart")
                volume_data = stock_data.set_index('Date')[['Volume']]
                st.bar_chart(volume_data, height=200)
            
            # Statistics table
            st.markdown("#### 📋 Statistics")
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.markdown("**Price Statistics**")
                price_stats = pd.DataFrame({
                    'Metric': ['Current', 'Mean', 'Median', 'Std Dev', 'Min', 'Max'],
                    'Value': [
                        f"{latest_close:.2f} NOK",
                        f"{stock_data['Close'].mean():.2f} NOK",
                        f"{stock_data['Close'].median():.2f} NOK",
                        f"{stock_data['Close'].std():.2f} NOK",
                        f"{stock_data['Close'].min():.2f} NOK",
                        f"{stock_data['Close'].max():.2f} NOK"
                    ]
                })
                st.dataframe(price_stats, hide_index=True, use_container_width=True)
            
            with col2:
                st.markdown("**Volume Statistics**")
                volume_stats = pd.DataFrame({
                    'Metric': ['Today', 'Mean', 'Median', 'Min', 'Max'],
                    'Value': [
                        f"{stock_data['Volume'].iloc[-1]:,.0f}",
                        f"{stock_data['Volume'].mean():,.0f}",
                        f"{stock_data['Volume'].median():,.0f}",
                        f"{stock_data['Volume'].min():,.0f}",
                        f"{stock_data['Volume'].max():,.0f}"
                    ]
                })
                st.dataframe(volume_stats, hide_index=True, use_container_width=True)
            
            # Raw data table
            st.markdown("---")
            st.markdown("#### 📋 Raw Data")
            
            # Show last 100 rows by default
            show_all = st.checkbox("Show all data", value=False)
            
            if show_all:
                display_data = stock_data[['Date', 'Open', 'High', 'Low', 'Close', 'Volume']]
            else:
                display_data = stock_data[['Date', 'Open', 'High', 'Low', 'Close', 'Volume']].tail(100)
                st.caption(f"Showing last 100 rows of {len(stock_data)} total rows")
            
            st.dataframe(
                display_data,
                hide_index=True,
                use_container_width=True,
                height=300
            )
            
            # Download button
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
    <p>Data from <a href='https://live.euronext.com/nb/markets/oslo/equities/list' target='_blank'>Euronext Oslo</a> 
    and <a href='https://finance.yahoo.com' target='_blank'>Yahoo Finance</a></p>
    <p>Stock list updates monthly • Historical data updates weekly</p>
</div>
""", unsafe_allow_html=True)
