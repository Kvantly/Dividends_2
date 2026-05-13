"""
Weekly stock pick model — position tracking with exit strategy.

Each Sunday:
 1. Score all dividend stocks (same multi-factor model)
 2. Load previous position from ai_pick.json
 3. Fetch current price for held stock and check exit signals:
      - Take profit  ≥ +TAKE_PROFIT_PCT
      - Stop loss    ≤ -STOP_LOSS_PCT
      - Rotation     if best alternative scores ROTATION_GAP+ pts higher
        (only after MIN_HOLD_WEEKS to avoid churning)
 4. If no exit: HOLD current stock
    If exit triggered: SELL, then BUY best-scoring stock
    If no position: BUY best-scoring stock
 5. Run backtest using 2Y of weekly prices for top candidates.
    Simulates the same logic week-by-week.

Output: dividends-app/public/ai_pick.json
"""

import json, os
from datetime import datetime, timedelta
import yfinance as yf

DIVIDENDS_DIR  = 'dividends-app/public/dividends'
FINANCIALS_DIR = 'dividends-app/public/financials'
RANKINGS_DIR   = 'dividends-app/public/rankings'
OUTPUT_FILE    = 'dividends-app/public/ai_pick.json'

TAKE_PROFIT_PCT   = 20    # Sell when up ≥20% from entry
STOP_LOSS_PCT     = 15    # Sell when down ≥15% from entry
ROTATION_GAP      = 12    # Sell if best alt scores 12+ pts higher
MIN_HOLD_WEEKS    = 4     # Hold at least 4 weeks before any exit

BACKTEST_WEEKS    = 104   # ~2 years of weekly data
BACKTEST_CANDS    = 30    # fetch price history for top N stocks


# ─── Utilities ────────────────────────────────────────────────────────────────

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


def yearly_totals(dividends, up_to=None):
    by_year = {}
    for d in dividends:
        y = d['date'][:4]
        if up_to and d['date'] > up_to:
            continue
        by_year[y] = by_year.get(y, 0) + d['amount']
    return dict(sorted(by_year.items()))


def tier(val, thresholds):
    if val is None:
        return None
    for minimum, score in thresholds:
        if val >= minimum:
            return score
    return 0


# ─── Scoring ──────────────────────────────────────────────────────────────────

