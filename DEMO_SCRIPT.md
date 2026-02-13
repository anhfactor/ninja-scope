# NinjaScope Demo Script

> Follow this script while screen recording to create a compelling demo video.
> Recommended: Use a terminal with a dark theme and large font (16pt+).
> Recording tool: QuickTime (macOS) or OBS Studio.

---

## Setup (before recording)

```bash
cd ~/Documents/ninja-inj
npm start
```

Wait for the startup banner to appear, then start recording.

---

## Scene 1: Introduction (show Swagger docs) — ~15s

**Action:** Open browser to `http://localhost:3000/docs`

**Narration:** "NinjaScope is a REST API that transforms Injective's raw on-chain data into developer-ready intelligence — 20 endpoints across 6 categories."

**Screenshot opportunity:** Full Swagger UI showing all endpoint groups.

---

## Scene 2: Ticker Lookup — ~15s

**Action:** Switch to terminal, run:

```bash
curl -s 'http://localhost:3000/api/v1/markets/ticker/INJ-USDT' | jq
```

**Narration:** "Find any market by its human-readable ticker — no hex hashes needed."

**Screenshot opportunity:** Clean JSON response showing INJ/USDT market data.

---

## Scene 3: Orderbook with Human-Readable Prices — ~20s

**Action:** Run:

```bash
curl -s 'http://localhost:3000/api/v1/markets/0xa508cb32923323679f29a032c70342c147c17d0145625922b0ef22e955c844c0/orderbook' | jq '.data.buys[:3]'
```

**Narration:** "Orderbooks include human-readable prices. Raw values like 0.00000000000299 are automatically converted to $2.99 using token decimals."

**Screenshot opportunity:** Orderbook showing both raw and humanPrice fields side by side.

---

## Scene 4: Market Health Score — ~15s

**Action:** Run:

```bash
curl -s 'http://localhost:3000/api/v1/markets/0xa508cb32923323679f29a032c70342c147c17d0145625922b0ef22e955c844c0/health' | jq '.data'
```

**Narration:** "Every market gets a composite health score from 0 to 100, computed from spread tightness, orderbook depth, and trade activity."

**Screenshot opportunity:** Health score response with component breakdown.

---

## Scene 5: Market Rankings — ~15s

**Action:** Run:

```bash
curl -s 'http://localhost:3000/api/v1/markets/rankings?sort=health&limit=5' | jq '.data[] | {ticker, healthScore, rating, spreadPercentage}'
```

**Narration:** "Rankings let you instantly find the healthiest markets on Injective — sortable by health, spread, or depth."

**Screenshot opportunity:** Top 5 markets ranked by health score.

---

## Scene 6: Whale Detection — ~15s

**Action:** Run:

```bash
curl -s 'http://localhost:3000/api/v1/markets/0xa508cb32923323679f29a032c70342c147c17d0145625922b0ef22e955c844c0/whales' | jq '.data[:3] | .[] | {tradeDirection, humanPrice, humanQuantity, notionalValue}'
```

**Narration:** "Whale detection automatically surfaces the largest trades by notional value — the top 10% by default, or set your own threshold."

**Screenshot opportunity:** Top whale trades with notional values.

---

## Scene 7: All-in-One Snapshot — ~15s

**Action:** Run:

```bash
curl -s 'http://localhost:3000/api/v1/markets/0xa508cb32923323679f29a032c70342c147c17d0145625922b0ef22e955c844c0/snapshot' | jq '{market: .data.market.ticker, bestBid: .data.orderbook.topBuys[0].humanPrice, bestAsk: .data.orderbook.topSells[0].humanPrice, health: .data.health.score, rating: .data.health.rating, spread: .data.spread.spreadPercentage}'
```

**Narration:** "The snapshot endpoint gives you everything about a market in one call — market details, top orderbook, recent trades, health, and spread. Perfect for dashboards."

**Screenshot opportunity:** Compact snapshot summary.

---

## Scene 8: Wallet Portfolio — ~15s

**Action:** Run:

```bash
curl -s 'http://localhost:3000/api/v1/accounts/inj14au322k9munkmx5wrchz9q30juf5wjgz2cfqku/portfolio' | jq '{address: .data.address, balances: (.data.bankBalances | length), subaccounts: (.data.subaccounts | length), positions: .data.positionsCount}'
```

**Narration:** "Wallet intelligence — get any address's bank balances, subaccounts, and open positions in one call."

**Screenshot opportunity:** Portfolio summary.

---

## Scene 9: Caching Demo — ~15s

**Action:** Run the same command twice quickly:

```bash
curl -s 'http://localhost:3000/api/v1/markets/0xa508cb32923323679f29a032c70342c147c17d0145625922b0ef22e955c844c0/health' | jq '.meta'
```

```bash
curl -s 'http://localhost:3000/api/v1/markets/0xa508cb32923323679f29a032c70342c147c17d0145625922b0ef22e955c844c0/health' | jq '.meta'
```

**Narration:** "Intelligent caching with per-type TTLs. The first call fetches fresh data, the second is instant from cache. The meta.cached field tells clients exactly what happened."

**Screenshot opportunity:** Two responses showing cached: false then cached: true with took_ms: 0.

---

## Scene 10: Closing — ~10s

**Action:** Switch back to Swagger docs in browser, scroll through endpoints.

**Narration:** "NinjaScope — 20 endpoints, 6 categories, live Injective mainnet data. Built with TypeScript, Fastify, and the official Injective SDK."

---

## Tips for Recording

1. **Install jq** if not already: `brew install jq` (makes JSON output colorful and readable)
2. **Use a large terminal font** — at least 16pt so text is readable in video
3. **Pause briefly** between commands so viewers can read the output
4. **Total video length:** aim for ~2-3 minutes
5. **Screenshots to capture:**
   - Swagger UI overview (Scene 1)
   - Orderbook with humanPrice fields (Scene 3)
   - Market rankings table (Scene 5)
   - Whale trades (Scene 6)
   - Cache hit demo (Scene 9)
