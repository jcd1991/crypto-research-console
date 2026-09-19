const BASE = "https://eth.blockscout.com/api/v2";
export const ETHEREUM_BLOCKSCOUT = "https://eth.blockscout.com";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`blockscout ${response.status}`);
  return response.json() as Promise<T>;
}

export type WalletHolding = { asset: string; symbol: string; name: string; contract: string | null; amount: number; priceUsd: number | null; valueUsd: number | null; decimals: number; source: "reported" | "derived" };
export type WalletSnapshot = { chain: "ethereum"; address: string; native: WalletHolding; holdings: WalletHolding[]; observedAt: string; sourceUrl: string };

export async function ethereumHoldings(address: string): Promise<WalletSnapshot> {
  const normalized = address.toLowerCase();
  const [account, tokens] = await Promise.all([
    getJson<any>(`/addresses/${normalized}`),
    getJson<any>(`/addresses/${normalized}/tokens?type=ERC-20`),
  ]);
  const observedAt = new Date().toISOString();
  const nativeDecimals = 18;
  const nativeAmount = Number(account.coin_balance ?? 0) / 10 ** nativeDecimals;
  const nativePrice = Number(account.exchange_rate);
  const native: WalletHolding = { asset: "ETH", symbol: "ETH", name: "Ethereum", contract: null, amount: nativeAmount, priceUsd: Number.isFinite(nativePrice) ? nativePrice : null, valueUsd: Number.isFinite(nativePrice) ? nativeAmount * nativePrice : null, decimals: nativeDecimals, source: "reported" };
  const holdings = (tokens.items ?? []).map((item: any): WalletHolding | null => {
    const token = item.token ?? {};
    const decimals = Number(token.decimals);
    const raw = Number(item.value);
    const price = Number(token.exchange_rate);
    if (!token.address_hash || !Number.isFinite(raw) || !Number.isFinite(decimals) || decimals < 0) return null;
    const amount = raw / 10 ** decimals;
    return { asset: token.symbol ?? token.address_hash, symbol: token.symbol ?? "?", name: token.name ?? token.symbol ?? token.address_hash, contract: token.address_hash, amount, priceUsd: Number.isFinite(price) ? price : null, valueUsd: Number.isFinite(price) ? amount * price : null, decimals, source: "reported" };
  }).filter(Boolean) as WalletHolding[];
  return { chain: "ethereum", address: normalized, native, holdings, observedAt, sourceUrl: `${ETHEREUM_BLOCKSCOUT}/api/v2/addresses/${normalized}/tokens?type=ERC-20` };
}
