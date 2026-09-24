const GAMES = [
  {
    href: "/mercenary",
    title: "The Mercenary Band",
    detail: "One company. Fifty-two weeks. You lead them.",
  },
  {
    href: "/lobby/riverlands",
    title: "The Riverlands Campaign",
    detail: "North and Westerlands meet in the river country.",
  },
  {
    href: "/lobby/five-kings",
    title: "War of the Five Kings",
    detail: "The older theatre — kept for the record.",
  },
  {
    href: "/secret-test",
    title: "Secret Test",
    detail: "A closed correspondence campaign.",
  },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground">Games</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-wide text-foreground">The table</h1>
      <ul className="mt-8 flex flex-col gap-3">
        {GAMES.map((game, index) => (
          <li key={game.href}>
            <a
              href={game.href}
              className={
                index === 0
                  ? "block rounded-sm border border-foreground/30 bg-card px-5 py-5 hover:border-foreground/60"
                  : "block rounded-sm border border-border bg-card px-5 py-4 hover:border-foreground/40"
              }
            >
              <div className={index === 0 ? "font-display text-3xl text-foreground" : "font-display text-2xl text-foreground"}>
                {game.title}
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{game.detail}</p>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
