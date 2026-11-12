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
import { passagePresentation, showOfflineChapterGate } from "../src/bible/viewState/selectors.ts";
import {
  overlayDismissTarget,
  readerSurfaceChrome,
} from "../src/bible/viewState/readerSurfaceChrome.ts";
import { pickerVerseNumberOptions } from "../src/bible/viewState/pickerVerseOptions.ts";
import { planReaderOnStep } from "../src/bible/viewState/planReaderChrome.ts";
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

const openingFast = passagePresentation({
  viewState: { status: "loading", schema: jhn2, reload: false, stalePassage: null },
  loading: true,
  showDeferredUi: false,
});
assert.equal(openingFast.isOpening, true);
assert.equal(openingFast.showOpeningSkeleton, false);
assert.equal(openingFast.statusLine, "idle");

const openingDeferred = passagePresentation({
  viewState: { status: "loading", schema: jhn2, reload: false, stalePassage: null },
  loading: true,
  showDeferredUi: true,
});
assert.equal(openingDeferred.showOpeningSkeleton, true);
assert.equal(openingDeferred.statusLine, "opening");

const reloading = passagePresentation({
  viewState: {
    status: "loading",
    schema: jhn1,
    reload: true,
    stalePassage: sample,
  },
  loading: true,
  showDeferredUi: false,
});
assert.equal(reloading.isReloading, true);
assert.equal(reloading.showOpeningSkeleton, false);
assert.equal(reloading.statusLine, "reload");

const surfaceTools = readerSurfaceChrome({
  pickerOpen: false,
  pickerPanelOpenAllowed: true,
  toolsMenuOpen: true,
  historyOpen: false,
  shareSheetOpen: false,
  verseActionsOpen: false,
});
assert.equal(surfaceTools.passageInputBlocked, true);
assert.equal(surfaceTools.passageSurfaceScrimOpen, true);
assert.equal(surfaceTools.toolsMenuPassThroughDismiss, false);
assert.equal(surfaceTools.scrimIsTools, true);
assert.equal(surfaceTools.scrimIsPickerDismiss, true);
assert.equal(surfaceTools.rootClassPassageRollOpen, false);

const surfacePickerNoCatalog = readerSurfaceChrome({
  pickerOpen: true,
  pickerPanelOpenAllowed: false,
  toolsMenuOpen: false,
  historyOpen: false,
  shareSheetOpen: false,
  verseActionsOpen: false,
});
assert.equal(surfacePickerNoCatalog.passageInputBlocked, false);
assert.equal(surfacePickerNoCatalog.rootClassPassageRollOpen, false);

assert.equal(
  overlayDismissTarget({
    pickerOpen: true,
    pickerPanelOpenAllowed: true,
    toolsMenuOpen: true,
    historyOpen: false,
    shareSheetOpen: false,
    verseActionsOpen: false,
  }),
  "picker",
);

const versesStale = pickerVerseNumberOptions({
  bookId: "JHN",
  chapterId: "2",
  schema: jhn2,
  passageUsfm: "JHN.1",
  passageVerseNumbers: [1, 2, 3],
});
assert.equal(versesStale.length, 25);
assert.equal(versesStale[0], 1);

const versesReady = pickerVerseNumberOptions({
  bookId: "JHN",
  chapterId: "1",
  schema: jhn1,
  passageUsfm: "JHN.1",
  passageVerseNumbers: [1, 2, 51],
});
assert.deepEqual(versesReady, [1, 2, 51]);

assert.equal(
  planReaderOnStep({
    planFocusRef: "Jean 3.16",
    planLabel: "Jean 3",
    bookId: "JHN",
    chapterId: "3",
  }),
  true,
);

assert.equal(
  showOfflineChapterGate({
    passageErrorKind: "offline_not_cached",
    localBundledAvailable: false,
    versesInMemory: false,
  }),
  true,
);

console.log("passage-viewstate: ok");
