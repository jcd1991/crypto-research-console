import { db } from "../db.js";
import * as binance from "../providers/binance.js";
import * as defillama from "../providers/defillama.js";
import * as hyperliquid from "../providers/hyperliquid.js";
import * as okx from "../providers/okx.js";
import { ASSET_UNIVERSE, PROTOCOL_UNIVERSE, assetEntry, protocolEntry } from "../research/registry.js";
import type { AlertOperator, MetricName, ResearchObservation, TargetType } from "../research/types.js";
import { mapWithConcurrency } from "../concurrency.js";

type SnapshotRow = ResearchObservation & { id: number };

function bucket(minutes: number): string {
  return new Date(Math.floor(Date.now() / (minutes * 60_000)) * minutes * 60_000).toISOString();
}

function now(): string { return new Date().toISOString(); }

function saveObservation(o: ResearchObservation): void {
  db.prepare(`INSERT OR IGNORE INTO research_snapshots
    (target_type,target_key,provider,venue,instrument,observed_at,source_time,units,native_interval_hours,stale,status,payload_json,bucket,source_url,http_status,fetched_at,parser_version)
    VALUES (@targetType,@targetKey,@provider,@venue,@instrument,@observedAt,@sourceTime,@units,@nativeIntervalHours,@stale,@status,@payload,@bucket,@sourceUrl,@httpStatus,@fetchedAt,@parserVersion)`)
    .run({ ...o, stale: o.stale ? 1 : 0, payload: JSON.stringify(o.payload), bucket: bucket(o.targetType === "asset" ? 5 : 15), sourceUrl: o.sourceUrl ?? null, httpStatus: o.httpStatus ?? null, fetchedAt: o.fetchedAt ?? now(), parserVersion: o.parserVersion ?? "research-v1" });
}

function rowToObservation(row: any): SnapshotRow {
  return { id: row.id, targetType: row.target_type, targetKey: row.target_key, provider: row.provider, venue: row.venue, instrument: row.instrument,
    observedAt: row.observed_at, sourceTime: row.source_time, units: row.units, nativeIntervalHours: row.native_interval_hours,
    stale: Boolean(row.stale), status: row.status, payload: JSON.parse(row.payload_json), sourceUrl: row.source_url, httpStatus: row.http_status, fetchedAt: row.fetched_at, parserVersion: row.parser_version };
}

function latest(targetType: TargetType, targetKey: string, limit = 100): SnapshotRow[] {
  return (db.prepare(`SELECT * FROM research_snapshots WHERE target_type=? AND target_key=? ORDER BY observed_at DESC, id DESC LIMIT ?`).all(targetType, targetKey, limit) as any[]).map(rowToObservation);
}

function responseRows(targetType: TargetType, targetKey: string): SnapshotRow[] {
  const rows = latest(targetType, targetKey);
  const byVenue = new Map<string, SnapshotRow[]>();
  for (const row of rows) byVenue.set(row.venue, [...(byVenue.get(row.venue) ?? []), row]);
  return [...byVenue.values()].map((items) => {
    const row = items[0];
    const age = Date.now() - new Date(row.observedAt).getTime();
    const interval = targetType === "asset" ? 5 * 60_000 : 15 * 60_000;
    const stale = row.status === "available" && age > interval * 2;
    return oiChanges(stale ? { ...row, status: "stale" as const, stale: true } : row);
  });
}

function oiChanges(row: SnapshotRow): SnapshotRow {
  if (row.targetType !== "asset" || row.status !== "available") return row;
  const current = metricValue(row, "open_interest_usd");
  if (current === null || current === 0) return row;
  const prior = (hours: number): number | null => {
    const target = new Date(new Date(row.observedAt).getTime() - hours * 3_600_000).toISOString();
    const candidate = db.prepare(`SELECT * FROM research_snapshots WHERE target_type='asset' AND target_key=? AND venue=? AND status='available' AND observed_at <= ? ORDER BY observed_at DESC LIMIT 1`).get(row.targetKey, row.venue, target) as any;
    if (!candidate) return null;
    const observed = new Date(candidate.observed_at).getTime();
    const expected = new Date(row.observedAt).getTime() - hours * 3_600_000;
    const tolerance = hours === 1 ? 45 * 60_000 : 4 * 3_600_000;
    if (Math.abs(observed - expected) > tolerance) return null;
    return metricValue(rowToObservation(candidate), "open_interest_usd");
  };
  const p1 = prior(1); const p24 = prior(24);
  return { ...row, payload: { ...row.payload,
    open_interest_change_pct_1h: p1 !== null && p1 !== 0 ? ((current - p1) / p1) * 100 : null,
    open_interest_change_pct_24h: p24 !== null && p24 !== 0 ? ((current - p24) / p24) * 100 : null,
  } };
}

