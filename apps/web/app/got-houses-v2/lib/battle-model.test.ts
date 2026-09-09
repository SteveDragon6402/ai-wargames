import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyChronicleReason, textOfContent } from "./battle-model";

describe("textOfContent", () => {
  it("joins text blocks and ignores thinking", () => {
    assert.equal(
      textOfContent([
        { type: "thinking", text: "" },
        { type: "text", text: "INITIAL DEPLOYMENT: The hosts met at The Twins." },
      ]),
      "INITIAL DEPLOYMENT: The hosts met at The Twins."
    );
  });

  it("treats a thinking-only reply as empty", () => {
    assert.equal(textOfContent([{ type: "thinking" }]), "");
  });
});

describe("emptyChronicleReason", () => {
  it("rejects the Sonnet 5 thinking-only / max_tokens case", () => {
    const reason = emptyChronicleReason({
      stop_reason: "max_tokens",
      content: [{ type: "thinking" }],
    });
    assert.equal(reason, "empty text (stop=max_tokens, blocks=thinking)");
  });

  it("accepts a real chronicle", () => {
    assert.equal(
      emptyChronicleReason({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "VERDICT: The Westerlands — STRUCTURED WITHDRAWAL" }],
      }),
      null
    );
  });
});
