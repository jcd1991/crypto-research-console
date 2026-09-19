# Research Wallets requirements

## Scope

Research Wallets are read-only public-address watchlists. They are not custody, trading, signing, or portfolio-account integrations.

## v1 requirements

- Support Ethereum EVM addresses through the public Blockscout API.
- Require a valid public address, analyst label, chain, and optional provenance URL.
- Allow `followed` state to be toggled without changing the immutable address or label history.
- Fetch native ETH and ERC-20 holdings with amount, decimals, USD price when supplied by the provider, USD value, contract address, observation time, and source URL.
- Store each successful holdings response as a SQLite snapshot; retain the last successful response when the provider is unavailable and mark it stale.
- On a followed wallet, create one durable wallet inbox event when a position is added, removed, or changes by at least $100,000 between successful snapshots.
- Never infer missing price as zero, and never create a change event from a failed or stale response.
- Expose unread/read wallet events separately from market-threshold alerts.
- Never request private keys, seed phrases, wallet signatures, or transaction permissions.

## Analyst acceptance cases

1. Add a known public exchange wallet and verify its normalized ETH/ERC-20 holdings.
2. Follow it and verify the follow state persists after reload.
3. Refresh twice without a material balance change and verify no duplicate event is created.
4. Force a provider failure and verify the last successful holdings remain visible as stale.
5. Confirm BTC/ETH leverage, liquidity, fundamentals, governance, notes, and alerts still work with wallet context present.

## Provider boundary

Blockscout is the initial EVM adapter. It reports address-level holdings and token metadata; it does not prove that an address is controlled by a named entity. Labels remain analyst-curated and should carry a source URL.