export async function collectAsset(symbol: string): Promise<SnapshotRow[]> {
  const entry = assetEntry(symbol);
  if (!entry) throw new Error("unsupported crypto asset");
  const observedAt = now();
  const results = await Promise.allSettled([
    binance.derivativesSnapshot(entry.symbol),
    hyperliquid.snapshot(entry.hyperliquid),
    okx.snapshot(entry.symbol),
  ]);
  const rows: SnapshotRow[] = [];
  const definitions = [
    { provider: "binance", venue: "Binance USD-M", result: results[0] },
    { provider: "hyperliquid", venue: "Hyperliquid", result: results[1] },
    { provider: "okx", venue: "OKX", result: results[2] },
  ];
  for (const d of definitions) {
    const value = d.result.status === "fulfilled" ? d.result.value : null;
    const payload = value ? {
      ...value,
      funding_rate_pct: value.fundingRatePercent,
      funding_apr_pct: "fundingAprPercent" in value ? value.fundingAprPercent : value.fundingRatePercent * 3 * 365,
      basis_pct: value.basisPercent,
      open_interest_usd: value.openInterestUsd,
      price_change_pct_24h: value.priceChangePercent24h,
    } : { error: d.result.status === "rejected" ? String(d.result.reason instanceof Error ? d.result.reason.message : d.result.reason) : "unavailable" };
    const observation = {
      targetType: "asset" as const, targetKey: entry.symbol, provider: d.provider, venue: d.venue,
      instrument: value?.symbol ? `${value.symbol}-PERP` : `${entry.symbol}-PERP`, observedAt, sourceTime: value ? new Date(value.sourceTime).toISOString() : null,
      units: "USD and native contracts", nativeIntervalHours: (value as any)?.nativeIntervalHours ?? (d.provider === "hyperliquid" ? 1 : 8),
      stale: false, status: value ? "available" as const : "unavailable" as const, payload,
      sourceUrl: d.provider === "hyperliquid" ? "https://api.hyperliquid.xyz/info" : d.provider === "okx" ? "https://www.okx.com/api/v5/public/funding-rate" : "https://fapi.binance.com/fapi/v1/premiumIndex", fetchedAt: now(),
      httpStatus: value ? 200 : null,
    };
    saveObservation(observation);
    rows.push({ id: 0, ...observation });
  }
  return rows;
}

export async function collectProtocol(slug: string): Promise<SnapshotRow> {
  const entry = protocolEntry(slug);
  if (!entry) throw new Error("unsupported protocol");
  const observedAt = now();
  try {
    const value = await defillama.protocol(entry.slug, entry.tvlSlug, entry.feesSlug, entry.revenueSlug, entry.holderRevenueSlug);
    const observation = { targetType: "protocol" as const, targetKey: entry.slug, provider: "defillama", venue: "DefiLlama", instrument: entry.label,
      observedAt, sourceTime: value.sourceTime, units: "USD", nativeIntervalHours: 24, stale: false, status: "available" as const, payload: value,
      sourceUrl: `https://api.llama.fi/protocol/${entry.tvlSlug}`, fetchedAt: now(), httpStatus: 200 };
    saveObservation(observation);
    return { id: 0, ...observation };
  } catch (err) {
    const observation = { targetType: "protocol" as const, targetKey: entry.slug, provider: "defillama", venue: "DefiLlama", instrument: entry.label,
      observedAt, sourceTime: null, units: "USD", nativeIntervalHours: 24, stale: false, status: "unavailable" as const,
      payload: { error: err instanceof Error ? err.message : String(err) } };
    saveObservation(observation);
    return { id: 0, ...observation };
  }
}

