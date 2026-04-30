#!/usr/bin/env python3
"""
Split the master historical CSV into one JSON file per ticker.

Reads:  all_stocks_historical_data.csv  (at repo root)
Writes: dividends-app/public/data/{TICKER}.json  (one per ticker)

Each JSON file is an array of bars sorted oldest -> newest:
  [{ "time": <unix-seconds>, "open": ..., "high": ..., "low": ..., "close": ..., "volume": ... }, ...]

This keeps each file small (~50-300 KB) so it fits well under
Cloudflare Pages' 25 MB per-file limit, and so users only download
data for stocks they actually look at.
"""
import csv
import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

INPUT_CSV = Path("all_stocks_historical_data.csv")
OUTPUT_DIR = Path("dividends-app/public/data")


def parse_date_to_unix(s: str) -> int:
    """Convert dates like '2019-07-12 00:00:00+02:00' to Unix seconds."""
    try:
        return int(datetime.fromisoformat(s).timestamp())
    except ValueError:
        # Fallback: just take the date portion
        return int(datetime.strptime(s.split(" ")[0], "%Y-%m-%d").timestamp())


def main() -> int:
    if not INPUT_CSV.exists():
        print(f"❌ Input not found: {INPUT_CSV}", file=sys.stderr)
        return 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Clear any stale per-ticker files so delisted stocks don't linger
    for old in OUTPUT_DIR.glob("*.json"):
        old.unlink()

    by_ticker: dict[str, list[dict]] = defaultdict(list)
    skipped = 0

    with open(INPUT_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            ticker = (row.get("Ticker") or "").strip().upper()
            if not ticker:
                skipped += 1
                continue
            try:
                bar = {
                    "time": parse_date_to_unix(row["Date"]),
                    "open": float(row["Open"]),
                    "high": float(row["High"]),
                    "low": float(row["Low"]),
                    "close": float(row["Close"]),
                    "volume": float(row["Volume"]) if row.get("Volume") else 0,
                }
            except (ValueError, KeyError):
                skipped += 1
                continue
            by_ticker[ticker].append(bar)

    total_bars = 0
    for ticker, bars in by_ticker.items():
        bars.sort(key=lambda b: b["time"])
        out_path = OUTPUT_DIR / f"{ticker}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(bars, f, separators=(",", ":"))
        total_bars += len(bars)

    print(
        f"✅ Wrote {len(by_ticker)} per-ticker JSON files "
        f"({total_bars:,} bars total, {skipped} rows skipped) to {OUTPUT_DIR}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
