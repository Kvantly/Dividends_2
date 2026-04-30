# Deploying to Cloudflare Pages

## Step 0 — One important thing about your CSV

The chart needs `dividends-app/public/all_stocks_historical_data.csv`. Your GitHub Action already produces this CSV at the repo root. You have two options:

### Option A (simplest): Add a copy step to the weekly workflow

Open `.github/workflows/weekly_data_update.yml` in your repo and find the step that commits the CSV. Right before that step, add:

```yaml
      - name: Copy CSV into web app
        run: cp all_stocks_historical_data.csv dividends-app/public/all_stocks_historical_data.csv
```

Then the existing `git add` step will pick it up. Now every weekly update populates both locations and Cloudflare auto-rebuilds.

### Option B: Symlink it (Linux/Mac only — won't work on Windows GitHub runners)

Skip — Option A is more reliable.

### Option C: One-off manual copy via the GitHub web UI

If you just want to test the deploy once before automating: download the CSV from your repo, upload it into `dividends-app/public/` through the GitHub web UI. This works for now but you'll have to repeat it weekly.

## Step 1 — Push to GitHub

You said you've already added `dividends-app/` to the repo. If so, you're set. If not, drag-and-drop the folder onto github.com → Add file → Upload files.

## Step 2 — Create the Cloudflare Pages project

You're already partway through this. Go back to the Cloudflare dashboard and pick up from the build settings screen. Fill in:

| Field | Value |
|---|---|
| Project name | `dividends-app` (or whatever you chose) |
| Production branch | `main` |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory (advanced) | `dividends-app` |

Add environment variable:
- `NODE_VERSION` = `20`

Click **Save and Deploy**.

## Step 3 — Wait for the build

The first build runs `npm install` (~60 sec) then `npm run build` (~10 sec). Total: 1–3 minutes.

When it's done, click the URL Cloudflare gives you (something like `https://dividends-app.pages.dev`).

## Step 4 — Verify

You should see:
- **Sidebar on the left** with all 297 stocks
- A search box at the top of the sidebar (try typing "EQUI" — Equinor should appear)
- Click any stock — the chart loads on the right
- Toggle between Candles / Line, change time intervals, toggle MA20 / MA50 / MA200

If you see "No price history available" — your CSV is missing or in the wrong location. See Step 0.

## Optimizations (later)

If the first chart click feels too slow (the 30+ MB CSV download is the bottleneck), we can:

1. **Split the CSV per ticker.** Add a small Python step to the weekly workflow that produces `public/data/{ticker}.json` for each stock. Then the app loads only the stock you click — milliseconds instead of seconds.

2. **Use Cloudflare R2.** Move the CSV out of the build into R2 storage, served from Cloudflare's CDN. Same idea but cleaner separation.

3. **Compress the CSV.** Cloudflare auto-gzips text files served from Pages, so your 30 MB CSV becomes ~5 MB on the wire. This already happens — you don't need to do anything.

For 297 stocks and weekly updates, I'd recommend skipping optimizations until you actually feel a problem. The current approach is the simplest and gzipped CSV is fast enough.

## Common build errors

**`npm error code ENOENT` / `package.json not found`**
You forgot to set Root directory to `dividends-app`. Fix: Cloudflare project → Settings → Builds & deployments → Build configurations → edit Root directory.

**`tsc: command not found`**
Wrong Node version. Make sure `NODE_VERSION=20` env var is set.

**Build succeeds, page is blank**
Open browser dev tools (F12) → Console tab. Most likely a runtime error. Paste it to me and I'll fix.

**Page loads, sidebar empty**
`oslo_stocks.json` didn't make it into `public/`. Verify by visiting `https://your-site.pages.dev/oslo_stocks.json` — should show the JSON.

**Page loads, sidebar has stocks, but chart is empty when clicked**
`all_stocks_historical_data.csv` not in `public/`. See Step 0.
