import { Router } from "express";
import { live } from "../providers/freqtradeLab.js";
import { getCandles, getRun, getRunFile, listRuns } from "../services/labArtifacts.js";

export const labRouter = Router();

function asyncRoute(handler: (req: any, res: any) => Promise<void>) {
  return (req: any, res: any) => handler(req, res).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "lab request failed";
    const status = /invalid|unsupported|localhost-only/.test(message) ? 400 : 502;
    res.status(status).json({ error: message });
  });
}

labRouter.get("/runs", asyncRoute(async (_req, res) => res.json({ source: "artifact", runs: await listRuns() })));
labRouter.get("/runs/:runId", asyncRoute(async (req, res) => res.json({ source: "artifact", run: await getRun(req.params.runId) })));
labRouter.get("/runs/:runId/candles", asyncRoute(async (req, res) => res.json({ source: "artifact", rows: await getCandles(req.params.runId) })));
for (const file of ["regimes.json", "signals.json", "trades.json", "metrics.json"] as const) {
  labRouter.get(`/runs/:runId/${file.replace(".json", "")}`, asyncRoute(async (req, res) => {
    res.json({ source: "artifact", ...(await getRunFile(req.params.runId, file) as object) });
  }));
}

labRouter.get("/live/health", asyncRoute(async (_req, res) => res.json({ source: "freqtrade-api", data: await live.health() })));
labRouter.get("/live/status", asyncRoute(async (_req, res) => res.json({ source: "freqtrade-api", data: await live.status() })));
labRouter.get("/live/trades", asyncRoute(async (_req, res) => res.json({ source: "freqtrade-api", data: await live.trades() })));
labRouter.get("/live/profit", asyncRoute(async (_req, res) => res.json({ source: "freqtrade-api", data: await live.profit() })));
labRouter.get("/live/performance", asyncRoute(async (_req, res) => res.json({ source: "freqtrade-api", data: await live.performance() })));
labRouter.get("/live/candles", asyncRoute(async (req, res) => res.json({ source: "freqtrade-api", data: await live.candles(String(req.query.pair ?? "BTC/USDT:USDT"), String(req.query.timeframe ?? "1h"), Number(req.query.limit ?? 200)) })));
