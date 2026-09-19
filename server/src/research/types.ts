export type TargetType = "asset" | "protocol";
export type ObservationStatus = "available" | "unavailable" | "stale";

export type ResearchObservation = {
  targetType: TargetType;
  targetKey: string;
  provider: string;
  venue: string;
  instrument: string | null;
  observedAt: string;
  sourceTime: string | null;
  units: string | null;
  nativeIntervalHours: number | null;
  stale: boolean;
  status: ObservationStatus;
  payload: Record<string, unknown>;
  sourceUrl?: string | null;
  httpStatus?: number | null;
  fetchedAt?: string | null;
  parserVersion?: string | null;
};

export type MetricName =
  | "funding_rate_pct"
  | "funding_apr_pct"
  | "basis_pct"
  | "open_interest_usd"
  | "open_interest_change_pct_1h"
  | "open_interest_change_pct_24h"
  | "price_change_pct_24h"
  | "tvl_usd"
  | "tvl_change_pct_1d"
  | "tvl_change_pct_7d"
  | "fees_24h_usd"
  | "revenue_24h_usd"
  | "holder_revenue_24h_usd"
  | "market_cap_usd"
  | "fdv_usd";

export type AlertOperator = ">" | ">=" | "<" | "<=" | "crosses_above" | "crosses_below";
