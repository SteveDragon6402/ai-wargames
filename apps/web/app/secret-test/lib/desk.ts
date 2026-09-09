import { COUNTRY_RULES } from "../data/valden";
import type { CosRecommendation, FactionId, SecretTestState } from "../types";
import { rivalFaction } from "../types";
import { formatKr, humanMapDigest } from "./lean";

export function colorWord(faction: FactionId): string {
  return faction === "red" ? "RED" : "BLUE";
}

export function deskDefaults(state: SecretTestState, faction: FactionId): CosRecommendation[] {
  const cash = state.cash[faction] ?? 0;
  const recs: CosRecommendation[] = [
    { action: "Two neighbouring seats this month — pick a toss-up and the seat next to it", costKr: 130_000 },
    { action: "Local radio and papers in one state, not the whole country", costKr: 280_000 },
    { action: "Door operation in one toss-up", costKr: 180_000 },
    { action: "Small fundraiser in Havnstad — cheap, tops up the pot", costKr: 20_000 },
  ];
  return recs.filter((r) => r.costKr <= cash || r.costKr <= 20_000);
}

export function templateBriefing(
  state: SecretTestState,
  faction: FactionId,
  candidateName: string,
  opponentName: string,
  gmNote: string
): { letter: string; opponentRumor: string; recommendations: CosRecommendation[] } {
  const other = rivalFaction(faction);
  const cash = state.cash[faction] ?? 0;
  const recommendations = deskDefaults(state, faction);
  const opening = state.history.length === 0;
  const issues = state.issues.length
    ? state.issues.map((i) => `• ${i}`).join("\n")
    : "• Nothing live — pick a fight or stay quiet.";
  const debate =
    state.debateQuestions.length > 0
      ? `\n\nDEBATE THIS MONTH\nSame three questions as ${opponentName}. Answer them in your own words. We will quote them next month.\n${state.debateQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
      : "";
  const note = gmNote.trim()
    ? `\n\nWHAT JUST HAPPENED\n${gmNote.trim().slice(0, 320)}`
    : "";

  const letter = opening
    ? `YOU ARE THE ${colorWord(faction)} CAMPAIGN.

${candidateName} — that is you. ${opponentName} is ${colorWord(other)}. On the map, ${colorWord(faction)} seats are yours. ${colorWord(other)} seats are theirs. Grey is a toss-up. Do not read the other colour as you.

HOW THIS IS WON
${COUNTRY_RULES}

MONEY
${formatKr(cash)} on the desk. They started with the same. One package a month. If you ask for the whole country, we cut it and tell you.

THE BOARD
${humanMapDigest(state, faction)}

LIVE ISSUES — take a line in your 300 words or we stay mute
${issues}

THIS MONTH
One move. I want: ${recommendations[0]?.action ?? "two neighbouring seats"}. Cost ${formatKr(recommendations[0]?.costKr ?? 130_000)}. Write the 300 words as if you are talking to me.`
    : `YOU ARE STILL THE ${colorWord(faction)} CAMPAIGN.

You: ${candidateName}. Them: ${opponentName} (${colorWord(other)}). Map colours are campaign colours, not "whoever is reading this".

MONEY
${formatKr(cash)} left.

THE BOARD
${humanMapDigest(state, faction)}
${note}

LIVE ISSUES — opine or stay silent
${issues}${debate}

THIS MONTH
One package. My ask: ${recommendations[0]?.action ?? "visit two neighbouring seats"}. ${formatKr(recommendations[0]?.costKr ?? 130_000)}.`;

  return {
    letter,
    opponentRumor: opening
      ? `${opponentName} (${colorWord(other)}) started with the same war chest. We do not have an exact read on what they have spent.`
      : `${opponentName} (${colorWord(other)}) is still in the field. Treat any number you hear as a rumour.`,
    recommendations,
  };
}
