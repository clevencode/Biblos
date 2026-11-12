import assert from "node:assert/strict";
import {
  hasActiveBibleOverlay,
  isOverlayType,
  type ActiveBibleOverlay,
} from "../src/hooks/useBibleOverlayController.ts";

const none: ActiveBibleOverlay = { type: "none" };
const search: ActiveBibleOverlay = { type: "word_search" };
const verses: ActiveBibleOverlay = {
  type: "verse_actions",
  selectedVerseIds: ["1", "2"],
};

assert.equal(hasActiveBibleOverlay(none), false);
assert.equal(hasActiveBibleOverlay(search), true);
assert.equal(hasActiveBibleOverlay(verses), true);
assert.equal(isOverlayType(search, "word_search"), true);
assert.equal(isOverlayType(search, "passage_picker"), false);
assert.equal(isOverlayType(verses, "verse_actions"), true);
if (isOverlayType(verses, "verse_actions")) {
  assert.deepEqual(verses.selectedVerseIds, ["1", "2"]);
}

console.log("test-bible-overlay-controller: ok");
