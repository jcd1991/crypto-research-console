import { Router } from "express";
import { z } from "zod";
import { ASSET_UNIVERSE, PROTOCOL_UNIVERSE, assetEntry, protocolEntry } from "../research/registry.js";
import * as research from "../services/research.js";
import * as intel from "../services/intel.js";
import { liquidationStatus, startLiquidationCollectors } from "../services/liquidations.js";

export const researchRouter = Router();

const ranges = z.enum(["24h", "7d", "30d", "90d"]);
const protocolRanges = z.enum(["30d", "90d"]);
const target = z.object({ target_type: z.enum(["asset", "protocol"]), target_key: z.string().min(1).max(64) });

function bad(res: any, message: string): any { return res.status(400).json({ error: message }); }
function ensureTarget(targetType: "asset" | "protocol", key: string): boolean {
  return targetType === "asset" ? Boolean(assetEntry(key)) : Boolean(protocolEntry(key));
}

researchRouter.get("/derivatives/:symbol", async (req, res) => {
  try {
    await research.ensureAsset(req.params.symbol);
    res.json(research.assetResponse(req.params.symbol));
  } catch (err) { res.status(String(err).includes("unsupported") ? 400 : 502).json({ error: err instanceof Error ? err.message : String(err) }); }
});

researchRouter.get("/derivatives/:symbol/history", (req, res) => {
  const parsed = ranges.safeParse(req.query.range ?? "24h");
  if (!parsed.success || !assetEntry(req.params.symbol)) return bad(res, "unsupported asset or history range");
  try { res.json({ symbol: req.params.symbol.toUpperCase(), range: parsed.data, venues: research.assetHistory(req.params.symbol, parsed.data) }); }
  catch (err) { bad(res, err instanceof Error ? err.message : String(err)); }
});

researchRouter.get("/protocols", (_req, res) => res.json(PROTOCOL_UNIVERSE));

researchRouter.get("/protocols/:slug/history", (req, res) => {
  const parsed = protocolRanges.safeParse(req.query.range ?? "30d");
  if (!parsed.success || !protocolEntry(req.params.slug)) return bad(res, "unsupported protocol or history range");
  try { res.json({ slug: req.params.slug, range: parsed.data, history: research.protocolHistory(req.params.slug, parsed.data) }); }
  catch (err) { bad(res, err instanceof Error ? err.message : String(err)); }
});

researchRouter.get("/protocols/:slug", async (req, res) => {
  try {
    await research.ensureProtocol(req.params.slug);
    const result = research.protocolResponse(req.params.slug);
    const p: any = result.observation?.payload ?? {};
    const ratio = (n: unknown, d: unknown) => typeof n === "number" && typeof d === "number" && d > 0 ? n / d : null;
    res.json({ ...result, metrics: { ...p, marketCapRevenueRunRate: ratio(p.marketCapUsd, typeof p.revenue24hUsd === "number" ? p.revenue24hUsd * 365 : null), feesTvlRunRate: ratio(typeof p.fees24hUsd === "number" ? p.fees24hUsd * 365 : null, p.tvlUsd) } });
  } catch (err) { res.status(String(err).includes("unsupported") ? 400 : 502).json({ error: err instanceof Error ? err.message : String(err) }); }
});

researchRouter.get("/notes", (_req, res) => res.json(research.listNotes()));
researchRouter.get("/notes/:id", (req, res) => {
  const note = research.getNote(Number(req.params.id));
  if (!note) return res.status(404).json({ error: "note not found" });
  res.json({ ...note, tags: JSON.parse(note.tags_json), snapshot: JSON.parse(note.snapshot_json), reviews: research.listReviews(Number(req.params.id)) });
});

