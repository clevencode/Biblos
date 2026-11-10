# Módulo: folhas de estudo e busca

| Campo | Valor |
|-------|--------|
| **ID** | `study-sheets` |
| **Componentes** | `BibleStudySheet`, `BibleStrongSheet`, `BibleSearchSheet` |
| **Montagem actual** | **Não importados** em `BibleReaderView` — módulos prontos para ligação |

> Ver [bible-study.md](../bible-study.md): Strong/TSKe estavam **desactivados** na UI; dados e scripts ETL mantêm-se.

---

## Resumo por folha

| Folha | Função | Dados |
|-------|--------|--------|
| `BibleStudySheet` | Referências cruzadas (TSKe) por versículo | `loadVerseStudy` |
| `BibleStrongSheet` | Entrada léxico Strong (H/G) | `fetchStrongLexiconEntry` |
| `BibleSearchSheet` | Busca global AT/NT/livro, saltos de referência | `searchVersesForVersion`, `passageJumpsFromQuery` |

Padrão comum: `open` + `onClose`, Escape global, `useId` para títulos, `reqGen` anti-race.

---

## `BibleStudySheet`

**Props:** `bookId`, `chapterId`, `verse`, `refLabel`, `onOpenRef(usfm)`.

- `loadVerseStudy` ao abrir; lista `RefList` com botões por `TskeRef`.
- Estados: `busy`, `error`, `bundle`.

**Integração prevista:** menu estudo no leitor ou gesto em versículo; `onOpenRef` deve chamar `loadChapter` parseando USFM.

---

## `BibleStrongSheet`

**Props:** `open`, `code` (ex. H7225), `lemma?`, `onClose`.

- Fetch local JSON em `public/bible/study/strong/`.
- UI: código formatado, tipo lexique (BDB/Thayer), corpo HTML/texto da entrada.

**Integração prevista:** toque em palavra Strong no texto SG1910 (quando versão reactivada).

---

## `BibleSearchSheet`

**Props:** `open`, `onClose`, `onSelect(hit)`, `textVersion?` (default `s21`).

Funcionalidades:

- Scope `all` | `at` | `nt` + picker de livro (`booksInScope`).
- Saltos imediatos via `passageJumpsFromQuery` (como discovery).
- Debounce busca; lista com `BibleSearchHighlight`.
- Painel autocontido com foco no input ao abrir.

**Integração prevista:** item no menu tools do leitor; `onSelect` → mesmo fluxo que `pickVerseSearchHit`.

---

## Mapa de ficheiros

| Papel | Caminho |
|-------|---------|
| TSKe UI | `src/components/BibleStudySheet.tsx` |
| Strong UI | `src/components/BibleStrongSheet.tsx` |
| Busca UI | `src/components/BibleSearchSheet.tsx` |
| Queries | `src/bible/studyQueries.ts`, `strongLexicon.ts` |
| Busca | `src/bible/passageForVersion.ts` |
| Destaque | `src/components/BibleSearchHighlight.tsx` |

---

## Acessibilidade (comum)

- Fecho Escape.
- Títulos com `aria-labelledby`.
- Listas de resultados com `role="listbox"` / `option` onde aplicável.

---

## Alterações seguras

- Ligar folhas ao leitor via estado `studyOpen` / `searchOpen` espelhando `shareSheetOpen`.
- Feature-flag por versão de texto antes de mostrar Strong.

## Anti-padrões

- Duplicar busca da folha e do picker discovery sem partilhar `discoverPassageQuery`.
- Assumir folhas montadas — grep imports antes de QA.

---

## Ligações

- [bible-study.md](../bible-study.md)
- [passage-discovery.md](./passage-discovery.md)
- [reader-surface.md](./reader-surface.md)
