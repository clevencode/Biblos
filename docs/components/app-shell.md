# Módulo: shell da aplicação

| Campo | Valor |
|-------|--------|
| **ID** | `app-shell` |
| **Raiz** | `App.tsx` → `BiblosConsumerApp` |
| **Navegação** | `AppShellNav` + `shellNav.ts` |
| **Painéis** | `HomeShellPanel`, `PlanDiscoverPanel`, `BibleReaderView`, `ProfileShellPanel` |
| **Rota admin** | `EditorialAdminApp` via `hash` `#admin` |

---

## Resumo

Shell em **tablist** com quatro onglets (`SHELL_TABS`): Accueil, Plan, Bible, Profil.

- Tab persistida em `localStorage` (`biblos-ui`, chave `tab`).
- Bible montada lazy: `bibleMounted` fica true após primeira visita (preserva estado).
- Modo narrow + tab Bible → `immersiveHidden` na nav (`navHidden` do leitor).
- Tema global: `theme.ts` + `onCycleTheme` no perfil e leitor.

---

## Mapa de ficheiros

| Papel | Caminho |
|-------|---------|
| Composição | `src/App.tsx` |
| Tabs | `src/components/AppShellNav.tsx`, `ModeTabIcon.tsx` |
| Tabs data | `src/shellNav.ts` |
| Accueil | `src/components/HomeShellPanel.tsx` |
| Planos | `src/features/reading-plans/.../PlanDiscoverPanel.tsx` |
| Perfil | `src/components/ProfileShellPanel.tsx` |
| Leitor | `src/components/BibleReaderView.tsx` |
| Layout | `src/layout.ts` (`useNarrow`), classes `app is-bible-mode` |
| Admin | `src/features/editorial-auth/.../EditorialAdminApp.tsx` |
| `AppSettingsPanel` | Existe mas **não** está ligado ao `App` (legado/alternativo) |

---

## `AppShellNav`

**Props:** `active: ShellTab`, `onSelect`, `immersiveHidden?`.

- `role="tablist"`, tabs com `aria-controls={`panel-${id}`}`.
- Setas ←/→ rotacionam tab e movem foco.
- Classe `is-immersive-hidden` esconde barra na leitura imersiva.

IDs de painel: `panel-home`, `panel-bible`, `PlanDiscoverPanel` com `panel-today`, `panel-profile`.

---

## `HomeShellPanel`

**Props:** `active`, `activityTick`, `onOpenBible(ref?)`, `onOpenPlan`.

- Saudação horária; cartão **Reprendre** com última leitura (`listBibleReadingHistory`).
- Teaser planos → `onOpenPlan` muda tab `today`.

---

## `ProfileShellPanel`

**Props:** `active`, `activityTick`, `themePref`, `onCycleTheme`, `onOpenPassage`, `onHistoryChange`.

- Link `#admin` para CMS planos.
- Tema, histórico local (12 itens), limpar histórico.
- Dados «sur cet appareil» — sem cloud de perfil.

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

---

## Ligações

- [share-history.md](./share-history.md)
- [reader-surface.md](./reader-surface.md)
- [reading-plans-firestore.md](../reading-plans-firestore.md)