def score_stock(ticker, div_data, fin_data,
                as_of_date=None, current_price_override=None):
    """
    Score one stock.
    as_of_date: restrict dividend/price data (for backtest simulation)
    current_price_override: use this price instead of year_end_prices (for live/backtest)
    Returns dict or None if insufficient data.
    """
    divs   = div_data.get('dividends', [])
    prices = div_data.get('year_end_prices', {})
    name   = div_data.get('name', ticker)
    up_to  = str(as_of_date.date()) if as_of_date else None

    if as_of_date:
        divs   = [d for d in divs if d['date'] <= up_to]
        year_s = str(as_of_date.year)
        prices = {y: p for y, p in prices.items() if y <= year_s}

    yt    = yearly_totals(divs, up_to)
    years = sorted(yt.keys())

    if len(years) < 3:
        return None

    # ── Consistency (0-10) ───────────────────────────────────────────────────
    window  = years[-6:]
    growths = []
    for i in range(1, len(window)):
        prev, curr = yt.get(window[i-1]), yt.get(window[i])
        if prev and prev > 0:
            growths.append((curr - prev) / prev * 100)
    if not growths:
        return None
    pos         = sum(1 for g in growths if g > 0)
    consistency = pos / len(growths)
    s_cons      = round(consistency * 10, 1)

    # ── Streak (0-10) ────────────────────────────────────────────────────────
    streak = 0
    for g in reversed(growths):
        if g > 0: streak += 1
        else: break
    s_streak = min(streak * 2, 10)

    # ── Yield (0-10) — use override price, else latest year_end_price ────────
    latest_div   = yt.get(years[-1])
    last_full_yr = str((as_of_date.year - 1) if as_of_date else int(years[-1]))
    annual_div   = yt.get(last_full_yr) or latest_div

    price_for_yield = current_price_override or prices.get(years[-1])
    if price_for_yield and price_for_yield > 0 and annual_div:
        yield_pct = annual_div / price_for_yield * 100
        s_yield   = tier(yield_pct, [(8,10),(6,8),(4,6),(2,4),(0.01,2)]) or 0
    else:
        yield_pct = None
        s_yield   = 0

    # ── Yield trend (0-10) ───────────────────────────────────────────────────
    yield_series, yield_growths = [], []
    for yr in sorted(prices.keys())[-6:]:
        p = prices.get(yr); d = yt.get(yr)
        yield_series.append(d / p * 100 if p and p > 0 and d else None)
    for i in range(1, len(yield_series)):
        a, b = yield_series[i-1], yield_series[i]
        if a is not None and b is not None and a > 0:
            yield_growths.append(b - a)
    s_ytnd = round(sum(1 for g in yield_growths if g > 0) / len(yield_growths) * 10, 1) \
             if yield_growths else 0.0

    div_total = s_cons + s_streak + s_yield + s_ytnd   # max 40

    # ── Quality factors (only for live recommendation with financials) ────────
    s_roe = s_margin = s_mom = None
    q_total = 0
    if not as_of_date and fin_data:
        pr  = fin_data.get('profitability', {})
        tr  = fin_data.get('trading', {})
        ps  = fin_data.get('per_share', {})
        roe = pr.get('roe')
        if roe is not None:
            rp = roe * 100 if abs(roe) <= 1 else roe
            s_roe = tier(rp, [(25,10),(20,8),(15,6),(10,4),(0,2)]) or 0
        else:
            s_roe = 5
        pm = pr.get('profit_margin')
        if pm is not None:
            mp = pm * 100 if abs(pm) <= 1 else pm
            s_margin = tier(mp, [(20,10),(15,8),(10,6),(5,4),(0,2)]) or 0
        else:
            s_margin = 5
        price  = ps.get('current_price')
        avg200 = tr.get('avg200d')
        if price and avg200 and avg200 > 0:
            vs200 = (price - avg200) / avg200 * 100
            if   -5 <= vs200 <= 10:  s_mom = 10
            elif  10 < vs200 <= 20:  s_mom = 7
            elif -15 <= vs200 < -5:  s_mom = 6
            elif  vs200 > 20:        s_mom = 4
            else:                    s_mom = 2
        else:
            s_mom = 5
        q_total = s_roe + s_margin + s_mom

    total_score = div_total + q_total

    return {
        'ticker':       ticker,
        'name':         name,
        'total_score':  round(total_score, 1),
        'div_score':    round(div_total, 1),
        'quality_score': round(q_total, 1),
        'consistency':  consistency * 100,
        'streak':       streak,
        'yield_pct':    round(yield_pct, 2) if yield_pct is not None else None,
        'scores': {
            'consistency': s_cons,
            'streak':      s_streak,
            'yield':       s_yield,
            'yield_trend': s_ytnd,
            'roe':         s_roe,
            'margin':      s_margin,
            'momentum':    s_mom,
        },
    }


# ─── Price fetching ───────────────────────────────────────────────────────────

def fetch_current_price(ticker):
    try:
        hist = yf.Ticker(f"{ticker}.OL").history(period='5d', interval='1d')
        if not hist.empty:
            return round(float(hist['Close'].iloc[-1]), 4)
    except Exception as e:
        print(f"  ⚠️  {ticker} current price: {e}")
    return None


