# Módulo: painel scroll do picker (`BiblePassageScrollPicker`)

| Campo | Valor |
|-------|--------|
| **ID** | `passage-scroll-picker` |
| **Componente** | `BiblePassageScrollPicker` |
| **Tipo** | Componente **controlado** — sem estado de passo interno |
| **Pai** | `renderPassageRoll` em `BibleReaderView` |

Agrega os três passos (`book`, `chapter`, `verse`) num único painel. A documentação por passo está nos módulos filhos; este ficheiro descreve o **contrato único** e comportamento transversal.

---

## Resumo

- Retorna `null` se `!open`.
- Classe painel: `bible-yv-passage-scroll-panel is-open is-header-roll is-${step}`.
- Cabeçalho contextual: busca (book), subhead com back (chapter/verse).
- Grelha `role="listbox"` — conteúdo varia por `step`.

---

## Contrato completo

Ver tipos em `BiblePassageScrollPicker.tsx`:

| Grupo | Props |
|-------|--------|
| Passo | `step`, `open` |
| Contexto | `bookId`, `bookTitle`, `chapterId`, `textVersion` |
| Book | `bookSearchQuery`, `books`, `discovery*`, `discoverySession`, callbacks discovery |
| Chapter/verse | `chapters`, `verseOptions`, `passageChrome`, `highlightVerse`, `verseSelected` |
| Acções | `onBack`, `onPickBook`, `onPickChapter`, `onJumpVerse`, `onPickVerse`, `onPickJump`, search handlers |

`forwardRef` no contentor externo para medição/foco no pai.

---

## Comportamento transversal

- **Scroll lista livros:** só passo `book`; restaura `discoverySession.listScrollTop` uma vez por abertura.
- **Chapter grid:** botões numéricos ou `BiblePickGridSkeleton` se `chapters` vazio.
- **Verse grid:** skeleton se `passageChrome.showDeferredUi`; senão map `verseOptions`.
- **Empty states:** copy em `PASSAGE_LOADING_COPY` e mensagens FR locais.

---

## Dependências directas

| Filho | Passo |
|-------|--------|
| `BiblePassageDiscoveryList` | book |
| `BiblePickGridSkeleton` | chapter/verse loading |

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