export async function ensureAsset(symbol: string): Promise<void> {
  const current = responseRows("asset", symbol.toUpperCase()).some((x) => x.status === "available" && Date.now() - new Date(x.observedAt).getTime() < 5 * 60_000);
  if (!current) await collectAsset(symbol);
}

export async function ensureProtocol(slug: string): Promise<void> {
  const current = responseRows("protocol", slug).some((x) => x.status === "available" && Date.now() - new Date(x.observedAt).getTime() < 15 * 60_000);
  if (!current) await collectProtocol(slug);
}

export function assetResponse(symbol: string): { symbol: string; venues: SnapshotRow[] } {
  if (!assetEntry(symbol)) throw new Error("unsupported crypto asset");
  return { symbol: symbol.toUpperCase(), venues: responseRows("asset", symbol.toUpperCase()) };
}

export function protocolResponse(slug: string): { protocol: ReturnType<typeof protocolEntry>; observation: SnapshotRow | null } {
  const protocol = protocolEntry(slug);
  if (!protocol) throw new Error("unsupported protocol");
  const rows = responseRows("protocol", slug);
  const latestRow = rows[0] ?? null;
  if (latestRow?.status === "unavailable") {
    const prior = latest("protocol", slug).find((x) => x.status === "available");
    if (prior) return { protocol, observation: { ...prior, status: "stale", stale: true, payload: { ...prior.payload, lastError: latestRow.payload.error } } };
  }
  return { protocol, observation: latestRow };
}

export function assetHistory(symbol: string, range: string): Record<string, SnapshotRow[]> {
  const days = range === "24h" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 0;
  if (!days) throw new Error("invalid history range");
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = (db.prepare(`SELECT * FROM research_snapshots WHERE target_type='asset' AND target_key=? AND observed_at >= ? ORDER BY observed_at ASC`).all(symbol.toUpperCase(), cutoff) as any[]).map(rowToObservation);
  return rows.reduce<Record<string, SnapshotRow[]>>((acc, row) => { (acc[row.venue] ??= []).push(row); return acc; }, {});
}

export function protocolHistory(slug: string, range: string): SnapshotRow[] {
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 0;
  if (!days) throw new Error("invalid history range");
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  return (db.prepare(`SELECT * FROM research_snapshots WHERE target_type='protocol' AND target_key=? AND observed_at >= ? ORDER BY observed_at ASC`).all(slug, cutoff) as any[]).map(rowToObservation);
}

