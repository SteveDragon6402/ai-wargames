import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeImagePrompt, pictureFrameAt } from "./picture";

describe("life pictures", () => {
  it("locks a painted style and a crop for each frame", () => {
    const figure = composeImagePrompt("A girl runs the mill lane in sleet, clogs kicking slush.", "figure");
    const place = composeImagePrompt("The croft under a slate sky, smoke flattening.", "place");
    assert.match(figure, /oil on oak panel/i);
    assert.match(figure, /4:5/);
    assert.match(place, /3:2/);
    assert.match(figure, /not concept art/i);
    assert.equal(pictureFrameAt(0), "figure");
    assert.equal(pictureFrameAt(1), "place");
  });
});
