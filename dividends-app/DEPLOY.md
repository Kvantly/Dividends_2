# Deploying to Cloudflare Pages

Two paths: **Git-connected (recommended)** or **Direct upload**. Git-connected is the way — every push deploys, you get preview URLs for branches, and your weekly GitHub Action will trigger redeploys automatically.

## Path A: Git-connected deploy (recommended)

### 1. Get this code into your `Dividends_2` repo

You have a choice on folder layout. Pick one:

**Option 1: Put `dividends-app/` at the repo root.**
- Best if you want the React app alongside your Python scripts.
- Cloudflare will need to know the build is in a subfolder (handled in step 4).

**Option 2: Put the files at the repo root, alongside `streamlit_app.py`.**
- Simpler Cloudflare config but mixes Python and Node files.
- Move everything from `dividends-app/` up one level if you go this route.

I'll assume **Option 1** below.

```bash
# From inside Dividends_2/
cp -r /path/to/dividends-app .
git add dividends-app/
git commit -m "Add React/TypeScript frontend"
git push
```

### 2. Sign in to Cloudflare

Go to https://dash.cloudflare.com. Free tier is fine — Pages includes 500 builds/month and unlimited bandwidth.

### 3. Create a new Pages project

In the dashboard sidebar: **Workers & Pages → Create → Pages → Connect to Git**.

Authorize Cloudflare to access your GitHub account, then select the `Dividends_2` repository.

### 4. Configure the build

Fill in:

| Setting | Value |
|---|---|
| Project name | `dividends-app` (or whatever — this becomes your `*.pages.dev` URL) |
| Production branch | `main` |
| Framework preset | `Vite` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory (advanced) | `dividends-app` |
| Node version (env var) | `NODE_VERSION=20` |

The "Root directory" setting is the key one if you used Option 1 above — it tells Cloudflare to `cd dividends-app` before running `npm install` and `npm run build`.

To set the Node version: open **Settings → Environment variables → Add variable**, name `NODE_VERSION`, value `20`, scope: **Production and Preview**.

### 5. Deploy

Click **Save and Deploy**. First build takes 1–2 minutes. When it's done you'll get a URL like `https://dividends-app.pages.dev`.

### 6. (Optional) Custom domain

In your Pages project: **Custom domains → Set up a custom domain**. If your domain is on Cloudflare DNS, it's a single click. Otherwise add a CNAME pointing to `dividends-app.pages.dev`.

### 7. Verify weekly auto-redeploy

Your existing GitHub Action (`.github/workflows/weekly_data_update.yml`) commits the updated `oslo_stocks.json` and `oslo_stocks.csv` back to the repo. That commit triggers Cloudflare Pages to rebuild automatically. To verify:

1. Push a small change to any file in `main`.
2. Go to your Pages project → **Deployments**.
3. You should see a new build trigger within ~10 seconds.

If you want explicit control, add a webhook to the GitHub Action — see the "Optional: Deploy hooks" section below.

## Path B: Direct upload (one-off)

If you just want to test before connecting Git:

```bash
cd dividends-app
npm install
npm run build

# Install the Cloudflare CLI
npm install -g wrangler
wrangler login
wrangler pages deploy dist --project-name=dividends-app
```

## Optional: Deploy hooks

Cloudflare can give you a unique URL that triggers a redeploy when called. Useful if your data lives elsewhere and you want to redeploy without a Git commit.

In your Pages project: **Settings → Builds & deployments → Deploy hooks → Add deploy hook**. Copy the URL it gives you, then in your GitHub Action add:

```yaml
- name: Trigger Cloudflare Pages rebuild
  run: curl -X POST ${{ secrets.CLOUDFLARE_DEPLOY_HOOK }}
```

Add the URL as a repo secret named `CLOUDFLARE_DEPLOY_HOOK`.

## Troubleshooting

**"Module not found" during build.** Make sure `package.json` is committed and the "Root directory" setting points to `dividends-app`.

**Page loads but `oslo_stocks.json` returns 404.** Check that the file is in `public/oslo_stocks.json` — Vite copies everything from `public/` to the root of the deployed site.

**Theme toggle doesn't persist.** Localstorage is per-domain. Make sure you're not testing in incognito.

**Build succeeds but page is blank.** Check the browser console. Most likely a TypeScript or runtime error in `App.tsx`. Run `npm run build` locally first to catch these.
