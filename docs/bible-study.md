# Bíblia de estudo (âmbito Biblos)

> **État app :** as **références croisées (TSKe)** estão activas no painel de estudo do versículo.
> Strong / Sg1910 foram removidos do projeto.

Recursos suportados na app:

| Recurso | ID | Uso |
|--------|-----|-----|
| Segond 21 | `s21` | Texto principal, áudio, offline, busca |
| Haïtienne 1998 | `ht98` | Texto (`/bibles/ht1998.json`) |
| Références croisées | TSKe | Painel « Référence croisée » (`/bible/study/tske/{USFM}.{ch}.json`) |
| Diksyonè Kreyòl Vilsen | `ht-vilsen` | Pressão longa numa palavra do HT98 (`/bible/study/dict/ht-vilsen.json`) |

## Gerar e incluir no deploy

O ficheiro `estudo-biblia-compilado.txt` **não** vai para o git. Extração local (só TSKE):

```bash
npm run bible:study:export
npm run bible:study:stage
```

- `data/bible/study/tske/` — **versionado** (necessário para Vercel/APK)
- `public/bible/study/` — gerado no `npm run build` via `stage-study-assets.mjs`

`npm run build` e `build:mobile` já correm o stage de study depois do S21.

## Offline (refs croisées)

| Camada | Comportamento |
|--------|----------------|
| Leitura | `loadTskeChapter`: RAM → fetch asset (APK / Cache Storage) |
| PWA | Workbox `CacheFirst` em `/bible/study/tske/` |
| Manifest | `public/bible/study/tske/manifest.json` gerado no stage |

Sem rede, as refs usam assets Capacitor ou o cache HTTP da PWA.

## Licenças

- Sg1910 / TSKe: conforme as fontes MySword / concordance.bible referenciadas no compilado.
- Diksyonè Kreyòl Vilsen: © Educa Vision Inc., todos os direitos reservados; uso decidido pelo mantenedor (app sem fins lucrativos, público restrito, sem indexação). Atribuição visível em cada definição. Detalhes: `data/bible/study/dict/README.md`.
- Não incluir Nave, ISBE, LSG paralelo, interlinear ou outros módulos fora deste âmbito.

## Dicionário kreyòl (HT98)

| Peça | Ficheiro |
|------|----------|
| Dados (10 773 entradas, versionados) | `data/bible/study/dict/ht-vilsen.json` — gerado por `npm run dict:import` a partir do repo privado `clevencode/dicvilsen` |
| Grafia HT98 → lema | `data/bible/study/dict/ht-aliases.json` (só pares verificados pelo gloss) |
| Stage / PWA | `stage-study-assets.mjs` copia para `public/bible/study/dict/`; Workbox `CacheFirst` `biblos-dict-json` |
| Lookup | `src/bible/htDictionary.ts` — lema (acento exato primeiro) › alias › contração (`m'` → mwen…) › expressões de várias palavras presentes no versículo |
| Gesto | `src/hooks/useWordLongPress.ts` + `src/bible/wordAtPoint.ts` — 450 ms; o toque curto continua a selecionar o versículo |
| UI | `src/components/WordDefinitionSheet.tsx` (overlay `word_definition`) |

- Só activo com `ht98` e com o asset presente (sem asset → gesto desligado, nada muda).
- Com o dicionário activo, o texto HT98 não abre a seleção nativa do sistema; copiar continua no menu do versículo.
- Cobertura medida no HT98: 74,6% das ocorrências (`npm run test:ht-dictionary` falha se descer).
- Os glosses vêm de OCR e podem ter ruído; correções fazem-se no repo `dicvilsen` e voltam com `dict:import`.

## Backlog (ideia) — refs cruzadas deuterocanônicas

> **Não implementar agora.** Apenas mapa de encaixe para decisão futura.

### O que é possível hoje

