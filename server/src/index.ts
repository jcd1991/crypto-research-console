import express from "express";
import cors from "cors";
import { marketRouter } from "./routes/market.js";
import { portfolioRouter } from "./routes/portfolio.js";
import { aiRouter } from "./routes/ai.js";
import { allStats } from "./providers/registry.js";
import { requireApiKey } from "./auth.js";
import { rateLimit } from "./rateLimit.js";
import { researchRouter } from "./routes/research.js";
import { evaluateAlerts, pruneResearchSnapshots, sampleAll, sampleAssets, sampleProtocols } from "./services/research.js";
import { startLiquidationCollectors } from "./services/liquidations.js";
import { sampleFlows, sampleOnchain } from "./services/intel.js";
import { ASSET_UNIVERSE } from "./research/registry.js";

const app = express();

// Off by default: req.ip then falls back to the immediate socket address
// (the bundled web proxy's own address when called through it), so every
// caller behind that proxy shares one rate-limit bucket — safe, if coarser
// than per-browser. Only set TRUST_PROXY=1 if you know exactly one trusted
// reverse proxy sits in front of this process (the bundled web proxy alone,
// or your own proxy in front of it that itself sets X-Forwarded-For from
// the real client and doesn't let callers inject their own value) —
// otherwise a caller can forge X-Forwarded-For to dodge the rate limit.
if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

// Only the configured web origin may call this API from a browser. Without
// this, any website open in the same browser as the terminal could reach a
// server bound beyond localhost — cors() with no options reflects every
// origin.
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
app.use(cors({ origin: webOrigin }));
app.use(express.json());

// No API key here by design (market.ts routes proxy free, keyless public data),
// but still bounded per-IP: unlike /api/ai and /api/portfolios, an unauthenticated
// caller could otherwise repeat the multi-provider fan-out in market.ts (up to
// hundreds of outbound calls per request — see getQuotes) fast enough to get
// this deployment's IP rate-limited or banned by Nasdaq/Yahoo/Stooq/SEC.
app.use("/api", rateLimit({ windowMs: 60_000, max: 240 }), marketRouter);
// Portfolio data and the paid AI endpoint require a shared secret; see auth.ts.
app.use("/api/portfolios", requireApiKey, portfolioRouter);
app.use(
  "/api/ai",
  requireApiKey,
  rateLimit({ windowMs: 60_000, max: 10 }),
  aiRouter
);
app.use("/api/research", requireApiKey, rateLimit({ windowMs: 60_000, max: 120 }), researchRouter);

app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    providers: allStats(),
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
  });
});

const PORT = Number(process.env.API_PORT ?? 4000);
// Bind to localhost by default so cloning and running this never exposes an
// unauthenticated-by-default API to the network. Set API_HOST=0.0.0.0 (and
// API_KEY + WEB_ORIGIN) to intentionally expose it beyond this machine.
const HOST = process.env.API_HOST ?? "127.0.0.1";
app.listen(PORT, HOST, () => {
  console.log(`Crypto Research Console API listening on http://${HOST}:${PORT}`);
});

if (process.env.RESEARCH_SAMPLER_ENABLED !== "0" && process.env.NODE_ENV !== "test") {
  let running = false;
  const run = async (all = false) => {
    if (running) return;
    running = true;
    try { if (all) await sampleAll(); else { await sampleAssets(); evaluateAlerts(); } }
    finally { running = false; }
  };
  void run(true);
  setInterval(() => void run(), 5 * 60_000).unref();
  setInterval(() => void (async () => { if (running) return; running = true; try { await sampleProtocols(); evaluateAlerts(); } finally { running = false; } })(), 15 * 60_000).unref();
  setInterval(() => pruneResearchSnapshots(), 24 * 60 * 60_000).unref();
  startLiquidationCollectors(ASSET_UNIVERSE.map((x) => x.symbol));
  void sampleOnchain().catch(() => undefined);
  void sampleFlows().catch(() => undefined);
  setInterval(() => void sampleOnchain().catch(() => undefined), 24 * 60 * 60_000).unref();
  setInterval(() => void sampleFlows().catch(() => undefined), 24 * 60 * 60_000).unref();
}
