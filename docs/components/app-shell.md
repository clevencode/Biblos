# Módulo: shell da aplicação

| Campo | Valor |
|-------|--------|
| **ID** | `app-shell` |
| **Raiz** | `App.tsx` → `BiblosConsumerApp` |
| **Navegação** | `AppShellNav` + `shellNav.ts` |
| **Painéis** | `ProfileSettingsPanel` (`#panel-account`), `PlanDiscoverPanel`, `BibleReaderView` |
| **Rota admin** | `EditorialAdminApp` via `hash` `#admin` |

---

## Resumo

Shell com **navbar radial** (`SHELL_TABS`: Bible · Plan).

- Tab persistida em `localStorage` (`biblos-ui`, chave `tab`). Legado `profile` / `home` → Bible.
- Bible montada lazy: `bibleMounted` fica true após primeira visita (preserva estado).
- Modo narrow + tab Bible → `immersiveHidden` na nav (`navHidden` do leitor).
- **Profil + Settings** via hub Conta → `#panel-account` (`ProfileSettingsPanel`: header + grupos).
- **Admin** (email Clevencode) via hub pill → `#panel-admin` (`AdminReadingPlansWorkspace`); fora do Profile.
- **Plan hub** (`PlanDiscoverPanel`): estilo YouVersion Plans — tabs **Mes plans** / **Découvrir** (sem Accueil/Today). Workspace aberto → navbar shell oculta (retorno pelo ← do topbar). Workspace → `openPlanAtJour` → leitor (`planReading`); no leitor, navbar inferior **Retour · Plan** chama `returnFromPlanReading` (volta ao workspace). Note pessoal opcional só no workspace.
- Tema global: `theme.ts` — `onSetTheme` no perfil (clair / sombre / système).

---

## Mapa de ficheiros

| Papel | Caminho |
|-------|---------|
| Composição | `src/App.tsx` |
| Tabs | `src/components/AppShellNav.tsx`, `ModeTabIcon.tsx` |
| Tabs data | `src/shellNav.ts` |
| Profil + Settings | `src/components/profile/ProfileSettingsPanel.tsx` (+ Header / Group / Row) |
| Planos | `src/features/reading-plans/.../PlanDiscoverPanel.tsx` |
| Leitor | `src/components/BibleReaderView.tsx` |
| Histórico / marques | `src/components/BibleHistorySheet.tsx` |
| Layout | `src/layout.ts` (`useNarrow`), classes `app is-bible-mode` |
| Admin editorial | `src/features/editorial-auth/.../EditorialAdminApp.tsx` |
| `AppSettingsPanel` | Existe mas **não** está ligado ao `App` (legado/alternativo) |

---

## `AppShellNav`

**Props:** `active: ShellTab`, `onSelect`, `immersiveHidden?`, `accountOpen?`, `onToggleAccount?`.

- **Hub flutuante** (destino activo / ✕) + **arco radial** (`RadialUiBackdrop`); barra convexa substituída por **fade** full-bleed (`.mode-tabs::before`) para leitura.
- Estado canónico: `shellRadial.ts` → `data-radial-open` / `is-radial-open` no `<html>`.
- Hub = tab activa **ou** Conta (quando o painel de perfil está aberto); arco = restantes (`SHELL_TABS` + Conta/`shell.profile`).
- Escolher Conta no arco abre o painel de perfil; escolher uma tab fecha a conta e muda de vista.
- Classe `is-immersive-hidden` esconde a barra na leitura imersiva.
- Clearance: `--mobile-tabbar-h` ≈ `--mode-tabs-bar-body` + `--mode-tabs-dome-rise` + safe-area.
- Superfície: `--bible-nav-surface` → `--mode-tabs-canvas`.

IDs de painel: `panel-bible`, `panel-plan` (PlanDiscover / workspace), `panel-account`, `panel-admin`.

### Secção Options (verse_actions)

Quando o leitor abre a secção Options (seleção de versículos):

- Shell nav **oculta** (CSS `:has(.bible-verse-actions)`).
- Topbar: section pill **Options** (mesmo padrão search/history/marks) — único fecho (+ Escape).
- Bottom: `.bible-verse-actions-nav` — clone layout do `.mode-tabs` (pill + mat fade), superfície `--bible-nav-surface`; acções Cor · Marquer · Partager.
- Ver [reader-surface.md](./reader-surface.md) (pass-through na passagem).

---

## `ProfileSettingsPanel`

**Props:** `active`, `activityTick`, `themePref`, `onSetTheme`, `onRequestSignIn?`, `readingChrome?`, `onOpenHistory?`, `onOpenMarks?`.

- **Profile header**: avatar / iniciais, nome (editável) ou CTA guest + backup.
- **Settings groups**: Apparence, Langue, Bible, Lecture (font), Bibliothèque, Stockage, Compte, Admin (gated).
- Tipografia / versão / offline via `ProfileReadingChrome` (bridge do `BibleReaderView`).

---

## Orquestração `App`

| Função | Papel |
|--------|--------|
| `selectTab` | `setTab` + `saveShellTab` |
| `openBible(ref?)` | tab bible, `setBibleFocusRef`, incrementa `focusSeq` |
| `startPlanReadingFromWorkspace` / `openPlanAtJour` | inject leitor com `planReading` (+ passage opcional) |
| `returnFromPlanReading` | sai do leitor plano → workspace (resumeSeq) |
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
