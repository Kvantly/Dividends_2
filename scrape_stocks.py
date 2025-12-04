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
    print("Starting Euronext Oslo Stock Scraper")
    print("="*60)
    
    # Set up Chrome options for headless browsing
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920,1080')
    chrome_options.add_argument('--disable-blink-features=AutomationControlled')
    chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    # Initialize the driver
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        url = 'https://live.euronext.com/nb/markets/oslo/equities/list'
        print(f"\n📡 Loading page: {url}")
        driver.get(url)
        
        # Wait for page to load
        print("⏳ Waiting for page to load...")
        wait = WebDriverWait(driver, 30)
        
        # Wait for body to be present
        wait.until(EC.presence_of_element_located((By.TAG_NAME, 'body')))
        
        # Give extra time for JavaScript to execute and load data
        print("⏳ Waiting for JavaScript to load data...")
        time.sleep(10)
        
        print("📄 Page loaded, searching for table...")
        
        # Try to find the table
        table = None
        selectors = [
            'table',
            'table.table',
            'div.table-responsive table',
        ]
        
        for selector in selectors:
            try:
                tables = driver.find_elements(By.CSS_SELECTOR, selector)
                if tables:
                    print(f"✅ Found {len(tables)} table(s) using selector: {selector}")
                    table = tables[0]
                    break
            except:
                continue
        
        if not table:
            print("❌ ERROR: Could not find any table on the page")
            return []
        
        # Find all rows
        print("🔍 Searching for table rows...")
        rows = table.find_elements(By.TAG_NAME, 'tr')
        print(f"📊 Found {len(rows)} total rows (including header)")
        
        if len(rows) <= 1:
            print("❌ ERROR: No data rows found")
            return []
        
        stocks = []
        skipped = 0
        
        print("\n🔄 Processing rows...")
        
        # Process each row (skip header)
        for i, row in enumerate(rows[1:], 1):
            try:
                # Get all cells in the row
                cells = row.find_elements(By.TAG_NAME, 'td')
                
                if len(cells) < 3:
                    skipped += 1
                    continue
                
                # Try multiple methods to extract text from cells
                def get_cell_text(cell):
                    """Get text from a cell, trying multiple methods"""
                    # Method 1: Direct text
                    text = cell.text.strip()
                    if text:
                        return text
                    
                    # Method 2: Look for links (stock names are often links)
                    try:
                        link = cell.find_element(By.TAG_NAME, 'a')
                        text = link.text.strip()
                        if text:
                            return text
                    except:
                        pass
                    
                    # Method 3: Look for spans
                    try:
                        span = cell.find_element(By.TAG_NAME, 'span')
                        text = span.text.strip()
                        if text:
                            return text
                    except:
                        pass
                    
                    # Method 4: Get all text content
                    try:
                        text = cell.get_attribute('textContent').strip()
                        if text:
                            return text
                    except:
                        pass
                    
                    return ""
                
                # Extract data from cells
                name = get_cell_text(cells[0])
                isin = get_cell_text(cells[1])
                ticker = get_cell_text(cells[2])
                market = get_cell_text(cells[3]) if len(cells) > 3 else ''
                
                # Debug: Print first few rows to see what we're getting
                if i <= 3:
                    print(f"  🔍 Row {i} debug:")
                    print(f"     Name: '{name}'")
                    print(f"     ISIN: '{isin}'")
                    print(f"     Ticker: '{ticker}'")
                    print(f"     Market: '{market}'")
                
                # Only add if we have name and ticker
                if name and ticker:
                    stock = {
                        'name': name,
                        'ticker': ticker,
                        'isin': isin,
                        'market': market,
                        'scraped_date': datetime.now().strftime('%Y-%m-%d')
                    }
                    stocks.append(stock)
                    
                    if i <= 5:
                        print(f"  ✓ Row {i}: {name} ({ticker})")
                else:
                    if i <= 3:
                        print(f"  ⚠️  Row {i}: Skipped (name='{name}', ticker='{ticker}')")
                    skipped += 1
                    
            except Exception as e:
                if i <= 3:
                    print(f"  ⚠️  Error processing row {i}: {e}")
                skipped += 1
                continue
        
        print(f"\n📈 Summary:")
        print(f"  • Successfully scraped: {len(stocks)} stocks")
        print(f"  • Skipped rows: {skipped}")
        
        return stocks
        
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {e}")
        import traceback
        print(traceback.format_exc())
        return []
        
    finally:
        print("\n🔒 Closing browser...")
        driver.quit()

def save_to_json(stocks, filename='oslo_stocks.json'):
    """Save stocks to JSON file"""
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(stocks, f, indent=2, ensure_ascii=False)
        print(f"✅ Saved {len(stocks)} stocks to {filename}")
        return True
    except Exception as e:
        print(f"❌ Error saving JSON: {e}")
        return False

def save_to_csv(stocks, filename='oslo_stocks.csv'):
    """Save stocks to CSV file"""
    if not stocks:
        print("⚠️  No stocks to save to CSV")
        return False
    
    try:
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            fieldnames = ['name', 'ticker', 'isin', 'market', 'scraped_date']
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(stocks)
        print(f"✅ Saved {len(stocks)} stocks to {filename}")
        return True
    except Exception as e:
        print(f"❌ Error saving CSV: {e}")
        return False

if __name__ == '__main__':
    print("\n" + "="*60)
    print("EURONEXT OSLO STOCK SCRAPER")
    print("="*60 + "\n")
    
    stocks = scrape_euronext_oslo()
    
    print("\n" + "="*60)
    if stocks:
        print(f"✅ SUCCESS: Scraped {len(stocks)} stocks!")
        print("="*60)
        
        # Save in both formats
        json_success = save_to_json(stocks)
        csv_success = save_to_csv(stocks)
        
        if json_success and csv_success:
            print("\n🎉 All files created successfully!")
            print("\n📋 Sample of scraped data (first 10 stocks):")
            for stock in stocks[:10]:
                print(f"  • {stock['name']} ({stock['ticker']}) - {stock['market']}")
        else:
            print("\n⚠️  Some files could not be saved")
            exit(1)
    else:
        print("❌ FAILURE: No stocks were scraped")
        print("="*60)
        print("\n💡 Possible issues:")
        print("  • Website structure may have changed")
        print("  • Data is loaded via AJAX after initial page load")
        print("  • JavaScript content didn't render properly")
        print("  • Table uses a non-standard structure")
        exit(1)
    
    print("\n" + "="*60)
    print("Scraping completed")
    print("="*60 + "\n")
