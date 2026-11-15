# Módulo: shell da aplicação

| Campo | Valor |
|-------|--------|
| **ID** | `app-shell` |
| **Raiz** | `App.tsx` → `BiblosConsumerApp` |
| **Navegação** | `AppShellNav` + `shellNav.ts` |
| **Painéis** | `HomeShellPanel` (+ `HomeConfigSection`), `PlanDiscoverPanel`, `BibleReaderView` |
| **Rota admin** | `EditorialAdminApp` via `hash` `#admin` |

---

## Resumo

Shell em **tablist** com três onglets (`SHELL_TABS`): Accueil, Bible, Plan.

- Tab persistida em `localStorage` (`biblos-ui`, chave `tab`). Legado `profile` → `home`.
- Bible montada lazy: `bibleMounted` fica true após primeira visita (preserva estado).
- Modo narrow + tab Bible → `immersiveHidden` na nav (`navHidden` do leitor).
- **Config de conta/app** na Home (`HomeConfigSection`: conta, idioma, tema, storage health, admin).
- **Experiência de leitura** no leitor (menu + `BibleHistorySheet`: versão, fonte, offline, surlignages, histórico).
- Tema global: `theme.ts` — `onSetTheme` na Home; `onCycleTheme` no leitor.

---

## Mapa de ficheiros

| Papel | Caminho |
|-------|---------|
| Composição | `src/App.tsx` |
| Tabs | `src/components/AppShellNav.tsx`, `ModeTabIcon.tsx` |
| Tabs data | `src/shellNav.ts` |
| Accueil + config | `src/components/HomeShellPanel.tsx`, `HomeConfigSection.tsx` |
| Planos | `src/features/reading-plans/.../PlanDiscoverPanel.tsx` |
| Leitor | `src/components/BibleReaderView.tsx` |
| Histórico / marques | `src/components/BibleHistorySheet.tsx` |
| Layout | `src/layout.ts` (`useNarrow`), classes `app is-bible-mode` |
| Admin editorial | `src/features/editorial-auth/.../EditorialAdminApp.tsx` |
| `AppSettingsPanel` | Existe mas **não** está ligado ao `App` (legado/alternativo) |

---

## `AppShellNav`

**Props:** `active: ShellTab`, `onSelect`, `immersiveHidden?`.

- Pill horizontal flutuante (`.mode-tabs-pill`) com as **3 tabs** sempre visíveis (Home · Bible · Plan).
- Sem hub, arco radial, `RadialUiBackdrop` nem `ConvexBottomBarSurface`.
- `role="tablist"`, tabs com `aria-controls={`panel-${id}`}`; activa = segmento invertido.
- Setas ←/→ mudam tab e movem foco.
- Classe `is-immersive-hidden` esconde a barra na leitura imersiva.
- Clearance: `--mobile-bottom-chrome` = pillH + floatGap + safe-area.

IDs de painel: `panel-home`, `panel-bible`, `PlanDiscoverPanel` com `panel-today`.

---

## `HomeShellPanel`

**Props:** `active`, `activityTick`, `themePref`, `onSetTheme`, `onOpenBible(ref?)`, `onOpenPlan`, `onResumePlan`, `onRequestSignIn?`.

- Saudação horária; cartão **Reprendre** com última leitura (`listBibleReadingHistory`).
- Teaser planos → `onOpenPlan` muda tab `today`.
- `HomeConfigSection`: conta (auth/export), preferências (idioma/tema), saúde do storage, admin embutido.

---

## Orquestração `App`

| Função | Papel |
|--------|--------|
| `selectTab` | `setTab` + `saveShellTab` |
| `openBible(ref?)` | tab bible, `setBibleFocusRef`, incrementa `focusSeq` |
| `openPlanReading` | inject leitor com `planReading` |
| `handleVerseMarked` | `setVerseMarks` + activity |
| Share boot | `consumeShareRefFromUrl` uma vez |

Classes workspace: `is-mobile-vista`, `is-bible-compact-tools` quando `BIBLE_COMPACT_TOOLS_MENU && narrow`.

---

## Acessibilidade

- Skip link `#workspace`
- Toast offline `role="status"`
- Tabpanels `hidden={!active}`, `aria-labelledby` por tab

---

## Alterações seguras

- Novo tab: extend `ShellTab`, `SHELL_TABS`, painel com id `panel-*`, entrada no nav.
- Feature flags na shell sem tocar no leitor.

## Anti-padrões

- Desmontar `BibleReaderView` ao sair da tab — usar `hidden` + `active` prop.
- Ignorar `focusSeq` ao reabrir mesma referência.
- Voltar a pôr Profil na navbar — config fica na Home; leitura no leitor.
- Restaurar o radial / wave convex sem actualização de clearance e docs.

---

## Ligações

- [share-history.md](./share-history.md)
- [reader-surface.md](./reader-surface.md)
- [reading-plans-firestore.md](../reading-plans-firestore.md)
