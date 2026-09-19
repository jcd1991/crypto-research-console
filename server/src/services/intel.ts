import { db } from "../db.js";
import * as provider from "../providers/intel.js";
import * as walletProvider from "../providers/wallet.js";
import { liquidationStatus } from "./liquidations.js";

const iso = () => new Date().toISOString();
function save(category: string, targetKey: string, providerName: string, payload: unknown, sourceTime = iso(), status = "available"): void {
  db.prepare(`INSERT OR REPLACE INTO research_intel_snapshots (category,target_key,provider,observed_at,source_time,status,payload_json) VALUES (?,?,?,?,?,?,?)`).run(category, targetKey, providerName, iso(), sourceTime, status, JSON.stringify(payload));
}
function latest(category: string, targetKey = "all"): any { const row = db.prepare("SELECT * FROM research_intel_snapshots WHERE category=? AND target_key=? ORDER BY observed_at DESC LIMIT 1").get(category, targetKey) as any; return row ? { ...row, payload: JSON.parse(row.payload_json) } : null; }

export async function collectLiquidity(symbol: string): Promise<any[]> {
  const sources = [
    ["binance", "Binance USD-M", provider.binanceDepth],
    ["bybit", "Bybit", provider.bybitDepth],
    ["hyperliquid", "Hyperliquid", provider.hyperliquidDepth],
    ["okx", "OKX", provider.okxDepth],
  ] as const;
  const results = await Promise.all(sources.map(async ([name, venue, fn]) => { try { const payload = await fn(symbol); db.prepare("INSERT OR REPLACE INTO liquidity_snapshots (symbol,provider,venue,observed_at,source_time,status,payload_json) VALUES (?,?,?,?,?,?,?)").run(symbol.toUpperCase(), name, venue, iso(), new Date(payload.sourceTime).toISOString(), "available", JSON.stringify(payload)); return { provider: name, venue, status: "available", payload }; } catch (error) { const payload = { error: error instanceof Error ? error.message : String(error) }; db.prepare("INSERT INTO liquidity_snapshots (symbol,provider,venue,observed_at,source_time,status,payload_json) VALUES (?,?,?,?,?,?,?)").run(symbol.toUpperCase(), name, venue, iso(), null, "unavailable", JSON.stringify(payload)); return { provider: name, venue, status: "unavailable", payload }; } }));
  return results;
}
export function liquidityHistory(symbol: string): any[] { return (db.prepare("SELECT * FROM liquidity_snapshots WHERE symbol=? ORDER BY observed_at ASC LIMIT 500").all(symbol.toUpperCase()) as any[]).map((x) => ({ ...x, payload: JSON.parse(x.payload_json) })); }

export async function collectLiquidations(symbol: string): Promise<any> { const collectorByVenue = new Map(liquidationStatus().map((x) => [x.venue, x])); return { symbol: symbol.toUpperCase(), venues: ["Binance USD-M", "Bybit"].map((venue) => { const rows = db.prepare("SELECT * FROM liquidation_events WHERE symbol=? AND venue=? AND observed_at >= datetime('now','-24 hours') ORDER BY observed_at DESC LIMIT 500").all(symbol.toUpperCase(), venue) as any[]; const totals = rows.reduce((a, r) => { const key = r.side === "long" ? "longUsd" : r.side === "short" ? "shortUsd" : "unknownUsd"; a[key] += Number(r.notional_usd ?? 0); return a; }, { longUsd: 0, shortUsd: 0, unknownUsd: 0 }); return { venue, status: rows.length ? "available" : "insufficient_history", collector: collectorByVenue.get(venue) ?? null, events: rows, totals, eventCount: rows.length }; }) }; }

