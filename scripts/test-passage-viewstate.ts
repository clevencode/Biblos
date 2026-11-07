/**
 * Transições PassageViewState (anti-CLS).
 * Usage: npx tsx scripts/test-passage-viewstate.ts
 */
import assert from "node:assert/strict";
import { buildPassageSkeletonSchema } from "../src/bible/viewState/schema.ts";
import {
  displayPassageFromViewState,
  initialPassageViewState,
  passageReducer,
} from "../src/bible/viewState/passageReducer.ts";
import { buildGridSkeletonSlotIds } from "../src/bible/viewState/pickerViewState.ts";
import type { YouVersionPassage } from "../src/youversion/client.ts";

const jhn1 = buildPassageSkeletonSchema({
  bookId: "JHN",
  chapterId: "1",
  bookTitle: "Jean",
  verseCount: 51,
});

const jhn2 = buildPassageSkeletonSchema({
  bookId: "JHN",
  chapterId: "2",
  bookTitle: "Jean",
  verseCount: 25,
});

const sample: YouVersionPassage = {
  id: "JHN.1",
  reference: "Jean 1",
  content: "…",
  verses: [{ number: 1, text: "Au commencement…" }],
};

let state = initialPassageViewState;
state = passageReducer(state, { type: "NAVIGATE", schema: jhn1 });
assert.equal(state.status, "loading");
assert.equal(displayPassageFromViewState(state), null);

state = passageReducer(state, {
  type: "RESOLVE_OK",
  schema: jhn1,
  passage: sample,
});
assert.equal(state.status, "success");

state = passageReducer(state, { type: "NAVIGATE", schema: jhn1 });
assert.equal(state.status, "loading");
assert.equal(state.reload, true);
assert.equal(displayPassageFromViewState(state)?.id, "JHN.1");

state = passageReducer(state, { type: "NAVIGATE", schema: jhn2 });
assert.equal(state.reload, false);
assert.equal(displayPassageFromViewState(state), null);

const slots = buildGridSkeletonSlotIds("skeleton-verse:JHN.2", 25);
assert.equal(slots.slotIds.length, 25);
assert.equal(slots.slotIds[0], "skeleton-verse:JHN.2:1");

console.log("passage-viewstate: ok");
