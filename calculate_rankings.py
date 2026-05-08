import json
import os
import statistics as _stat
from datetime import datetime, date

DIVIDENDS_DIR = 'dividends-app/public/dividends'
FINANCIALS_DIR = 'dividends-app/public/financials'
OUTPUT_DIR    = 'dividends-app/public/rankings'


def load_json_dir(directory):
    result = {}
    if not os.path.exists(directory):
        return result
    for filename in os.listdir(directory):
        if not filename.endswith('.json'):
            continue
        ticker = filename[:-5]
        try:
            with open(os.path.join(directory, filename), 'r', encoding='utf-8') as f:
                result[ticker] = json.load(f)
        except Exception:
            pass
    return result


def yearly_totals(dividends):
    by_year = {}
    for d in dividends:
        year = d['date'][:4]
        by_year[year] = by_year.get(year, 0) + d['amount']
    return dict(sorted(by_year.items()))


# ─── Dividend Rank ────────────────────────────────────────────────────────────
#
# Ranking philosophy: reward stable, compounding dividend growth.
# A company qualifies only if its most recent year is its peak dividend
# (the company is currently at an all-time high in its window), and the
# majority of years show positive growth.
#
# Composite score weights:
#   35% consistency  — % of periods with positive YoY growth
#   30% stability    — inverse of growth-rate coefficient of variation
#                      (rewards smooth, predictable growth over erratic spikes)
#   25% recency      — avg growth of the last 2 periods (still actively growing)
#   10% streak       — current unbroken run of positive-growth years

def calc_dividend_rank(all_divs):
    today = date.today()
    # 6-year window gives up to 5 YoY growth periods
    window = [str(today.year - i) for i in range(5, -1, -1)]

    rows = []
    for ticker, data in all_divs.items():
        divs = data.get('dividends', [])
        if not divs:
            continue

        yt = yearly_totals(divs)
        window_data = [(y, yt[y]) for y in window if y in yt]

        # Need at least 3 data points → 2 growth periods to assess consistency
        if len(window_data) < 3:
            continue

        # Hard filter: most recent year must be the highest dividend on record
        # in this window — the company must be at its peak, not declining.
        totals = [t for _, t in window_data]
        if window_data[-1][1] < max(totals):
            continue

        year_prices = data.get('year_end_prices', {})
        growth_rates = []
        yearly_list  = []

        for i, (year, total) in enumerate(window_data):
            price = year_prices.get(year)
            yield_pct = round(total / price * 100, 2) if price and price > 0 else None

            if i == 0:
                yearly_list.append({'year': year, 'total': round(total, 4), 'growth_pct': None, 'yield_pct': yield_pct})
            else:
                prev = window_data[i - 1][1]
                if prev and prev > 0:
                    g = (total - prev) / prev * 100
                    growth_rates.append(g)
                    yearly_list.append({'year': year, 'total': round(total, 4), 'growth_pct': round(g, 2), 'yield_pct': yield_pct})
                else:
                    yearly_list.append({'year': year, 'total': round(total, 4), 'growth_pct': None, 'yield_pct': yield_pct})

        if not growth_rates:
            continue

        avg_growth = sum(growth_rates) / len(growth_rates)
        if avg_growth <= 0:
            continue

        positive    = sum(1 for g in growth_rates if g > 0)
        consistency = positive / len(growth_rates)  # 0.0–1.0

        # Hard filter: majority of years must show positive growth
        if consistency < 0.5:
            continue

        # Stability: inverse coefficient of variation.
        # A company growing 5% every single year scores higher than one that
        # grew 50% one year and shrank 40% another, even if avg is the same.
        if len(growth_rates) >= 2:
            stdev = _stat.stdev(growth_rates)
            cv = stdev / avg_growth if avg_growth > 0 else float('inf')
            stability = 1.0 / (1.0 + cv)
        else:
            stability = 0.5  # neutral with only 1 data point

        # Recency: average of the last 2 growth periods, normalised to 0–1.
        # 30% recent growth = full recency score; anything beyond is capped.
        recent_rates = growth_rates[-2:]
        recency_raw  = sum(recent_rates) / len(recent_rates)
        recency      = min(max(recency_raw, 0) / 30.0, 1.0)

        # Streak: current consecutive years of positive growth
        streak = 0
        for g in reversed(growth_rates):
            if g > 0:
                streak += 1
            else:
                break
        streak_score = streak / len(growth_rates)

        # Composite score (0–100)
        composite = (
            0.35 * consistency +
            0.30 * stability   +
            0.25 * recency     +
            0.10 * streak_score
        ) * 100

        rows.append({
            'ticker':            ticker,
            'name':              data.get('name', ticker),
            'avg_growth_5y':     round(avg_growth, 2),
            'composite_score':   round(composite, 1),
            'years_in_window':   len(window_data),
            'streak':            streak,
            'consistency_pct':   round(consistency * 100, 1),
            'latest_annual':     round(window_data[-1][1], 4),
            'yearly':            yearly_list,
        })

    rows.sort(key=lambda x: x['composite_score'], reverse=True)
    for i, r in enumerate(rows[:50], 1):
        r['rank'] = i
    return rows[:50]


