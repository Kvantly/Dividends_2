import time
import json
import csv
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, TimeoutException

def scrape_euronext_oslo():
    """Scrape stock names and tickers from Euronext Oslo - ALL PAGES"""
    
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
        
        def scrape_current_page():
            """Scrape stocks from the current page"""
            stocks = []
            
            try:
                table = driver.find_element(By.TAG_NAME, 'table')
                rows = table.find_elements(By.TAG_NAME, 'tr')
                
                # Process rows (skip header)
                for row in rows[1:]:
                    try:
                        cells = row.find_elements(By.TAG_NAME, 'td')
                        
                        if len(cells) < 5:
                            continue
                        
                        # Column structure:
                        # 0: Hidden/Icon
                        # 1: Name (NAVN)
                        # 2: ISIN
                        # 3: Ticker
                        # 4: Market (MARKED)
                        
                        name = get_text(cells[1])
                        isin = get_text(cells[2])
                        ticker = get_text(cells[3])
                        market = get_text(cells[4])
                        
                        if name and ticker:
                            stocks.append({
                                'name': name,
                                'ticker': ticker,
                                'isin': isin,
                                'market': market,
                                'scraped_date': datetime.now().strftime('%Y-%m-%d')
                            })
                            
                    except Exception as e:
                        continue
                
            except Exception as e:
                print(f"⚠️  Error scraping page: {e}")
            
            return stocks
        
        all_stocks = []
        page_num = 1
        
        print("\n🔄 Starting to scrape all pages...")
        
        while True:
            print(f"\n📄 Scraping page {page_num}...")
            
            # Scrape current page
            stocks_on_page = scrape_current_page()
            
            if stocks_on_page:
                all_stocks.extend(stocks_on_page)
                print(f"   ✅ Found {len(stocks_on_page)} stocks on page {page_num}")
                print(f"   📊 Total so far: {len(all_stocks)} stocks")
                
                # Show first stock from this page as example
                if stocks_on_page:
                    print(f"   Example: {stocks_on_page[0]['name']} ({stocks_on_page[0]['ticker']})")
            else:
                print(f"   ⚠️  No stocks found on page {page_num}")
            
            # Try to find and click "Next" button or next page number
            next_button_found = False
            
            # Try different selectors for pagination
            next_selectors = [
                'a[aria-label="Next"]',
                'button[aria-label="Next"]',
                'a.next',
                'button.next',
                'li.next a',
                'a[rel="next"]',
                '.pagination a[aria-label="Next"]',
                '.pagination button[aria-label="Next"]',
            ]
            
            for selector in next_selectors:
                try:
                    next_button = driver.find_element(By.CSS_SELECTOR, selector)
                    
                    # Check if button is enabled (not disabled)
                    if next_button.is_enabled() and next_button.is_displayed():
                        # Check if it's not disabled by class
                        classes = next_button.get_attribute('class') or ''
                        if 'disabled' not in classes.lower():
                            print(f"   🔽 Clicking next button (selector: {selector})...")
                            
                            # Scroll to button
                            driver.execute_script("arguments[0].scrollIntoView(true);", next_button)
                            time.sleep(1)
                            
                            # Click it
                            next_button.click()
                            next_button_found = True
                            
                            # Wait for new data to load
                            time.sleep(5)
                            
                            page_num += 1
                            break
                except:
                    continue
            
            # If no next button found, try to find page numbers and click the next one
            if not next_button_found:
                try:
                    # Look for pagination with page numbers
                    pagination = driver.find_element(By.CSS_SELECTOR, '.pagination, nav[aria-label="pagination"]')
                    page_links = pagination.find_elements(By.TAG_NAME, 'a')
                    
                    # Find current page and next page
                    for i, link in enumerate(page_links):
                        if 'active' in (link.get_attribute('class') or ''):
                            # Found active page, try to click next one
                            if i + 1 < len(page_links):
                                next_page = page_links[i + 1]
                                print(f"   🔽 Clicking page {page_num + 1}...")
                                next_page.click()
                                next_button_found = True
                                time.sleep(5)
                                page_num += 1
                                break
                except:
                    pass
            
            # If still no next button, we're done
            if not next_button_found:
                print(f"\n✅ No more pages found. Finished scraping!")
                break
            
            # Safety: Don't scrape more than 20 pages
            if page_num > 20:
                print("\n⚠️  Reached maximum page limit (20 pages)")
                break
        
        print(f"\n{'='*60}")
        print(f"✅ TOTAL SCRAPED: {len(all_stocks)} stocks from {page_num} page(s)")
        print(f"{'='*60}")
        
        return all_stocks
        
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
        
        print(f"\n🎉 SUCCESS! Scraped {len(stocks)} total stocks")
        print("\nFirst 10 stocks:")
        for stock in stocks[:10]:
            print(f"  • {stock['name']} ({stock['ticker']})")
        
        print("\nLast 10 stocks:")
        for stock in stocks[-10:]:
            print(f"  • {stock['name']} ({stock['ticker']})")
    else:
        print("❌ No stocks scraped")
        exit(1)
