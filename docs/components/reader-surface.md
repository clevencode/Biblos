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
| Abertura / reload | `BibleChapterLoadingPlaceholder` + `presentation.showOpeningSkeleton` |
| Texto pronto | Grelha `.bible-verses` → botões `.bible-verse` |
| Seleção activa | `showCreateCard` → `.bible-verse-actions` (marcas, partilha, flashcard) |

A passagem bloqueia interacção quando overlays estão abertos (`readerSurfaceChrome.passageInputBlocked`).

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

---

## `usePassageViewModel`

- `passageReducer` com estados idle/loading/error e schema skeleton.
- `presentation` = `passagePresentation` — `inFlight`, `showDeferredUi`, `showOpeningSkeleton`, `ariaBusy`, `isOpening`, `isReloading`.
- `commitPassageLoad` / `retryChapter` — única via para trocar capítulo no servidor/offline.
- `onResolved` → histórico (`onBibleRead`), actualiza `bibleId`, etc.
- `active: false` quando tab Bible oculta — incrementa `loadGen` para cancelar loads.

`PASSAGE_LOADING_DEFER_MS` atrasa skeleton visível (evita flash).

---

## Render da passagem

Ordem em `BibleReaderView`:

1. **Head** — `.bible-book-name`, `.bible-chapter-num`
2. **Gate** — se `showOfflineChapterGateUi` (erro `offline_not_cached`)
3. **Skeleton** — `presentation.showOpeningSkeleton`
4. **Versículos** — map `passage.verses`

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

## Cartão de acções (`showCreateCard`)

Aparece com `selection?.length`:

- Marca circular (`CircularColorEditor`, `verseMarks`)
- Partilha → `setShareSheetOpen(true)`
- Flashcard (`makeFlashcard`) se marcado
- `ResizeObserver` define `--verse-actions-sheet-h` no `.bible-reader`

Entra em `readerSurfaceChrome` como `verseActionsOpen` → `forceChromeVisible`.

---

## Chrome de leitura (scroll)

- `chromeHiddenRef` — esconde header/dock ao scroll; `forceChrome` impede quando overlays.
- Tap na passagem com chrome escondido → `setReadingChrome(false, true)`.
- `focusDim` limpa no primeiro scroll do utilizador (`USER_SCROLL_PX`).

---

## Hierarquia cor / profundidade

Definida em `.bible-reader--yv`. Canvas branco ≠ chrome cinza ≠ overlay elevated. Sombras sutis só nos suspensos.

| Camada | Token | Uso |
|--------|--------|-----|
| L0 canvas | `--yv-bg` | Fundo de leitura (branco) |
| L1 chrome | `--yv-chrome-surface` (= `--surface`) | FAB idle, skips, play bar |
| L1 chip | `--yv-overlay-surface` + shadow | Chip ref (primário no topo; search = ghost) |
| L1 quiet | `--yv-muted`, wash `text 6%` | Labels, hover ghost |
| L2 hairline | `--yv-hairline`, `--yv-separator` | Bordas; traço sob o topo |
| L3 overlay | `--yv-overlay-surface` + `--yv-overlay-shadow` | Painéis picker/search, popover |
| L4 emphasis | `--yv-highlight`, `--verse-mark`, inset bar | Marcas / áudio activo |
| L5 inverse | `--yv-audio-fab-active-*` | Play a tocar |
| FAB shadow | `--yv-audio-fab-shadow` / `--bible-chrome-fab-shadow` | Play + skips |

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
