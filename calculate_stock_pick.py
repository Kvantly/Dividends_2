"""
Static multi-factor stock pick model for Oslo Børs.
No external API required. Scores all dividend stocks across four pillars:
  1. Dividend consistency & streak   (0-10 pts each)
  2. Dividend yield attractiveness   (0-10 pts)
  3. Yield trend (is yield growing?) (0-10 pts)
  4. Company quality: ROE, margin    (0-10 pts each)
  5. Price momentum vs 200D MA       (0-10 pts)
Total max: 70 pts.

Backtests the model on historical years using the year_end_prices
stored in each dividend JSON file.

Output: dividends-app/public/ai_pick.json
"""

import json
import os
from datetime import datetime

DIVIDENDS_DIR = 'dividends-app/public/dividends'
FINANCIALS_DIR = 'dividends-app/public/financials'
RANKINGS_DIR   = 'dividends-app/public/rankings'
OUTPUT_FILE    = 'dividends-app/public/ai_pick.json'

BACKTEST_YEARS = ['2021', '2022', '2023', '2024']
HOLD_YEARS = 1          # evaluate picks 1 year later
MIN_DIV_YEARS = 3       # need at least 3 years of dividend history to qualify


# ─── Helpers ──────────────────────────────────────────────────────────────────

def load_json(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def load_dir(directory):
    result = {}
    if not os.path.exists(directory):
        return result
    for fn in os.listdir(directory):
        if fn.endswith('.json'):
            data = load_json(os.path.join(directory, fn))
            if data:
                result[fn[:-5]] = data
    return result


def yearly_totals(dividends, up_to_year=None):
    by_year = {}
    for d in dividends:
        y = d['date'][:4]
        if up_to_year and y > up_to_year:
            continue
        by_year[y] = by_year.get(y, 0) + d['amount']
    return dict(sorted(by_year.items()))


def tier(val, thresholds):
    """Return score for val against [(min, score), ...], descending."""
    if val is None:
        return None
    for minimum, score in thresholds:
        if val >= minimum:
            return score
    return 0


# ─── Scoring ──────────────────────────────────────────────────────────────────

def score_stock(ticker, div_data, fin_data, as_of_year=None):
    """
    Score one stock.  as_of_year restricts data to simulate a past decision.
    When as_of_year is set, financial factors are excluded (no historical fin data).
    Returns dict with scores or None if not enough data.
    """
    divs   = div_data.get('dividends', [])
    prices = div_data.get('year_end_prices', {})
    name   = div_data.get('name', ticker)

    # Restrict to historical data when backtesting
    if as_of_year:
        divs   = [d for d in divs if d['date'][:4] <= as_of_year]
        prices = {y: p for y, p in prices.items() if y <= as_of_year}

    yt = yearly_totals(divs)
    years = sorted(yt.keys())

    if len(years) < MIN_DIV_YEARS:
        return None

    # ── 1. Dividend consistency (0–10) ───────────────────────────────────────
    window = years[-6:]
    growths = []
    for i in range(1, len(window)):
        prev = yt.get(window[i - 1])
        curr = yt.get(window[i])
        if prev and prev > 0:
            growths.append((curr - prev) / prev * 100)

    if not growths:
        return None

    pos          = sum(1 for g in growths if g > 0)
    consistency  = pos / len(growths)
    s_consistency = round(consistency * 10, 1)

    # ── 2. Dividend growth streak (0–10) ─────────────────────────────────────
    streak = 0
    for g in reversed(growths):
        if g > 0: streak += 1
        else: break
    s_streak = min(streak * 2, 10)   # 5+ years consecutive = max

    # ── 3. Dividend yield (0–10) ─────────────────────────────────────────────
    latest_year = years[-1]
    price_now   = prices.get(latest_year)
    latest_div  = yt.get(latest_year)

    if price_now and price_now > 0 and latest_div:
        yield_pct = latest_div / price_now * 100
        s_yield = tier(yield_pct, [(8,10),(6,8),(4,6),(2,4),(0.01,2)]) or 0
    else:
        yield_pct = None
        s_yield = 0

    # ── 4. Yield trend — is the yield itself growing? (0–10) ─────────────────
    yield_series = []
    for yr in years[-6:]:
        p = prices.get(yr)
        d = yt.get(yr)
        if p and p > 0 and d:
            yield_series.append(d / p * 100)
        else:
            yield_series.append(None)

    yield_growths = []
    for i in range(1, len(yield_series)):
        a, b = yield_series[i - 1], yield_series[i]
        if a is not None and b is not None and a > 0:
            yield_growths.append(b - a)

    if yield_growths:
        pos_yg   = sum(1 for g in yield_growths if g > 0)
        s_yield_trend = round(pos_yg / len(yield_growths) * 10, 1)
    else:
        s_yield_trend = 5.0   # neutral

    div_total = s_consistency + s_streak + s_yield + s_yield_trend   # max 40

    # ── 5. Quality factors — only for current recommendation ─────────────────
    s_roe = s_margin = s_momentum = None
    quality_total = 0

    if not as_of_year and fin_data:
        pr  = fin_data.get('profitability', {})
        tr  = fin_data.get('trading', {})
        ps  = fin_data.get('per_share', {})

        roe = pr.get('roe')
        if roe is not None:
            roe_pct = roe * 100 if abs(roe) <= 1 else roe
            s_roe = tier(roe_pct, [(25,10),(20,8),(15,6),(10,4),(0,2)]) or 0
        else:
            s_roe = 5

        margin = pr.get('profit_margin')
        if margin is not None:
            m_pct = margin * 100 if abs(margin) <= 1 else margin
            s_margin = tier(m_pct, [(20,10),(15,8),(10,6),(5,4),(0,2)]) or 0
        else:
            s_margin = 5

        price  = ps.get('current_price')
        avg200 = tr.get('avg200d')
        if price and avg200 and avg200 > 0:
            vs200 = (price - avg200) / avg200 * 100
            # Ideal entry: slightly above 200D MA (not overextended, not crashing)
            if   -5  <= vs200 <= 10:  s_momentum = 10
            elif  10 <  vs200 <= 20:  s_momentum = 7
            elif -15 <= vs200 < -5:   s_momentum = 6
            elif  vs200 > 20:         s_momentum = 4
            else:                      s_momentum = 2
        else:
            s_momentum = 5

        quality_total = s_roe + s_margin + s_momentum   # max 30

    total_score = div_total + quality_total   # max 70 (current) / 40 (backtest)

    return {
        'ticker':         ticker,
        'name':           name,
        'total_score':    round(total_score, 1),
        'div_score':      round(div_total, 1),
        'quality_score':  round(quality_total, 1),
        'consistency':    consistency * 100,
        'streak':         streak,
        'yield_pct':      round(yield_pct, 2) if yield_pct is not None else None,
        'scores': {
            'consistency':  s_consistency,
            'streak':       s_streak,
            'yield':        s_yield,
            'yield_trend':  s_yield_trend,
            'roe':          s_roe,
            'margin':       s_margin,
            'momentum':     s_momentum,
        },
    }


# ─── Reasoning generator ──────────────────────────────────────────────────────

def generate_reasoning(pick, fin_data, div_data, co_rank_entry):
    s = pick['scores']
    ticker = pick['ticker']
    name   = pick['name']
    yld    = pick.get('yield_pct')
    streak = pick['streak']
    cons   = pick['consistency']

    # Dividends
    div_text = (
        f"{name} has paid growing dividends for {streak} consecutive year(s) "
        f"with {cons:.0f}% consistency over the last 5 years."
    )
    if yld:
        div_text += f" The current dividend yield is {yld:.1f}%"
        if yld >= 5:
            div_text += ", which is well above average for Oslo Børs."
        elif yld >= 3:
            div_text += ", offering a competitive income return."
        else:
            div_text += "."
    if s.get('yield_trend') is not None and s['yield_trend'] >= 7:
        div_text += " Importantly, the yield percentage itself has been trending upward, indicating dividends are growing faster than the share price."

    # Valuation
    fin = fin_data or {}
    v   = fin.get('valuation', {})
    pr  = fin.get('profitability', {})
    pe  = v.get('trailing_pe') or v.get('forward_pe')
    roe_raw = pr.get('roe')
    roe = (roe_raw * 100) if (roe_raw is not None and abs(roe_raw) <= 1) else roe_raw

    val_parts = []
    if pe:
        if pe < 15:
            val_parts.append(f"P/E of {pe:.1f}x looks attractive relative to quality")
        elif pe < 20:
            val_parts.append(f"P/E of {pe:.1f}x is reasonable for a dividend compounder")
        else:
            val_parts.append(f"P/E of {pe:.1f}x is elevated but may be justified by growth")
    if roe:
        if roe >= 15:
            val_parts.append(f"ROE of {roe:.1f}% signals strong capital efficiency")
        else:
            val_parts.append(f"ROE of {roe:.1f}%")
    val_text = ". ".join(val_parts) + "." if val_parts else \
        "Valuation data is limited; the dividend yield provides a built-in margin of safety."

    # Momentum
    tr    = fin.get('trading', {})
    ps    = fin.get('per_share', {})
    price = ps.get('current_price')
    a200  = tr.get('avg200d')
    a52h  = tr.get('week52_high')
    a52l  = tr.get('week52_low')

    if price and a200 and a200 > 0:
        vs200 = (price - a200) / a200 * 100
        mom_text = f"Price is {abs(vs200):.1f}% {'above' if vs200 >= 0 else 'below'} the 200-day moving average"
        if -5 <= vs200 <= 10:
            mom_text += " — a constructive entry zone, not overextended."
        elif vs200 > 10:
            mom_text += " — strong uptrend; chasing slightly but momentum is positive."
        else:
            mom_text += " — a pullback offering a potentially better entry price."
    else:
        mom_text = "Price momentum data unavailable; focus on dividend fundamentals."

    if price and a52h and a52l and (a52h - a52l) > 0:
        pos_in_range = (price - a52l) / (a52h - a52l) * 100
        if pos_in_range < 40:
            mom_text += f" Currently near the lower end of its 52-week range ({pos_in_range:.0f}%), suggesting value."

    # Risks
    bs  = fin.get('balance_sheet', {})
    de  = bs.get('debt_to_equity')
    cr  = bs.get('current_ratio')
    beta = tr.get('beta')

    risk_parts = []
    if de and de > 150:
        risk_parts.append(f"debt/equity of {de:.0f}% is elevated and could pressure dividends if earnings decline")
    if cr and cr < 1.0:
        risk_parts.append(f"current ratio of {cr:.1f}x suggests limited short-term liquidity buffer")
    if beta and beta > 1.2:
        risk_parts.append(f"beta of {beta:.1f} means above-market volatility")
    if not risk_parts:
        risk_parts.append("balance sheet appears manageable based on available data")
    risk_parts.append("Oslo Børs is sensitive to oil prices and NOK/EUR movements")
    risk_parts.append("past dividend growth is not a guarantee of future payouts")
    risks_text = ". ".join(r.capitalize() for r in risk_parts) + "."

    return {
        'dividends': div_text,
        'valuation':  val_text,
        'momentum':   mom_text,
        'risks':      risks_text,
    }


def confidence_from_score(total, max_score):
    pct = total / max_score * 100
    if pct >= 70: return 'HIGH'
    if pct >= 50: return 'MEDIUM'
    return 'LOW'


# ─── Backtest ─────────────────────────────────────────────────────────────────

def run_backtest(all_divs, all_fin):
    results = []

    for year in BACKTEST_YEARS:
        exit_year = str(int(year) + 1)

        # Score every stock using only data available at end of 'year'
        scored = []
        for ticker, div_data in all_divs.items():
            s = score_stock(ticker, div_data, None, as_of_year=year)
            if s and s['total_score'] > 0:
                scored.append(s)

        if not scored:
            continue

        scored.sort(key=lambda x: x['total_score'], reverse=True)
        pick = scored[0]
        ticker = pick['ticker']

        div_data = all_divs[ticker]
        prices   = div_data.get('year_end_prices', {})
        yt       = yearly_totals(div_data.get('dividends', []))

        entry_price = prices.get(year)
        exit_price  = prices.get(exit_year)
        div_received = yt.get(exit_year, 0)

        if entry_price and exit_price and entry_price > 0:
            price_ret = (exit_price - entry_price) / entry_price * 100
            div_yield_realized = div_received / entry_price * 100
            total_ret = price_ret + div_yield_realized

            results.append({
                'year':                   year,
                'ticker':                 ticker,
                'name':                   pick['name'],
                'model_score':            pick['total_score'],
                'consistency_pct':        round(pick['consistency'], 1),
                'streak':                 pick['streak'],
                'yield_at_pick_pct':      round(pick['yield_pct'], 2) if pick['yield_pct'] else None,
                'entry_price':            round(entry_price, 2),
                'exit_price':             round(exit_price, 2),
                'div_received':           round(div_received, 2),
                'price_return_pct':       round(price_ret, 1),
                'div_yield_realized_pct': round(div_yield_realized, 1),
                'total_return_pct':       round(total_ret, 1),
                'outcome':                'WIN' if total_ret > 0 else 'LOSS',
            })
        else:
            # Price data missing — record pick but mark as unverified
            results.append({
                'year':           year,
                'ticker':         ticker,
                'name':           pick['name'],
                'model_score':    pick['total_score'],
                'consistency_pct': round(pick['consistency'], 1),
                'streak':         pick['streak'],
                'yield_at_pick_pct': round(pick['yield_pct'], 2) if pick['yield_pct'] else None,
                'entry_price':    None,
                'exit_price':     None,
                'div_received':   None,
                'price_return_pct':       None,
                'div_yield_realized_pct': None,
                'total_return_pct':       None,
                'outcome':        'NO_DATA',
            })

    return results


def backtest_summary(results):
    verified = [r for r in results if r['total_return_pct'] is not None]
    if not verified:
        return {'years_tested': 0, 'wins': 0, 'win_rate_pct': 0,
                'avg_total_return_pct': 0, 'best_return_pct': None, 'worst_return_pct': None}
    wins     = [r for r in verified if r['outcome'] == 'WIN']
    returns  = [r['total_return_pct'] for r in verified]
    return {
        'years_tested':         len(verified),
        'wins':                 len(wins),
        'win_rate_pct':         round(len(wins) / len(verified) * 100, 0),
        'avg_total_return_pct': round(sum(returns) / len(returns), 1),
        'best_return_pct':      round(max(returns), 1),
        'worst_return_pct':     round(min(returns), 1),
    }


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print('=' * 60)
    print('STATIC STOCK PICK MODEL — OSLO BØRS')
    print('=' * 60)

    all_divs = load_dir(DIVIDENDS_DIR)
    all_fin  = load_dir(FINANCIALS_DIR)
    print(f'Loaded {len(all_divs)} dividend files, {len(all_fin)} financial files')

    # ── Current recommendation ────────────────────────────────────────────────
    print('\nScoring all candidates...')
    scored = []
    for ticker, div_data in all_divs.items():
        fin_data = all_fin.get(ticker)
        s = score_stock(ticker, div_data, fin_data, as_of_year=None)
        if s and s['total_score'] > 0:
            scored.append(s)

    if not scored:
        print('❌  No candidates scored — check data files')
        return

    scored.sort(key=lambda x: x['total_score'], reverse=True)
    top = scored[0]
    ticker = top['ticker']
    div_data = all_divs[ticker]
    fin_data = all_fin.get(ticker)

    # Load rankings for extra context
    div_rankings = load_json(os.path.join(RANKINGS_DIR, 'dividend_rank.json'))
    co_rankings  = load_json(os.path.join(RANKINGS_DIR, 'company_rank.json'))
    co_rank_entry = None
    div_rank_entry = None
    if co_rankings:
        for r in co_rankings['rankings']:
            if r['ticker'] == ticker:
                co_rank_entry = r
                break
    if div_rankings:
        for r in div_rankings['rankings']:
            if r['ticker'] == ticker:
                div_rank_entry = r
                break

    reasoning = generate_reasoning(top, fin_data, div_data, co_rank_entry)
    confidence = confidence_from_score(top['total_score'], 70)

    # Build key metrics for display
    fin = fin_data or {}
    v   = fin.get('valuation', {})
    pr  = fin.get('profitability', {})
    tr  = fin.get('trading', {})
    roe_raw = pr.get('roe')
    roe_pct = round((roe_raw * 100 if abs(roe_raw) <= 1 else roe_raw), 1) if roe_raw else None
    pm_raw  = pr.get('profit_margin')
    pm_pct  = round((pm_raw  * 100 if abs(pm_raw)  <= 1 else pm_raw),  1) if pm_raw  else None

    key_metrics = {
        'dividend_yield_pct':     top.get('yield_pct'),
        'pe_ratio':               v.get('trailing_pe') or v.get('forward_pe'),
        'roe_pct':                roe_pct,
        'avg_5y_div_growth_pct':  div_rank_entry['avg_growth_5y'] if div_rank_entry else None,
        'consistency_pct':        round(top['consistency'], 1),
        'latest_annual_dividend': None,
        'company_score':          co_rank_entry['score'] if co_rank_entry else None,
        'dividend_score':         div_rank_entry['composite_score'] if div_rank_entry else None,
    }

    # Latest annual dividend
    yt = yearly_totals(div_data.get('dividends', []))
    if yt:
        key_metrics['latest_annual_dividend'] = round(yt[max(yt.keys())], 2)

    recommendation = {
        'ticker':           ticker,
        'name':             top['name'],
        'action':           'BUY',
        'hold_period':      '12 months',
        'confidence':       confidence,
        'estimated_upside': f"Dividend yield ~{top['yield_pct']:.1f}% + price appreciation" if top.get('yield_pct') else 'Dividend income + price appreciation',
        'summary':          (
            f"{top['name']} scores {top['total_score']:.0f}/70 in our multi-factor model, "
            f"driven by {top['consistency']:.0f}% dividend consistency and a "
            f"{top['streak']}-year growth streak."
            + (f" The {top['yield_pct']:.1f}% current yield provides immediate income while the model waits for price appreciation." if top.get('yield_pct') else "")
        ),
        'reasoning':        reasoning,
        'key_metrics':      key_metrics,
        'score_breakdown':  top['scores'],
        'total_score':      top['total_score'],
        'max_score':        70,
        'data_as_of':       datetime.now().strftime('%Y-%m-%d'),
    }

    # ── Backtest ──────────────────────────────────────────────────────────────
    print('Running backtest...')
    bt_picks   = run_backtest(all_divs, all_fin)
    bt_summary = backtest_summary(bt_picks)

    today = datetime.now()
    output = {
        'generated_at':        today.strftime('%Y-%m-%d %H:%M:%S'),
        'week':                today.strftime('%Y-W%V'),
        'model_type':          'static',
        'model_version':       '1.0',
        'recommendation':      recommendation,
        'candidates_scored':   len(scored),
        'top5_scores':         [
            {'ticker': s['ticker'], 'name': s['name'], 'score': s['total_score']}
            for s in scored[:5]
        ],
        'backtest': {
            'summary': bt_summary,
            'picks':   bt_picks,
            'note':    'Historical picks use dividend data only (no historical financials available). Current recommendation also includes ROE, margin, and price momentum.',
        },
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    r = recommendation
    print(f"\n✅  Pick: {r['ticker']} — {r['name']}")
    print(f"   Score:    {r['total_score']}/70  ({r['confidence']} confidence)")
    print(f"   Yield:    {top.get('yield_pct', '?')}%  |  Streak: {top['streak']}y  |  Consistency: {top['consistency']:.0f}%")
    print(f"\n   Backtest ({bt_summary['years_tested']} years verified):")
    print(f"   Win rate:    {bt_summary['win_rate_pct']:.0f}%  ({bt_summary['wins']}/{bt_summary['years_tested']} wins)")
    print(f"   Avg return:  {bt_summary['avg_total_return_pct']}%  (best: {bt_summary['best_return_pct']}%  worst: {bt_summary['worst_return_pct']}%)")
    for bt in bt_picks:
        ret_str = f"{bt['total_return_pct']:+.1f}%" if bt['total_return_pct'] is not None else "no price data"
        print(f"   {bt['year']}: {bt['ticker']:6s} → {ret_str}  ({bt['outcome']})")
    print('=' * 60)


if __name__ == '__main__':
    main()
