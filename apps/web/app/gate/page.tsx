import type { Metadata } from "next";
import { safeNext } from "@/lib/gate-auth";

export const metadata: Metadata = {
  title: "Closed — The Riverlands Campaign",
};

type GateSearch = {
  error?: string;
  next?: string;
};

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<GateSearch>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const failed = params.error === "1";
  const unconfigured = params.error === "config";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="mb-8 text-center">
        <div className="mx-auto flex size-16 items-center justify-center border border-primary/40 bg-secondary font-display text-3xl text-primary">
          ⌘
        </div>
        <h1 className="mt-6 font-display text-4xl font-semibold tracking-wide text-foreground sm:text-5xl">
          The table is closed
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          Enter the password to sit down. Nothing behind this gate runs until you do.
        </p>
      </div>

      <form
        action="/api/gate"
        method="POST"
        className="w-full max-w-md rounded-sm border border-border bg-card"
      >
        <div className="border-b border-border px-5 py-3 text-[13px] text-muted-foreground">
          Password
        </div>
        <div className="space-y-4 p-5">
          {next !== "/" && <input type="hidden" name="next" value={next} />}
          <div>
            <label htmlFor="gate-password" className="mb-1.5 block text-[13px] text-muted-foreground">
              Password
            </label>
            <input
              id="gate-password"
              name="password"
              type="password"
              required
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="current-password"
              maxLength={200}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary text-[13px] font-semibold text-primary-foreground shadow hover:bg-primary/90"
          >
            Open the gate
          </button>
        </div>
        {failed && (
          <div className="mx-5 mb-4 rounded-sm border border-bad/40 bg-bad/10 px-3 py-2 text-[13px] text-bad">
            That password does not open the gate.
          </div>
        )}
        {unconfigured && (
          <div className="mx-5 mb-4 rounded-sm border border-bad/40 bg-bad/10 px-3 py-2 text-[13px] text-bad">
            The gate is not configured on this server.
          </div>
        )}
      </form>
    </main>
  );
}
