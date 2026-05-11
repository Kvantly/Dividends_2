"""
Weekly AI Stock Pick for Oslo Børs.
Reads all existing dividend, financial, and ranking data, then calls
the Claude API to produce a structured buy recommendation with full reasoning.
Output: dividends-app/public/ai_pick.json
"""

import json
import os
from datetime import datetime
import anthropic

DIVIDENDS_DIR = 'dividends-app/public/dividends'
FINANCIALS_DIR = 'dividends-app/public/financials'
RANKINGS_DIR   = 'dividends-app/public/rankings'
OUTPUT_FILE    = 'dividends-app/public/ai_pick.json'

CANDIDATES_FROM_EACH_RANKING = 20  # top N from each ranking list to consider


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
    for filename in os.listdir(directory):
        if filename.endswith('.json'):
            ticker = filename[:-5]
            data = load_json(os.path.join(directory, filename))
            if data:
                result[ticker] = data
    return result


def fmt(v, suffix='', decimals=1):
    if v is None:
        return 'N/A'
    if isinstance(v, float):
        return f"{v:.{decimals}f}{suffix}"
    return f"{v}{suffix}"


def build_context(candidates, all_fin, div_rank_map, co_rank_map):
    sections = []

    for ticker in candidates:
        lines = [f"\n--- {ticker} ---"]
        dr = div_rank_map.get(ticker)
        cr = co_rank_map.get(ticker)
        fin = all_fin.get(ticker)

        name = (fin or {}).get('name') or (dr or {}).get('name') or ticker
        lines.append(f"Company: {name}")

        if dr:
            yearly_str = ' | '.join(
                f"{y['year']}: div={fmt(y['total'], ' NOK', 2)}, "
                f"growth={fmt(y['growth_pct'], '%')}, "
                f"yield={fmt(y['yield_pct'], '%')}"
                for y in dr['yearly'][-5:]
                if y.get('growth_pct') is not None or y.get('yield_pct') is not None
            )
            lines.append(
                f"Dividend rank: #{dr['rank']}  score={dr['composite_score']}  "
                f"avg_5y_growth={fmt(dr['avg_growth_5y'], '%')}  "
                f"consistency={fmt(dr['consistency_pct'], '%')}  "
                f"streak={dr['streak']}y  "
                f"latest_yield={fmt(dr.get('latest_yield'), '%')}"
            )
            if yearly_str:
                lines.append(f"Yearly history: {yearly_str}")

        if cr:
            m = cr['metrics']
            s = cr['scores']
            lines.append(
                f"Company rank: #{cr['rank']}  score={cr['score']}/100  "
                f"P/E={fmt(m.get('pe'))}  ROE={fmt(m.get('roe'), '%')}  "
                f"margin={fmt(m.get('profit_margin'), '%')}  "
                f"D/E={fmt(m.get('debt_to_equity'))}  "
                f"beta={fmt(m.get('beta'))}  "
                f"vs200d={fmt(m.get('price_vs_200d'), '%')}  "
                f"rev_growth={fmt(m.get('revenue_growth'), '%')}"
            )
            top_scores = sorted(s.items(), key=lambda x: x[1], reverse=True)[:4]
            lines.append("Top scoring factors: " + ', '.join(f"{k}={v}/10" for k, v in top_scores))

        if fin:
            v   = fin.get('valuation', {})
            ps  = fin.get('per_share', {})
            tr  = fin.get('trading', {})
            inc = fin.get('income', {})
            bs  = fin.get('balance_sheet', {})
            lines.append(
                f"Price={fmt(ps.get('current_price'), ' NOK')}  "
                f"52w={fmt(tr.get('week52_low'), ' NOK')}-{fmt(tr.get('week52_high'), ' NOK')}  "
                f"fwd_PE={fmt(v.get('forward_pe'))}  "
                f"EPS={fmt(ps.get('eps_trailing'), ' NOK')}  "
                f"mkt_cap={v.get('market_cap', 'N/A')}  "
                f"current_ratio={fmt(bs.get('current_ratio'))}  "
                f"earnings_growth={fmt(inc.get('earnings_growth'), '%')}"
            )

        sections.append('\n'.join(lines))

    return '\n'.join(sections)


