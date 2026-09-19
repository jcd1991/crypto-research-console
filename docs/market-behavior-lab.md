# Optional Market Behavior Lab connector

This repository is a crypto-focused OpenTerminal fork. It does not contain
Freqtrade, strategy implementations, feature engineering, exchange
credentials, or a live trading control path. Market Behavior Lab is an
optional external research engine; this connector only reads its normalized
artifacts and can monitor a local Freqtrade instance through read-only API
calls.

The boundary is intentional:

| Repository | Responsibility |
| --- | --- |
| `market-behavior-lab` | Strategies, research features, backtests, evaluation, and artifact generation |
| Upstream Freqtrade | Exchange data, execution simulation, backtesting, and bot runtime |
| `crypto-research-console` | Crypto UI, reference feeds, artifact display, and read-only local monitoring |

## Local setup

```bash
cp .env.example .env
npm install
LAB_ARTIFACT_ROOT=/absolute/path/to/market-behavior-lab/research/runs npm run dev
```

The web application runs on `http://localhost:3000` and the API on
`http://127.0.0.1:4000`. `LAB_ARTIFACT_ROOT` should contain one directory per
exported run. Each run is valid only when it contains `run.json`,
`candles.parquet`, `regimes.json`, `signals.json`, `trades.json`, and
`metrics.json`.

## Exporting a run

From the separately installed Freqtrade checkout:

```bash
freqtrade backtesting \
  --userdir "$LAB_ROOT/user_data" \
  --config "$LAB_ROOT/examples/config.backtest.example.json" \
  --datadir "$LAB_ROOT/user_data/data" \
  --strategy RegimeRouted \
  --timerange 20240601-20251201 \
  --export signals

python "$LAB_ROOT/scripts/export_lab_run.py" \
  --backtest-export "$LAB_ROOT/user_data/backtest_results/<export>.zip" \
  --datadir "$LAB_ROOT/user_data/data" \
  --output "$LAB_ROOT/research/runs/okx-regimerouted-2024-2025"
```

The exporter uses Freqtrade's exchange data as the execution truth. Every
artifact carries the venue, market type, pair universe, and source label.
Spot pairs remain `BTC/USDT`; perpetuals remain `BTC/USDT:USDT`.

## Read-only Freqtrade monitoring

Set the local API credentials in the server environment. The backend obtains a
token and calls only read endpoints for health, status, trades, profit,
performance, strategies, and analyzed candles. It does not proxy start, stop,
force-enter, force-exit, reload, or other control actions. Freqtrade documents
the broader REST surface here:
<https://www.freqtrade.io/en/stable/rest-api/>.

The adapter rejects non-loopback Freqtrade URLs. Do not expose this development
API to the internet.

## Data boundaries

CoinGecko and OpenTerminal's public Binance feed remain reference overlays for
discovery and visualization. They are never merged into Freqtrade candles,
trades, equity, or performance. OpenTerminal's public data warning is retained
in its upstream documentation: <https://github.com/ErTasselli/OpenTerminal#data-sources>.

Futures-only fields such as funding, basis, mark price, index price, open
interest, leverage, and liquidation distance are nullable. Spot runs do not
request or synthesize those fields.

## Portfolio framing

This is an experimental research instrument. Historical backtests are not
performance promises, and venue behavior does not automatically transfer to a
different exchange.

> If this makes money, tell me lol. If it loses money, tell me that too—the
> point is to measure reality, not promise returns.
