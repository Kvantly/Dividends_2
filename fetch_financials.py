import yfinance as yf
import json
import time
import os
from datetime import datetime

SUMMARY_FILE = 'financials_summary.json'
OUTPUT_DIR = 'dividends-app/public/financials'

# Fields to extract from yf.Ticker.info, grouped by section
FIELD_MAP = {
    'valuation': {
        'marketCap':                    'market_cap',
        'enterpriseValue':              'enterprise_value',
        'trailingPE':                   'trailing_pe',
        'forwardPE':                    'forward_pe',
        'pegRatio':                     'peg_ratio',
        'priceToSalesTrailing12Months': 'price_to_sales',
        'priceToBook':                  'price_to_book',
        'enterpriseToRevenue':          'ev_to_revenue',
        'enterpriseToEbitda':           'ev_to_ebitda',
    },
    'per_share': {
        'currentPrice':    'current_price',
        'trailingEps':     'eps_trailing',
        'forwardEps':      'eps_forward',
        'bookValue':       'book_value',
        'revenuePerShare': 'revenue_per_share',
        'currency':        'currency',
    },
    'profitability': {
        'profitMargins':    'profit_margin',
        'operatingMargins': 'operating_margin',
        'grossMargins':     'gross_margin',
        'ebitdaMargins':    'ebitda_margin',
        'returnOnEquity':   'roe',
        'returnOnAssets':   'roa',
    },
    'income': {
        'totalRevenue':    'total_revenue',
        'revenueGrowth':   'revenue_growth',
        'grossProfits':    'gross_profits',
        'ebitda':          'ebitda',
        'netIncomeToCommon': 'net_income',
        'earningsGrowth':  'earnings_growth',
    },
    'balance_sheet': {
        'totalCash':          'total_cash',
        'totalCashPerShare':  'cash_per_share',
        'totalDebt':          'total_debt',
        'debtToEquity':       'debt_to_equity',
        'currentRatio':       'current_ratio',
        'quickRatio':         'quick_ratio',
    },
    'trading': {
        'beta':                   'beta',
        'fiftyTwoWeekHigh':       'week52_high',
        'fiftyTwoWeekLow':        'week52_low',
        'fiftyDayAverage':        'avg50d',
        'twoHundredDayAverage':   'avg200d',
        'averageVolume':          'avg_volume',
        'averageVolume10days':    'avg_volume_10d',
        'sharesOutstanding':      'shares_outstanding',
        'floatShares':            'float_shares',
        'heldPercentInsiders':    'insider_ownership',
        'heldPercentInstitutions':'institutional_ownership',
        'shortRatio':             'short_ratio',
    },
}


def load_stocks():
    with open('oslo_stocks.json', 'r', encoding='utf-8') as f:
        return json.load(f)


def safe_float(val):
    """Return a rounded float or None."""
    if val is None:
        return None
    try:
        f = float(val)
        if f != f:  # NaN check
            return None
        return round(f, 6)
    except (TypeError, ValueError):
        return None


def fetch_financials(ticker, name):
    yahoo_ticker = f"{ticker}.OL"
    try:
        info = yf.Ticker(yahoo_ticker).info
        if not info or info.get('quoteType') is None:
            return None

        result = {
            'ticker': ticker,
            'name': name,
            'last_updated': datetime.now().strftime('%Y-%m-%d'),
        }

        for section, fields in FIELD_MAP.items():
            section_data = {}
            for yf_key, out_key in fields.items():
                val = info.get(yf_key)
                if isinstance(val, str):
                    section_data[out_key] = val
                else:
                    section_data[out_key] = safe_float(val)
            result[section] = section_data

        # Derive useful computed fields
        valuation = result['valuation']
        per_share = result['per_share']

        # P/E label helper stored as string for display
        if valuation.get('trailing_pe') is not None:
            result['_pe_label'] = f"{valuation['trailing_pe']:.2f}x"

        return result

    except Exception as e:
        return None


def main():
    print('\n' + '=' * 60)
    print('OSLO STOCK EXCHANGE - FINANCIALS FETCHER')
    print('=' * 60 + '\n')

    stocks = load_stocks()
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f'Fetching financials for {len(stocks)} stocks...\n')

    successful = 0
    failed = 0
    no_data = 0

    for i, stock in enumerate(stocks, 1):
        ticker = stock['ticker']
        name = stock['name']

        data = fetch_financials(ticker, name)

        if data is not None:
            path = os.path.join(OUTPUT_DIR, f'{ticker}.json')
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
            successful += 1
        else:
            no_data += 1

        if i % 50 == 0 or i == len(stocks):
            print(f'Progress: {i}/{len(stocks)} | ✅ {successful} | ⚠️  {no_data} no data | ❌ {failed} errors')

        if i < len(stocks):
            time.sleep(0.4)

    summary = {
        'fetch_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'total_stocks': len(stocks),
        'successful': successful,
        'no_data': no_data,
        'failed': failed,
    }
    with open(SUMMARY_FILE, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)

    print('\n' + '=' * 60)
    print('COMPLETED')
    print(f'  Successful : {successful}')
    print(f'  No data    : {no_data}')
    print(f'  Failed     : {failed}')
    print('=' * 60 + '\n')


if __name__ == '__main__':
    main()