def fetch_weekly_prices(tickers, weeks=BACKTEST_WEEKS):
    """Fetch weekly close prices for backtest candidates."""
    start = (datetime.now() - timedelta(weeks=weeks + 4)).strftime('%Y-%m-%d')
    yf_map = {t: f"{t}.OL" for t in tickers}
    try:
        raw = yf.download(
            tickers=list(yf_map.values()),
            start=start,
            interval='1wk',
            auto_adjust=True,
            progress=False,
        )
        if raw.empty:
            return {}
        closes = raw['Close']
        result = {}
        for ticker, yf_t in yf_map.items():
            col = yf_t if yf_t in closes.columns else None
            if col is None and len(tickers) == 1:
                col = closes.columns[0] if not closes.empty else None
            if col is not None:
                series = closes[col].dropna()
                result[ticker] = {
                    str(ts.date()): round(float(p), 4)
                    for ts, p in series.items()
                    if not (hasattr(p, '__float__') and str(p) == 'nan')
                }
        return result
    except Exception as e:
        print(f"  ⚠️  Weekly price fetch failed: {e}")
        return {}


# ─── Backtest ─────────────────────────────────────────────────────────────────

def run_backtest(all_divs, candidates, weekly_prices):
    """
    Simulate the strategy week-by-week over the available price history.
    Returns (trades, equity_curve).
    """
    all_dates = sorted({d for prices in weekly_prices.values() for d in prices})
    if not all_dates:
        return [], []

    position    = None   # None = in cash
    cash_value  = 100.0  # track portfolio starting at 100
    pos_base    = 100.0  # portfolio value when we entered position
    weeks_held  = 0
    trades      = []
    equity_curve = []

    for date_str in all_dates:
        dt = datetime.strptime(date_str, '%Y-%m-%d')

        # Score candidates with data available up to this date
        scored = []
        for ticker in candidates:
            div_data = all_divs.get(ticker, {})
            curr_p   = weekly_prices.get(ticker, {}).get(date_str)
            s = score_stock(ticker, div_data, None, as_of_date=dt,
                            current_price_override=curr_p)
            if s and s['total_score'] > 0:
                scored.append(s)

        if not scored:
            equity_curve.append({'date': date_str, 'value': round(cash_value, 2), 'ticker': None})
            continue

        scored.sort(key=lambda x: x['total_score'], reverse=True)
        best = scored[0]

        # ── Check exit for current position ──────────────────────────────────
        if position:
            cur_p = weekly_prices.get(position['ticker'], {}).get(date_str)
            if cur_p:
                pct = (cur_p - position['entry_price']) / position['entry_price'] * 100
                current_val = pos_base * (1 + pct / 100)

                exit_reason = None
                if weeks_held >= MIN_HOLD_WEEKS:
                    if pct >= TAKE_PROFIT_PCT:
                        exit_reason = 'TAKE_PROFIT'
                    elif pct <= -STOP_LOSS_PCT:
                        exit_reason = 'STOP_LOSS'
                    elif (best['ticker'] != position['ticker'] and
                          best['total_score'] >= position['entry_score'] + ROTATION_GAP):
                        exit_reason = 'ROTATION'

                if exit_reason:
                    cash_value = current_val
                    trades.append({
                        'action':      'SELL',
                        'ticker':      position['ticker'],
                        'name':        position['name'],
                        'date':        date_str,
                        'price':       round(cur_p, 2),
                        'entry_price': round(position['entry_price'], 2),
                        'entry_date':  position['entry_date'],
                        'return_pct':  round(pct, 1),
                        'weeks_held':  weeks_held,
                        'exit_reason': exit_reason,
                        'outcome':     'WIN' if pct > 0 else 'LOSS',
                    })
                    position   = None
                    weeks_held = 0
                else:
                    cash_value = current_val

        # ── Enter position if in cash ─────────────────────────────────────────
        if not position:
            buy_price = weekly_prices.get(best['ticker'], {}).get(date_str)
            if buy_price:
                pos_base  = cash_value
                position  = {
                    'ticker':       best['ticker'],
                    'name':         best['name'],
                    'entry_price':  buy_price,
                    'entry_date':   date_str,
                    'entry_score':  best['total_score'],
                }
                weeks_held = 0
                trades.append({
                    'action': 'BUY',
                    'ticker': best['ticker'],
                    'name':   best['name'],
                    'date':   date_str,
                    'price':  round(buy_price, 2),
                    'score':  best['total_score'],
                })

        if position:
            weeks_held += 1

        equity_curve.append({
            'date':   date_str,
            'value':  round(cash_value, 2),
            'ticker': position['ticker'] if position else None,
        })

    return trades, equity_curve


