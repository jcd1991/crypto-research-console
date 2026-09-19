const BASE = "https://api.hyperliquid.xyz/info";

type AssetContext = {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  oraclePx: string;
  markPx: string;
  premium: string | null;
};

async function info<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(BASE, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`hyperliquid ${res.status}`);
  return res.json() as Promise<T>;
}

export type HyperliquidSnapshot = {
  symbol: string;
  venue: "Hyperliquid";
  instrument: string;
  markPrice: number;
  oraclePrice: number;
  basisPercent: number;
  fundingRatePercent: number;
  fundingAprPercent: number;
  nativeIntervalHours: 1;
  openInterestContracts: number;
  openInterestUsd: number;
  volume24hUsd: number;
  priceChangePercent24h: number;
  sourceTime: number;
};

export async function snapshot(symbol: string): Promise<HyperliquidSnapshot> {
  const [meta, contexts] = await info<[{ universe: Array<{ name: string }> }, AssetContext[]]>({ type: "metaAndAssetCtxs" });
  const index = meta.universe.findIndex((x) => x.name === symbol.toUpperCase());
  if (index < 0 || !contexts[index]) throw new Error(`hyperliquid unsupported asset ${symbol}`);
  const c = contexts[index];
  const markPrice = Number(c.markPx);
  const oraclePrice = Number(c.oraclePx);
  const openInterestContracts = Number(c.openInterest);
  const fundingRate = Number(c.funding);
  const volume24hUsd = Number(c.dayNtlVlm);
  const prevDayPx = Number(c.prevDayPx);
  if (![markPrice, oraclePrice, openInterestContracts, fundingRate, volume24hUsd, prevDayPx].every(Number.isFinite) || oraclePrice <= 0) {
    throw new Error("hyperliquid returned invalid numeric data");
  }
  return {
    symbol: symbol.toUpperCase(), venue: "Hyperliquid", instrument: `${symbol.toUpperCase()}-PERP`,
    markPrice, oraclePrice, basisPercent: ((markPrice - oraclePrice) / oraclePrice) * 100,
    fundingRatePercent: fundingRate * 100, fundingAprPercent: fundingRate * 24 * 365 * 100,
    nativeIntervalHours: 1, openInterestContracts, openInterestUsd: openInterestContracts * markPrice,
    volume24hUsd, priceChangePercent24h: ((markPrice - prevDayPx) / prevDayPx) * 100, sourceTime: Date.now(),
  };
}

export type FundingPoint = { coin: string; fundingRate: string; premium: string; time: number };

export async function fundingHistory(symbol: string, startTime: number): Promise<FundingPoint[]> {
  return info<FundingPoint[]>({ type: "fundingHistory", coin: symbol.toUpperCase(), startTime });
}
