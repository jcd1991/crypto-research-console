"use client";

import { useTerminal, type WidgetType } from "../store/terminal";

const GROUPS: Array<{ label: string; tone: string; items: Array<{ type: WidgetType; label: string; key: string }> }> = [
  { label: "MARKET", tone: "sidebar-group-market", items: [
    { type: "chart", label: "CHART", key: "⌥1" },
    { type: "quote", label: "QUOTE", key: "⌥2" },
    { type: "crypto", label: "MARKET BOARD", key: "⌥3" },
    { type: "derivatives", label: "PERP POSITIONING", key: "⌥4" },
    { type: "watchlist", label: "WATCHLIST", key: "⌥6" },
    { type: "news", label: "CATALYSTS / NEWS", key: "⌥5" },
  ] },
  { label: "RESEARCH", tone: "sidebar-group-research", items: [
    { type: "fundamentals", label: "FUNDAMENTALS", key: "" },
    { type: "intel", label: "INTELLIGENCE", key: "" },
    { type: "research", label: "NOTEBOOK / INBOX", key: "" },
  ] },
  { label: "WORKSPACE", tone: "sidebar-group-workspace", items: [
    { type: "portfolio", label: "PORTFOLIO / RISK", key: "" },
    { type: "ai", label: "AI ASSIST", key: "⌥9" },
  ] },
];

export default function Sidebar() {
  const addWidget = useTerminal((s) => s.addWidget);
  const resetWorkspace = useTerminal((s) => s.resetWorkspace);

  return (
    <nav className="sidebar-shell">
      <div className="sidebar-heading"><span className="sidebar-mark">+</span><span>ADD WIDGET</span><span className="dim">⌘K</span></div>
      <div className="sidebar-groups">
        {GROUPS.map((group) => <section key={group.label} className={`sidebar-group ${group.tone}`}>
          <div className="sidebar-group-label"><span>{group.label}</span><span className="sidebar-rule" /></div>
          {group.items.map((item) => <button key={item.type} onClick={() => addWidget(item.type)} className="sidebar-item">
            <span>{item.label}</span><span className="sidebar-shortcut">{item.key}</span>
          </button>)}
        </section>)}
      </div>
      <div className="mt-auto border-t border-[var(--border)]">
        <button
          onClick={resetWorkspace}
          className="w-full text-left px-2 py-1.5 text-[11px] dim hover:text-[var(--down)]"
        >
          RESET LAYOUT
        </button>
      </div>
    </nav>
  );
}