def backtest_summary(trades, equity_curve):
    sells = [t for t in trades if t['action'] == 'SELL']
    if not sells:
        return {}
    returns = [t['return_pct'] for t in sells]
    wins    = [t for t in sells if t['outcome'] == 'WIN']
    avg_hold = sum(t['weeks_held'] for t in sells) / len(sells) if sells else 0

    values     = [e['value'] for e in equity_curve]
    peak       = values[0]
    max_dd     = 0.0
    for v in values:
        if v > peak:
            peak = v
        dd = (v - peak) / peak * 100
        if dd < max_dd:
            max_dd = dd

    return {
        'start_date':          equity_curve[0]['date'] if equity_curve else None,
        'end_date':            equity_curve[-1]['date'] if equity_curve else None,
        'final_value':         round(equity_curve[-1]['value'], 2) if equity_curve else 100,
        'total_return_pct':    round(equity_curve[-1]['value'] - 100, 1) if equity_curve else 0,
        'total_trades':        len(sells),
        'wins':                len(wins),
        'win_rate_pct':        round(len(wins) / len(sells) * 100) if sells else 0,
        'avg_trade_return_pct': round(sum(returns) / len(returns), 1) if returns else 0,
        'best_trade_pct':      round(max(returns), 1) if returns else None,
        'worst_trade_pct':     round(min(returns), 1) if returns else None,
        'avg_hold_weeks':      round(avg_hold, 1),
        'max_drawdown_pct':    round(max_dd, 1),
    }


# ─── Reasoning generator ──────────────────────────────────────────────────────

def generate_reasoning(pick, fin_data, div_rank_entry):
    s       = pick['scores']
    name    = pick['name']
    streak  = pick['streak']
    cons    = pick['consistency']
    yld     = pick.get('yield_pct')

    div_txt = (
        f"{name} has grown its dividend for {streak} consecutive year(s) "
        f"with {cons:.0f}% consistency over the available history."
    )
    if yld:
        div_txt += f" The current yield of {yld:.1f}%"
        div_txt += " is well above the Oslo Børs average." if yld >= 5 else \
                   " provides a solid income base." if yld >= 3 else "."
    if s.get('yield_trend', 0) >= 7:
        div_txt += " Crucially, the yield percentage itself is trending upward — dividends are outpacing price growth."

    fin = fin_data or {}
    v, pr, tr, bs = fin.get('valuation',{}), fin.get('profitability',{}), \
                    fin.get('trading',{}), fin.get('balance_sheet',{})
    pe  = v.get('trailing_pe') or v.get('forward_pe')
    roe_r = pr.get('roe')
    roe = (roe_r*100 if roe_r and abs(roe_r)<=1 else roe_r)

    val_parts = []
    if pe:
        val_parts.append(f"P/E {pe:.1f}x {'looks attractive' if pe < 15 else 'is reasonable' if pe < 20 else 'is elevated'}")
    if roe:
        val_parts.append(f"ROE {roe:.1f}% {'signals strong capital efficiency' if roe >= 15 else ''}")
    val_txt = '. '.join(val_parts) + '.' if val_parts else \
              "Valuation data limited; dividend yield provides a margin of safety."

    ps  = fin.get('per_share', {})
    price, a200 = ps.get('current_price'), tr.get('avg200d')
    if price and a200 and a200 > 0:
        v200 = (price - a200) / a200 * 100
        mom_txt = f"Price is {abs(v200):.1f}% {'above' if v200>=0 else 'below'} its 200-day MA"
        mom_txt += (" — ideal entry zone." if -5<=v200<=10 else
                    " — strong uptrend." if v200>10 else " — pullback entry opportunity.")
    else:
        mom_txt = "Price momentum data unavailable; focus on dividend fundamentals."

    de, beta = bs.get('debt_to_equity'), tr.get('beta')
    risks = []
    if de and de > 150: risks.append(f"D/E of {de:.0f}% is elevated")
    if beta and beta > 1.2: risks.append(f"beta {beta:.1f} means above-market swings")
    risks += ["past dividend growth doesn't guarantee future payouts",
              "Oslo Børs is sensitive to oil prices and NOK exchange rate"]
    risk_txt = ". ".join(r.capitalize() for r in risks) + "."

    return {'dividends': div_txt, 'valuation': val_txt,
            'momentum': mom_txt,  'risks': risk_txt}


