const BASE = "https://api.llama.fi";

export type ProtocolMetric = {
  tvlUsd: number | null;
  tvlChangePct1d: number | null;
  tvlChangePct7d: number | null;
  fees24hUsd: number | null;
  revenue24hUsd: number | null;
  holderRevenue24hUsd: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  chains: string[];
  category: string | null;
  methodologyUrl: string | null;
  sourceTime: string;
  missing: string[];
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`defillama ${res.status}`);
  return res.json() as Promise<T>;
}

function numeric(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function protocol(slug: string, tvlSlug: string, feesSlug: string, revenueSlug = feesSlug, holderRevenueSlug = feesSlug): Promise<ProtocolMetric> {
  const [tvlResult, feesResult, revenueResult, holderResult] = await Promise.allSettled([
    get<any>(`/protocol/${encodeURIComponent(tvlSlug)}`),
    get<any>(`/summary/fees/${encodeURIComponent(feesSlug)}`),
    get<any>(`/summary/fees/${encodeURIComponent(revenueSlug)}?dataType=dailyRevenue`),
    get<any>(`/summary/fees/${encodeURIComponent(holderRevenueSlug)}?dataType=dailyHoldersRevenue`),
  ]);
  const tvl = tvlResult.status === "fulfilled" ? tvlResult.value : null;
  const fees = feesResult.status === "fulfilled" ? feesResult.value : null;
  const revenue = revenueResult.status === "fulfilled" ? revenueResult.value : null;
  const holder = holderResult.status === "fulfilled" ? holderResult.value : null;
  const tvlRows = Array.isArray(tvl?.tvl) ? tvl.tvl : [];
  const latest = tvlRows[tvlRows.length - 1];
  const previous = tvlRows[tvlRows.length - 2];
  const missing: string[] = [];
  if (!latest || numeric(latest.totalLiquidityUSD) === null) missing.push("tvl_usd");
  if (!fees || numeric(fees.total24h) === null) missing.push("fees_24h_usd");
  if (!revenue || numeric(revenue.total24h) === null) missing.push("revenue_24h_usd");
  if (!holder || numeric(holder.total24h) === null) missing.push("holder_revenue_24h_usd");
  return {
    tvlUsd: numeric(latest?.totalLiquidityUSD),
    tvlChangePct1d: latest && previous && Number(previous.totalLiquidityUSD) > 0 ? ((Number(latest.totalLiquidityUSD) - Number(previous.totalLiquidityUSD)) / Number(previous.totalLiquidityUSD)) * 100 : null,
    tvlChangePct7d: tvlRows.length > 7 && Number(tvlRows[tvlRows.length - 8]?.totalLiquidityUSD) > 0 ? ((Number(latest.totalLiquidityUSD) - Number(tvlRows[tvlRows.length - 8].totalLiquidityUSD)) / Number(tvlRows[tvlRows.length - 8].totalLiquidityUSD)) * 100 : null,
    fees24hUsd: numeric(fees?.total24h), revenue24hUsd: numeric(revenue?.total24h), holderRevenue24hUsd: numeric(holder?.total24h),
    marketCapUsd: numeric(tvl?.mcap), fdvUsd: numeric(tvl?.fdv), chains: tvl?.chains ?? fees?.chains ?? [], category: tvl?.category ?? fees?.category ?? null,
    methodologyUrl: fees?.methodologyURL ?? tvl?.methodologyURL ?? null, sourceTime: new Date().toISOString(), missing,
  };
}

export async function history(slug: string, tvlSlug: string): Promise<Array<{ time: number; tvlUsd: number | null }>> {
  const d = await get<any>(`/protocol/${encodeURIComponent(tvlSlug)}`);
  const rows = Array.isArray(d?.tvl) ? d.tvl : [];
  return rows.map((x: any) => ({ time: Number(x.date) * 1000, tvlUsd: numeric(x.totalLiquidityUSD) })).filter((x: any) => Number.isFinite(x.time));
}
