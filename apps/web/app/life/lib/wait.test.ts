import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendSample, meanMs, waitRatio, WRITE_SEED_MS } from "./wait";

describe("life wait", () => {
  it("uses the seed until there are samples, then the mean of the last eight", () => {
    assert.equal(meanMs([], WRITE_SEED_MS.childhood), 25_000);
    assert.equal(meanMs([10_000, 20_000], WRITE_SEED_MS.childhood), 15_000);
    const kept = appendSample([1, 2, 3, 4, 5, 6, 7, 8], 30_000);
    assert.deepEqual(kept, [2, 3, 4, 5, 6, 7, 8, 30_000]);
  });

  it("fills most of the bar by the average, then creeps", () => {
    assert.equal(waitRatio(0, 25_000), 0);
    const mid = waitRatio(12_500, 25_000);
    const end = waitRatio(25_000, 25_000);
    const late = waitRatio(50_000, 25_000);
    assert.ok(mid > 0.4 && mid < 0.7);
    assert.ok(end > 0.85 && end < 0.91);
    assert.ok(late > end && late < 0.98);
  });
});
