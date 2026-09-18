const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

let token: { value: string; expiresAt: number } | null = null;

function apiUrl(): URL {
  const raw = process.env.FREQTRADE_API_URL ?? "http://127.0.0.1:8080";
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Freqtrade API must use HTTP(S)");
  if (!LOOPBACK_HOSTS.has(url.hostname)) throw new Error("Freqtrade API must be localhost-only");
  return url;
}

async function getToken(): Promise<string | null> {
  const configured = process.env.FREQTRADE_API_TOKEN;
  if (configured) return configured;
  const username = process.env.FREQTRADE_API_USERNAME;
  const password = process.env.FREQTRADE_API_PASSWORD;
  if (!username || !password) return null;
  if (token && token.expiresAt > Date.now()) return token.value;
  const url = apiUrl();
  const response = await fetch(new URL("/api/v1/token", url), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error(`Freqtrade authentication failed (${response.status})`);
  const body = (await response.json()) as { access_token?: string; token?: string };
  const value = body.access_token ?? body.token;
  if (!value) throw new Error("Freqtrade authentication returned no token");
  token = { value, expiresAt: Date.now() + 55 * 60_000 };
  return value;
}

export async function get(path: string, query?: Record<string, string | number | undefined>): Promise<unknown> {
  if (!path.startsWith("/api/v1/") || path.includes("/start") || path.includes("/stop") || path.includes("/force")) {
    throw new Error("unsupported Freqtrade route");
  }
  const url = apiUrl();
  const target = new URL(path, url);
  for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined) target.searchParams.set(key, String(value));
  const auth = await getToken();
  const headers = new Headers({ Accept: "application/json" });
  if (auth) headers.set("Authorization", `Bearer ${auth}`);
  const response = await fetch(target, { method: "GET", headers });
  if (!response.ok) throw new Error(`Freqtrade request failed (${response.status})`);
  return response.json();
}

export const live = {
  health: () => get("/api/v1/health"),
  status: () => get("/api/v1/status"),
  trades: () => get("/api/v1/trades"),
  profit: () => get("/api/v1/profit"),
  performance: () => get("/api/v1/performance"),
  strategies: () => get("/api/v1/strategies"),
  candles: (pair: string, timeframe = "1h", limit = 200) => get("/api/v1/pair_candles", { pair, timeframe, limit }),
};
