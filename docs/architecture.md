# Crypto terminal architecture

Crypto Market Terminal is a crypto-focused fork of OpenTerminal. It is an
inspection and monitoring application, not a strategy repository.

## Responsibility boundary

```text
Market Behavior Lab ── exports normalized artifacts ──┐
                                                      ├─> Crypto Market Terminal UI
Freqtrade localhost REST ── read-only monitoring ─────┘

CoinGecko / public Binance ── reference overlays only
```

The strategy source, regime features, backtests, and research conclusions stay
in [Market Behavior Lab](https://github.com/jcd1991/market-behavior-lab). The
console does not import Python, execute strategies, run backtests, or infer
execution results from public reference feeds.

## Supported console surface

- Crypto quotes, candles, watchlists, and news.
- UTC/24×7 regime and strategy-run inspection from exported artifacts.
- Venue-labeled trades, metrics, drawdown, and risk views.
- Optional read-only Freqtrade health, status, trades, profit, performance, and
  analyzed-candle monitoring over loopback REST.
- Reference-only CoinGecko and public Binance overlays.

The artifact adapter validates and labels `run.json`, `candles.parquet`,
`regimes.json`, `signals.json`, `trades.json`, and `metrics.json`. It does not
recreate the research pipeline that produced them.
