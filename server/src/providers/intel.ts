const JSON_HEADERS = { accept: "application/json" };

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: JSON_HEADERS });
  if (!response.ok) throw new Error(`${new URL(url).hostname} ${response.status}`);
  return response.json() as Promise<T>;
}

function n(value: unknown): number | null { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }

export type DepthSnapshot = {
  bids: Array<[number, number]>;
  asks: Array<[number, number]>;
  mid: number | null;
  spreadBps: number | null;
  depthUsd: { within05Pct: number; within1Pct: number };
  imbalance: number | null;
  sourceTime: number;
};

function depth(bids: Array<[number, number]>, asks: Array<[number, number]>): DepthSnapshot {
  const bestBid = bids[0]?.[0] ?? null; const bestAsk = asks[0]?.[0] ?? null;
  const mid = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : null;
  const side = (list: Array<[number, number]>, pct: number, bid: boolean) => !mid ? 0 : list.filter(([p]) => bid ? p >= mid * (1 - pct) : p <= mid * (1 + pct)).reduce((s, [p, q]) => s + p * q, 0);
  const within = (pct: number) => side(bids, pct, true) + side(asks, pct, false);
  const bidNear = side(bids, 0.01, true); const askNear = side(asks, 0.01, false);
  return { bids, asks, mid, spreadBps: mid && bestBid && bestAsk ? ((bestAsk - bestBid) / mid) * 10_000 : null, depthUsd: { within05Pct: within(0.005), within1Pct: within(0.01) }, imbalance: bidNear + askNear > 0 ? (bidNear - askNear) / (bidNear + askNear) : null, sourceTime: Date.now() };
}

export async function binanceDepth(symbol: string): Promise<DepthSnapshot> {
  const d = await getJson<any>(`https://fapi.binance.com/fapi/v1/depth?symbol=${encodeURIComponent(symbol.toUpperCase() + "USDT")}&limit=100`);
  return depth((d.bids ?? []).map((x: string[]) => [n(x[0]) ?? 0, n(x[1]) ?? 0]), (d.asks ?? []).map((x: string[]) => [n(x[0]) ?? 0, n(x[1]) ?? 0]));
}

export async function bybitDepth(symbol: string): Promise<DepthSnapshot> {
  const d = await getJson<any>(`https://api.bybit.com/v5/market/orderbook?category=linear&symbol=${encodeURIComponent(symbol.toUpperCase() + "USDT")}&limit=50`);
  return depth((d.result?.b ?? []).map((x: string[]) => [n(x[0]) ?? 0, n(x[1]) ?? 0]), (d.result?.a ?? []).map((x: string[]) => [n(x[0]) ?? 0, n(x[1]) ?? 0]));
}

export async function okxDepth(symbol: string): Promise<DepthSnapshot> {
  const instId = `${symbol.toUpperCase()}-USDT-SWAP`;
  const d = await getJson<any>(`https://www.okx.com/api/v5/market/books?instId=${encodeURIComponent(instId)}&sz=100`);
  if (d.code && d.code !== "0") throw new Error(`okx ${d.code}: ${d.msg ?? "request failed"}`);
  const book = d.data?.[0];
  if (!book) throw new Error("okx empty order book");
  return depth((book.bids ?? []).map((x: string[]) => [n(x[0]) ?? 0, n(x[1]) ?? 0]), (book.asks ?? []).map((x: string[]) => [n(x[0]) ?? 0, n(x[1]) ?? 0]));
}

export async function hyperliquidDepth(symbol: string): Promise<DepthSnapshot> {
  const response = await fetch("https://api.hyperliquid.xyz/info", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "l2Book", coin: symbol.toUpperCase() }) });
  if (!response.ok) throw new Error(`hyperliquid ${response.status}`);
  const d = await response.json() as any;
  return depth((d?.levels?.[0] ?? []).map((x: any) => [n(x.px) ?? 0, n(x.sz) ?? 0]), (d?.levels?.[1] ?? []).map((x: any) => [n(x.px) ?? 0, n(x.sz) ?? 0]));
}

export async function coinMetricsDaily(asset: string): Promise<any> {
  return getJson(`https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=${encodeURIComponent(asset.toLowerCase())}&metrics=PriceUSD,CapMrktEstUSD,SplyCur,TxCnt&frequency=1d&limit_per_asset=365`);
}

export async function defillamaStablecoins(): Promise<any> {
  return getJson("https://stablecoins.llama.fi/stablecoins?includePrices=true");
}

export async function farsideBitcoinFlows(): Promise<{ sourceUrl: string; rows: Array<Record<string, string>> }> {
  const url = "https://farside.co.uk/bitcoin-etf-flow-all-data/";
  const response = await fetch(url, { headers: { accept: "text/html" } });
  if (!response.ok) {
    const fallbackUrl = "https://xoomar.com/api/markets/etf-flows?asset=btc&days=90";
    const fallback = await fetch(fallbackUrl, { headers: JSON_HEADERS });
    if (!fallback.ok) throw new Error(`farside ${response.status}; xoomar ${fallback.status}`);
    const body = await fallback.json() as any;
    return { sourceUrl: fallbackUrl, rows: (body.data ?? []).map((x: any) => ({ ...x, classification: "derived_from_holdings", confidence: "medium" })) };
  }
  const html = await response.text();
  const rows: Array<Record<string, string>> = [];
  for (const match of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((x) => x[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim());
    if (cells.length >= 2 && /\d{1,2}\s+[A-Za-z]{3}/.test(cells[0])) rows.push({ date: cells[0], values: cells.slice(1).join("|"), classification: "reported", confidence: "high" });
  }
  return { sourceUrl: url, rows: rows.slice(-365) };
}

export async function snapshotGovernance(protocol: string): Promise<any> {
  const query = `query($spaces:[String!]){proposals(first:20,where:{space_in:$spaces},orderBy:"created",orderDirection:desc){id,title,state,start,end,quorum,scores,link,space{id}}}`;
  const response = await fetch("https://hub.snapshot.org/graphql", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, variables: { spaces: [protocol] } }) });
  if (!response.ok) throw new Error(`snapshot ${response.status}`);
  return response.json();
}
