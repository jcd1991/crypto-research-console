<div align="center">

# Crypto Market Terminal

**A crypto-focused OpenTerminal fork for market data, execution-aware research views, regimes, trades, and risk.**

Dark. Dense. Keyboard‑driven. Zero paid API keys, zero subscriptions.

[![Stack](https://img.shields.io/badge/stack-Next.js%20%2B%20Express%20%2B%20TypeScript-orange)](#tech-stack)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](#license)
[![No API Key Required](https://img.shields.io/badge/data-no%20API%20key%20required-brightgreen)](#data-sources)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-ff69b4.svg)](#contributing)

<sub>Derived from <a href="https://github.com/ErTasselli/OpenTerminal">OpenTerminal</a>; crypto-specific UI and adapters are maintained here.</sub>

<br/>

<img src="docs/screenshots/dashboard.png" alt="Crypto terminal dashboard — live chart, quote panel, watchlist, crypto board, and research panels" width="100%" />

<sub>⭐ If this is useful to you, consider starring the repo — it genuinely helps other people find it.</sub>

</div>

<br/>

## Why this terminal?

Crypto market data, exchange monitoring, and research tooling are often split across several dashboards. This fork puts the crypto workflow first: quotes, candles, watchlists, reference market data, Freqtrade runs, regimes, trades, and risk in one local terminal.

It retains OpenTerminal's fast, keyboard-first, widget-based architecture while narrowing the supported product story to crypto. Provider fallbacks are explicit and source badges distinguish reference prices from execution-grade research artifacts.

No signup. No credit card. No rate‑limited demo tier. Clone it, `npm install`, and you have a live terminal in under a minute.

<br/>

## ✨ Features

- 🖥️ **Widget-based workspace** — drag, resize, add, and remove panels (`react-grid-layout`); your layout is saved locally and restored on reload
- ⌘K **global command palette** — search supported crypto assets and jump straight to them
- 📈 **Professional charting** (via [`lightweight-charts`](https://github.com/tradingview/lightweight-charts)) — candlesticks, bars, line, area, volume, 8 timeframes (1D → MAX), and SMA / EMA / VWAP / Bollinger Bands / RSI / MACD indicators, each with a live hover legend showing OHLC, volume, and every active indicator's value under your cursor
- 💹 **Crypto quote panel** — last / bid / ask / OHLC, volume, market cap, and venue/source status
- 📰 **News feed** — aggregated and de‑duplicated from multiple RSS sources, per‑symbol or global
- 🪙 **Crypto board** — top assets with 7‑day sparklines, BTC/ETH dominance, and full OHLCV charting for any listed coin
- 🧭 **Crypto regime dashboard** — inspect exported regimes, confidence, PnL, and drawdown in UTC/24×7 time
- 🧪 **Strategy run console** — inspect Market Behavior Lab artifacts without embedding Python or Freqtrade
- 💼 **Portfolio tracker** — log buy/sell transactions, track average cost, realized & unrealized P&L (persisted in SQLite)
- 🤖 **AI assistant** (optional) — ask questions about the symbol you're looking at, powered by Claude, fully context‑aware of the terminal's current data
- ⚡ **Near real‑time updates** — quotes and indexes refresh every second with a subtle flash on change, so you always know what just moved
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

No paid API, no keys, and no single point of failure — every endpoint has a fallback chain, and results are cached with a stale‑while‑revalidate strategy so a temporary outage never blanks out the UI.

| Data | Primary source | Fallback |
|---|---|---|
| Crypto quotes & board | CoinGecko | Binance public API |
| Crypto candles | Binance public API (klines) | Coinbase reference |
| News | Yahoo Finance RSS | Google News RSS |
| Freqtrade execution truth | Market Behavior Lab artifacts | — |
| Freqtrade monitor | Localhost read-only REST adapter | — |

> ⚠️ These are public endpoints, not officially licensed data feeds — treat prices as delayed/indicative, not execution‑grade. See [`server/src/providers/`](server/src/providers) — each provider is a small, isolated module, so swapping or adding a data source is a 30‑minute job.

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

### Optional Market Behavior Lab connector

This optional connector reads exported runs from
[Market Behavior Lab](https://github.com/jcd1991/market-behavior-lab). The lab
exports normalized Freqtrade artifacts; this console reads them without
embedding Python or Freqtrade in the TypeScript UI.

```bash
cp .env.example .env
export LAB_ARTIFACT_ROOT=/absolute/path/to/market-behavior-lab/research/runs
npm run dev
```

The Crypto Regime and Strategy Lab panels use UTC and 24/7 market semantics,
preserve spot/perpetual pair syntax, and display source badges. The optional
Freqtrade monitor is localhost-only and read-only. See
[`docs/market-behavior-lab.md`](docs/market-behavior-lab.md).

### Optional: AI assistant

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

Without a key, everything else still works — the AI widget just shows a friendly "unavailable" message instead of failing.

### Security defaults

- The API binds to `127.0.0.1` and only accepts browser requests from `http://localhost:3000` by default — nothing else on your network can reach it out of the box.
- The portfolio and AI endpoints require a shared secret. If you don't set `API_KEY` yourself, the API generates one on first run and saves it to `data/.api-key`; the bundled web app reads that file automatically, so local dev stays zero-config.
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
│       ├── providers/       # crypto reference feeds and optional Freqtrade adapter
│       ├── routes/          # crypto market, portfolio, AI, optional lab adapter
│       ├── cache.ts         # TTL cache with stale-while-revalidate fallback
│       └── db.ts            # SQLite (better-sqlite3, WAL)
└── web/                      # Next.js 15 + React 19 + Tailwind 4
    ├── components/           # TopBar, Sidebar, Workspace, CommandPalette
    ├── components/widgets/   # Chart, Quote, Watchlist, Crypto, Regime, Strategy Lab, News, Risk
    ├── lib/                  # API client, technical indicators
    └── store/                # Zustand store (workspace layout, persisted)
```

Run tests with `npm test` (Vitest, no network calls). CI runs on every push — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

<br/>

## 🗺️ Roadmap

- [ ] Chart drawing tools & multi‑asset comparison overlay
- [ ] Price alerts with desktop notifications
- [ ] PostgreSQL as an alternative to SQLite

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

- `npm audit` still flags two dependency advisories this project doesn't force-fix: `fast-xml-parser`'s XMLBuilder injection (moderate) doesn't apply here — only `XMLParser` is used, never `XMLBuilder` — and `postcss`'s high-severity issue is bundled inside Next.js itself, only resolved by a Next 16 major upgrade. Both are tracked, neither is silently ignored.
- If you deploy behind a reverse proxy or load balancer, set `API_HOST`/`WEB_ORIGIN` to match, and terminate TLS in front of it — this project doesn't handle HTTPS itself.

<br/>

## ⚖️ Disclaimer

For personal and educational use only. Market data comes from public endpoints and may be delayed, incomplete, or occasionally wrong — **do not use this for real investment decisions**.

This repository is a crypto terminal fork, not the strategy research repository.
Strategies, feature engineering, backtests, and research experiments belong in
[Market Behavior Lab](https://github.com/jcd1991/market-behavior-lab). This
console only visualizes exported artifacts and optionally monitors a local
Freqtrade instance through read-only endpoints.

This project is not affiliated with, endorsed by, or sponsored by any of the data providers it connects to. It does not host or redistribute data to third parties — it's source code you run yourself, fetching data directly from the provider. Respect the terms of service of the underlying data providers; most free sources are licensed for personal/research use only and prohibit commercial redistribution.

## License

[MIT](LICENSE)

<br/>

<div align="center">

**star the repo** ⭐ — it's the best way to support the project.

</div>
