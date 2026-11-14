# Resumo do trabalho — 13 de novembro de 2026

Registo do trabalho no **BiblosApp** (web / PWA / Capacitor) nesta data.

**Intervalo de commits:** `44c4bdb` → `a366b41` (tudo em `origin/master`).

---

## Visão geral

| Área | Resultado |
|------|-----------|
| Nav convex | Roleta mais suave, UI mínima, hub com ícone de fechar |
| Auth | Sessão Google persistente até logout manual; soft-gate e erros i18n |
| Perfil | Tabs activas + scroll; Admin só para admin; menos ruído na conta |
| CMS planos | Hub Créer/Voir, modal única, wizard UI Identité→Contenu→Publication |
| Busca | Índice S21 a partir do bundle se offline incompleto |
| TSKe | Dados no git + stage no build; cache IndexedDB + PWA CacheFirst |
| 1.ª visita | Mesmo cartão do SW update → **Installer** (S21 + HT98 + TSKE + planos) |

---

## 1. Navegação convex (barra inferior / hub)

| Tema | O que mudou |
|------|-------------|
| Animação | Saída ~260–280 ms (ease suave); entrada ~480 ms |
| Visual | Sem frost/blur; stroke oculto; arco sem borda/sombra (activo só com tint) |
| Hub | Aberto = idle; ícone intermédio (fechar); toque fora fecha |

**Ficheiros:** `AppShellNav.tsx`, `ConvexBottomBarSurface.tsx`, `index.css`.

---

## 2. Auth de consumidor (Google) e sessão

| Tema | O que mudou |
|------|-------------|
| Persistência | `browserLocalPersistence`; boot espera o 1.º `onAuthStateChanged` antes de anónimo |
| Soft-gate | Só após `authReady` (não durante `initializing`) |
| Erros | `mapAuthErrorToMessage` + i18n |
| Logout | Confirmação localizada (+ aviso offline) |
| Onboarding | Portal/i18n; nome não pedido a cada login |
| Público vs admin | Google only no consumer; e-mail/senha só em `#admin` |

**Ficheiros:** `useConsumerAuth.tsx`, `consumerFirebaseAuth.ts`, `SignInModal.tsx`, `ProfileOnboarding.tsx`, `App.tsx`.

---

## 3. Perfil — tabs, conta, preferências

| Tema | O que mudou |
|------|-------------|
| Tabs | Compte / Préfs / Stockage / Historique (+ **Admin** se email admin) |
| Scroll | Tabs horizontais; tab activa entra na vista |
| Conta | Removidos sync row/badge; export JSON **só guest** |
| Historique | Marcas + histórico de leitura |
| Idioma | FR/HT nas Préfs → versão bíblica S21 ↔ HT98 |
| Share | URL no texto do verso sem duplicar |

**Ficheiros:** `ProfileShellPanel.tsx`, `uiCopy.ts`, `shareVerse.ts`.

---

## 4. Admin editorial (CMS de planos)

| Tema | O que mudou |
|------|-------------|
| Entrada | Tab Admin só com `isClevencodeAdminEmail` |
| Hub | **Créer un plan** / **Voir les plans** |
| Modal | Uma só: grelha ↔ editor (sem empilhar); «← Plans» |
| Wizard | Progresso UI (não etapas do plano): Identité → Contenu → Publication — criar **e** editar |
| Slug | Sem campo bloqueado; em edição o ID Firestore fica fixo |
| Ícone shell | Plan: `CalendarCheck` (ritmo diário) |
| Polish | Progresso/nav sticky; copy de publicação limpa |

**Ficheiros:** `AdminReadingPlansWorkspace.tsx`, `AdminPlanEditor.tsx`, `editorial-admin.css`, `ModeTabIcon.tsx`.

`#admin` full-page (`EditorialAdminApp`) mantém-se para deep link.

---

## 5. Motor de busca

| Tema | O que mudou |
|------|-------------|
| Índice S21 | Offline incompleto → indexa `/bible/s21/books/*.json` (bundle) |
| Erros | Índice vazio → `ok: false` com mensagem (`localVerseSearch`) |

**Ficheiros:** `verseIndexCache.ts`, `localVerseSearch.ts`, `bibleS21Canon.ts`.

---

## 6. Referências cruzadas (TSKe) — deploy e offline

| Tema | O que mudou |
|------|-------------|
| Deploy | `data/bible/study/tske/**` versionado; `stage-study-assets` no `build` / `build:mobile` |
| Manifest | `public/bible/study/tske/manifest.json` gerado no stage |
| Leitura | RAM → IndexedDB (`biblos-tske-offline`) → fetch asset |
| Pack | `ensureTskeOfflinePack` no download/seed da Bible S21 |
| PWA | Workbox `CacheFirst` em `/bible/study/tske/` |
| UX | `study.loadError` (capítulo ausente) vs `study.refsEmpty` |

**Ficheiros:** `tske.ts`, `idbTskeCache.ts`, `tskeOffline.ts`, `stage-study-assets.mjs`, `vite.config.ts`, `docs/bible-study.md`.

---

## 7. Cartão Install na 1.ª visita

Reutiliza `.sw-update-banner` (o mesmo do «Mettre à jour»).

| Tema | Comportamento |
|------|----------------|
| Quando | Pack incompleto na 1.ª entrada (persistente até concluir) |
| CTA | **Installer** → S21 + HT98 + TSKE + warm planos Firestore |
| Depois | Banner some; se houver SW update, mostra **Mettre à jour** |
| Flag | `localStorage` `biblos-first-install-pack=v1-complete` (+ checks IDB) |

**Ficheiros:** `src/offline/firstInstallPack.ts`, `App.tsx`, `uiCopy.ts`.

---

## 8. Commits do dia (ordem)

| Hash | Mensagem (resumo) |
|------|-------------------|
| `44c4bdb` | Hub: ícone intermédio ao abrir o menu |
| `8e4d3c2` | Convex navbar UI |
| `bfa98e9` | Timing saída da roleta |
| `27527b8` | UI mínima da barra |
| `b45babf` | Remoção frost/blur |
| `fa38879` | Tabs internas do perfil |
| `b1e4c54` | Idioma Préfs ↔ versão bíblica |
| `56bca96` | Tab Admin só para admin |
| `216288d` | CMS embutido + hub + modais + wizard + scroll tabs |
| `4e01dfa` | Busca bundle + TSKE no deploy |
| `a366b41` | Pack 1.ª visita + TSKE offline IDB/PWA + resumo |

---

## 9. Smoke tests

| Área | Verificar |
|------|-----------|
| Sessão | Google → reabrir app → continua; só sai com déconnexion |
| Perfil | Tabs + scroll; guest = export JSON; admin = tab Admin |
| Admin | Wizard 3 passos; Voir → editar no mesmo modal |
| Busca | Sem pack offline, palavra em S21 → hits |
| TSKe | `GET /bible/study/tske/JHN.3.json` → JSON; estudo offline após Install |
| Install | 1.ª visita → banner Installer → progresso S21/HT98/refs/plans → some |

```bash
npm run bible:study:stage
npm run build
```

---

## 10. Follow-ups opcionais

- Strong / Sg1910: removidos do projeto (só TSKE no estudo)
- Facetas da busca vs escopo filtrado (pills)  
- Actualizar `docs/components/*` com hub admin embutido  
- Política `#admin` vs tab Admin  

---

*Actualizado após `a366b41` — 13/11/2026.*
