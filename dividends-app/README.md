# Oslo Børs Dashboard

A TradingView-style stock dashboard for the Dividends_2 project. Pick any of the 297 Oslo-listed stocks from the sidebar and view its candlestick/line chart, switch time intervals, and toggle moving averages.

## What's in here

```
dividends-app/
├── public/
│   ├── oslo_stocks.json                 ← stock list (already included)
│   └── all_stocks_historical_data.csv   ← YOU NEED TO ADD THIS (see below)
├── src/
│   ├── components/
│   │   ├── TopBar.tsx        Brand + theme toggle
│   │   ├── Sidebar.tsx       Searchable list of all 297 stocks
│   │   ├── StockPane.tsx     Right-side detail panel
│   │   └── PriceChart.tsx    The chart (lightweight-charts)
│   ├── hooks/
│   │   ├── useTheme.ts
│   │   └── useStockList.ts
│   ├── lib/
│   │   ├── priceData.ts      CSV parser + interval filter + SMA
│   │   └── format.ts         Price/percent/volume formatting
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   └── types.ts
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
└── DEPLOY.md
```

## Features

- **Sidebar** — 297 stocks, searchable by ticker or name
- **Chart** — candlestick or line view, with volume bars at the bottom
- **Time intervals** — 1W / 1M / 3M / 6M / 1Y / 5Y / All
- **Moving averages** — toggleable MA20, MA50, MA200 overlays
- **Info strip** — Open / High / Low / Close / Volume for the most recent bar
- **Light + dark themes** — auto-detects from system, persists choice
- **Mobile responsive** — sidebar moves to top half of screen on small screens

## Adding the price data

The chart needs `public/all_stocks_historical_data.csv` to render anything. This is the same CSV your weekly GitHub Action already produces in your `Dividends_2` repo.

**Option A — copy it once locally:**

```bash
cp /path/to/Dividends_2/all_stocks_historical_data.csv public/
```

**Option B — let GitHub do it (recommended):**

When you commit this `dividends-app/` folder back into your `Dividends_2` repo, the CSV is already at the repo root. We need it inside `dividends-app/public/`. The simplest fix is to update your weekly GitHub Action to copy it into both places. (See DEPLOY.md.)

The CSV must have these columns: `Date, Ticker, Name, Open, High, Low, Close, Volume` (matching what `fetch_historical_data_weekly.py` already produces).

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. The sidebar should show all 297 stocks. Click any one — if you've added the CSV, the chart loads. If not, you'll see "No price history available."

## Building for production

```bash
npm run build
```

Output ends up in `dist/`.

## How it handles the big CSV

`all_stocks_historical_data.csv` is roughly 30–40 MB with ~488K rows. The app:

1. Loads it once, lazily, when you click your first stock
2. Streams the parse with PapaParse's `chunk` callback so the browser doesn't freeze
3. Indexes rows by ticker into an in-memory `Map`
4. From then on, every stock click is instant

This means **the first chart takes 2–4 seconds to render**, every subsequent one is instant. If that's too slow, we can split the CSV into one file per ticker as a Phase 2 improvement (see DEPLOY.md "Optimizations").

## Deployment

See `DEPLOY.md`.
