# Módulo: superfície de leitura (capítulo)

| Campo | Valor |
|-------|--------|
| **ID** | `reader-surface` |
| **Superfície** | Corpo do leitor: cabeçalho livro/capítulo, versículos, seleção, cartão de acções, estados de carga/offline |
| **Dono do estado** | `BibleReaderView` + `usePassageViewModel` |
| **Raiz DOM** | `section.bible-passage` dentro de `.bible-yv-read-surface` |

---

## Resumo

| Estado UI | Componente / condição |
|-----------|-------------------------|
| Capítulo offline em falta | `BibleOfflineChapterGate` |
| Abertura (boot) | Splash cor até shell estável; sinal = `.bible-yv-top-loading-bar` (sem skeleton de versos) |
| Reload / troca | Barra `.bible-yv-top-loading-bar` + `stalePassage` (texto anterior) |
| Texto pronto | Grelha `.bible-verses` → botões `.bible-verse` |
| Seleção activa | `showCreateCard` → `.bible-verse-actions` (marcas, partilha, flashcard) |

A passagem bloqueia interacção quando overlays estão abertos (`readerSurfaceChrome.passageInputBlocked`).

Navegação de capítulo: `.bible-passage-start-skips` (anterior, após o cabeçalho) + `.bible-passage-end-skips` (seguinte, no fim). Sem swipe; sem FAB ‹ ›. Carga: só barra do topbar; trocas com `stalePassage`.

---

## Mapa de ficheiros

| Papel | Caminho |
|-------|---------|
| Orquestração | `src/components/BibleReaderView.tsx` |
| ViewModel | `src/hooks/usePassageViewModel.ts` |
| Reducer / apresentação | `src/bible/viewState/passageReducer.ts`, `selectors.ts` (`passagePresentation`) |
| Carga | `src/bible/passageRepository.ts` |
| Placeholder | `src/components/BibleChapterLoadingPlaceholder.tsx` |
| Gate offline | `src/components/BibleOfflineChapterGate.tsx` |
| Cor editor | `src/components/CircularColorEditor.tsx` (marcas) |
| Scroll versículo | refs `pendingScrollVerse`, `verseScrollSeq` em `BibleReaderView` |
| Chrome overlay | `src/bible/viewState/readerSurfaceChrome.ts` |
| Study jump (LIFO) | `src/bible/viewState/studyJumpStack.ts` |

---

## Study jump (retorno de estudo)

Pilha LIFO em `studyJumpStack.ts` (`pushStudyJumpStep` / `popStudyJumpStep` / `clearStudyJumpSteps`; hook `useStudyJumpStack`).

- **Push** ao saltar a partir de histórico, marcas, pesquisa ou Référence (origem = passagem actual + `returnTo`).
- **UI** `.bible-study-return-nav` no dock — “voltar” restaura livro/capítulo/verso + scrolls; reabre a superfície de origem (`refs` → Options/Référence; `history` / `marks` / `word_search` → o sheet respectivo, não Options).

Contrato Options: `verseActionsOpen` força chrome visível mas **não** põe `passageInputBlocked` (pass-through). Lista Verset espelha `chapterMarks` (`is-marked`). Ver `npm run test:study-nav`.

---

## `usePassageViewModel`

- `passageReducer` com estados idle/loading/error e schema skeleton.
- `presentation` = `passagePresentation` — `inFlight`, `ariaBusy`, `isOpening`, `isReloading`, `statusLine`.
- `commitPassageLoad` / `retryChapter` — única via para trocar capítulo no servidor/offline.
- `onResolved` → histórico (`onBibleRead`), actualiza `bibleId`, etc.
- `active: false` quando tab Bible oculta — incrementa `loadGen` para cancelar loads.

---

## Render da passagem

Ordem em `BibleReaderView`:

1. **Head** — `.bible-book-name`, `.bible-chapter-num`
2. **Skip anterior** — `.bible-passage-start-skips` (se há conteúdo)
3. **Gate** — se `showOfflineChapterGateUi` (erro `offline_not_cached`)
4. **Versículos** — map `passage.verses` (ou stale durante `inFlight`)
5. **Skip seguinte** — `.bible-passage-end-skips`

### Classes por versículo

| Classe | Condição |
|--------|----------|
| `is-focus` | âncora de foco / seleção |
| `is-in-range` | plano ou highlight intervalo |
| `is-selected` | multi-seleção |
| `is-marked` | marca local (`verseMarks`) |
| `is-dimming` | container quando há seleção |
| `is-passage-focus` | `focusDimActive` (salto picker) |

