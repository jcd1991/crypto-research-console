import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getRun, listRuns } from "./labArtifacts.js";

const oldRoot = process.env.LAB_ARTIFACT_ROOT;

afterEach(() => {
  if (oldRoot === undefined) delete process.env.LAB_ARTIFACT_ROOT;
  else process.env.LAB_ARTIFACT_ROOT = oldRoot;
});

describe("lab artifacts", () => {
  it("lists only complete manifests and rejects traversal", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "lab-artifacts-"));
    const run = path.join(root, "fixture-1");
    await mkdir(run);
    await writeFile(path.join(run, "run.json"), JSON.stringify({
      schema_version: "1.0", run_id: "fixture-1", strategy: "Demo", exchange: "binanceus",
      market_type: "spot", timeframe: "1h", pairs: ["BTC/USDT"], data_provenance: "freqtrade-exchange-data",
    }));
    await writeFile(path.join(run, "candles.parquet"), "");
    for (const file of ["regimes.json", "signals.json", "trades.json", "metrics.json"]) await writeFile(path.join(run, file), "{}");
    process.env.LAB_ARTIFACT_ROOT = root;
    expect((await listRuns()).map((item) => item.run_id)).toEqual(["fixture-1"]);
    await expect(getRun("../secret")).rejects.toThrow("invalid lab run id");
  });
});
