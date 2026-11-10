# Módulo: partilha e histórico de leitura

| Campo | Valor |
|-------|--------|
| **ID** | `share-history` |
| **Componentes** | `BibleShareSheet`, `BibleHistorySheet`, `BibleHistoryPanel` |
| **Dono do estado (leitor)** | `BibleReaderView` (`shareSheetOpen`, `historyOpen`, `shareMode`) |
| **Dados** | `activityLog.ts`, `shareVerse.ts`, `shareVerseCard.ts` |

---

## Resumo

| Superfície | Onde aparece |
|------------|----------------|
| `BibleShareSheet` | Overlay no leitor; modos `verse` e `plan` |
| `BibleHistorySheet` | Menu leitor se `ACTIVITY_UI_ENABLED` |
| `BibleHistoryPanel` | Variante painel (não usada na shell actual) |

Histórico também listado em **Perfil** (`ProfileShellPanel`) e **Accueil** (`HomeShellPanel` resume última leitura).

---

## `BibleShareSheet`

**Props chave:** `open`, `onClose`, `layoutRootRef`, `mode`, `refLabel`, `verseText`, `usfm`, `accentHex`, campos `plan*`.

**Modo verse:**

- Pré-visualização cartão (`renderVerseShareCard`) → blob/imagem.
- Acções: copiar legenda, partilha nativa (`navigator.share`), URL `buildShareUrl`.

**Modo plan:**

- `renderPlanShareBlob`, caption `buildPlanShareCaption`, link `?plan=`.

**Layout:** `ResizeObserver` no sheet → `--bible-share-sheet-measured-h` no `layoutRootRef` (reader) para reservar scroll da passagem.

Entra em `readerSurfaceChrome`: `shareSheetOpen` → scrim, `passageInputBlocked`, dismiss priority `share`.

---

## `BibleHistorySheet`

**Props:** `open`, `onClose`, `onSelect(BibleHistorySelect)`, `onHistoryChange?`.

- Lista `listBibleReadingHistory(undefined, 40)`.
- Apagar item / limpar tudo (confirm).
- `onSelect` no leitor: `loadChapter(bookId, chapterId, verse)`.

Tipo exportado `BibleHistorySelect` — reutilizado na shell (`historyToFocusRef` em `App.tsx`).

---

## `BibleHistoryPanel`

Mesma lógica de parse/label que o sheet, mas embed em `active` tab (refresh quando `active`).

Útil para layouts sem sheet modal; hoje a shell usa lista inline no perfil.

---

## Fluxo de actividade

1. `recordBibleRead` / `onBibleRead` no leitor → `activityLog`.
2. `activityTick` no `App` refresca Home/Profile.
3. Marca de versículo → `appendActivity("verse.mark", ...)`.

`ProfileShellPanel.onOpenPassage` → `openBible(historyToFocusRef(ref))` muda tab Bible + `focusSeq`.

---

## Mapa de ficheiros

| Papel | Caminho |
|-------|---------|
| Partilha UI | `src/components/BibleShareSheet.tsx` |
| Histórico sheet | `src/components/BibleHistorySheet.tsx` |
| Histórico painel | `src/components/BibleHistoryPanel.tsx` |
| Log | `src/activityLog.ts` |
| Partilha | `src/shareVerse.ts`, `shareVerseCard.ts` |
| Boot URL | `consumeShareRefFromUrl` em `App.tsx` |

---

## Acessibilidade

- Escape fecha sheets.
- Botões de apagar com confirmação.
- Partilha: mensagens de estado (`msg`, `previewError`).

---

## Alterações seguras

- Novos modos de partilha estendendo `shareMode`.
- Unificar parse histórico num helper partilhado (hoje duplicado sheet/panel/profile).

## Anti-padrões

- Partilhar sem `usfm` coerente com selecção actual.
- Esquecer `onReadingHistoryChange` após mutação — Home/Profile ficam stale.

---

## Ligações

- [reader-surface.md](./reader-surface.md)
- [app-shell.md](./app-shell.md)
- [passage-roll.md](./passage-roll.md) (dismiss overlays)
