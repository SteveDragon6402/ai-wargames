"use client";

import { useParams } from "next/navigation";
import CampaignTable, { type CampaignId } from "@/components/campaign-table";

const LOBBIES: Record<string, CampaignId> = {
  riverlands: "got-houses-v2",
  "five-kings": "got-houses",
};

export default function LobbyPage() {
  const params = useParams<{ campaign: string }>();
  const campaign = LOBBIES[params?.campaign ?? ""];
  if (!campaign) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6">
        <p className="text-[15px] text-muted-foreground">That game is not on the table.</p>
        <a href="/" className="mt-4 text-[13px] text-foreground underline">
          All games
        </a>
      </main>
    );
  }
  return <CampaignTable campaign={campaign} />;
}
