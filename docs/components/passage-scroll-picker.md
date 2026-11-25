# Módulo: painel scroll do picker (`BiblePassageScrollPicker`)

| Campo | Valor |
|-------|--------|
| **ID** | `passage-scroll-picker` |
| **Componente** | `BiblePassageScrollPicker` |
| **Tipo** | Componente **controlado** — sem estado de passo interno |
| **Pai** | `renderPassageRoll` em `BibleReaderView` |

Agrega os passos (`book`, `verse`; `chapter` legado) num único painel. Capítulos escolhem-se no **acordeão** do passo `book`.

---

## Resumo

- Retorna `null` se `!open`.
- Classe painel: `bible-yv-passage-scroll-panel is-open is-header-roll is-${step}`.
- Cabeçalho contextual: busca (book), pill de retorno; passo `verse` só no fluxo legacy.
- Grelha `role="listbox"` — no passo `book`, lista + acordeão de capítulos / hits de versículo.

---

## Contrato completo

Ver tipos em `BiblePassageScrollPicker.tsx`:

| Grupo | Props |
|-------|--------|
| Passo | `step`, `open` |
| Contexto | `bookId`, `bookTitle`, `chapterId`, `textVersion` |
| Book | `bookSearchQuery`, `books`, `discovery*`, `discoverySession`, callbacks discovery |
| Chapter/verse | `chapters`, `verseOptions`, `passageChrome`, `highlightVerse`, `verseSelected` |
| Acções | `onPickBook`, `onPickChapter`, `onPickChapterFromBook`, `onJumpVerse`, `onPickVerse`, `onPickJump` |

`forwardRef` no contentor externo para medição/foco no pai.

---

## Comportamento transversal

- **Scroll lista livros:** só passo `book`; restaura scroll da grelha uma vez por abertura.
- **Acordeão capítulos:** sem query de texto, tap no livro expande `bible-yv-pick-chapter-panel` (grelha 5 colunas); `onPickChapterFromBook` → `pickChapter` (fecha no fluxo default).
- **Busca inline:** campo `bible-yv-pick-inline-search` no topo do passo `book` (sem fluxo lupa → ecrã de pesquisa).
- **Perf:** `startTransition` no expand; `memo` na row; mapa estável `chapterIdsByBook`; delegação de clique na grelha; `content-visibility` nas rows.
- **Acordeão versículos:** com query + hits, mantém `bible-yv-pick-verse-panel`.
- **Passo `chapter`:** legado / inalcançável no fluxo canónico (chip capítulo abre `book` + expand do livro actual).
- **Verse grid:** só se `VITE_PASSAGE_PICKER_FLOW` for `legacy`/`verse`/`0`.
- **Empty states:** copy em `PASSAGE_LOADING_COPY` e mensagens FR locais.

---

## Dependências directas

| Filho | Passo |
|-------|--------|
| `BiblePassageDiscoveryList` + acordeão capítulos | book (canónico) |
| Grelha chapter | legado / inalcançável no fluxo default |
| Grelha verse | só fluxo `legacy`/`verse` |

---

## Acessibilidade

`aria-label` do diálogo por passo (liste des livres / chapitres / versets).

---

## Alterações seguras

- Novo passo: extender `PassagePickStep` + ramo JSX + CSS `is-${step}`.
- Props opcionais para analytics.

## Anti-padrões

- Estado `step` interno — quebra sincronização com chips.
- Fetch de passagem dentro do picker.

---

## Ligações

- [passage-roll.md](./passage-roll.md)
- [passage-discovery.md](./passage-discovery.md)
- [barra-seletor-versiculo.md](./barra-seletor-versiculo.md)
