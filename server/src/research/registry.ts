import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type AssetEntry = { symbol: string; hyperliquid: string };
export type ProtocolEntry = { slug: string; label: string; tvlSlug: string; feesSlug: string; revenueSlug: string; holderRevenueSlug: string };
type Universe = { assets: AssetEntry[]; protocols: ProtocolEntry[] };

const universePath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "data", "research_universe.json");
const universe = JSON.parse(readFileSync(universePath, "utf8")) as Universe;

export const ASSET_UNIVERSE = universe.assets;
export const PROTOCOL_UNIVERSE = universe.protocols;

export function assetEntry(symbol: string): AssetEntry | undefined {
  return ASSET_UNIVERSE.find((x) => x.symbol === symbol.toUpperCase());
}

export function protocolEntry(slug: string): ProtocolEntry | undefined {
  return PROTOCOL_UNIVERSE.find((x) => x.slug === slug);
}