def main():
    print('=' * 60)
    print('WEEKLY AI STOCK PICK — OSLO BØRS')
    print('=' * 60)

    all_divs       = load_dir(DIVIDENDS_DIR)
    all_fin        = load_dir(FINANCIALS_DIR)
    div_rankings   = load_json(os.path.join(RANKINGS_DIR, 'dividend_rank.json'))
    co_rankings    = load_json(os.path.join(RANKINGS_DIR, 'company_rank.json'))

    if not div_rankings or not co_rankings:
        print('❌  Rankings not available — run calculate_rankings.py first')
        return

    print(f'Loaded: {len(all_divs)} dividend files, {len(all_fin)} financial files')

    div_rank_map = {r['ticker']: r for r in div_rankings['rankings']}
    co_rank_map  = {r['ticker']: r for r in co_rankings['rankings']}

    # Union of top N from each ranking, div-rank first
    div_top = [r['ticker'] for r in div_rankings['rankings'][:CANDIDATES_FROM_EACH_RANKING]]
    co_top  = [r['ticker'] for r in co_rankings['rankings'][:CANDIDATES_FROM_EACH_RANKING]]
    seen, candidates = set(), []
    for t in div_top + co_top:
        if t not in seen:
            seen.add(t)
            candidates.append(t)

    print(f'Analyzing {len(candidates)} candidate stocks...')
    context = build_context(candidates, all_fin, div_rank_map, co_rank_map)

    today = datetime.now()
    week  = today.strftime('%Y-W%V')

    prompt = f"""You are a senior equity analyst specialising in Oslo Stock Exchange (Oslo Børs) dividend stocks.
Today is {today.strftime('%A, %d %B %Y')} — producing the weekly pick for {week}.

Your audience is a Norwegian private investor seeking reliable dividend income with moderate capital growth.
They are comfortable holding for 3–18 months and want clear, honest reasoning including risks.

Below is quantitative data for {len(candidates)} candidate stocks drawn from dividend history,
financial statements, and composite ranking scores (all data is recent; prices in NOK).

{context}

─────────────────────────────────────────
TASK
─────────────────────────────────────────
Select the single best stock to BUY this week.

Prioritise:
1. Consistent, growing dividend yield (primary goal)
2. Reasonable valuation (P/E, ROE, debt)
3. Positive price momentum (above 200-day MA)
4. Strong balance sheet (low debt, positive cash flow)
5. Be contrarian if a fundamentally strong stock has pulled back

Respond with ONLY a valid JSON object — no markdown fences, no commentary outside JSON:

{{
  "ticker": "XXXX",
  "name": "Full company name",
  "action": "BUY",
  "hold_period": "e.g. 6–12 months",
  "confidence": "HIGH or MEDIUM or LOW",
  "estimated_upside": "e.g. 12–18% total return including dividends",
  "summary": "2–3 sentence executive summary of why this is the best pick this week",
  "reasoning": {{
    "dividends":  "2–3 sentences: yield level, growth history, consistency, reliability",
    "valuation":  "2–3 sentences: P/E vs peers/history, ROE, what makes it cheap or fairly priced",
    "momentum":   "1–2 sentences: price vs 200-day MA, recent trend, entry point quality",
    "risks":      "2–3 sentences: the main risks an investor should monitor"
  }},
  "key_metrics": {{
    "dividend_yield_pct":       0.0,
    "pe_ratio":                 0.0,
    "roe_pct":                  0.0,
    "avg_5y_div_growth_pct":    0.0,
    "consistency_pct":          0.0,
    "latest_annual_dividend":   0.0,
    "company_score":            0,
    "dividend_score":           0
  }},
  "data_as_of": "{today.strftime('%Y-%m-%d')}"
}}"""

    print('Calling Claude API...')
    client = anthropic.Anthropic()

    message = client.messages.create(
        model='claude-sonnet-4-6',
        max_tokens=2000,
        messages=[{'role': 'user', 'content': prompt}],
    )

    raw = message.content[0].text.strip()
    # Strip markdown fences if model wrapped the JSON
    if raw.startswith('```'):
        raw = '\n'.join(raw.split('\n')[1:])
        raw = raw.rsplit('```', 1)[0].strip()

    recommendation = json.loads(raw)

    output = {
        'generated_at':        today.strftime('%Y-%m-%d %H:%M:%S'),
        'week':                week,
        'recommendation':      recommendation,
        'model':               'claude-sonnet-4-6',
        'candidates_analyzed': len(candidates),
        'input_tokens':        message.usage.input_tokens,
        'output_tokens':       message.usage.output_tokens,
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    r = recommendation
    print(f"\n✅  Pick: {r['ticker']} — {r['name']}")
    print(f"   Action:     {r['action']}  ({r['confidence']} confidence)")
    print(f"   Hold:       {r['hold_period']}")
    print(f"   Upside est: {r['estimated_upside']}")
    print(f"   Summary:    {r['summary'][:120]}...")
    print(f"   Tokens:     {message.usage.input_tokens} in / {message.usage.output_tokens} out")
    print('=' * 60)


if __name__ == '__main__':
    main()
