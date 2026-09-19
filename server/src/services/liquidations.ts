import { db } from "../db.js";

type State = { socket: WebSocket | null; provider: string; venue: string; reconnectMs: number; symbols: string[]; connected: boolean; lastMessageAt: string | null; backfillStatus: "pending" | "available" | "unavailable"; lastBackfillAt: string | null; backfillError: string | null };
const states = new Map<string, State>();
const now = () => new Date().toISOString();
function insert(provider: string, venue: string, symbol: string, side: "long" | "short" | "unknown", price: number | null, quantity: number | null, sourceTime: number | null, raw: unknown): void {
  const notional = price !== null && quantity !== null ? price * quantity : null;
  db.prepare("INSERT OR IGNORE INTO liquidation_events (symbol,provider,venue,side,price,quantity,notional_usd,observed_at,source_time,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?)").run(symbol.toUpperCase(), provider, venue, side, price, quantity, notional, now(), sourceTime ? new Date(sourceTime).toISOString() : null, JSON.stringify(raw));
}
function connect(state: State): void {
  const url = state.provider === "binance" ? "wss://fstream.binance.com/stream?streams=!forceOrder@arr" : "wss://stream.bybit.com/v5/public/linear";
  const socket = new WebSocket(url); state.socket = socket;
  socket.addEventListener("open", () => { state.connected = true; state.reconnectMs = 1_000; if (state.provider === "bybit") socket.send(JSON.stringify({ op: "subscribe", args: state.symbols.map((s) => `liquidation.${s.toUpperCase()}USDT`) })); });
  socket.addEventListener("message", (event) => { state.lastMessageAt = now(); try { const msg = JSON.parse(String(event.data)); if (state.provider === "binance") { const o = msg.data?.o; if (!o) return; const side = o.S === "BUY" ? "short" : o.S === "SELL" ? "long" : "unknown"; insert("binance", state.venue, o.s?.replace(/USDT$/, "") ?? "", side, Number(o.ap), Number(o.z), Number(o.T), o); } else { for (const o of msg.data ?? []) { const side = o.S === "Buy" ? "short" : o.S === "Sell" ? "long" : "unknown"; insert("bybit", state.venue, o.symbol?.replace(/USDT$/, "") ?? "", side, Number(o.price), Number(o.qty), Number(o.T), o); } } } catch { /* malformed provider messages are ignored and surfaced by freshness */ } });
  socket.addEventListener("close", () => { state.connected = false; state.socket = null; setTimeout(() => connect(state), state.reconnectMs); state.reconnectMs = Math.min(state.reconnectMs * 2, 60_000); });
  socket.addEventListener("error", () => { try { socket.close(); } catch { /* noop */ } });
}
async function backfillBinance(state: State): Promise<void> {
  try {
    for (const symbol of state.symbols) {
      const response = await fetch(`https://fapi.binance.com/fapi/v1/allForceOrders?symbol=${encodeURIComponent(symbol.toUpperCase() + "USDT")}&limit=1000`, { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`binance liquidation backfill ${response.status}`);
      const rows = await response.json() as any[];
      for (const o of rows ?? []) {
        const side = o.side === "BUY" ? "short" : o.side === "SELL" ? "long" : "unknown";
        insert("binance", state.venue, o.symbol?.replace(/USDT$/, "") ?? symbol, side, Number(o.averagePrice ?? o.price), Number(o.origQty ?? o.executedQty), Number(o.time ?? o.T), o);
      }
    }
    state.backfillStatus = "available"; state.lastBackfillAt = now(); state.backfillError = null;
  } catch (error) {
    state.backfillStatus = "unavailable"; state.lastBackfillAt = now(); state.backfillError = error instanceof Error ? error.message : String(error);
  }
}
export function startLiquidationCollectors(symbols: string[]): void { if (states.size) return; for (const config of [{ provider: "binance", venue: "Binance USD-M" }, { provider: "bybit", venue: "Bybit" }]) { const state: State = { ...config, socket: null, reconnectMs: 1_000, symbols, connected: false, lastMessageAt: null, backfillStatus: "pending", lastBackfillAt: null, backfillError: null }; states.set(config.provider, state); connect(state); if (config.provider === "binance") void backfillBinance(state); else { state.backfillStatus = "available"; state.lastBackfillAt = now(); } } }
export function liquidationStatus(): any[] { return [...states.values()].map((s) => ({ provider: s.provider, venue: s.venue, connected: s.connected, lastMessageAt: s.lastMessageAt, reconnecting: !s.connected, backfillStatus: s.backfillStatus, lastBackfillAt: s.lastBackfillAt, backfillError: s.backfillError })); }
