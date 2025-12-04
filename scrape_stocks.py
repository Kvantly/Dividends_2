import time
import json
import csv
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def scrape_euronext_oslo():
    """Scrape stock names and tickers from Euronext Oslo"""
    
    # Set up Chrome options for headless browsing
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920,1080')
    
    # Initialize the driver
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        print("Loading page...")
        driver.get('https://live.euronext.com/nb/markets/oslo/equities/list')
        
        # Wait for the table to load (adjust selector as needed)
        wait = WebDriverWait(driver, 20)
        
        # Wait for the table body to be present
        wait.until(EC.presence_of_element_located((By.TAG_NAME, 'tbody')))
        
        # Give extra time for dynamic content to load
        time.sleep(5)
        
        # Try to find all rows in the table
        rows = driver.find_elements(By.CSS_SELECTOR, 'table tbody tr')
        
        stocks = []
        
        print(f"Found {len(rows)} rows")
        
        for row in rows:
            try:
                cells = row.find_elements(By.TAG_NAME, 'td')
                if len(cells) >= 3:  # Make sure we have enough columns
                    # Typically: Name, ISIN, Ticker, Market, Last, %, Date/Time
                    name = cells[0].text.strip()
                    isin = cells[1].text.strip()
                    ticker = cells[2].text.strip()
                    market = cells[3].text.strip() if len(cells) > 3 else ''
                    
                    if name and ticker:  # Only add if we have both name and ticker
                        stocks.append({
                            'name': name,
                            'ticker': ticker,
                            'isin': isin,
                            'market': market,
                            'scraped_date': datetime.now().strftime('%Y-%m-%d')
                        })
            except Exception as e:
                print(f"Error processing row: {e}")
                continue
        
        return stocks
        
    finally:
        driver.quit()

def save_to_json(stocks, filename='oslo_stocks.json'):
    """Save stocks to JSON file"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(stocks, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(stocks)} stocks to {filename}")

def save_to_csv(stocks, filename='oslo_stocks.csv'):
    """Save stocks to CSV file"""
    if not stocks:
        print("No stocks to save")
        return
    
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['name', 'ticker', 'isin', 'market', 'scraped_date']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(stocks)
    print(f"Saved {len(stocks)} stocks to {filename}")

if __name__ == '__main__':
    print("Starting Euronext Oslo stock scraper...")
    
    stocks = scrape_euronext_oslo()
    
    if stocks:
        print(f"\nSuccessfully scraped {len(stocks)} stocks!")
        
        # Save in both formats
        save_to_json(stocks)
        save_to_csv(stocks)
        
        # Print first few entries as sample
        print("\nSample of scraped data:")
        for stock in stocks[:5]:
            print(f"  {stock['name']} ({stock['ticker']})")
    else:
        print("No stocks were scraped. Please check the page structure.")