const noteSchema = target.extend({ title: z.string().min(1).max(160), thesis: z.string().min(1).max(10_000), catalyst: z.string().min(1).max(5_000), invalidation: z.string().min(1).max(5_000), horizon: z.string().min(1).max(120), tags: z.array(z.string().min(1).max(40)).max(20).default([]) });
researchRouter.post("/notes", async (req, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, parsed.error.message);
  if (!ensureTarget(parsed.data.target_type, parsed.data.target_key)) return bad(res, "unsupported target");
  parsed.data.target_key = parsed.data.target_type === "asset" ? parsed.data.target_key.toUpperCase() : parsed.data.target_key;
  try {
    if (parsed.data.target_type === "asset") await research.ensureAsset(parsed.data.target_key);
    else await research.ensureProtocol(parsed.data.target_key);
    res.status(201).json(research.createNote(parsed.data));
  } catch (err) { res.status(502).json({ error: err instanceof Error ? err.message : String(err) }); }
});
researchRouter.post("/notes/:id/reviews", (req, res) => {
  const parsed = z.object({ body: z.string().min(1).max(10_000) }).safeParse(req.body);
  if (!parsed.success) return bad(res, parsed.error.message);
  if (!research.getNote(Number(req.params.id))) return res.status(404).json({ error: "note not found" });
  res.status(201).json(research.addReview(Number(req.params.id), parsed.data.body));
});
researchRouter.patch("/notes/:id/status", (req, res) => {
  const parsed = z.object({ status: z.enum(["active", "invalidated", "closed", "archived"]) }).safeParse(req.body);
  if (!parsed.success) return bad(res, parsed.error.message);
  if (!research.getNote(Number(req.params.id))) return res.status(404).json({ error: "note not found" });
  research.updateNoteStatus(Number(req.params.id), parsed.data.status); res.json({ ok: true });
});

const alertSchema = target.extend({ venue: z.enum(["any", "Binance USD-M", "Hyperliquid", "DefiLlama"]).default("any"), metric: z.enum(["funding_rate_pct", "basis_pct", "open_interest_usd", "open_interest_change_pct_1h", "open_interest_change_pct_24h", "price_change_pct_24h", "tvlUsd", "tvlChangePct1d", "tvlChangePct7d", "fees24hUsd", "revenue24hUsd", "holderRevenue24hUsd", "marketCapUsd", "fdvUsd"]), operator: z.enum([">", ">=", "<", "<=", "crosses_above", "crosses_below"]), threshold: z.number().finite(), cooldown_minutes: z.number().int().min(0).max(10080).default(60) });
researchRouter.get("/alerts", (_req, res) => res.json(research.listAlerts()));
researchRouter.post("/alerts", (req, res) => { const parsed = alertSchema.safeParse(req.body); if (!parsed.success) return bad(res, parsed.error.message); if (!ensureTarget(parsed.data.target_type, parsed.data.target_key)) return bad(res, "unsupported target"); parsed.data.target_key = parsed.data.target_type === "asset" ? parsed.data.target_key.toUpperCase() : parsed.data.target_key; res.status(201).json(research.createAlert(parsed.data)); });
researchRouter.patch("/alerts/:id", (req, res) => { const parsed = z.object({ enabled: z.boolean().optional(), threshold: z.number().finite().optional(), cooldown_minutes: z.number().int().min(0).max(10080).optional() }).safeParse(req.body); if (!parsed.success) return bad(res, parsed.error.message); if (!research.listAlerts().some((a) => a.id === Number(req.params.id))) return res.status(404).json({ error: "alert not found" }); research.updateAlert(Number(req.params.id), parsed.data); res.json({ ok: true }); });
researchRouter.get("/alert-events", (req, res) => res.json(research.listEvents(req.query.unread === "1" || req.query.unread === "true")));
researchRouter.post("/alert-events/:id/read", (req, res) => { research.markEventRead(Number(req.params.id)); res.json({ ok: true }); });

