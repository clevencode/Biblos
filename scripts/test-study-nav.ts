/**
 * Navegação de estudo: pilha LIFO + Options pass-through.
 * Usage: npm run test:study-nav
 */
import assert from "node:assert/strict";
import {
  clearStudyJumpSteps,
  popStudyJumpStep,
  pushStudyJumpStep,
  studyJumpReturnOverlay,
  studyJumpTop,
  type StudyJumpReturnTo,
  type StudyJumpStep,
} from "../src/bible/viewState/studyJumpStack.ts";
import { readerSurfaceChrome } from "../src/bible/viewState/readerSurfaceChrome.ts";

function step(n: number, returnTo: StudyJumpReturnTo = "refs"): StudyJumpStep {
  return {
    bookId: "JHN",
    chapterId: String(n),
    verse: n,
    label: `Jean ${n}.${n}`,
    refsScrollTop: n * 10,
    passageScrollTop: n * 100,
    returnTo,
  };
}

/* ——— Study jump stack ——— */
let stack: StudyJumpStep[] = [];
assert.equal(studyJumpTop(stack), null);

stack = pushStudyJumpStep(stack, step(1));
stack = pushStudyJumpStep(stack, step(2));
assert.equal(stack.length, 2);
assert.equal(studyJumpTop(stack)?.verse, 2);

let popped = popStudyJumpStep(stack);
assert.equal(popped.removed?.verse, 2);
assert.equal(popped.stack.length, 1);
assert.equal(studyJumpTop(popped.stack)?.verse, 1);
stack = popped.stack;

popped = popStudyJumpStep(stack);
assert.equal(popped.removed?.verse, 1);
assert.equal(popped.stack.length, 0);

popped = popStudyJumpStep([]);
assert.equal(popped.removed, null);
assert.equal(popped.stack.length, 0);

stack = pushStudyJumpStep([], step(3));
stack = clearStudyJumpSteps();
assert.equal(stack.length, 0);
assert.equal(studyJumpTop(stack), null);

/* ——— Retorno abre a superfície de origem ——— */
assert.deepEqual(studyJumpReturnOverlay(step(1, "refs")), {
  type: "verse_actions",
  selectedVerseIds: ["1"],
});
assert.deepEqual(studyJumpReturnOverlay(step(2, "history")), {
  type: "history",
});
assert.deepEqual(studyJumpReturnOverlay(step(3, "marks")), {
  type: "marks",
});
assert.deepEqual(studyJumpReturnOverlay(step(4, "word_search")), {
  type: "word_search",
});

/* ——— Options pass-through (não bloqueia passagem) ——— */
const surfaceOptions = readerSurfaceChrome({
  pickerOpen: false,
  pickerPanelOpenAllowed: true,
  toolsMenuOpen: false,
  historyOpen: false,
  shareSheetOpen: false,
  verseActionsOpen: true,
});
assert.equal(surfaceOptions.passageInputBlocked, false);
assert.equal(surfaceOptions.forceChromeVisible, true);

const surfaceTools = readerSurfaceChrome({
  pickerOpen: false,
  pickerPanelOpenAllowed: true,
  toolsMenuOpen: true,
  historyOpen: false,
  shareSheetOpen: false,
  verseActionsOpen: false,
});
assert.equal(surfaceTools.passageInputBlocked, true);

console.log("test-study-nav: OK");
