# Resumo do trabalho — 13 de novembro de 2026

Documento de registo do que foi feito nesta sessão no **BiblosApp** (web / PWA / Capacitor). Commits principais no `master`: `8e4d3c2` … `4e01dfa` (e alterações locais de polish admin ainda por commit se existirem).

---

## 1. Navegação convex (barra inferior / hub)

**Objectivo:** roleta de tabs mais suave e UI mínima alinhada à topbar.

| Tema | O que mudou |
|------|-------------|
| Animação | Saída da roleta ~260–280 ms (ease suave); entrada mais longa (~480 ms). |
| Visual | Sem frost/blur opaco na barra; stroke oculto; itens do arco sem borda/sombra (activo só com tint). |
| Hub | Aberto igual ao idle; ícone intermédio (ex. fechar) em vez de repetir a tab activa; toque fora continua a fechar. |

**Ficheiros típicos:** `AppShellNav.tsx`, `ConvexBottomBarSurface.tsx`, `index.css` (mode-tabs / convex).

---

## 2. Auth de consumidor (Google) e sessão

**Objectivo:** login público só Google; sessão persistente até logout manual; UX de soft-gate e erros.

| Tema | O que mudou |
|------|-------------|
| Persistência | `browserLocalPersistence`; boot espera o primeiro `onAuthStateChanged` antes de criar anónimo — evita sobrescrever a sessão Google ao reabrir a app. |
| Soft-gate | Gate de marcas só depois de `authReady` / sessão ≠ `initializing`. |
| Erros | Mapa Firebase → mensagens i18n (`mapAuthErrorToMessage`). |
| Logout | Confirmação localizada (+ aviso offline) no perfil. |
| Onboarding | Portal / z-index / i18n; nome não pedido a cada login (`onboardedAt` / nome persistido). |
| Admin CMS | Continua e-mail/senha em `editorial-auth` (`#admin`); público = Google only. |

**Ficheiros típicos:** `useConsumerAuth.tsx`, `consumerFirebaseAuth.ts`, `SignInModal.tsx`, `ProfileOnboarding.tsx`, `App.tsx`.

---

## 3. Perfil — tabs, conta, preferências

**Objectivo:** conteúdo do perfil em tabs activas; menos ruído na conta.

| Tema | O que mudou |
|------|-------------|
| Tabs | Conta / Préfs / Stockage / Historique (+ **Admin** só para o email admin). |
| Scroll | Tabs com scroll horizontal; tab activa entra na vista. |
| Sync UI | Removida a linha/badge de synchronisation na conta. |
| Export JSON | Só para utilizador **sem** login (guest). |
| Historique | Inclui versículos marcados + histórico de leitura. |
| Idioma | Français / Kreyòl nas Préfs; ao mudar, a versão bíblica acompanha (S21 ↔ HT98). |
| Share | Deduplicação de URL no texto partilhado do verso. |

**Ficheiros típicos:** `ProfileShellPanel.tsx`, `uiCopy.ts`, `shareVerse.ts`, prefs de versão bíblica.

---

## 4. Admin editorial (CMS de planos) no perfil

**Objectivo:** CMS embutido no separador Admin (sem depender só de `#admin`); fluxo claro criar / ver / editar.

| Tema | O que mudou |
|------|-------------|
| Entrada | Separador **Admin** só se `isAuthenticated && isClevencodeAdminEmail`. |
| Hub | Dois CTAs: **Créer un plan** e **Voir les plans**. |
| Modal única | Grelha e editor no **mesmo** modal (sem empilhar); «← Plans» volta à lista. |
| Wizard UI | Progresso em 3 etapas de **UI** (não as etapas do plano): Identité → Contenu → Publication — criação **e** edição. |
| Slug | Campo slug bloqueado removido do formulário; em edição o ID Firestore fica **fixo** (título pode mudar sem migrar doc). |
| Ícone shell | Tab Plan: `Library` → `CalendarCheck` (ritmo diário de leitura). |

**Ficheiros típicos:** `AdminReadingPlansWorkspace.tsx`, `AdminPlanEditor.tsx`, `editorial-admin.css`, `ModeTabIcon.tsx`, `ProfileShellPanel.tsx`.

