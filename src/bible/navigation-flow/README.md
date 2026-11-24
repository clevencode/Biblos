# Navigation Flow Engine (Biblos)

Motor headless de navegação espacial + USFM `BBCCCVVV`.

## Uso rápido

```ts
import {
  createNavigationFlowEngine,
  createBiblosPassageAdapter,
  buildBiblosManifest,
  encodeUsfmId,
} from "./navigation-flow";

const engine = createNavigationFlowEngine({
  adapter: createBiblosPassageAdapter(() => "s21"),
  manifest: buildBiblosManifest(books),
  initialVersion: "s21",
  initialUsfmId: encodeUsfmId(43, 3, 16), // JHN 3.16
});

engine.subscribe((state) => {
  // ligar à UI (React/Vue/Vanilla)
});

await engine.stepChapter("next");
await engine.jumpTo(encodeUsfmId(1, 1, 1), { pushHistory: true });
await engine.switchVersion("ht98"); // preserva anchor
```

## Exemplo

```bash
npx tsx src/bible/navigation-flow/example.ts
```
