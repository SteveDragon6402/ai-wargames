/**
 * How we read a Messages API reply. Sonnet 5 can return only thinking
 * blocks (no text) when its token budget is spent on hidden reasoning —
 * that used to look like a successful empty chronicle.
 */

export type ContentBlock = { type: string; text?: string };

export function textOfContent(content: ContentBlock[]): string {
  return content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/** Null when the reply has usable prose; otherwise a short reject reason. */
export function emptyChronicleReason(response: {
  stop_reason?: string | null;
  content: ContentBlock[];
}): string | null {
  if (textOfContent(response.content)) return null;
  const blocks = response.content.map((b) => b.type).join(",") || "none";
  return `empty text (stop=${response.stop_reason ?? "unknown"}, blocks=${blocks})`;
}
