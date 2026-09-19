const BASE = "https://www.okx.com/api/v5";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`);
  if (!response.ok) throw new Error(`okx ${response.status}`);
  const body = await response.json() as any;
  if (body.code && body.code !== "0") throw new Error(`okx ${body.code}: ${body.msg ?? "request failed"}`);
  return body.data as T;
}

export type OkxSnapshot = {
  symbol: string;
  venue: "OKX";
  instrument: string;
  markPrice: number;
  indexPrice: number | null;
  basisPercent: number | null;
  fundingRatePercent: number;
  fundingAprPercent: number;
  nativeIntervalHours: number;
  openInterestContracts: number;
  openInterestUsd: number;
  volume24hUsd: number;
  priceChangePercent24h: number;
  sourceTime: number;
};

export async function snapshot(symbol: string): Promise<OkxSnapshot> {
  const coin = symbol.toUpperCase();
  const instId = `${coin}-USDT-SWAP`;
  const [funding, ticker, oi] = await Promise.all([
    getJson<any[]>(`/public/funding-rate?instId=${encodeURIComponent(instId)}`),
    getJson<any[]>(`/market/ticker?instId=${encodeURIComponent(instId)}`),
    getJson<any[]>(`/public/open-interest?instType=SWAP&instId=${encodeURIComponent(instId)}`),
  ]);
  const f = funding[0]; const t = ticker[0]; const o = oi[0];
  const mark = Number(t?.last); const rawIndex = Number(f?.idxPx ?? t?.idxPx); const index = Number.isFinite(rawIndex) && rawIndex > 0 ? rawIndex : null; const rate = Number(f?.fundingRate);
  const contracts = Number(o?.oi); const oiUsd = Number(o?.oiUsd ?? contracts * mark);
  const volume = Number(t?.volCcy24h ?? t?.vol24h) * mark; const open24 = Number(t?.open24h);
  const next = Number(f?.nextFundingTime); const fundingTime = Number(f?.fundingTime); const previous = Number(f?.prevFundingTime);
  const periods = [next - fundingTime, fundingTime - previous].filter((x) => Number.isFinite(x) && x > 0);
  const interval = periods.length ? Math.max(1, Math.min(...periods) / 3_600_000) : 8;
  if (![mark, rate, contracts, oiUsd, volume, open24].every(Number.isFinite) || mark <= 0 || open24 <= 0) throw new Error("okx returned invalid numeric data");
  return { symbol: coin, venue: "OKX", instrument: instId, markPrice: mark, indexPrice: index, basisPercent: index === null ? null : ((mark - index) / index) * 100,
    fundingRatePercent: rate * 100, fundingAprPercent: rate * (24 / interval) * 365 * 100, nativeIntervalHours: interval,
    openInterestContracts: contracts, openInterestUsd: oiUsd, volume24hUsd: volume, priceChangePercent24h: ((mark - open24) / open24) * 100, sourceTime: Number(t?.ts ?? Date.now()) };
}