`selectVerse` — toggle Set; bloqueado com picker/tools/share/history abertos.

### Scroll programático

`pendingScrollVerse` + `useLayoutEffect`: modos `start` | `top`; respeita `showCreateCard` para alinhar versículo sob o sheet de acções.

---

## Secção Options (`showCreateCard` / `verse_actions`)

Abre com overlay `verse_actions` + seleção + texto (não share):

| Peça | Contrato |
|------|----------|
| Sheet | `.bible-verse-actions` full-bleed (lista Verset \| Référence) |
| Topbar | Section pill **Options** — fecho só aqui (+ Escape); sem X no sheet |
| Lista Verset | Outline (underline + dim) — **sem** check circular |
| Bottom nav | `.bible-verse-actions-nav` — Cor · Marquer · Partager; superfície = `--bible-nav-surface` |
| Cor Marquer | `adaptVerseColorForTheme` + `verseActionTone(hex, theme)` → vars no `<nav>` |
| Negócio | Desmarcar o último verso = fechar Options (mesma lógica da passagem); marcar/desmarcar com seleção → aviso, sheet fica |

`readerSurfaceChrome` / `verseActionsOpen`:

- → `forceChromeVisible` (mantém topbar Options)
- **não** entra em `passageInputBlocked` nem `overlayDismissTarget` — **pass-through** para continuar a seleccionar versos na passagem
- `ResizeObserver` define `--verse-actions-sheet-h` no `.bible-reader`

---

## Chrome de leitura (microinterações)

- **Sem hide-on-scroll** — top/dock ficam estáveis; nav shell some só com modal / `:has` (menu, Options, study-return).
- `forceChrome` / `readerSurfaceChrome.forceChromeVisible` — Options e overlays forçam chrome visível.
- Tokens: `--yv-chrome-ms`, `--bible-scrim-ms`, `--bible-press-ms`, `--bible-dim-ms`, `--top-sheet-ease`.
- `focusDim` limpa no primeiro scroll do utilizador (`FOCUS_DIM_CLEAR_PX`).
- Options = pass-through: sem `scale` da passagem; sheets full-bleed = snap (família menu).

---

## Hierarquia cor / profundidade

Definida em `.bible-reader--yv` + shell. **L0 canvas = navbar** (`--bible-nav-surface`); chrome de controlos usa `--surface`.

| Camada | Token | Uso |
|--------|--------|-----|
| L0 canvas / nav | `--yv-bg` = `--bible-nav-surface` (paper/ink) | Fundo de leitura, topbar, Options sheet/nav |
| L1 chrome | `--yv-chrome-surface` (= `--surface`) + border/hover | Search, menu, chip, FAB idle, end-skips |
| L2 overlay | `--yv-overlay-surface` + border + shadow | Painéis picker / word-search / tools |
| L3 inverse | `--yv-audio-fab-active-*` | Play a tocar |
| L4 mark | `--yv-highlight`, `--verse-mark` | Marcas / ênfase no texto |
| FAB shadow | `--yv-audio-fab-shadow` | Play (skips = start/end-of-passage) |

Selecção de versículo = underline (accent); **não** caixa azul de sistema. Cor azul no texto = marca do utilizador (`--verse-mark`).

---

## Contrato com `App`

Props relevantes de `BibleReaderView`:

- `focusRef` / `focusSeq` — deep link da shell ou partilha
- `planReading` — range e dock de plano
- `compactToolsMenu`, `compactViewport` — layout narrow
- `onBibleRead`, `onVerseMarked`, `onReadingChromeChange`

---

## Acessibilidade

- `aria-busy` na passagem conforme `presentation.ariaBusy`
- `inert` quando overlay bloqueia
- Versículos como `button` com rótulos de número
- Live region `passageLiveStatusLabel` no header

---

## Alterações seguras

- Ajustar CSS de foco/plano sem mudar `selectVerse`.
- Novos estados em `passagePresentation` antes de ramificar JSX.

## Anti-padrões

- `loadChapter` sem `commitPassageLoad` / bypass do reducer.
- Ignorar `surfaceChrome` ao permitir clique em versículos.
- Duplicar lógica skeleton fora de `activeSchema` / `presentation`.

---

## Ligações

- [passage-roll.md](./passage-roll.md)
- [share-history.md](./share-history.md)
- [audio-float.md](./audio-float.md)
- [skeleton-architecture.md](../skeleton-architecture.md)
- [bible-offline-first-ui.md](../bible-offline-first-ui.md)
