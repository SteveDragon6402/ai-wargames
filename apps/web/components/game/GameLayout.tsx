"use client";

import { useState, type ReactNode } from "react";

interface GameLayoutProps {
  header: ReactNode;
  map: ReactNode;
  sidebarHeader: ReactNode;
  sidebarScroll: ReactNode;
  sidebarFooter?: ReactNode;
  orders: ReactNode;
  log: ReactNode;
}

export function GameLayout({
  header,
  map,
  sidebarHeader,
  sidebarScroll,
  orders,
  log,
}: GameLayoutProps) {
  const [activeTab, setActiveTab] = useState<"intel" | "log">("intel");

  return (
    <section className="game-shell">
      {/* Full-width war room header */}
      <header className="shrink-0">{header}</header>

      <main className="flex min-h-0 flex-1 overflow-hidden">
        {/* LEFT SIDEBAR */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-hairline bg-canvas-soft xl:w-72">
          {/* Unit intel header */}
          <div className="shrink-0 border-b border-hairline">
            {sidebarHeader}
          </div>

          {/* Tab switcher */}
          <div className="flex shrink-0 border-b border-hairline">
            {(["intel", "log"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-medium uppercase tracking-wide transition-colors ${
                  activeTab === tab
                    ? "border-b-2 border-primary text-primary-soft"
                    : "border-b-2 border-transparent text-mute"
                }`}
                style={{ marginBottom: -1 }}
              >
                {tab === "intel" ? "Unit Intel" : "Battle Log"}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="game-scroll">
            {activeTab === "intel" ? sidebarScroll : log}
          </div>

          {/* Orders strip at bottom of sidebar */}
          <div className="shrink-0 border-t border-hairline">
            {orders}
          </div>
        </aside>

        {/* MAP — takes remaining space */}
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {map}
        </section>
      </main>
    </section>
  );
}
