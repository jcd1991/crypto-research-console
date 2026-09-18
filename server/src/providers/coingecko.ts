import type { Candle, Quote } from "./yahoo.js";

const BASE = "https://api.coingecko.com/api/v3";

const IDS_BY_SYMBOL: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  LINK: "chainlink",
  LTC: "litecoin",
  MATIC: "matic-network",
};

const DAYS_BY_RANGE: Record<string, number | "max"> = {
  "1D": 1,
  "5D": 5,
  "1M": 30,
  "6M": 180,
  YTD: 365,
  "1Y": 365,
  "5Y": 1825,
  MAX: "max",
};

let referenceQuoteCache: { expires: number; rows: any[] } | null = null;
const referenceHistoryCache = new Map<string, { expires: number; rows: Candle[] }>();

export type CryptoRow = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  changePercent24h: number | null;
  marketCap: number | null;
  volume24h: number | null;
  rank: number | null;
  sparkline: number[];
};

export async function markets(perPage = 50): Promise<CryptoRow[]> {
  const url = `${BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=1&sparkline=true&price_change_percentage=24h`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  const rows: any[] = await res.json();
  return rows.map((r) => ({
    id: r.id,
    symbol: (r.symbol ?? "").toUpperCase(),
    name: r.name,
    price: r.current_price,
    changePercent24h: r.price_change_percentage_24h ?? null,
    marketCap: r.market_cap ?? null,
    volume24h: r.total_volume ?? null,
    rank: r.market_cap_rank ?? null,
    sparkline: r.sparkline_in_7d?.price ?? [],
  }));
}

export async function globalStats(): Promise<{ totalMarketCap: number; btcDominance: number; ethDominance: number }> {
  const res = await fetch(`${BASE}/global`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  const d = (await res.json())?.data;
  return {
    totalMarketCap: d?.total_market_cap?.usd ?? 0,
    btcDominance: d?.market_cap_percentage?.btc ?? 0,
    ethDominance: d?.market_cap_percentage?.eth ?? 0,
  };
}

/**
 * Reference-only quote fallback for environments where Binance is unavailable.
 * This must remain visibly distinct from exchange execution data.
 */
function toQuote(normalized: string, row: any): Quote {
  const change = typeof row.price_change_24h === "number" ? row.price_change_24h : null;
  return {
    symbol: normalized,
    name: row.name ?? normalized,
    price: row.current_price,
    change,
    changePercent: row.price_change_percentage_24h ?? null,
    open: null,
    high: row.high_24h ?? null,
    low: row.low_24h ?? null,
    previousClose: change !== null ? row.current_price - change : null,
    bid: null,
    ask: null,
    volume: row.total_volume ?? null,
    avgVolume: null,
    marketCap: row.market_cap ?? null,
    pe: null,
    eps: null,
    dividendYield: null,
    week52High: null,
    week52Low: null,
    beta: null,
    sharesOutstanding: null,
    currency: "USD",
    exchange: "CoinGecko reference",
    marketState: "Open",
    time: null,
    source: "coingecko-reference",
  };
}

export async function quotes(symbols: string[]): Promise<Quote[]> {
  const normalized = symbols.map((s) => s.toUpperCase());
  const ids = normalized.map((s) => IDS_BY_SYMBOL[s]).filter(Boolean);
  if (ids.length !== normalized.length) throw new Error("coingecko: unsupported symbol in batch");

  let rows: any[];
  if (referenceQuoteCache && referenceQuoteCache.expires > Date.now()) {
    rows = referenceQuoteCache.rows;
  } else {
    const res = await fetch(
      `${BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(ids.join(","))}&price_change_percentage=24h`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) throw new Error(`coingecko ${res.status}`);
    rows = await res.json();
    referenceQuoteCache = { expires: Date.now() + 15_000, rows };
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  return normalized.map((symbol) => {
    const row = byId.get(IDS_BY_SYMBOL[symbol]);
    if (!row?.current_price) throw new Error(`coingecko: no quote for ${symbol}`);
    return toQuote(symbol, row);
  });
}

export async function quote(symbol: string): Promise<Quote> {
  const result = await quotes([symbol]);
  if (!result[0]) throw new Error(`coingecko: no quote for ${symbol.toUpperCase()}`);
  return result[0];
}

/** Reference-only OHLC approximation from CoinGecko market history. */
export async function history(symbol: string, rangeKey: string): Promise<Candle[]> {
  const normalized = symbol.toUpperCase();
  const id = IDS_BY_SYMBOL[normalized];
  if (!id) throw new Error(`coingecko: unsupported symbol ${normalized}`);
  const days = DAYS_BY_RANGE[rangeKey] ?? DAYS_BY_RANGE["6M"];
  const cacheKey = `${id}:${days}`;
  const cached = referenceHistoryCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.rows;
  const res = await fetch(
    `${BASE}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  const payload = await res.json();
  const prices: Array<[number, number]> = payload?.prices ?? [];
  const volumes: Array<[number, number]> = payload?.total_volumes ?? [];
  if (prices.length === 0) throw new Error(`coingecko: no history for ${normalized}`);
  const rows = prices.map(([timestamp, value], index) => {
    const previous = index > 0 ? prices[index - 1][1] : value;
    const volume = volumes[index]?.[1] ?? 0;
    return {
      time: Math.floor(timestamp / 1000),
      open: previous,
      high: Math.max(previous, value),
      low: Math.min(previous, value),
      close: value,
      volume,
    };
  });
  referenceHistoryCache.set(cacheKey, { expires: Date.now() + 300_000, rows });
  return rows;
}
