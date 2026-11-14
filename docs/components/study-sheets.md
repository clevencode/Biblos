# Módulo: folhas de estudo e busca

| Campo | Valor |
|-------|--------|
| **ID** | `study-sheets` |
| **Componentes** | `BibleStudySheet`, `BibleSearchSheet` |
| **Montagem actual** | Estudo via painel de verso (`VerseStudyDrawer` / `loadVerseStudy`); folhas standalone opcionais |

> Strong / Sg1910 foram **removidos** do projeto. Ver [bible-study.md](../bible-study.md).

---

## Resumo por folha

| Folha | Função | Dados |
|-------|--------|--------|
| `BibleStudySheet` | Referências cruzadas (TSKe) por versículo | `loadVerseStudy` |
| `BibleSearchSheet` | Busca global AT/NT/livro, saltos de referência | `searchVersesForVersion`, `passageJumpsFromQuery` |

Padrão comum: `open` + `onClose`, Escape global, `useId` para títulos, `reqGen` anti-race.

---

## `BibleStudySheet`

**Props:** `bookId`, `chapterId`, `verse`, `refLabel`, `onOpenRef(usfm)`.

- `loadVerseStudy` ao abrir; lista `RefList` com botões por `TskeRef`.
- Estados: `busy`, `error`, `bundle`.

**Integração:** menu estudo no leitor ou gesto em versículo; `onOpenRef` deve chamar `loadChapter` parseando USFM.

---

## `BibleSearchSheet`

**Props:** `open`, `onClose`, `onSelect(hit)`, `textVersion?` (default `s21`).

Ver implementação em `src/components/BibleSearchSheet.tsx`.

---

## Ficheiros

| Área | Path |
|------|------|
| Estudo TSKE | `src/bible/studyQueries.ts`, `src/bible/tske.ts` |
| Busca | `src/bible/verseIndexCache.ts`, worker de busca |
