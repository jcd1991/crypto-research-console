import type { CryptoRow } from "./coingecko.js";
import type { Quote, Candle } from "./yahoo.js";

const NAMES: Record<string, string> = {
  BTCUSDT: "Bitcoin", ETHUSDT: "Ethereum", SOLUSDT: "Solana", BNBUSDT: "BNB",
  XRPUSDT: "XRP", ADAUSDT: "Cardano", DOGEUSDT: "Dogecoin", AVAXUSDT: "Avalanche",
  DOTUSDT: "Polkadot", LINKUSDT: "Chainlink", LTCUSDT: "Litecoin", MATICUSDT: "Polygon",
};

export type CryptoSearchResult = { symbol: string; name: string; exchange: string; type: string };

export function searchAssets(query: string): CryptoSearchResult[] {
  const normalized = query.trim().toUpperCase();
  if (!normalized) return [];
  return Object.entries(NAMES)
    .map(([pair, name]) => ({ symbol: pair.replace("USDT", ""), name }))
    .filter(({ symbol, name }) => symbol.includes(normalized) || name.toUpperCase().includes(normalized))
    .map(({ symbol, name }) => ({ symbol, name, exchange: "Crypto", type: "spot/perpetual" }));
}

/** Plain tickers (BTC, ETH, ...) this app treats as crypto for routing quotes/history. */
export const CRYPTO_SYMBOLS = new Set(Object.keys(NAMES).map((s) => s.replace("USDT", "")));

/** Fallback crypto board built from Binance public 24hr tickers (no key required). */
export async function markets(): Promise<CryptoRow[]> {
  const symbols = Object.keys(NAMES);
  const url =
    "https://api.binance.com/api/v3/ticker/24hr?symbols=" + encodeURIComponent(JSON.stringify(symbols));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`binance ${res.status}`);
  const rows: any[] = await res.json();
  return rows
    .map((r) => ({
      id: r.symbol,
      symbol: r.symbol.replace("USDT", ""),
      name: NAMES[r.symbol] ?? r.symbol,
      price: +r.lastPrice,
      changePercent24h: +r.priceChangePercent,
      marketCap: null,
      volume24h: +r.quoteVolume,
      rank: null,
      sparkline: [],
    }))
    .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
}

export async function orderBook(symbol: string, limit = 20): Promise<{ bids: [string, string][]; asks: [string, string][] }> {
  const pair = encodeURIComponent(symbol.toUpperCase() + "USDT");
  const res = await fetch(`https://api.binance.com/api/v3/depth?symbol=${pair}&limit=${limit}`);
  if (!res.ok) throw new Error(`binance ${res.status}`);
  const d = await res.json();
  return { bids: d.bids ?? [], asks: d.asks ?? [] };
}

export type DerivativesSnapshot = {
  symbol: string;
  venue: "Binance USD-M";
  markPrice: number;
  indexPrice: number;
  basisPercent: number;
  fundingRatePercent: number;
  nextFundingTime: number;
  openInterestContracts: number;
  openInterestUsd: number;
  volume24hUsd: number;
  priceChangePercent24h: number;
  sourceTime: number;
};

/** Public, read-only perpetual-futures snapshot for execution-aware research. */
export async function derivativesSnapshot(symbol: string): Promise<DerivativesSnapshot> {
  const pair = symbol.toUpperCase() + "USDT";
  const encodedPair = encodeURIComponent(pair);
  const [premiumRes, oiRes, tickerRes] = await Promise.all([
    fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${encodedPair}`),
    fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${encodedPair}`),
    fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${encodedPair}`),
  ]);
  if (!premiumRes.ok) throw new Error(`binance futures premium ${premiumRes.status}`);
  if (!oiRes.ok) throw new Error(`binance futures open interest ${oiRes.status}`);
  if (!tickerRes.ok) throw new Error(`binance futures ticker ${tickerRes.status}`);

  const [premium, oi, ticker] = await Promise.all([premiumRes.json(), oiRes.json(), tickerRes.json()]);
  const markPrice = Number(premium.markPrice);
  const indexPrice = Number(premium.indexPrice);
  const openInterestContracts = Number(oi.openInterest);
  if (![markPrice, indexPrice, openInterestContracts].every(Number.isFinite) || indexPrice <= 0) {
    throw new Error("binance futures returned invalid numeric data");
  }

  return {
    symbol: symbol.toUpperCase(),
    venue: "Binance USD-M",
    markPrice,
    indexPrice,
    basisPercent: ((markPrice - indexPrice) / indexPrice) * 100,
    fundingRatePercent: Number(premium.lastFundingRate) * 100,
    nextFundingTime: Number(premium.nextFundingTime),
    openInterestContracts,
    openInterestUsd: openInterestContracts * markPrice,
    volume24hUsd: Number(ticker.quoteVolume),
    priceChangePercent24h: Number(ticker.priceChangePercent),
    sourceTime: Number(premium.time),
  };
}

/** Single-symbol quote so crypto tickers can flow through the same /api/quotes path as stocks. */
export async function quote(symbol: string): Promise<Quote> {
  const pair = symbol.toUpperCase() + "USDT";
  const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(pair)}`);
  if (!res.ok) throw new Error(`binance ticker ${res.status}`);
  const d = await res.json();
  return {
    symbol: symbol.toUpperCase(),
    name: NAMES[pair] ?? symbol.toUpperCase(),
    price: +d.lastPrice,
    change: +d.priceChange,
    changePercent: +d.priceChangePercent,
    open: +d.openPrice,
    high: +d.highPrice,
    low: +d.lowPrice,
    previousClose: +d.prevClosePrice,
    bid: +d.bidPrice || null,
    ask: +d.askPrice || null,
    volume: +d.volume,
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
    exchange: "Binance",
    marketState: "Open",
    time: null,
    source: "binance",
  };
}

const RANGE_TO_KLINE: Record<string, { interval: string; limit: number }> = {
  "1D": { interval: "5m", limit: 288 },
  "5D": { interval: "15m", limit: 480 },
  "1M": { interval: "1h", limit: 720 },
  "6M": { interval: "4h", limit: 1080 },
  YTD: { interval: "1d", limit: 400 },
  "1Y": { interval: "1d", limit: 365 },
  "5Y": { interval: "1w", limit: 260 },
  MAX: { interval: "1M", limit: 200 },
};

export async function history(symbol: string, rangeKey: string): Promise<Candle[]> {
  const { interval, limit } = RANGE_TO_KLINE[rangeKey] ?? RANGE_TO_KLINE["6M"];
  const pair = symbol.toUpperCase() + "USDT";
  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=${interval}&limit=${limit}`
  );
  if (!res.ok) throw new Error(`binance klines ${res.status}`);
  const rows: any[] = await res.json();
  return rows.map((r) => ({
    time: Math.round(r[0] / 1000),
    open: +r[1],
    high: +r[2],
    low: +r[3],
    close: +r[4],
    volume: +r[5],
  }));
}