| Peça | Estado |
|------|--------|
| Texto DC | Só em **HT98** (`TOB`, `JDT`, `WIS`, `SIR`, `BAR`, `1MA`, `2MA`, … — ver [`searchTestamentSets.ts`](../src/bible/searchTestamentSets.ts)) |
| Busca DC | Pill / filtro `dc` na word-search (HT98) |
| Painel estudo | [`VerseStudyDrawer`](../src/components/VerseStudyDrawer.tsx) → [`loadVerseStudy`](../src/bible/studyQueries.ts) → TSKe |
| Offline TSKe | Pack IndexedDB + assets `data/bible/study/tske/` (cânon protestante 66 livros) |
| Preview da ref | [`crossRefPassageText`](../src/bible/crossRefPassageText.ts) na versão ativa (`s21` / `ht98`) |

Em S21, livros DC **não existem** no texto; o estudo de um versículo S21/HT (AT/NT) já mostra refs TSKe para o cânon de 66 livros.

### O que o TSKe **não** cobre

O pack TSKe embutido **não tem** capítulos fonte deuterocanônicos (`TOB.*`, `WIS.*`, etc.). O TSK clássico indexa o cânon protestante; abrir estudo em Tobie/Sagesse no HT98 → capítulo TSKe ausente → `unavailable` / lista vazia.

Também faltam aliases USFM DC em [`usfm.ts`](../src/youversion/usfm.ts) se alguma fonte citar `Tob`, `Wis`, `Sir`, …

### Encaixe recomendado (quando for prioridade)

```mermaid
flowchart TD
  verse[Versículo aberto]
  version{Versão ativa}
  tske[Pack TSKe 66 livros]
  dcPack[Pack DC xrefs separado]
  panel[VerseStudyDrawer]
  text[Texto da versão para preview]

  verse --> version
  version -->|s21 ou AT/NT| tske
  version -->|ht98 e livro DC| dcPack
  tske --> panel
  dcPack --> panel
  panel --> text
```

1. **Fonte de dados** — dataset DC dedicado (ex. [Catholic Cross-References](https://github.com/jesuslovestyler/Catholic-Cross-References), domínio público), **não** misturar dentro dos JSON TSKe atuais.
2. **Formato interno** — normalizar para o mesmo contrato que TSKe (`body` / `refs` → `parseTskeBody` ou parser irmão) + stage em `data/bible/study/dc-xrefs/` (nome a definir).
3. **Loader** — em `loadVerseStudy` / `studyQueries`: se `isDcBook(bookId)` e versão com DC (HT98), ler pack DC; senão TSKe.
4. **Aliases** — mapear abreviações DC → USFM em `usfm.ts` / `knownBookCode`.
5. **Offline** — espelhar o padrão `idbTskeCache` + manifest (pack opcional no first-install HT, ou sob pedido).
6. **UX** — mesmo painel « Référence croisée »; sem segunda UI. Em S21, DC continua inexistente (só links *para* DC fariam sentido se o preview falhar → já há `study.refUnavailable`).

### Fora de âmbito deste backlog

- Reescrever o TSKe protestante
- Mostrar refs DC como se fossem TSKe
- Léxico / estudo lexical para livros DC (fora do escopo actual)
- Implementação ou ETL nesta entrega

### Ficheiros que tocariam numa implementação futura

- [`src/bible/studyQueries.ts`](../src/bible/studyQueries.ts) — escolha TSKe vs pack DC
- [`src/bible/tske.ts`](../src/bible/tske.ts) / novo `dcXrefs.ts` — parse + load
- [`src/bible/searchTestamentSets.ts`](../src/bible/searchTestamentSets.ts) — IDs DC (já existem)
- [`src/youversion/usfm.ts`](../src/youversion/usfm.ts) — aliases
- `data/bible/study/` + `stage-study-assets` + offline pack
- [`docs/bible-product-scope.md`](./bible-product-scope.md) — promover de backlog a «incluído» só após ship
