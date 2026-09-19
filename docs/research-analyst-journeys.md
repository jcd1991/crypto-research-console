# Research analyst usability journeys

These are end-to-end tasks for evaluating the console as a real research workstation. Each task is deliberately written as a decision a crypto analyst might need to support, not as a feature checklist.

## 1. BTC leveraged-risk memo

**Question:** Is BTC showing healthy demand, or is a new long crowded trade forming?

1. Set the active asset to BTC.
2. Review the perpetual leverage map by venue.
3. Compare funding interval, funding rate, mark/oracle basis, OI USD, and 24-hour OI change.
4. Inspect the liquidity tab for spread, ±0.5% depth, and imbalance.
5. Inspect liquidation totals and collector status.
6. Compare BTC ETF flows and Coin Metrics daily price/supply/transaction history.
7. Save a structured thesis with catalyst and invalidation condition.
8. Create a Hyperliquid funding alert and a 24-hour OI-change alert.

**Pass criteria:** Binance or Bybit outages remain visible; Hyperliquid is not mislabeled as a fallback; missing liquidation history is explicit; the saved thesis contains the original metric snapshot; alerts identify their venue.

## 2. ETH client allocation proposal

**Question:** Does ETH ecosystem activity support a medium-term allocation proposal?

1. Review ETH derivatives and liquidity coverage.
2. Inspect the ETH on-chain daily series and note coverage length.
3. Open protocol fundamentals for Aave and Uniswap.
4. Compare TVL, fees, revenue, holder revenue, market cap, FDV, and annualized ratios.
5. Inspect governance proposals for the relevant Snapshot space.
6. Write a proposal thesis with evidence links and a specific invalidation condition.

**Pass criteria:** fees, protocol revenue, and holder revenue remain separate; missing values are not rendered as zero; provenance and methodology links are visible; governance data shows proposal state and deadline.

## 3. Lido governance/event-risk review

**Question:** Is a current Lido governance proposal a material catalyst or risk?

1. Load Lido Snapshot proposals.
2. Sort mentally by active/closed state and end time.
3. Capture quorum and vote-score context.
4. Check Lido fundamentals and TVL/fee/revenue trends.
5. Add a governance-related review entry to a thesis.

**Pass criteria:** proposal links are preserved; a failed/empty Snapshot space is labeled unavailable; the analyst can distinguish historical outcomes from active votes.

## 4. Curated wallet due diligence

**Question:** Can a researcher maintain a transparent wallet watchlist without pretending to have proprietary Smart Money labels?

1. Add a known exchange, fund, or protocol address.
2. Record chain, label, label type, source URL, and notes.
3. Review the wallet registry in the Intelligence widget.

**Pass criteria:** labels are clearly marked curated; malformed addresses are rejected; no unsupported “Smart Money” score is shown.

## 5. Token unlock risk check

**Question:** Is a scheduled token unlock relevant to an investment memo?

1. Add an unlock only with a primary source URL.
2. Record date, amount, supply percentage, vesting contract, and confidence.
3. Review the calendar before finalizing a thesis.

**Pass criteria:** source URL and confidence are mandatory; unsupported third-party calendars are not presented as authoritative.

## 6. Provider-outage and restart drill

**Question:** Can the console be trusted during partial market-data outages?

1. Run the BTC derivatives and liquidity views while Binance returns HTTP 451.
2. Verify Hyperliquid remains available independently.
3. Verify Bybit 403/unavailable state is visible.
4. Restart the API and reload the research views.
5. Confirm SQLite snapshots and immutable note snapshots remain intact.

**Pass criteria:** no cross-venue substitution, no duplicate alert event after restart, and no stale value presented as fresh.
