"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiGet, fmt, pctClass } from "../../lib/api";

type Run = { run_id: string; strategy: string; exchange: string; market_type: "spot" | "futures"; timeframe: string; pairs: string[]; [key: string]: unknown };
type RunsResponse = { source: string; runs: Run[] };
type RegimesResponse = { source: string; regimes?: Array<Record<string, unknown>> };
type MetricsResponse = { source: string; summary?: { trade_count?: number; profit_abs?: number }; drawdown_curve?: Array<{ drawdown_abs?: number }> };

function SourceBadge({ source }: { source: string }) {
  return <span className="dim border border-[var(--border)] px-1">{source === "artifact" ? "Freqtrade exchange truth" : source}</span>;
}

export default function CryptoRegimeWidget() {
  const [selected, setSelected] = useState<string>();
  const runs = useQuery({ queryKey: ["lab-runs"], queryFn: () => apiGet<RunsResponse>("/api/lab/runs"), refetchInterval: 15_000 });
  const runId = selected ?? runs.data?.runs[0]?.run_id;
  const run = runs.data?.runs.find((item) => item.run_id === runId);
  const regimes = useQuery({ queryKey: ["lab-regimes", runId], queryFn: () => apiGet<RegimesResponse>(`/api/lab/runs/${encodeURIComponent(runId!)}/regimes`), enabled: Boolean(runId) });
  const metrics = useQuery({ queryKey: ["lab-metrics", runId], queryFn: () => apiGet<MetricsResponse>(`/api/lab/runs/${encodeURIComponent(runId!)}/metrics`), enabled: Boolean(runId) });

  if (runs.isLoading) return <div className="p-2 dim">Loading lab runs…</div>;
  if (runs.error) return <div className="p-2 down">Research adapter: {(runs.error as Error).message}</div>;
  if (!run) return <div className="p-2 dim">No exported Freqtrade runs. Set LAB_ARTIFACT_ROOT and export a run.</div>;

  const latest = regimes.data?.regimes?.[regimes.data.regimes.length - 1];
  const drawdown = metrics.data?.drawdown_curve?.reduce((min, row) => Math.min(min, Number(row.drawdown_abs ?? 0)), 0) ?? 0;
  return (
    <div className="p-2 space-y-2">
      <div className="flex items-center justify-between gap-2"><select value={run.run_id} onChange={(event) => setSelected(event.target.value)}>{runs.data?.runs.map((item) => <option key={item.run_id} value={item.run_id}>{item.strategy} · {item.exchange} · {item.market_type}</option>)}</select><SourceBadge source={runs.data?.source ?? "artifact"} /></div>
      <div className="flex gap-3 dim"><span>{run.exchange}</span><span>{run.market_type}</span><span>{run.timeframe}</span><span>UTC / 24×7</span></div>
      <div className="grid grid-cols-2 gap-1"><div className="border border-[var(--border)] p-1">Regime <strong className="amber">{String(latest?.regime ?? latest?.label ?? "not exported")}</strong></div><div className="border border-[var(--border)] p-1">Confidence <strong>{fmt(Number(latest?.confidence ?? NaN), 2)}</strong></div><div className="border border-[var(--border)] p-1">PnL <strong className={pctClass(Number(metrics.data?.summary?.profit_abs ?? 0))}>{fmt(metrics.data?.summary?.profit_abs, 2)}</strong></div><div className="border border-[var(--border)] p-1">Max DD <strong className="down">{fmt(drawdown, 2)}</strong></div></div>
      <div className="dim">Pairs: {run.pairs.join(", ") || "—"}</div>
      <div className="text-[10px] dim">Regime rows are strategy-derived. Reference feeds are never substituted for exchange truth.</div>
    </div>
  );
}