researchRouter.get("/liquidations/status", (_req, res) => { startLiquidationCollectors(ASSET_UNIVERSE.map((x) => x.symbol)); res.json(liquidationStatus()); });
researchRouter.get("/liquidations/:symbol", async (req, res) => { startLiquidationCollectors(ASSET_UNIVERSE.map((x) => x.symbol)); res.json(await intel.collectLiquidations(req.params.symbol)); });
researchRouter.get("/liquidity/:symbol", async (req, res) => { res.json({ symbol: req.params.symbol.toUpperCase(), venues: await intel.collectLiquidity(req.params.symbol), history: intel.liquidityHistory(req.params.symbol) }); });
researchRouter.get("/flows/stablecoins", async (_req, res) => res.json(await intel.collectStablecoins()));
researchRouter.get("/flows/etf", async (_req, res) => res.json(await intel.collectEtfFlows()));
researchRouter.get("/flows", async (_req, res) => { const [stablecoins, etf] = await Promise.all([intel.collectStablecoins(), intel.collectEtfFlows()]); res.json({ stablecoins, etf }); });
researchRouter.get("/onchain/:asset", async (req, res) => res.json(await intel.collectOnchain(req.params.asset)));
researchRouter.get("/governance", async (req, res) => { const protocol = typeof req.query.protocol === "string" ? req.query.protocol : undefined; if (protocol) res.json(await intel.collectGovernance(protocol)); else res.json(intel.governance()); });
researchRouter.get("/wallets", (_req, res) => res.json(intel.wallets()));
researchRouter.get("/wallets/:id/holdings", async (req, res) => { try { res.json(await intel.refreshWallet(Number(req.params.id))); } catch (error) { res.status(502).json({ error: error instanceof Error ? error.message : String(error) }); } });
researchRouter.patch("/wallets/:id/follow", (req, res) => { const parsed = z.object({ followed: z.boolean() }).safeParse(req.body); if (!parsed.success) return bad(res, parsed.error.message); if (!intel.getWallet(Number(req.params.id))) return res.status(404).json({ error: "wallet not found" }); res.json(intel.setWalletFollowed(Number(req.params.id), parsed.data.followed)); });
researchRouter.post("/wallets", (req, res) => { const parsed = z.object({ chain: z.literal("ethereum"), address: z.string().regex(/^0x[a-fA-F0-9]{40}$/), label: z.string().min(1).max(120), label_type: z.enum(["curated", "exchange", "fund", "protocol", "unknown"]).default("curated"), source_url: z.string().url().optional(), notes: z.string().max(5000).optional() }).safeParse(req.body); if (!parsed.success) return bad(res, parsed.error.message); try { res.status(201).json(intel.addWallet(parsed.data)); } catch { res.status(409).json({ error: "wallet already exists" }); } });
researchRouter.get("/wallet-events", (req, res) => res.json(intel.walletEvents(req.query.unread === "1" || req.query.unread === "true")));
researchRouter.post("/wallet-events/:id/read", (req, res) => { intel.markWalletEventRead(Number(req.params.id)); res.json({ ok: true }); });
researchRouter.get("/unlocks", (req, res) => res.json(intel.unlocks(typeof req.query.token === "string" ? req.query.token : undefined)));
researchRouter.post("/unlocks", (req, res) => { const parsed = z.object({ token: z.string().min(1).max(32), protocol: z.string().max(80).optional(), event_date: z.string().datetime(), amount: z.number().nonnegative().optional(), amount_unit: z.string().max(32).optional(), percent_supply: z.number().min(0).max(100).optional(), vesting_contract: z.string().optional(), source_url: z.string().url(), confidence: z.enum(["high", "medium", "low"]), status: z.enum(["scheduled", "completed", "cancelled"]).default("scheduled"), notes: z.string().max(5000).optional() }).safeParse(req.body); if (!parsed.success) return bad(res, parsed.error.message); try { res.status(201).json(intel.addUnlock(parsed.data)); } catch { res.status(409).json({ error: "unlock already exists" }); } });
