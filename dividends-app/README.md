# StockAI — Oslo Børs Weekly Pick

A static React + TypeScript frontend for the Dividends_2 project, built to deploy on Cloudflare Pages.

## What's in here

```
dividends-app/
├── public/
│   ├── oslo_stocks.json              ← your scraped stock list (already copied)
│   └── all_stocks_historical_data.csv ← YOU NEED TO ADD THIS (see below)
├── src/
│   ├── components/   React components (Header, Hero, StockCard, etc.)
│   ├── hooks/        useTheme, useStockPick
│   ├── lib/          pickStock (deterministic weekly picker), priceData (CSV parser)
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css    ported from your original index.html
│   └── types.ts
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Step 1 — Install Node.js if you don't have it

Check with:
```bash
node --version
```
You need Node 18 or newer. If you don't have it, install from https://nodejs.org or via your package manager.

## Step 2 — Install dependencies

From inside the `dividends-app/` folder:

```bash
npm install
```

## Step 3 — Add your historical CSV (optional but recommended)

The app shows the current price + 7-day change for the picked stock. To enable that, copy your existing `all_stocks_historical_data.csv` from the Dividends_2 repo into `public/`:

```bash
cp /path/to/Dividends_2/all_stocks_historical_data.csv public/
```

If you skip this, the app still works — it just shows "Price N/A" for the price card (everything else still renders correctly).

**About the CSV format:** the parser in `src/lib/priceData.ts` expects columns named `Date`, `Close`, and `Ticker` (case-insensitive variants supported). If your CSV uses different column names, edit `pickField()` calls at the bottom of that file.

## Step 4 — Run locally

```bash
npm run dev
```

Open http://localhost:5173. You should see the StockAI homepage. Click "Get This Week's Pick" to see the picked stock.

## Step 5 — Build for production

```bash
npm run build
```

The output ends up in `dist/`. You can preview it with:

```bash
npm run preview
```

## Step 6 — Deploy to Cloudflare Pages

See `DEPLOY.md` in this folder for the full Cloudflare walkthrough.

## How the weekly pick works

`src/lib/pickStock.ts` computes the current ISO week, hashes `${year}-W${week}`, and uses `hash % stocks.length` to choose an index into `oslo_stocks.json`. This means:

- **Same pick all week** for every visitor
- **New pick automatically** at 00:00 UTC on Monday
- **No backend needed** — it's pure client-side, deterministic math
- **Reproducible** — open dev tools and import the function to verify

## Where the design came from

The CSS in `src/styles.css` is your original `index.html` mockup, ported wholesale. Same color tokens, same components, same dark mode toggle. The React components rebuild the same DOM structure with proper component boundaries and TypeScript types.

## What this app does NOT do yet

- P/E ratio, market cap, average volume — **not in your data pipeline**. The mockup showed these but `oslo_stocks.json` doesn't contain them. To fill these, extend `fetch_historical_data_weekly.py` to also call `yfinance.Ticker(ticker).info` and write a `fundamentals.json`.
- AI rationale — the "About This Pick" card currently shows a templated description. To replace with real AI-generated text, run an LLM call in your weekly GitHub Action and write a `rationale.json` keyed by ticker.

Both are Phase 4 from our plan and don't block anything.
