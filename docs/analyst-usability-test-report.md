# Analyst usability test report

Test date: 2026-09-19. The test used an isolated SQLite database and API on port 4101 so test notes, alerts, wallets, and unlocks did not contaminate the working database.

## End-to-end results

| Journey | Result | Evidence |
|---|---|---|
| BTC leveraged-risk memo | Pass with coverage caveats | BTC derivatives returned Hyperliquid; Binance remained explicit unavailable. Liquidity returned Hyperliquid depth and venue-specific Binance/Bybit failures. |
| ETH client allocation proposal | Pass with coverage caveats | ETH derivatives and Coin Metrics daily data returned; protocol fundamentals remain separate by metric and source. |
| Lido governance/event-risk review | Pass | Snapshot returned 20 Lido proposals with state, dates, quorum, scores, and source links. |
| Curated wallet due diligence | Pass | Valid wallet creation persisted chain, address, label, label type, source URL, and notes. |
| Token unlock risk check | Pass | Unlock creation required a source URL and confidence, and persisted the event metadata. |
| Outage/restart drill | Partial | HTTP 451/403 states were preserved, but liquidation history is initially empty until collectors accumulate local events. |
| Public research-wallet overlay | Pass with provenance caveat | A public Binance 8 exchange wallet was followed and Blockscout returned normalized ETH/ERC-20 holdings; no wallet-change event fired on the initial snapshot, as expected. |

## API smoke results

All 14 isolated checks passed:

- API key rejection without authentication.
- BTC and ETH derivatives.
- BTC liquidity.
- BTC liquidation summary.
- Stablecoin and ETF flow endpoint.
- BTC and ETH on-chain endpoints.
- Lido governance.
- Immutable thesis creation and snapshot readback.
- Venue-scoped alert creation.
- Curated wallet creation.
- Source-required unlock creation.

## Friction discovered and resolved

1. Liquidation summaries now attempt a Binance REST backfill at collector startup and expose WebSocket/backfill status. A fresh installation can still show `insufficient_history` when the provider returns a regional 451; this remains an explicit coverage limitation rather than an inferred zero.
2. Binance and Bybit can be unavailable by geography or network policy. Hyperliquid and OKX now provide independent venue rows, but the analyst should not mistake any single venue for market-wide coverage.
3. ETF flows may come from the derived-holdings fallback when Farside is blocked. The API and UI now expose source, `reported`/`derived` classification, and confidence so derived values cannot be mistaken for issuer-reported flows.
4. Snapshot governance is space-ID based. A protocol without a verified Snapshot space should be labeled unavailable rather than guessed.
5. Wallet and unlock registries are intentionally empty until the analyst adds curated records; this is safer than an opaque label vendor but creates setup work. The forms now validate EVM addresses, required labels, dates, and primary HTTP(S) URLs before submitting.
6. Raw on-chain JSON was hard to scan in a client workflow. The Intelligence panel now presents the latest eight observations as a compact date/price/market-cap/transaction table, and governance has a protocol selector instead of a hard-coded Lido-only view.

## Client-proposal checklist

Before using a result in a client memo, record:

- Asset/protocol and exact instrument or governance space.
- Provider, venue, source URL, observation time, and freshness state.
- Whether a value is reported, derived, or analyst-curated.
- Coverage gaps and provider failures.
- The original thesis snapshot and invalidation condition.
- Whether history is sufficient for the requested conclusion.

Wallet-specific checks used the public Binance 8 address `0xf977814e90da44bfa03b6295a0616a897441acec`. This is an address-level observation, not proof of ownership or control. The wallet overlay returned native ETH plus ERC-20 balances and preserved the Blockscout source URL.

The browser smoke test verified the rendered controls and loaded data through the accessibility tree at `http://localhost:3000/`. The desktop screenshot renderer returned a black capture in this environment, so visual confirmation relied on the browser's accessibility tree and live HTTP responses.
