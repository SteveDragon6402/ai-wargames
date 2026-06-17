"use client";

import type { ReactNode } from "react";

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
  sidebarFooter,
  orders,
  log,
}: GameLayoutProps) {
  return (
    <section className="game-shell">
      <header className="shrink-0">{header}</header>

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="relative flex h-[50dvh] min-h-[280px] flex-1 min-w-0 flex-col lg:h-auto lg:min-h-0">
          {map}
        </section>

        <aside className="flex min-h-0 w-full shrink-0 flex-col border-t border-slate-800 bg-slate-950 lg:w-72 lg:border-l lg:border-t-0 xl:w-80">
          <header className="shrink-0">{sidebarHeader}</header>
          <section className="game-scroll border-t border-slate-800/80">{sidebarScroll}</section>
          {sidebarFooter ? (
            <footer className="shrink-0 border-t border-slate-800">{sidebarFooter}</footer>
          ) : null}
        </aside>
      </main>

      <footer className="shrink-0 border-t border-slate-800 bg-slate-950">
        <section className="max-h-36 overflow-y-auto overscroll-contain">{orders}</section>
        {log}
      </footer>
    </section>
  );
}
