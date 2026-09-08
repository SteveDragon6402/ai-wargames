import Anthropic from "@anthropic-ai/sdk";
import { SEAT_BY_ID } from "../data/valden";
import { MAX_VOTER_POLLS } from "../types";

const HAIKU = "claude-haiku-4-5";

export interface VoterSample {
  seatId: string;
  demographic: string;
  question: string;
}

export interface VoterReply {
  seatId: string;
  demographic: string;
  reply: string;
}

export async function pollVoters(samples: VoterSample[]): Promise<VoterReply[]> {
  const sliced = samples.slice(0, MAX_VOTER_POLLS);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return sliced.map((s) => ({
      seatId: s.seatId,
      demographic: s.demographic,
      reply: "(no key) Unmoved; waiting to hear something concrete.",
    }));
  }
  const client = new Anthropic({ apiKey: key });
  const results = await Promise.all(
    sliced.map(async (s) => {
      const seat = SEAT_BY_ID[s.seatId];
      try {
        const response = await client.messages.create({
          model: HAIKU,
          max_tokens: 160,
          system: `You are one voter in ${seat?.name ?? s.seatId}, Republic of Valden.
Demographic: ${s.demographic}.
Seat: ${seat?.demographics.summary ?? "unknown"}.
Answer in first person, under 60 words, as this person. No strategy talk. No "as an AI".`,
          messages: [{ role: "user", content: s.question }],
        });
        const reply = response.content
          .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join(" ")
          .trim();
        return { seatId: s.seatId, demographic: s.demographic, reply: reply || "(silent)" };
      } catch (err) {
        console.error("[secret-test/poll]", err);
        return { seatId: s.seatId, demographic: s.demographic, reply: "(no answer)" };
      }
    })
  );
  return results;
}