def confidence_level(score, max_score=70):
    pct = score / max_score * 100
    return 'HIGH' if pct >= 70 else 'MEDIUM' if pct >= 50 else 'LOW'


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print('=' * 60)
    print('WEEKLY STOCK PICK — OSLO BØRS')
    print('=' * 60)

    all_divs = load_dir(DIVIDENDS_DIR)
    all_fin  = load_dir(FINANCIALS_DIR)
    print(f'Loaded {len(all_divs)} dividend files, {len(all_fin)} financial files')

    # ── Score all stocks for this week ────────────────────────────────────────
    print('\nScoring all candidates...')
    scored = []
    for ticker, div_data in all_divs.items():
        s = score_stock(ticker, div_data, all_fin.get(ticker))
        if s and s['total_score'] > 0:
            scored.append(s)
    scored.sort(key=lambda x: x['total_score'], reverse=True)
    if not scored:
        print('  No stocks passed scoring filters — aborting.')
        return
    print(f'  {len(scored)} stocks scored — top pick: {scored[0]["ticker"]} ({scored[0]["total_score"]}/70)')

    # ── Load previous position from last week's output ────────────────────────
    prev = load_json(OUTPUT_FILE)
    prev_pos = (prev or {}).get('recommendation', {}).get('position')

    action      = 'BUY'
    exit_signal = None
    position    = None

    best = scored[0]

    if prev_pos:
        held_ticker = prev_pos.get('ticker')
        entry_price = prev_pos.get('entry_price')
        entry_score = prev_pos.get('entry_score', 0)
        entry_date  = prev_pos.get('entry_date', '')
        weeks_held  = prev_pos.get('weeks_held', 0)

        cur_price = fetch_current_price(held_ticker)
        print(f'\n  Current position: {held_ticker} @ {entry_price} NOK  →  now {cur_price} NOK  ({weeks_held}w held)')

        if cur_price and entry_price:
            pct = (cur_price - entry_price) / entry_price * 100

            exit_reason = None
            if weeks_held >= MIN_HOLD_WEEKS:
                if pct >= TAKE_PROFIT_PCT:
                    exit_reason = 'TAKE_PROFIT'
                elif pct <= -STOP_LOSS_PCT:
                    exit_reason = 'STOP_LOSS'
                elif (best['ticker'] != held_ticker and
                      best['total_score'] >= entry_score + ROTATION_GAP):
                    exit_reason = 'ROTATION'

            if exit_reason:
                print(f'  EXIT signal: {exit_reason} ({pct:+.1f}%) → rotate to {best["ticker"]}')
                exit_signal = {
                    'reason':        exit_reason,
                    'prev_ticker':   held_ticker,
                    'exit_price':    round(cur_price, 2),
                    'return_pct':    round(pct, 1),
                    'weeks_held':    weeks_held,
                    'outcome':       'WIN' if pct > 0 else 'LOSS',
                }
                action = 'SELL_BUY'
            else:
                # HOLD current position
                action    = 'HOLD'
                best      = next((s for s in scored if s['ticker'] == held_ticker), scored[0])
                cur_score = next((s['total_score'] for s in scored if s['ticker'] == held_ticker), scored[0]['total_score'])
                position  = {
                    'ticker':        held_ticker,
                    'entry_date':    entry_date,
                    'entry_price':   entry_price,
                    'entry_score':   entry_score,
                    'current_price': round(cur_price, 2),
                    'current_score': cur_score,
                    'unrealized_pct': round(pct, 1),
                    'weeks_held':    weeks_held + 1,
                    'take_profit_at': round(entry_price * (1 + TAKE_PROFIT_PCT / 100), 2) if entry_price else None,
                    'stop_loss_at':   round(entry_price * (1 - STOP_LOSS_PCT / 100), 2) if entry_price else None,
                }
                print(f'  HOLD {held_ticker}  {pct:+.1f}%  ({weeks_held+1} weeks)')
        else:
            print(f'  Could not fetch current price for {held_ticker} — defaulting to HOLD')
            action   = 'HOLD'
            position = {**prev_pos, 'weeks_held': (prev_pos.get('weeks_held', 0) + 1)}

    # If BUY or SELL_BUY, new position starts now
    if action in ('BUY', 'SELL_BUY'):
        new_price = fetch_current_price(best['ticker'])
        position  = {
            'ticker':        best['ticker'],
            'entry_date':    datetime.now().strftime('%Y-%m-%d'),
            'entry_price':   new_price,
            'entry_score':   best['total_score'],
            'current_price': new_price,
            'current_score': best['total_score'],
            'unrealized_pct': 0.0,
            'weeks_held':    1,
            'take_profit_at': round(new_price * (1 + TAKE_PROFIT_PCT / 100), 2) if new_price else None,
            'stop_loss_at':   round(new_price * (1 - STOP_LOSS_PCT / 100), 2) if new_price else None,
        }

    # ── Build recommendation object ───────────────────────────────────────────
    div_rank  = load_json(os.path.join(RANKINGS_DIR, 'dividend_rank.json'))
    co_rank   = load_json(os.path.join(RANKINGS_DIR, 'company_rank.json'))
    div_entry = next((r for r in (div_rank or {}).get('rankings', []) if r['ticker'] == best['ticker']), None)
    co_entry  = next((r for r in (co_rank  or {}).get('rankings', []) if r['ticker'] == best['ticker']), None)
    fin_data  = all_fin.get(best['ticker'])
    reasoning = generate_reasoning(best, fin_data, div_entry)

    fin       = fin_data or {}
    v, pr, tr = fin.get('valuation',{}), fin.get('profitability',{}), fin.get('trading',{})
    roe_r = pr.get('roe')
    roe_p = round((roe_r*100 if roe_r and abs(roe_r)<=1 else roe_r), 1) if roe_r else None
    pm_r  = pr.get('profit_margin')
    pm_p  = round((pm_r*100  if pm_r  and abs(pm_r)<=1  else pm_r),  1) if pm_r  else None
    yt    = yearly_totals(all_divs.get(best['ticker'], {}).get('dividends', []))

    action_text = {'BUY': 'BUY', 'HOLD': 'HOLD', 'SELL_BUY': 'SELL → BUY'}[action]
    pos_pct = (position or {}).get('unrealized_pct', 0)
    summary_prefix = {
        'HOLD':     f"Holding {best['name']} — currently {pos_pct:+.1f}% from entry. ",
        'SELL_BUY': f"Exiting {exit_signal['prev_ticker']} ({exit_signal['return_pct']:+.1f}% — {exit_signal['reason']}). Rotating to {best['ticker']}. ",
        'BUY':      '',
    }[action]

    recommendation = {
        'action':           action_text,
        'ticker':           best['ticker'],
        'name':             best['name'],
        'confidence':       confidence_level(best['total_score']),
        'hold_period':      f"Until exit signal (take profit ≥+{TAKE_PROFIT_PCT}%, stop loss ≤-{STOP_LOSS_PCT}%)",
        'estimated_upside': f"Div yield ~{best['yield_pct']:.1f}% + capital gain" if best.get('yield_pct') else 'Dividend income + capital gain',
        'summary':          summary_prefix + (
            f"{best['name']} scores {best['total_score']:.0f}/70 this week, "
            f"driven by {best['consistency']:.0f}% dividend consistency and a "
            f"{best['streak']}-year growth streak."
        ),
        'reasoning':        reasoning,
        'key_metrics': {
            'dividend_yield_pct':    best.get('yield_pct'),
            'pe_ratio':              v.get('trailing_pe') or v.get('forward_pe'),
            'roe_pct':               roe_p,
            'avg_5y_div_growth_pct': div_entry['avg_growth_5y'] if div_entry else None,
            'consistency_pct':       round(best['consistency'], 1),
            'latest_annual_dividend': round(yt[max(yt.keys())], 2) if yt else None,
            'company_score':         co_entry['score'] if co_entry else None,
            'dividend_score':        div_entry['composite_score'] if div_entry else None,
        },
        'score_breakdown': best['scores'],
        'total_score':     best['total_score'],
        'max_score':       70,
        'position':        position,
        'exit_signal':     exit_signal,
        'data_as_of':      datetime.now().strftime('%Y-%m-%d'),
    }

    # ── Backtest ──────────────────────────────────────────────────────────────
    print(f'\nFetching {BACKTEST_WEEKS}w of weekly prices for top {BACKTEST_CANDS} candidates...')
    top_tickers  = [s['ticker'] for s in scored[:BACKTEST_CANDS]]
    weekly_prices = fetch_weekly_prices(top_tickers, BACKTEST_WEEKS)
    print(f'  Got prices for {len(weekly_prices)} tickers')

    print('Running backtest simulation...')
    trades, equity_curve = run_backtest(all_divs, top_tickers, weekly_prices)
    bt_sum = backtest_summary(trades, equity_curve)

    # Thin equity curve to weekly (already weekly, but cap at last 104 points)
    thin_curve = equity_curve[-BACKTEST_WEEKS:] if len(equity_curve) > BACKTEST_WEEKS else equity_curve

    today = datetime.now()
    output = {
        'generated_at':       today.strftime('%Y-%m-%d %H:%M:%S'),
        'week':               today.strftime('%G-W%V'),
        'model_type':         'static',
        'model_version':      '2.0',
        'recommendation':     recommendation,
        'candidates_scored':  len(scored),
        'top5_scores':        [
            {'ticker': s['ticker'], 'name': s['name'], 'score': s['total_score']}
            for s in scored[:5]
        ],
        'exit_rules': {
            'take_profit_pct': TAKE_PROFIT_PCT,
            'stop_loss_pct':   STOP_LOSS_PCT,
            'rotation_gap':    ROTATION_GAP,
            'min_hold_weeks':  MIN_HOLD_WEEKS,
        },
        'backtest': {
            'summary':      bt_sum,
            'equity_curve': thin_curve,
            'trades':       trades,
            'note': (
                f"Simulates the same model and exit rules ({TAKE_PROFIT_PCT}% TP / "
                f"{STOP_LOSS_PCT}% SL / {ROTATION_GAP}pt rotation) over the last "
                f"~{BACKTEST_WEEKS} weeks using live yfinance weekly prices. "
                "Quality factors (ROE/margin/momentum) excluded from historical scoring."
            ),
        },
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    r = recommendation
    print(f"\n✅  Action:  {r['action']}")
    print(f"   Pick:    {r['ticker']} — {r['name']}")
    print(f"   Score:   {r['total_score']}/70  ({r['confidence']})")
    if bt_sum:
        print(f"   Backtest: {bt_sum.get('total_return_pct',0):+.1f}% total  "
              f"win {bt_sum.get('win_rate_pct',0):.0f}%  "
              f"avg {bt_sum.get('avg_trade_return_pct',0):+.1f}%/trade  "
              f"max DD {bt_sum.get('max_drawdown_pct',0):.1f}%")
    print('=' * 60)


if __name__ == '__main__':
    main()
