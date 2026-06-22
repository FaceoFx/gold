#!/usr/bin/env python3
"""Fetch Yahoo GC=F candles server-side and write data/yahoo-gold.json for GitHub Pages."""
from __future__ import annotations
import json
import time
import urllib.request
from pathlib import Path

OUT = Path('data/yahoo-gold.json')
URLS = [
    'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=2d&interval=5m&includePrePost=true',
    'https://query2.finance.yahoo.com/v8/finance/chart/GC=F?range=2d&interval=5m&includePrePost=true',
]

headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; gold-chart-updater/1.0)',
    'Accept': 'application/json,text/plain,*/*',
}

last_error = None
payload = None
for url in URLS:
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=20) as resp:
            payload = json.loads(resp.read().decode('utf-8'))
        break
    except Exception as exc:  # keep trying the alternate host
        last_error = str(exc)
        payload = None

if not payload:
    raise SystemExit(f'Yahoo fetch failed: {last_error}')

result = (payload.get('chart', {}).get('result') or [None])[0]
if not result:
    raise SystemExit('Yahoo response had no chart result')

ts = result.get('timestamp') or []
quote = ((result.get('indicators') or {}).get('quote') or [{}])[0]
close = quote.get('close') or []

candles = []
for t, p in zip(ts, close):
    if p is None:
        continue
    try:
        price = float(p)
    except Exception:
        continue
    if price > 100:
        candles.append({'t': int(t) * 1000, 'p': round(price, 3)})

if len(candles) < 8:
    raise SystemExit(f'Not enough Yahoo candles: {len(candles)}')

# Keep the file compact; 2 trading days of 5m candles is enough for 12h chart and closed-market fallback.
out = {
    'updatedAt': int(time.time() * 1000),
    'source': 'Yahoo GitHub Auto',
    'symbol': 'GC=F',
    'interval': '5m',
    'range': '2d',
    'candles': candles[-650:],
}

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(out, separators=(',', ':')), encoding='utf-8')
print(f'Wrote {OUT} with {len(out["candles"])} candles')
