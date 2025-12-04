import streamlit as st
import pandas as pd
import json
from datetime import datetime

# Page configuration
st.set_page_config(
    page_title="Oslo Stock Exchange",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Title and description
st.title("📈 Oslo Stock Exchange - Live Listings")
st.markdown("Real-time data from Oslo Børs, Euronext Growth Oslo, and Euronext Expand Oslo")

# Load data
@st.cache_data
def load_data():
    try:
        # Try to load from JSON first
        with open('oslo_stocks.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        df = pd.DataFrame(data)
        return df
    except FileNotFoundError:
        # If JSON doesn't exist, try CSV
        try:
            df = pd.read_csv('oslo_stocks.csv')
            return df
        except FileNotFoundError:
            return None

# Load the data
df = load_data()

if df is None or df.empty:
    st.error("⚠️ No data available. Please run the scraper first to collect stock data.")
    st.info("The GitHub Action should run on the 1st of each month to update the data.")
    st.stop()

# Show last update date
if 'scraped_date' in df.columns and not df['scraped_date'].isna().all():
    last_update = df['scraped_date'].iloc[0]
    st.success(f"📅 Last updated: {last_update}")
else:
    st.info("📅 Data update date not available")

# Sidebar filters
st.sidebar.header("🔍 Filters")

# Search by name or ticker
search_term = st.sidebar.text_input("Search by name or ticker", "")

# Filter by market
markets = ['All'] + sorted(df['market'].unique().tolist())
selected_market = st.sidebar.selectbox("Filter by market", markets)

# Apply filters
filtered_df = df.copy()

if search_term:
    filtered_df = filtered_df[
        filtered_df['name'].str.contains(search_term, case=False, na=False) |
        filtered_df['ticker'].str.contains(search_term, case=False, na=False)
    ]

if selected_market != 'All':
    filtered_df = filtered_df[filtered_df['market'] == selected_market]

# Display statistics in sidebar
st.sidebar.markdown("---")
st.sidebar.header("📊 Statistics")
st.sidebar.metric("Total Stocks", len(df))
st.sidebar.metric("Stocks Displayed", len(filtered_df))

# Market breakdown
st.sidebar.markdown("### Market Breakdown")
market_counts = df['market'].value_counts()
for market, count in market_counts.items():
    st.sidebar.write(f"**{market}**: {count}")

# Main content - display the table
st.markdown(f"### Showing {len(filtered_df)} of {len(df)} stocks")

# Display options
col1, col2, col3 = st.columns([1, 1, 2])
with col1:
    show_isin = st.checkbox("Show ISIN", value=True)
with col2:
    page_size = st.selectbox("Rows per page", [25, 50, 100, 200], index=1)

# Prepare columns to display
display_columns = ['name', 'ticker']
if show_isin:
    display_columns.append('isin')
display_columns.append('market')

# Rename columns for better display
column_config = {
    'name': st.column_config.TextColumn('Stock Name', width='large'),
    'ticker': st.column_config.TextColumn('Ticker', width='small'),
    'isin': st.column_config.TextColumn('ISIN', width='medium'),
    'market': st.column_config.TextColumn('Market', width='small'),
}

# Display the dataframe with pagination
st.dataframe(
    filtered_df[display_columns],
    column_config=column_config,
    hide_index=True,
    use_container_width=True,
    height=600
)

# Download button
st.markdown("---")
col1, col2, col3 = st.columns([1, 1, 2])

with col1:
    # Download as CSV
    csv = filtered_df.to_csv(index=False).encode('utf-8')
    st.download_button(
        label="📥 Download as CSV",
        data=csv,
        file_name=f'oslo_stocks_{datetime.now().strftime("%Y%m%d")}.csv',
        mime='text/csv',
    )

with col2:
    # Download as JSON
    json_str = filtered_df.to_json(orient='records', indent=2)
    st.download_button(
        label="📥 Download as JSON",
        data=json_str,
        file_name=f'oslo_stocks_{datetime.now().strftime("%Y%m%d")}.json',
        mime='application/json',
    )

# Footer
st.markdown("---")
st.markdown("""
<div style='text-align: center; color: gray;'>
    <p>Data scraped from <a href='https://live.euronext.com/nb/markets/oslo/equities/list' target='_blank'>Euronext Oslo</a></p>
    <p>Updates automatically on the 1st of each month via GitHub Actions</p>
</div>
""", unsafe_allow_html=True)
