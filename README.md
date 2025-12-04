# Euronext Oslo Stock Scraper

This project automatically scrapes stock names and tickers from the Euronext Oslo stock exchange on the 1st of every month using GitHub Actions.

## 📋 What it does

- Scrapes all stocks listed on Oslo Børs, Euronext Growth Oslo, and Euronext Expand Oslo
- Collects: Stock name, Ticker symbol, ISIN, and Market
- Saves data in both JSON and CSV formats
- Runs automatically on the 1st of each month
- Commits the updated data back to your repository

## 🚀 Setup Instructions

### Step 1: Create a new GitHub repository

1. Go to [GitHub](https://github.com) and sign in
2. Click the `+` icon in the top right and select "New repository"
3. Give it a name (e.g., `oslo-stock-scraper`)
4. Make it **Public** or **Private** (your choice)
5. Check "Add a README file"
6. Click "Create repository"

### Step 2: Add the files to your repository

1. In your new repository, click "Add file" → "Create new file"

2. **Create the Python script:**
   - Name the file: `scrape_stocks.py`
   - Copy and paste the contents from the `scrape_stocks.py` file
   - Click "Commit changes"

3. **Create the workflow folder and file:**
   - Click "Add file" → "Create new file"
   - Name the file: `.github/workflows/monthly_scraper.yml`
     - ⚠️ Important: The name must start with `.github/workflows/`
   - Copy and paste the contents from the `monthly_scraper.yml` file
   - Click "Commit changes"

### Step 3: Enable GitHub Actions

1. Go to the "Settings" tab of your repository
2. In the left sidebar, click "Actions" → "General"
3. Under "Workflow permissions", select "Read and write permissions"
4. Check the box "Allow GitHub Actions to create and approve pull requests"
5. Click "Save"

### Step 4: Test the workflow

You can test it immediately without waiting for the 1st of the month:

1. Go to the "Actions" tab in your repository
2. Click on "Monthly Oslo Stock Scraper" in the left sidebar
3. Click the "Run workflow" button on the right
4. Click the green "Run workflow" button
5. Wait a minute or two, then refresh the page
6. You should see a new workflow run starting

### Step 5: Check the results

After the workflow completes:

1. Go back to your repository's main page (Code tab)
2. You should see two new files:
   - `oslo_stocks.json` - Stock data in JSON format
   - `oslo_stocks.csv` - Stock data in CSV format (can be opened in Excel)

## 📅 Schedule

The scraper runs automatically at **00:00 UTC on the 1st day of every month**.

To change the schedule, edit the cron expression in `.github/workflows/monthly_scraper.yml`:

```yaml
schedule:
  - cron: '0 0 1 * *'  # Minute Hour Day Month DayOfWeek
```

Examples:
- `'0 0 1 * *'` - 1st of every month at midnight
- `'0 9 1 * *'` - 1st of every month at 9 AM
- `'0 0 1,15 * *'` - 1st and 15th of every month

## 📊 Output Format

### JSON format (`oslo_stocks.json`)
```json
[
  {
    "name": "DNB ASA",
    "ticker": "DNB",
    "isin": "NO0010031479",
    "market": "Oslo Børs",
    "scraped_date": "2024-12-01"
  }
]
```

### CSV format (`oslo_stocks.csv`)
```csv
name,ticker,isin,market,scraped_date
DNB ASA,DNB,NO0010031479,Oslo Børs,2024-12-01
```

## 🔧 Troubleshooting

### Workflow fails to run
- Check that you've enabled "Read and write permissions" in repository settings
- Make sure the workflow file is in the correct location: `.github/workflows/`

### No data is scraped
- The website structure may have changed
- You can check the Actions logs for error messages

### How to see logs
1. Go to the "Actions" tab
2. Click on a workflow run
3. Click on "scrape" job to see detailed logs

## 📝 Notes

- The scraper respects the website's loading time (waits 5 seconds for content)
- Data is automatically committed back to your repository
- You can manually trigger the scraper anytime from the Actions tab

## 🆘 Need Help?

If you run into issues:
1. Check the Actions logs for error messages
2. Make sure all permissions are correctly set
3. Try running the workflow manually first to test

## 📜 License

Free to use and modify as needed!
