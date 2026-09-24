import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { passwordMatches, safeNext, sha256Hex, tokensMatch } from "./gate-auth";

describe("safeNext", () => {
  it("keeps ordinary in-app paths", () => {
    assert.equal(safeNext("/got-houses-v2/room/abc/game"), "/got-houses-v2/room/abc/game");
    assert.equal(safeNext("/?x=1"), "/?x=1");
  });

  it("drops off-site and gate targets", () => {
    assert.equal(safeNext("https://evil.example"), "/");
    assert.equal(safeNext("//evil.example"), "/");
    assert.equal(safeNext("/\\evil"), "/");
    assert.equal(safeNext("/gate"), "/");
    assert.equal(safeNext("/api/gate"), "/");
    assert.equal(safeNext(null), "/");
  });
});

describe("tokensMatch", () => {
  it("matches equal strings and rejects others", () => {
    assert.equal(tokensMatch("abc", "abc"), true);
    assert.equal(tokensMatch("abc", "abd"), false);
    assert.equal(tokensMatch("abc", "abcd"), false);
  });
});

describe("passwordMatches", () => {
  const previous = process.env.GATE_PASSWORD;

  afterEach(() => {
    if (previous === undefined) delete process.env.GATE_PASSWORD;
    else process.env.GATE_PASSWORD = previous;
  });

  it("rejects an empty or wrong passphrase", async () => {
    delete process.env.GATE_PASSWORD;
    assert.equal(await passwordMatches(""), false);
    assert.equal(await passwordMatches("open-sesame"), false);
    assert.equal(await passwordMatches("Open-Sesame"), false);
  });

  it("honors a GATE_PASSWORD override", async () => {
    process.env.GATE_PASSWORD = "override-phrase";
    assert.equal(await passwordMatches("override-phrase"), true);
    assert.equal(await passwordMatches("open-sesame"), false);
  });
});

describe("sha256Hex", () => {
  it("matches the known digest for abc", async () => {
    assert.equal(
      await sha256Hex("abc"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});
