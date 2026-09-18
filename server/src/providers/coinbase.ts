import type { Candle, Quote } from "./yahoo.js";
import type { CryptoRow } from "./coingecko.js";

const BASE = "https://api.coinbase.com";
const EXCHANGE_BASE = "https://api.exchange.coinbase.com";
const NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  BNB: "BNB",
  XRP: "XRP",
  ADA: "Cardano",
  DOGE: "Dogecoin",
  AVAX: "Avalanche",
};

const quoteCache = new Map<string, { expires: number; value: Quote }>();
const historyCache = new Map<string, { expires: number; value: Candle[] }>();

export async function quote(symbol: string): Promise<Quote> {
  const normalized = symbol.toUpperCase();
  const cached = quoteCache.get(normalized);
  if (cached && cached.expires > Date.now()) return cached.value;

  const res = await fetch(`${BASE}/v2/prices/${encodeURIComponent(normalized)}-USD/spot`);
  if (!res.ok) throw new Error(`coinbase ${res.status}`);
  const amount = Number((await res.json())?.data?.amount);
  if (!Number.isFinite(amount)) throw new Error(`coinbase: no quote for ${normalized}`);

  const value: Quote = {
    symbol: normalized,
    name: NAMES[normalized] ?? normalized,
    price: amount,
    change: null,
    changePercent: null,
    open: null,
    high: null,
    low: null,
    previousClose: null,
    bid: null,
    ask: null,
    volume: null,
    avgVolume: null,
    marketCap: null,
    pe: null,
    eps: null,
    dividendYield: null,
    week52High: null,
    week52Low: null,
    beta: null,
    sharesOutstanding: null,
    currency: "USD",
    exchange: "Coinbase reference",
    marketState: "Open",
    time: null,
    source: "coinbase-reference",
  };
  quoteCache.set(normalized, { expires: Date.now() + 15_000, value });
  return value;
}

export async function quotes(symbols: string[]): Promise<Quote[]> {
  return Promise.all(symbols.map((symbol) => quote(symbol)));
}

export async function markets(): Promise<CryptoRow[]> {
  const symbols = Object.keys(NAMES);
  const rows = await quotes(symbols);
  return rows.map((row) => ({
    id: `${row.symbol}-USD`,
    symbol: row.symbol,
    name: row.name ?? row.symbol,
    price: row.price ?? 0,
    changePercent24h: row.changePercent,
    marketCap: row.marketCap,
    volume24h: row.volume,
    rank: null,
    sparkline: [],
  }));
}

export async function history(symbol: string, rangeKey: string): Promise<Candle[]> {
  const normalized = symbol.toUpperCase();
  const granularity = rangeKey === "1D" ? 3600 : rangeKey === "5D" ? 21_600 : 86_400;
  const cacheKey = `${normalized}:${rangeKey}`;
  const cached = historyCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value;
  const end = Math.floor(Date.now() / 1000);
  const days = rangeKey === "1D" ? 1 : rangeKey === "5D" ? 5 : rangeKey === "1M" ? 30 : 180;
  const start = end - days * 86_400;
  const product = `${encodeURIComponent(normalized)}-USD`;
  const res = await fetch(
    `${EXCHANGE_BASE}/products/${product}/candles?granularity=${granularity}&start=${new Date(start * 1000).toISOString()}&end=${new Date(end * 1000).toISOString()}`
  );
  if (!res.ok) throw new Error(`coinbase ${res.status}`);
  const rows: number[][] = await res.json();
  const value = rows
    .sort((a, b) => a[0] - b[0])
    .map(([time, low, high, open, close, volume]) => ({ time, open, high, low, close, volume }));
  if (value.length === 0) throw new Error(`coinbase: no history for ${normalized}`);
  historyCache.set(cacheKey, { expires: Date.now() + 300_000, value });
  return value;
}