**Nota:** `#admin` full-page (`EditorialAdminApp`) mantém-se para deep link / gate e-mail+senha.

---

## 5. Motor de busca (S21 / HT98)

**Problema:** com a Bíblia offline incompleta, o índice S21 podia ficar com **0 versículos** e a UI mostrava “vazio” em vez de erro ou resultados.

| Tema | O que mudou |
|------|-------------|
| Índice S21 | Se o pack offline não está completo, indexa a partir do **bundle** `/bible/s21/books/*.json` (após `stage-bible-assets`). |
| Erros | Índice vazio / falha de build → `ok: false` com mensagem clara (`localVerseSearch`). |

**Ficheiros típicos:** `verseIndexCache.ts`, `localVerseSearch.ts`, `bibleS21Canon.ts`.

---

## 6. Referências cruzadas (TSKe) no deploy

**Problema:** `npm run build` não fazia stage do study; `data/bible/study/` e `public/bible/` estavam ignorados → no Vercel/APK o fetch de `/bible/study/tske/…` caía em 404/HTML e a UI fingia “sem refs”.

| Tema | O que mudou |
|------|-------------|
| Dados | `data/bible/study/tske/**` **versionado** (~1224 JSON). |
| Build | `stage-study-assets.mjs` corre em `build` e `build:mobile` (TSKE obrigatório; strong/sg1910 opcionais). |
| UX | Distinção **capítulo indisponível** (`study.loadError`) vs **versículo sem refs** (`study.refsEmpty`). |
| Docs | `docs/bible-study.md` actualizado (TSKe activo na UI). |

**Commit:** `4e01dfa`.

---

## 7. Commits do dia (ordem aproximada)

1. Hub / ícone intermédio na roleta  
2. Convex navbar UI  
3. Timing de saída da roleta  
4. UI mínima da barra  
5. Remoção do frost/blur  
6. Tabs internas do perfil  
7. Idioma Préfs ↔ versão bíblica  
8. Separador Admin só para admin  
9. CMS embutido + hub + modais + wizard + scroll de tabs (`216288d`)  
10. Busca bundle + TSKE no deploy (`4e01dfa`)  

Ícone Plan (`CalendarCheck`) e polish fino do modal admin (sticky progresso/nav, copy) podem estar no mesmo commit de busca ou ainda locais — verificar `git status` se necessário.

---

## 8. Como verificar rapidamente

| Área | Smoke test |
|------|------------|
| Sessão | Login Google → fechar app → reabrir → continua autenticado; só sai com «Se déconnecter». |
| Perfil | Tabs com scroll; guest vê export JSON; admin vê tab Admin. |
| Admin | Créer → wizard 3 passos → publicar; Voir → grelha → editar no mesmo modal. |
| Busca | Sem pack offline completo, pesquisar uma palavra em S21 → hits (não lista vazia silenciosa). |
| TSKe | Após deploy: `GET /bible/study/tske/JHN.3.json` → JSON; painel de estudo no verso mostra refs ou erro de carga. |

```bash
npm run bible:study:stage   # local
npm run build               # inclui stage S21 + TSKE
```

---

## 9. Fora de âmbito / follow-ups úteis

- Strong / Sg1910: ETL local, não obrigatório no deploy.  
- Facetas da busca vs escopo filtrado (pills): alinhamento fino opcional.  
- Docs de componentes (`docs/components/*`) ainda não reflectem o hub admin embutido — actualizar se o time usar esses docs como fonte de verdade.  
- `#admin` vs tab Admin: dois caminhos para o mesmo workspace; documentar política (só admin email).

---

## 10. Addendum — TSKe offline

Após o commit `4e01dfa`: pack IndexedDB + CacheFirst PWA + download junto com a Bible hors ligne; ver `docs/bible-study.md` § Offline.

## 11. Addendum — cartão Install 1.ª visita

O mesmo `.sw-update-banner` mostra **Installer Biblos hors ligne** na 1.ª entrada até o pack estar completo: S21 + HT98 + TSKE + warm dos planos (`src/offline/firstInstallPack.ts`).

---

*Gerado a partir da sessão de trabalho de 13/11/2026.*