export async function collectStablecoins(): Promise<any> { try { const data = await provider.defillamaStablecoins(); const payload = { source: "DefiLlama", sourceUrl: "https://stablecoins.llama.fi/stablecoins?includePrices=true", reported: data, fetchedAt: iso() }; save("stablecoins", "all", "defillama", payload); return payload; } catch (error) { return { status: "unavailable", error: error instanceof Error ? error.message : String(error) }; } }
export async function collectEtfFlows(): Promise<any> { try { const data = await provider.farsideBitcoinFlows(); const derived = data.rows.some((row) => row.classification === "derived_from_holdings"); const payload = { source: derived ? "Xoomar holdings-derived fallback" : "Farside", sourceUrl: data.sourceUrl, classification: derived ? "derived" : "reported", confidence: derived ? "medium" : "high", reported: data.rows, fetchedAt: iso() }; save("etf_flows", "btc", "farside", payload); return payload; } catch (error) { return { status: "unavailable", error: error instanceof Error ? error.message : String(error) }; } }
export async function collectOnchain(asset: string): Promise<any> { try { const data = await provider.coinMetricsDaily(asset); const payload = { source: "Coin Metrics Community API", sourceUrl: "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics", asset: asset.toLowerCase(), metrics: ["PriceUSD", "CapMrktEstUSD", "SplyCur", "TxCnt"], frequency: "1d", coverage: data.data?.length ?? 0, reported: data.data ?? [], fetchedAt: iso() }; save("onchain", asset.toLowerCase(), "coinmetrics-community", payload); return payload; } catch (error) { return { status: "unavailable", error: error instanceof Error ? error.message : String(error) }; } }
export async function collectGovernance(protocol: string): Promise<any> { try { const data = await provider.snapshotGovernance(protocol); const proposals = data.data?.proposals ?? []; for (const p of proposals) db.prepare(`INSERT OR REPLACE INTO governance_proposals (protocol,provider,proposal_key,title,state,start_time,end_time,quorum,scores_json,source_url,observed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(protocol, "snapshot", p.id, p.title ?? "", p.state ?? null, p.start ? new Date(p.start * 1000).toISOString() : null, p.end ? new Date(p.end * 1000).toISOString() : null, p.quorum ?? null, JSON.stringify(p.scores ?? []), p.link ?? `https://snapshot.org/#/${protocol}`, iso()); return db.prepare("SELECT * FROM governance_proposals WHERE protocol=? ORDER BY observed_at DESC LIMIT 20").all(protocol); } catch (error) { return { status: "unavailable", error: error instanceof Error ? error.message : String(error) }; } }
export function governance(protocol?: string): any[] { return (db.prepare(`SELECT * FROM governance_proposals ${protocol ? "WHERE protocol=?" : ""} ORDER BY end_time ASC`).all(...(protocol ? [protocol] : [])) as any[]); }
export function wallets(): any[] { return db.prepare("SELECT * FROM wallet_registry ORDER BY created_at DESC").all(); }
export function getWallet(id: number): any { return db.prepare("SELECT * FROM wallet_registry WHERE id=?").get(id); }
export function addWallet(input: any): any { const result = db.prepare("INSERT INTO wallet_registry (chain,address,label,label_type,source_url,notes,created_at) VALUES (?,?,?,?,?,?,?)").run(input.chain,input.address.toLowerCase(),input.label,input.label_type ?? "curated",input.source_url ?? null,input.notes ?? null,iso()); return getWallet(Number(result.lastInsertRowid)); }
export function setWalletFollowed(id: number, followed: boolean): any { db.prepare("UPDATE wallet_registry SET followed=? WHERE id=?").run(followed ? 1 : 0, id); return getWallet(id); }
function walletPayload(row: any): any { return JSON.parse(row.payload_json); }
export async function refreshWallet(id: number): Promise<any> {
  const wallet = getWallet(id); if (!wallet) throw new Error("wallet not found");
  if (wallet.chain !== "ethereum") throw new Error("wallet chain is not supported yet");
  try {
    const snapshot = await walletProvider.ethereumHoldings(wallet.address);
    const previous = db.prepare("SELECT * FROM wallet_snapshots WHERE wallet_id=? AND status='available' ORDER BY observed_at DESC LIMIT 1").get(id) as any;
    db.prepare("INSERT INTO wallet_snapshots (wallet_id,observed_at,status,source_url,payload_json) VALUES (?,?,?,?,?)").run(id, snapshot.observedAt, "available", snapshot.sourceUrl, JSON.stringify(snapshot));
    if (wallet.followed && previous) {
      const before = new Map([walletPayload(previous).native, ...walletPayload(previous).holdings].map((x: any) => [x.asset, x]));
      const after = new Map([snapshot.native, ...snapshot.holdings].map((x) => [x.asset, x]));
      for (const [asset, current] of after) {
        const prior = before.get(asset); const oldValue = prior?.valueUsd ?? null; const newValue = current.valueUsd ?? null;
        if (newValue !== null && (oldValue === null || Math.abs(newValue - oldValue) >= 100_000)) db.prepare("INSERT INTO wallet_events (wallet_id,observed_at,event_type,asset,previous_value_usd,current_value_usd,payload_json) VALUES (?,?,?,?,?,?,?)").run(id, snapshot.observedAt, oldValue === null ? "position_added" : "position_changed", asset, oldValue, newValue, JSON.stringify({ prior, current }));
      }
      for (const [asset, prior] of before) if (!after.has(asset) && prior.valueUsd !== null && prior.valueUsd >= 100_000) db.prepare("INSERT INTO wallet_events (wallet_id,observed_at,event_type,asset,previous_value_usd,current_value_usd,payload_json) VALUES (?,?,?,?,?,?,?)").run(id, snapshot.observedAt, "position_removed", asset, prior.valueUsd, null, JSON.stringify({ prior }));
    }
    return { wallet, snapshot: { ...snapshot, status: "available" } };
  } catch (error) {
    const previous = db.prepare("SELECT * FROM wallet_snapshots WHERE wallet_id=? AND status='available' ORDER BY observed_at DESC LIMIT 1").get(id) as any;
    return { wallet, snapshot: previous ? { ...walletPayload(previous), status: "stale", lastError: error instanceof Error ? error.message : String(error) } : { status: "unavailable", error: error instanceof Error ? error.message : String(error) } };
  }
}
export function walletEvents(unreadOnly = false): any[] { return db.prepare(`SELECT e.*, w.label, w.chain, w.address FROM wallet_events e JOIN wallet_registry w ON w.id=e.wallet_id ${unreadOnly ? "WHERE e.read_at IS NULL" : ""} ORDER BY e.observed_at DESC`).all(); }
export function markWalletEventRead(id: number): void { db.prepare("UPDATE wallet_events SET read_at=? WHERE id=?").run(iso(), id); }
export function unlocks(token?: string): any[] { return db.prepare(`SELECT * FROM unlock_registry ${token ? "WHERE token=?" : ""} ORDER BY event_date ASC`).all(...(token ? [token] : [])) as any[]; }
export function addUnlock(input: any): any { const result = db.prepare("INSERT INTO unlock_registry (token,protocol,event_date,amount,amount_unit,percent_supply,vesting_contract,source_url,confidence,status,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(input.token.toUpperCase(),input.protocol ?? null,input.event_date,input.amount ?? null,input.amount_unit ?? null,input.percent_supply ?? null,input.vesting_contract ?? null,input.source_url,input.confidence,input.status ?? "scheduled",input.notes ?? null,iso()); return db.prepare("SELECT * FROM unlock_registry WHERE id=?").get(result.lastInsertRowid); }
export function latestIntel(category: string, targetKey = "all"): any { return latest(category, targetKey); }
export async function sampleOnchain(): Promise<void> { await Promise.all([collectOnchain("BTC"), collectOnchain("ETH")]); }
export async function sampleFlows(): Promise<void> { await Promise.all([collectStablecoins(), collectEtfFlows()]); }
