/**
 * Simulação headless — salto, prefetch, troca de versão, cross-ref.
 * Executar: npx tsx src/bible/navigation-flow/example.ts
 */

import { createNavigationFlowEngine } from "./core/navigation.machine";
import type {
  BookManifest,
  NavigationDataAdapter,
  VerseNode,
} from "./contracts/navigation.contract";
import { encodeUsfmId, formatUsfmRef } from "./core/usfm.codec";

const DEMO_MANIFEST: BookManifest[] = [
  {
    bookId: 1,
    code: "GEN",
    name: "Gênesis",
    direction: "ltr",
    versesPerChapter: [31, 25, 24],
  },
  {
    bookId: 40,
    code: "MAT",
    name: "Mateus",
    direction: "ltr",
    versesPerChapter: [25, 23],
  },
];

function makeAdapter(): NavigationDataAdapter {
  return {
    async fetchChapter(_version, bookId, chapter) {
      const book = DEMO_MANIFEST.find((b) => b.bookId === bookId);
      const count = book?.versesPerChapter[chapter - 1] ?? 0;
      const nodes: VerseNode[] = [];
      for (let v = 1; v <= count; v += 1) {
        nodes.push({
          usfmId: encodeUsfmId(bookId, chapter, v),
          bookId,
          chapter,
          verse: v,
          text: `Demo ${book?.code}.${chapter}.${v}`,
          crossRefs:
            bookId === 1 && chapter === 1 && v === 1
              ? [encodeUsfmId(40, 1, 1)]
              : undefined,
        });
      }
      await new Promise((r) => setTimeout(r, 5));
      return nodes;
    },
  };
}

async function main() {
  const engine = createNavigationFlowEngine({
    adapter: makeAdapter(),
    manifest: DEMO_MANIFEST,
    initialVersion: "demo",
    initialUsfmId: encodeUsfmId(1, 1, 1),
  });

  engine.subscribe((s) => {
    console.log(
      `[nav] ${s.version} ${formatUsfmRef(s.usfmId)} verses=${s.verses.length} anchor=${s.anchorUsfmId} stack=${s.crossRefDepth} seq=${s.requestSequenceId}`,
    );
  });

  await new Promise((r) => setTimeout(r, 20));
  await engine.stepChapter("next");
  await engine.jumpTo(encodeUsfmId(40, 1, 1), {
    pushHistory: true,
    label: "GEN 1.1",
  });
  await engine.switchVersion("demo-b");
  engine.updateScrollAnchor(encodeUsfmId(40, 1, 14));
  await engine.popCrossReference();
  console.log("done", engine.getState().usfmId);
}

void main();
