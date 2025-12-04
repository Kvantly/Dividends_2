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
    
    print("="*60)
    print("EURONEXT OSLO STOCK SCRAPER")
    print("="*60)
    
    # Set up Chrome options for headless browsing
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920,1080')
    chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        url = 'https://live.euronext.com/nb/markets/oslo/equities/list'
        print(f"\n📡 Loading: {url}")
        driver.get(url)
        
        print("⏳ Waiting for page to load...")
        wait = WebDriverWait(driver, 30)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, 'body')))
        
        # Wait for JavaScript to load the table data
        time.sleep(10)
        
        print("🔍 Finding table...")
        table = driver.find_element(By.TAG_NAME, 'table')
        
        rows = table.find_elements(By.TAG_NAME, 'tr')
        print(f"✅ Found {len(rows)} rows (including header)\n")
        
        def get_text(cell):
            """Extract text from a cell"""
            text = cell.text.strip()
            if text:
                return text
            try:
                return cell.find_element(By.TAG_NAME, 'a').text.strip()
            except:
                pass
            try:
                return cell.get_attribute('textContent').strip()
            except:
                return ""
        
        stocks = []
        
        # Process rows (skip header)
        for i, row in enumerate(rows[1:], 1):
            try:
                cells = row.find_elements(By.TAG_NAME, 'td')
                
                if len(cells) < 5:
                    continue
                
                # Based on the webpage structure and debug output:
                # Column 0: Hidden/Icon (skip)
                # Column 1: NAVN (Name)
                # Column 2: ISIN
                # Column 3: TICKER
                # Column 4: MARKED (Market)
                
                name = get_text(cells[1])
                isin = get_text(cells[2])
                ticker = get_text(cells[3])
                market = get_text(cells[4])
                
                if i <= 5:
                    print(f"Row {i}: {name} | {isin} | {ticker} | {market}")
                
                # Only add if we have name and ticker
                if name and ticker:
                    stocks.append({
                        'name': name,
                        'ticker': ticker,
                        'isin': isin,
                        'market': market,
                        'scraped_date': datetime.now().strftime('%Y-%m-%d')
                    })
                    
            except Exception as e:
                if i <= 5:
                    print(f"⚠️  Error on row {i}: {e}")
                continue
        
        print(f"\n✅ Successfully scraped {len(stocks)} stocks!")
        return stocks
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        print(traceback.format_exc())
        return []
        
    finally:
        driver.quit()

def save_to_json(stocks, filename='oslo_stocks.json'):
    """Save stocks to JSON"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(stocks, f, indent=2, ensure_ascii=False)
    print(f"💾 Saved to {filename}")

def save_to_csv(stocks, filename='oslo_stocks.csv'):
    """Save stocks to CSV"""
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['name', 'ticker', 'isin', 'market', 'scraped_date'])
        writer.writeheader()
        writer.writerows(stocks)
    print(f"💾 Saved to {filename}")

if __name__ == '__main__':
    stocks = scrape_euronext_oslo()
    
    if stocks:
        save_to_json(stocks)
        save_to_csv(stocks)
        print(f"\n🎉 Done! Scraped {len(stocks)} stocks")
        print("\nFirst 10 stocks:")
        for stock in stocks[:10]:
            print(f"  • {stock['name']} ({stock['ticker']})")
    else:
        print("❌ No stocks scraped")
        exit(1)
