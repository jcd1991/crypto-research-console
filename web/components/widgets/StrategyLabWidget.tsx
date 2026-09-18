"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiGet, fmt, pctClass } from "../../lib/api";

type Run = { run_id: string; strategy: string; exchange: string; market_type: string; pairs: string[] };
type RunsResponse = { runs: Run[]; source: string };
type Trade = { pair?: string; side?: string; close_time?: string; profit_abs?: number; leverage?: number; exit_reason?: string };
type TradesResponse = { trades?: Trade[] };
type MetricsResponse = { summary?: { trade_count?: number; profit_abs?: number } };

export default function StrategyLabWidget() {
  const [selected, setSelected] = useState<string>();
  const runs = useQuery({ queryKey: ["lab-runs-strategy"], queryFn: () => apiGet<RunsResponse>("/api/lab/runs"), refetchInterval: 15_000 });
  const runId = selected ?? runs.data?.runs[0]?.run_id;
  const run = runs.data?.runs.find((item) => item.run_id === runId);
  const trades = useQuery({ queryKey: ["lab-trades", runId], queryFn: () => apiGet<TradesResponse>(`/api/lab/runs/${encodeURIComponent(runId!)}/trades`), enabled: Boolean(runId) });
  const metrics = useQuery({ queryKey: ["lab-metrics-strategy", runId], queryFn: () => apiGet<MetricsResponse>(`/api/lab/runs/${encodeURIComponent(runId!)}/metrics`), enabled: Boolean(runId) });

  if (runs.error) return <div className="p-2 down">Strategy adapter: {(runs.error as Error).message}</div>;
  if (!run) return <div className="p-2 dim">Select an exported run to inspect trades and risk.</div>;
  const rows = trades.data?.trades ?? [];
  const byPair = new Map<string, number>();
  rows.forEach((trade) => byPair.set(trade.pair ?? "unknown", (byPair.get(trade.pair ?? "unknown") ?? 0) + Number(trade.profit_abs ?? 0)));
  return (
    <div className="p-2 space-y-2">
      <select value={run.run_id} onChange={(event) => setSelected(event.target.value)}>{runs.data?.runs.map((item) => <option key={item.run_id} value={item.run_id}>{item.strategy} · {item.exchange}</option>)}</select>
      <div className="flex gap-3 dim"><span>{run.market_type}</span><span>{metrics.data?.summary?.trade_count ?? rows.length} trades</span><span>source: Freqtrade</span></div>
      <div className="grid grid-cols-3 gap-1"><div className="border border-[var(--border)] p-1">PnL <strong className={pctClass(Number(metrics.data?.summary?.profit_abs ?? 0))}>{fmt(metrics.data?.summary?.profit_abs, 2)}</strong></div><div className="border border-[var(--border)] p-1">Pairs <strong>{byPair.size}</strong></div><div className="border border-[var(--border)] p-1">Leverage <strong>{fmt(Math.max(...rows.map((item) => Number(item.leverage ?? 1)), 1), 1)}×</strong></div></div>
      <table className="data-table"><thead><tr><th>Pair</th><th>Side</th><th>PnL</th><th>Lev</th><th>Exit</th></tr></thead><tbody>{rows.slice(-12).reverse().map((trade, index) => <tr key={`${trade.pair}-${trade.close_time}-${index}`}><td>{trade.pair ?? "—"}</td><td>{trade.side ?? "—"}</td><td className={pctClass(Number(trade.profit_abs ?? 0))}>{fmt(trade.profit_abs, 3)}</td><td>{fmt(trade.leverage, 1)}×</td><td>{trade.exit_reason ?? "—"}</td></tr>)}</tbody></table>
      <div className="dim">Risk view: exposure and concentration are computed from the venue-specific artifact; no other exchange feed is mixed into this blotter.</div>
    </div>
  );
}
