<div align="center">

# Crypto Market Terminal

**A local crypto research terminal for spot markets, perpetual positioning, catalysts, fundamentals, wallets, and risk.**

Dark. Dense. Keyboard‑driven. Zero paid API keys, zero subscriptions.

[![Stack](https://img.shields.io/badge/stack-Next.js%20%2B%20Express%20%2B%20TypeScript-orange)](#tech-stack)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](#license)
[![No API Key Required](https://img.shields.io/badge/data-no%20API%20key%20required-brightgreen)](#data-sources)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-ff69b4.svg)](#contributing)

<sub>Forked from <a href="https://github.com/ErTasselli/OpenTerminal">ErTasselli/OpenTerminal</a> under the MIT License. This downstream project is independently maintained and is not affiliated with the upstream authors.</sub>

<br/>

<img src="docs/screenshots/dashboard.png" alt="Crypto terminal dashboard — live chart, quote panel, watchlist, crypto board, and research panels" width="100%" />

<sub>⭐ If this is useful to you, consider starring the repo — it genuinely helps other people find it.</sub>

</div>

<br/>

## Scope

Crypto market data, derivatives positioning, catalysts, and protocol evidence are often split across several dashboards. This project narrows OpenTerminal to one job: a local, read-only crypto research workspace. The default workflow connects spot prices and candles with perpetual funding, mark/index basis, open interest, news, fundamentals, wallet context, and risk.

It is not an order-entry system, equity terminal, token recommendation engine, or claim of profitable trading performance. Provider and venue labels stay visible because a reference price, a Binance perpetual snapshot, and a wallet holdings observation are different kinds of evidence and must not be silently blended.

No signup. No credit card. No rate‑limited demo tier. Clone it, `npm install`, and you have a live terminal in under a minute.

<br/>

## ✨ Features

- 🖥️ **Widget-based workspace** — drag, resize, add, and remove panels (`react-grid-layout`); your layout is saved locally and restored on reload
- ⌘K **global command palette** — search supported crypto assets and jump straight to them
- 📈 **Professional charting** (via [`lightweight-charts`](https://github.com/tradingview/lightweight-charts)) — candlesticks, bars, line, area, volume, 8 timeframes (1D → MAX), and SMA / EMA / VWAP / Bollinger Bands / RSI / MACD indicators, each with a live hover legend showing OHLC, volume, and every active indicator's value under your cursor
- 💹 **Crypto quote panel** — last / bid / ask / OHLC, volume, market cap, and venue/source status
- 🧭 **Cross-venue leverage map** — independent Binance USD-M, Hyperliquid, and OKX rows, native funding intervals, mark/index basis, OI in native units plus USD, and explicit 451/unavailable/stale states
- 🧬 **Protocol fundamentals** — curated Lido, Aave, Uniswap, Hyperliquid Perps, and Jupiter pages with TVL, fees, revenue, holder revenue, market cap/FDV, ratios, missing-field reasons, and DefiLlama provenance
- 📝 **Research notebook + alert inbox** — API-key-protected structured theses with immutable metric snapshots, append-only reviews, fixed metric thresholds, transition-only events, and optional in-session browser notifications
- ⚡ **Market intelligence adapters** — Binance/Bybit liquidation collectors with Binance REST warm-backfill and connection status, Binance/Bybit/Hyperliquid/OKX order-book depth, public stablecoin supply, ETF flow provenance and confidence, Coin Metrics Community daily series, Snapshot governance proposals, read-only Ethereum Research Wallet holdings/follows via Blockscout, curated wallet labels, and source-required unlock records
- 📰 **News feed** — aggregated and de‑duplicated from multiple RSS sources, per‑symbol or global
- 🪙 **Crypto board** — top assets with 7‑day sparklines, BTC/ETH dominance, and full OHLCV charting for any listed coin
- 💼 **Portfolio tracker** — log buy/sell transactions, track average cost, realized & unrealized P&L (persisted in SQLite)
- 🤖 **AI assistant** (optional) — ask questions about the symbol you're looking at, powered by Claude, fully context‑aware of the terminal's current data
- ⚡ **Frequent local refreshes** — research panels poll on bounded intervals and use cached provider fallbacks instead of pretending to be a tick-perfect execution feed
- ⌨️ **Keyboard shortcuts** everywhere — `⌘K` to search, `⌥1`–`⌥9` to add any widget

<br/>

## 📸 A closer look

### Charting

Candlesticks, bars, line, or area — 8 timeframes, six technical indicators, and a live legend under your cursor showing OHLC, volume, and every active indicator's value for the candle you're pointing at.

<img src="docs/screenshots/chart.png" alt="Candlestick chart with SMA/RSI/MACD indicators and hover legend" width="100%" />

<br/>

### Crypto

Top assets with 7‑day sparklines and BTC/ETH dominance — click through to full OHLCV candlestick charting for any listed coin.

<img src="docs/screenshots/crypto.png" alt="Crypto board with sparklines and dominance" width="100%" />

<br/>

### News

Headlines aggregated and de‑duplicated across multiple sources, filterable per‑symbol or global, so you're never digging through five tabs to catch up.

<img src="docs/screenshots/news.png" alt="Per-symbol and global news feed, aggregated and de-duplicated" width="100%" />

<br/>

## 🗂️ Data sources

The core workspace requires no paid market-data key. Reference quotes and candles use cached fallback chains; venue-specific research panels fail visibly when their named venue is unavailable instead of substituting a different venue and presenting it as equivalent.

| Data | Primary source | Fallback |
|---|---|---|
| Crypto quotes & board | CoinGecko | Binance public API |
| Crypto candles | Binance public API (klines) | Coinbase reference |
| Perpetual positioning | Binance USD-M, Hyperliquid, and OKX public APIs | — |
| Protocol fundamentals | DefiLlama exact curated slugs | — |
| Liquidations & liquidity | Binance/Bybit streams, Binance REST warm-backfill, and Binance/Bybit/Hyperliquid/OKX public APIs | — |
| Stablecoins | DefiLlama public stablecoin API | — |
| ETF flows | Farside reported rows when reachable; Xoomar holdings-derived fallback with confidence labeling | — |
| On-chain history | Coin Metrics Community API | — |
| Governance | Snapshot Hub GraphQL | — |
| News | Yahoo Finance RSS | Google News RSS |

> ⚠️ These are public endpoints, not officially licensed data feeds — treat prices as delayed/indicative, not execution‑grade. See [`server/src/providers/`](server/src/providers) — each provider is a small, isolated module, so swapping or adding a data source is a 30‑minute job.

The derivatives panel is intentionally venue-specific. Funding, basis, and open interest from one venue must not be substituted for missing data on another venue or outside its available time range.

### Provenance rules

Every research panel should answer four questions before you use it in a memo:

1. **What exactly was observed?** Asset, protocol, instrument, chain, or wallet.
2. **Where did it come from?** Provider, venue, source URL, and source timestamp.
3. **How fresh and complete is it?** Available, stale, unavailable, or insufficient history.
4. **Is it reported or derived?** ETF rows, wallet labels, and calculated ratios carry explicit classification and confidence.

Missing data remains `null` or visibly unavailable. The console does not silently turn a different venue, a failed provider, or a missing metric into a plausible-looking substitute.

<br/>

## 🚀 Quick start

```bash
git clone https://github.com/jcd1991/crypto-research-console.git
cd crypto-research-console
npm install
npm run dev
```

- Web UI → **http://localhost:3000**
- API health → **http://localhost:4000/api/status**

That's it — no `.env` file required to get a fully working terminal.

### Optional: AI assistant

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

Without a key, everything else still works — the AI widget just shows a friendly "unavailable" message instead of failing.

### Security defaults

- The API binds to `127.0.0.1` and only accepts browser requests from `http://localhost:3000` by default — nothing else on your network can reach it out of the box.
- The portfolio and AI endpoints require a shared secret. If you don't set `API_KEY` yourself, the API generates one on first run and saves it to `data/.api-key`; the bundled web app reads that file automatically, so local dev stays zero-config.
- Research routes (`/api/research/*`) use the same shared secret. A single-process sampler stores five-minute perpetual and fifteen-minute protocol observations in SQLite, retains 90 days, and can be disabled with `RESEARCH_SAMPLER_ENABLED=0` on tests or additional replicas.
- Research Wallets are read-only public-address lookups. They never request private keys, seed phrases, signatures, exchange credentials, or transaction permissions. Ethereum holdings use Blockscout public APIs; a wallet label is analyst metadata, not proof of ownership.
- To expose this beyond your own machine, set `API_HOST=0.0.0.0`, `API_KEY=<a-strong-secret>` (on both the api and web processes), and `WEB_ORIGIN=<your actual origin>` explicitly. Don't do this without also keeping dependencies patched — see [Known limitations](#known-limitations) below.
- The `/api/ai` rate limit (10 req/min) keys on `req.ip`. Calls made through the bundled web proxy all arrive from that proxy's own address, so by default every caller sharing it shares one bucket. If you're serving more than one real user through it, set `TRUST_PROXY=1` on the api process **only if** you also run your own reverse proxy in front of the web service that sets `X-Forwarded-For` from the real client and doesn't let visitors set it themselves — otherwise a caller can forge that header to dodge the limit.

<br/>

## 🐳 Docker

```bash
docker compose up --build
```

Portfolio data persists in the `terminal-data` volume (SQLite, WAL mode). Ports are published on `127.0.0.1` only by default; see [Security defaults](#security-defaults) to expose it deliberately.

<br/>

## 🧱 Tech stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 15 · React 19 · TypeScript · Tailwind CSS 4 · Zustand · TanStack Query |
| Charts | `lightweight-charts` (candles/indicators) · D3 (heatmap treemap) · Recharts (yield curve) |
| Backend | Node.js · Express · TypeScript |
| Database | SQLite (`better-sqlite3`, WAL mode) |
| AI | Anthropic Claude (optional) |

<br/>

## 📁 Project structure

```
├── server/                  # Express + TypeScript crypto API
│   └── src/
│       ├── providers/       # market, venue, protocol, on-chain, and wallet adapters
│       ├── routes/          # crypto market, research, portfolio, AI, optional lab adapter
│       ├── services/        # normalized snapshots, samplers, alerts, and wallet events
│       ├── cache.ts         # TTL cache with stale-while-revalidate fallback
│       └── db.ts            # SQLite (better-sqlite3, WAL)
└── web/                      # Next.js 15 + React 19 + Tailwind 4
    ├── components/           # TopBar, Sidebar, Workspace, CommandPalette
    ├── components/widgets/   # Market, leverage, fundamentals, intelligence, notebook, wallet, and risk panels
    ├── lib/                  # API client, technical indicators
    └── store/                # Zustand store (workspace layout, persisted)
```

Run tests with `npm test` (Vitest, no network calls). CI runs on every push — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

<br/>

## Research workflow

The terminal is organized around the questions a crypto analyst needs to answer before forming a view:

1. **Market context:** price, volume, breadth, BTC/ETH dominance, and the current regime.
2. **Positioning:** perpetual mark/index basis, funding, open interest, venue-specific liquidity, and liquidation coverage.
3. **Catalysts:** asset-specific and market-wide news, governance, unlocks, stablecoin/ETF flows, and timestamps.
4. **Wallet context:** compare a public research wallet's holdings with the asset/protocol thesis; treat labels and inferred intent as hypotheses.
5. **Risk:** portfolio exposure and the difference between reference data, research artifacts, and execution truth.

This prioritization follows the structure of current institutional crypto markets: spot, fixed-term futures, perpetuals, options, ETPs, and on-chain protocols coexist, while perpetuals remain a major center of activity. See Coinbase Institutional's [Guide to Crypto Markets 2026](https://www.coinbase.com/institutional/research-insights/resources/guides/guide-to-crypto-markets-2026), the [Coin Metrics market-data taxonomy](https://docs.coinmetrics.io/market-data), and Binance's documentation for [funding](https://www.binance.com/en/support/faq/detail/360033525031) and [mark price](https://www.binance.com/en/support/faq/detail/360033525271).

## Competitive positioning

Paid products still have materially broader data coverage: CoinGlass emphasizes cross-exchange derivatives, liquidation and liquidity heatmaps, anomaly alerts, and high-frequency history; Glassnode combines spot, futures, options, ETF, macro, and long-run on-chain fundamentals; Nansen differentiates through labeled wallets, Smart Money tracking, and wallet alerts; and Messari focuses on curated research, screeners, feeds, and governance intelligence. This console intentionally competes on a narrower axis: local ownership, transparent provider/venue lineage, reproducible snapshots, open-source code, and a thesis notebook that does not turn missing data into false precision.

The open-source roadmap is therefore complementary rather than a claim of feature parity. The console now covers the first transparent versions of liquidation/order-book data, public wallet holdings, exchange/stablecoin flows, token unlocks, and governance. Remaining expansion areas include options surfaces, deeper historical on-chain series, and more chain-specific wallet adapters—each behind an explicit provider adapter and provenance badge.

<br/>

## Fork lineage and attribution

This repository began as a fork of [ErTasselli/OpenTerminal](https://github.com/ErTasselli/OpenTerminal). The retained upstream foundation includes the Next.js/Express workspace, draggable widget grid, keyboard-driven command palette, charting and indicator layer, local portfolio storage, provider registry, caching, and much of the original visual system.

The downstream work changes the product boundary to crypto: crypto-only discovery and defaults, 24/7 semantics, spot/reference fallbacks, perpetual positioning, protocol fundamentals, wallet context, venue/provenance labels, and removal of equity-first and legacy analysis panels from the supported interface. Some upstream modules may remain in repository history for comparison, but they are not part of the supported crypto-terminal workflow.

OpenTerminal's copyright notice and MIT terms are preserved in [`LICENSE`](LICENSE). Upstream deserves credit for the terminal architecture; downstream crypto-specific changes and any defects in them belong to this repository. Neither project endorses the other.

<br/>

## Upstream differences and staying current

This is a focused downstream product, not a drop-in OpenTerminal distribution. OpenTerminal provides the general terminal shell and interaction model; this repository intentionally narrows the supported workflow to crypto research. That means crypto-first symbols and defaults, 24/7 market semantics, venue-separated perpetual data, protocol fundamentals, liquidation and liquidity context, public wallet research, governance and unlock evidence, provenance badges, and an immutable research notebook. Equity-first panels and the former regime/strategy lab are not part of this console's supported interface.

The fork remains able to receive upstream improvements. The remotes are deliberately separated:

- `github` is the writable downstream repository (`jcd1991/crypto-research-console`).
- `upstream` is the fetch-only source repository (`ErTasselli/OpenTerminal`).

Review upstream changes before adopting them; do not merge `upstream/main` directly into the crypto product without checking whether a change reintroduces equity assumptions, execution behavior, unlabeled provider fallbacks, or the removed legacy panels. A safe sync looks like:

```bash
git fetch upstream --prune
git switch -c upstream-sync/$(date +%Y-%m-%d) main
git log --oneline main..upstream/main
git diff --stat main...upstream/main
# Select the compatible commits, or resolve a reviewed merge:
git cherry-pick <upstream-commit>
# or: git merge --no-ff upstream/main
npm test
npm run lint
npm run build
git diff --check
git push github upstream-sync/$(date +%Y-%m-%d)
```

Prefer small, reviewable cherry-picks for shared shell, accessibility, dependency, and resilience fixes. Keep crypto adapters, research schemas, provenance rules, and crypto-specific tests in this repository when conflicts occur. If an upstream change is useful but changes product meaning, adapt it in a separate commit rather than importing it unchanged. Delete the temporary sync branch after the reviewed changes are merged into `main`.

For a fresh clone, configure the same separation with `git remote add upstream https://github.com/ErTasselli/OpenTerminal.git`; keep `github` as the push target and treat `upstream` as read-only by convention.

<br/>

## 🗺️ Roadmap

- [x] Cross-venue perpetual leverage map with normalized symbols, native intervals, contract units, timestamps, and explicit coverage gaps
- [x] Funding and open-interest snapshots with price/OI interpretation and bounded history endpoints
- [ ] Options volatility surface (term structure, skew, put/call positioning) from a clearly attributed venue
- [ ] On-chain context: exchange and ETF flows, active addresses, transfer value, realized cap/MVRV, with metric definitions beside every chart
- [x] Protocol fundamentals: TVL, fees, protocol revenue, holder revenue, provenance, and missing-field reasons
- [x] Research notebook: immutable timestamped thesis snapshot, catalyst, invalidation, and append-only review
- [x] Research Wallets: read-only Ethereum holdings, follow state, stale fallback, and material-change inbox events
- [ ] Data-quality ledger showing provider freshness, venue, units, missing windows, fallbacks, and stale observations
- [ ] Multi-asset relative-strength and correlation views plus exportable research snapshots

Have an idea? [Open an issue](../../issues) — contributions are very welcome.

<br/>

## 🤝 Contributing

Pull requests are welcome, especially:
- New or more resilient data providers (`server/src/providers/`)
- New widgets (`web/components/widgets/`)
- Bug fixes and UI polish

Please open an issue first for anything non‑trivial so we can align on approach before you invest the time.

<br/>

## Known limitations

- Binance spot and USD-M endpoints can return HTTP 451 in restricted locations. Spot views can fall back to reference providers; the Binance derivatives panel deliberately shows unavailable because substituting another venue would change the meaning of funding, basis, and open interest.
- `npm audit` still flags two dependency advisories this project doesn't force-fix: `fast-xml-parser`'s XMLBuilder injection (moderate) doesn't apply here — only `XMLParser` is used, never `XMLBuilder` — and `postcss`'s high-severity issue is bundled inside Next.js itself, only resolved by a Next 16 major upgrade. Both are tracked, neither is silently ignored.
- If you deploy behind a reverse proxy or load balancer, set `API_HOST`/`WEB_ORIGIN` to match, and terminate TLS in front of it — this project doesn't handle HTTPS itself.

<br/>

## ⚖️ Disclaimer

For personal and educational use only. Market data comes from public endpoints and may be delayed, incomplete, or occasionally wrong — **do not use this for real investment decisions**.

This repository is a crypto terminal fork focused on live research context. It
does not place orders or claim to replace a backtesting or execution system.

This project is not affiliated with, endorsed by, or sponsored by any of the data providers it connects to. It does not host or redistribute data to third parties — it's source code you run yourself, fetching data directly from the provider. Respect the terms of service of the underlying data providers; most free sources are licensed for personal/research use only and prohibit commercial redistribution.

## License

[MIT](LICENSE)

<br/>

<div align="center">

**star the repo** ⭐ — it's the best way to support the project.

</div>