# ─── Company Rank ─────────────────────────────────────────────────────────────

def sc(val, tiers, default=0):
    """Score val against [(min_threshold, score), ...] top-down; first match wins."""
    if val is None:
        return default
    for threshold, points in tiers:
        if val >= threshold:
            return points
    return 0


def calc_company_rank(all_divs, all_fin):
    rows = []

    for ticker, fin in all_fin.items():
        v   = fin.get('valuation', {})
        ps  = fin.get('per_share', {})
        pr  = fin.get('profitability', {})
        inc = fin.get('income', {})
        bs  = fin.get('balance_sheet', {})
        tr  = fin.get('trading', {})

        price  = ps.get('current_price')
        avg200 = tr.get('avg200d')
        avg50  = tr.get('avg50d')
        pe     = v.get('trailing_pe')
        roe    = pr.get('roe')
        pm     = pr.get('profit_margin')
        rg     = inc.get('revenue_growth')
        eg     = inc.get('earnings_growth')
        de     = bs.get('debt_to_equity')
        beta   = tr.get('beta')
        cr     = bs.get('current_ratio')

        s = {}

        # 1. Price momentum vs 200D MA
        if price and avg200 and avg200 > 0:
            pct = (price - avg200) / avg200 * 100
            s['momentum'] = sc(pct, [(15, 10), (8, 8), (3, 6), (-3, 4), (-8, 2)], 0)
        else:
            s['momentum'] = 0

        # 2. Golden cross: 50D above 200D
        if avg50 and avg200:
            s['golden_cross'] = 10 if avg50 > avg200 else 0
        else:
            s['golden_cross'] = 0

        # 3. Valuation — P/E (lower = better, must be positive)
        if pe and pe > 0:
            if   pe < 10: s['pe'] = 10
            elif pe < 15: s['pe'] = 8
            elif pe < 20: s['pe'] = 6
            elif pe < 25: s['pe'] = 4
            elif pe < 35: s['pe'] = 2
            else:         s['pe'] = 0
        else:
            s['pe'] = 0

        # 4. Quality — Return on Equity
        if roe is not None:
            if   roe > 0.25: s['roe'] = 10
            elif roe > 0.20: s['roe'] = 8
            elif roe > 0.15: s['roe'] = 6
            elif roe > 0.10: s['roe'] = 4
            elif roe > 0:    s['roe'] = 2
            else:            s['roe'] = 0
        else:
            s['roe'] = 0

        # 5. Financial health — Debt/Equity (lower = better)
        if de is not None:
            if   de < 20:  s['debt'] = 10
            elif de < 50:  s['debt'] = 8
            elif de < 100: s['debt'] = 6
            elif de < 150: s['debt'] = 4
            elif de < 200: s['debt'] = 2
            else:          s['debt'] = 0
        else:
            s['debt'] = 5  # neutral when unknown

        # 6. Dividend growth (most recent year vs previous)
        div_data = all_divs.get(ticker)
        if div_data and div_data.get('dividends'):
            sy = sorted(yearly_totals(div_data['dividends']).items())
            if len(sy) >= 2 and sy[-2][1] > 0:
                g = (sy[-1][1] - sy[-2][1]) / sy[-2][1] * 100
                if   g > 15: s['dividend'] = 10
                elif g > 10: s['dividend'] = 8
                elif g > 5:  s['dividend'] = 6
                elif g > 0:  s['dividend'] = 4
                else:        s['dividend'] = 1
            elif len(sy) >= 1:
                s['dividend'] = 3
            else:
                s['dividend'] = 0
        else:
            s['dividend'] = 0

        # 7. Revenue growth
        if rg is not None:
            s['revenue_growth'] = sc(rg, [(0.20, 10), (0.15, 8), (0.10, 6), (0.05, 4), (0.01, 2)], 0)
        else:
            s['revenue_growth'] = 0

        # 8. Profit margin
        if pm is not None:
            if   pm > 0.25: s['profit_margin'] = 10
            elif pm > 0.20: s['profit_margin'] = 8
            elif pm > 0.15: s['profit_margin'] = 6
            elif pm > 0.10: s['profit_margin'] = 4
            elif pm > 0.05: s['profit_margin'] = 2
            elif pm > 0:    s['profit_margin'] = 1
            else:           s['profit_margin'] = 0
        else:
            s['profit_margin'] = 0

        # 9. Low volatility — Beta (lower = more stable)
        if beta is not None:
            if   beta < 0.5: s['low_beta'] = 10
            elif beta < 0.8: s['low_beta'] = 8
            elif beta < 1.0: s['low_beta'] = 6
            elif beta < 1.2: s['low_beta'] = 4
            elif beta < 1.5: s['low_beta'] = 2
            else:            s['low_beta'] = 0
        else:
            s['low_beta'] = 5  # neutral when unknown

        # 10. Earnings growth
        if eg is not None:
            s['eps_growth'] = sc(eg, [(0.25, 10), (0.15, 8), (0.10, 6), (0.05, 4), (0.01, 2)], 0)
        else:
            s['eps_growth'] = 0

        total    = sum(s.values())
        non_zero = sum(1 for v in s.values() if v > 0)
        if non_zero < 3:
            continue

        mom_pct = round((price - avg200) / avg200 * 100, 1) if price and avg200 and avg200 > 0 else None

        rows.append({
            'ticker': ticker,
            'name':   fin.get('name', ticker),
            'score':  total,
            'scores': s,
            'metrics': {
                'pe':              pe,
                'roe':             round(roe * 100, 2) if roe is not None else None,
                'profit_margin':   round(pm  * 100, 2) if pm  is not None else None,
                'revenue_growth':  round(rg  * 100, 2) if rg  is not None else None,
                'earnings_growth': round(eg  * 100, 2) if eg  is not None else None,
                'debt_to_equity':  de,
                'current_ratio':   cr,
                'beta':            beta,
                'price_vs_200d':   mom_pct,
                'market_cap':      v.get('market_cap'),
            },
        })

    rows.sort(key=lambda x: x['score'], reverse=True)
    for i, r in enumerate(rows[:50], 1):
        r['rank'] = i
    return rows[:50]


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print('=' * 60)
    print('CALCULATING RANKINGS')
    print('=' * 60)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    all_divs = load_json_dir(DIVIDENDS_DIR)
    all_fin  = load_json_dir(FINANCIALS_DIR)
    now      = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f'Loaded {len(all_divs)} dividend files, {len(all_fin)} financial files')

    # Dividend rank
    print('\nCalculating Dividend Rank...')
    dr = calc_dividend_rank(all_divs)
    with open(os.path.join(OUTPUT_DIR, 'dividend_rank.json'), 'w', encoding='utf-8') as f:
        json.dump({'generated_at': now, 'count': len(dr), 'rankings': dr}, f, indent=2)
    print(f'  ✅ {len(dr)} companies ranked')

    # Company rank
    print('\nCalculating Company Rank...')
    cr = calc_company_rank(all_divs, all_fin)
    with open(os.path.join(OUTPUT_DIR, 'company_rank.json'), 'w', encoding='utf-8') as f:
        json.dump({'generated_at': now, 'count': len(cr), 'rankings': cr}, f, indent=2)
    print(f'  ✅ {len(cr)} companies ranked')

    print('\n' + '=' * 60)
    print('RANKINGS COMPLETE')
    print('=' * 60 + '\n')


if __name__ == '__main__':
    main()
