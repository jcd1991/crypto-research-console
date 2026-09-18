import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";
import { z } from "zod";

const FILES = ["run.json", "candles.parquet", "regimes.json", "signals.json", "trades.json", "metrics.json"] as const;
export type LabFile = (typeof FILES)[number];

const runSchema = z.object({
  schema_version: z.string(),
  run_id: z.string(),
  strategy: z.string(),
  exchange: z.string(),
  market_type: z.enum(["spot", "futures"]),
  timeframe: z.string(),
  pairs: z.array(z.string()),
  data_provenance: z.string(),
}).passthrough();

export type LabRun = z.infer<typeof runSchema>;
type CacheEntry = { mtimeMs: number; value: unknown };

const cache = new Map<string, CacheEntry>();

function rootDir(): string {
  return path.resolve(process.env.LAB_ARTIFACT_ROOT ?? path.join(process.cwd(), "data", "lab-runs"));
}

function safeRunId(runId: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(runId);
}

function runDir(runId: string): string {
  if (!safeRunId(runId)) throw new Error("invalid lab run id");
  const root = rootDir();
  const resolved = path.resolve(root, runId);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error("invalid lab artifact path");
  return resolved;
}

function filePath(runId: string, file: LabFile): string {
  if (!FILES.includes(file)) throw new Error("unsupported lab artifact");
  return path.join(runDir(runId), file);
}

async function ensureComplete(runId: string): Promise<void> {
  for (const file of FILES) await stat(filePath(runId, file));
}

async function cachedJson<T>(runId: string, file: Exclude<LabFile, "candles.parquet">): Promise<T> {
  const fullPath = filePath(runId, file);
  const fileStat = await stat(fullPath);
  const key = `${runId}/${file}`;
  const hit = cache.get(key);
  if (hit?.mtimeMs === fileStat.mtimeMs) return hit.value as T;
  const value = JSON.parse(await readFile(fullPath, "utf8")) as T;
  cache.set(key, { mtimeMs: fileStat.mtimeMs, value });
  return value;
}

export async function listRuns(): Promise<LabRun[]> {
  const root = rootDir();
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const runs: LabRun[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !safeRunId(entry.name)) continue;
    try {
      await ensureComplete(entry.name);
      runs.push(runSchema.parse(await cachedJson(entry.name, "run.json")));
    } catch {
      // Ignore incomplete or invalid runs in the listing; detail routes report the error.
    }
  }
  return runs.sort((a, b) => a.run_id.localeCompare(b.run_id));
}

export async function getRun(runId: string): Promise<LabRun> {
  const run = runSchema.parse(await cachedJson(runId, "run.json"));
  await ensureComplete(runId);
  return run;
}

export async function getRunFile(runId: string, file: Exclude<LabFile, "run.json" | "candles.parquet">): Promise<unknown> {
  await getRun(runId);
  return cachedJson(runId, file);
}

export async function getCandles(runId: string): Promise<Record<string, unknown>[]> {
  await getRun(runId);
  const fullPath = filePath(runId, "candles.parquet");
  const fileStat = await stat(fullPath);
  const key = `${runId}/candles.parquet`;
  const hit = cache.get(key);
  if (hit?.mtimeMs === fileStat.mtimeMs) return hit.value as Record<string, unknown>[];
  const file = await asyncBufferFromFile(fullPath);
  const rows = await parquetReadObjects({ file });
  cache.set(key, { mtimeMs: fileStat.mtimeMs, value: rows });
  return rows as Record<string, unknown>[];
}

export { FILES };
