"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return await res.json();
  } catch {
    return { error: `Server error (${res.status})` };
  }
}

const CAMPAIGNS = {
  "got-houses-v2": {
    label: "Riverlands",
    title: "The Riverlands Campaign",
    tagline: "North and Westerlands meet in the river country.",
  },
  "got-houses": {
    label: "Five Kings",
    title: "War of the Five Kings",
    tagline: "The older theatre — kept for the record.",
  },
} as const;

type CampaignId = keyof typeof CAMPAIGNS;

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [campaign, setCampaign] = useState<CampaignId>("got-houses-v2");
  const codeRef = useRef<HTMLInputElement>(null);
  const active = CAMPAIGNS[campaign];

  async function createRoom() {
    if (!name.trim()) {
      setError("Enter a commander name");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/${campaign}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim() }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to create room");
      router.push(`/${campaign}/room/${data.roomId}/lobby`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function joinRoom() {
    if (code.length !== 6) {
      setError("Room code must be 6 characters");
      codeRef.current?.focus();
      return;
    }
    if (!name.trim()) {
      setError("Enter a commander name");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/${campaign}/rooms/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.toUpperCase(), displayName: name.trim() }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to join");
      router.push(`/${campaign}/room/${data.roomId}/lobby`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <nav className="mb-10 flex gap-1 rounded-sm border border-border p-1">
        {(Object.keys(CAMPAIGNS) as CampaignId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setCampaign(id)}
            className={cn(
              "rounded-sm px-3 py-1.5 text-[13px]",
              id === campaign
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {CAMPAIGNS[id].label}
          </button>
        ))}
        <a
          href="/secret-test"
          className="rounded-sm px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          Secret Test
        </a>
      </nav>

      <div className="mb-8 flex items-center gap-8">
        <div className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center border border-north/40 bg-north-deep font-display text-3xl text-north">
            ☾
          </div>
          <div className="mt-2 text-[13px] text-north">The North</div>
        </div>
        <div className="font-display text-lg text-muted-foreground">against</div>
        <div className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center border border-west/40 bg-west-deep font-display text-3xl text-west">
            ♟
          </div>
          <div className="mt-2 text-[13px] text-west">The Westerlands</div>
        </div>
      </div>

      <div className="mb-10 max-w-lg text-center">
        <h1 className="font-display text-4xl font-semibold tracking-wide text-foreground sm:text-5xl">
          {active.title}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          {active.tagline} Take a seat, lock your marches, and let the field be judged.
        </p>
      </div>

      <div className="w-full max-w-md rounded-sm border border-border bg-card">
        <div className="border-b border-border px-5 py-3 text-[13px] text-muted-foreground">
          Open the table
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label htmlFor="commander" className="mb-1.5 block text-[13px] text-muted-foreground">
              Commander name
            </label>
            <Input
              id="commander"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name at the table"
              maxLength={32}
              onKeyDown={(e) => e.key === "Enter" && createRoom()}
              className="h-10 bg-background"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-sm border border-north/30 bg-north-deep/50 px-3 py-2.5">
              <div className="text-[12px] font-medium text-north">Host · North</div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                Robb Stark, five hosts
              </div>
            </div>
            <div className="rounded-sm border border-west/30 bg-west-deep/50 px-3 py-2.5">
              <div className="text-[12px] font-medium text-west">Joiner · West</div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                Tywin Lannister, two hosts
              </div>
            </div>
          </div>

          <Button
            type="button"
            disabled={loading}
            onClick={createRoom}
            className="h-10 w-full text-[13px] font-semibold"
          >
            {loading ? "Raising banners…" : "Raise your banners"}
          </Button>

          <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or join with a code
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="flex gap-2">
            <Input
              ref={codeRef}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
              placeholder="XXXXXX"
              maxLength={6}
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
              className="h-10 flex-1 bg-background text-center font-mono text-lg tracking-[0.3em]"
            />
            <Button
              type="button"
              variant="outline"
              disabled={loading || code.length !== 6}
              onClick={joinRoom}
              className="h-10 px-5"
            >
              Join
            </Button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mb-4 rounded-sm border border-bad/40 bg-bad/10 px-3 py-2 text-[13px] text-bad">
            {error}
          </div>
        )}

        <div className="border-t border-border px-5 py-3 text-center">
          <a
            href={`/${campaign}`}
            className="text-[13px] text-muted-foreground hover:text-foreground"
          >
            Play standalone, no room
          </a>
        </div>
      </div>

      <p className="mt-10 text-[12px] text-muted-foreground">
        AI-adjudicated node warfare
      </p>
    </main>
  );
}