function metricValue(row: SnapshotRow, metric: string): number | null {
  const v = row.payload[metric];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function compare(value: number, operator: AlertOperator, threshold: number, previous: number | null): boolean {
  if (operator === ">") return value > threshold;
  if (operator === ">=") return value >= threshold;
  if (operator === "<") return value < threshold;
  if (operator === "<=") return value <= threshold;
  if (operator === "crosses_above") return previous !== null && previous <= threshold && value > threshold;
  return previous !== null && previous >= threshold && value < threshold;
}

export function evaluateAlerts(): void {
  const alerts = db.prepare("SELECT * FROM research_alerts WHERE enabled=1").all() as any[];
  for (const alert of alerts) {
    const row = responseRows(alert.target_type, alert.target_key).find((x) => x.status === "available" && (alert.venue === "any" || x.venue === alert.venue));
    if (!row || Date.now() - new Date(row.observedAt).getTime() > (alert.target_type === "asset" ? 10 : 30) * 60_000) continue;
    const value = metricValue(row, alert.metric);
    if (value === null) continue;
    const priorRows = latest(alert.target_type, alert.target_key, 10).filter((x) => x.venue === row.venue && x.id !== row.id);
    const previous = priorRows.length ? metricValue(priorRows[0], alert.metric) : null;
    const state = compare(value, alert.operator, alert.threshold, previous);
    const wasState = Boolean(alert.last_state);
    const due = !alert.last_triggered_at || Date.now() - new Date(alert.last_triggered_at).getTime() >= alert.cooldown_minutes * 60_000;
    db.prepare("UPDATE research_alerts SET last_state=?,last_evaluated_at=? WHERE id=?").run(state ? 1 : 0, row.observedAt, alert.id);
    if (state && !wasState && due) {
      db.prepare("INSERT INTO research_alert_events (alert_id,observed_at,value,threshold,provider,venue,payload_json) VALUES (?,?,?,?,?,?,?)")
        .run(alert.id, row.observedAt, value, alert.threshold, row.provider, row.venue, JSON.stringify(row.payload));
      db.prepare("UPDATE research_alerts SET last_triggered_at=? WHERE id=?").run(row.observedAt, alert.id);
    }
  }
}

export async function sampleAll(): Promise<void> {
  await sampleAssets();
  await sampleProtocols();
  evaluateAlerts();
  db.prepare("DELETE FROM research_snapshots WHERE observed_at < ?").run(new Date(Date.now() - 90 * 86_400_000).toISOString());
}

export async function sampleAssets(): Promise<void> { await mapWithConcurrency(ASSET_UNIVERSE, 2, async (x) => { await collectAsset(x.symbol).catch(() => undefined); return x.symbol; }); }
export async function sampleProtocols(): Promise<void> { await mapWithConcurrency(PROTOCOL_UNIVERSE, 2, async (x) => { await collectProtocol(x.slug).catch(() => undefined); return x.slug; }); }
export function pruneResearchSnapshots(): void { db.prepare("DELETE FROM research_snapshots WHERE observed_at < ?").run(new Date(Date.now() - 90 * 86_400_000).toISOString()); }

export function listNotes(): any[] { return db.prepare("SELECT * FROM research_notes ORDER BY created_at DESC").all(); }
export function getNote(id: number): any { return db.prepare("SELECT * FROM research_notes WHERE id=?").get(id); }
export function listReviews(noteId: number): any[] { return db.prepare("SELECT * FROM research_reviews WHERE note_id=? ORDER BY created_at ASC, id ASC").all(noteId); }
export function createNote(input: any): any {
  const snapshot = input.target_type === "asset" ? assetResponse(input.target_key) : protocolResponse(input.target_key);
  const createdAt = now();
  const result = db.prepare(`INSERT INTO research_notes (target_type,target_key,title,thesis,catalyst,invalidation,horizon,tags_json,snapshot_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(input.target_type, input.target_key, input.title, input.thesis, input.catalyst, input.invalidation, input.horizon, JSON.stringify(input.tags), JSON.stringify(snapshot), createdAt);
  return getNote(Number(result.lastInsertRowid));
}
export function addReview(noteId: number, body: string): any {
  const result = db.prepare("INSERT INTO research_reviews (note_id,body,created_at) VALUES (?,?,?)").run(noteId, body, now());
  return db.prepare("SELECT * FROM research_reviews WHERE id=?").get(result.lastInsertRowid);
}
export function updateNoteStatus(id: number, status: string): void { db.prepare("UPDATE research_notes SET status=?,closed_at=CASE WHEN ? IN ('closed','invalidated') THEN ? ELSE closed_at END WHERE id=?").run(status, status, now(), id); }
export function listAlerts(): any[] { return db.prepare("SELECT * FROM research_alerts ORDER BY id DESC").all(); }
export function createAlert(input: any): any { const result = db.prepare("INSERT INTO research_alerts (target_type,target_key,venue,metric,operator,threshold,cooldown_minutes,created_at) VALUES (?,?,?,?,?,?,?,?)").run(input.target_type,input.target_key,input.venue ?? "any",input.metric,input.operator,input.threshold,input.cooldown_minutes,now()); return db.prepare("SELECT * FROM research_alerts WHERE id=?").get(result.lastInsertRowid); }
export function updateAlert(id: number, input: { enabled?: boolean; threshold?: number; cooldown_minutes?: number }): void {
  const current = db.prepare("SELECT * FROM research_alerts WHERE id=?").get(id) as any;
  if (!current) return;
  db.prepare("UPDATE research_alerts SET enabled=?, threshold=?, cooldown_minutes=? WHERE id=?").run(input.enabled === undefined ? current.enabled : input.enabled ? 1 : 0, input.threshold ?? current.threshold, input.cooldown_minutes ?? current.cooldown_minutes, id);
}
export function listEvents(unreadOnly = false): any[] { return db.prepare(`SELECT * FROM research_alert_events ${unreadOnly ? "WHERE read_at IS NULL" : ""} ORDER BY observed_at DESC`).all(); }
export function markEventRead(id: number): void { db.prepare("UPDATE research_alert_events SET read_at=? WHERE id=?").run(now(), id); }
