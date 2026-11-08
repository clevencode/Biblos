# UI offline-first — cabeçalho e BookSelector

## Stack local

| Camada | Implementação |
|--------|----------------|
| Seed 66 livros + capítulos | `data/bible/s21/manifest.json` → `buildS21BookList()` |
| Última leitura | `localStorage` `biblos-bible-reader` |
| Cache lista API | `localStorage` `biblos-bible-books-s21` (7 dias) |
| Texto completo offline | IndexedDB (`biblos-s21-offline`) |
| UI React | `useBibleCatalog` + `bibleCatalogRepository` |

## Fluxo

```
BibleReaderView / BiblePassageScrollPicker
        → useBibleCatalog (hooks)
        → bibleCatalogRepository.hydrateCatalog()
              → seed (síncrono)
              → cache LS
              → meta IDB
              → fetchBooks() (rede, opcional)
```

A UI **nunca** inicia com `books: []`. Títulos no header usam `resolveBookDisplay()` (lista atual → seed → canon → id).

## Barre universelle (picker — livre)

Núcleo em `src/bible/passageDiscovery/` (puro) + `usePassageDiscovery` + `BiblePassageDiscoveryList`.

| Entrada | Comportamento |
|--------|----------------|
| Query vazia | 66 livros em **Ancien Testament** / **Nouveau Testament** |
| Nome de livre | Filtro por título (síncrono) + fusão com hits de texto |
| Mot (≥2 car.) | `bookCounts` + dépliant → versets; toque abre passagem; **session** (`PassageDiscoverySession`) guarda query, scroll, livro expandido e último verseto — só o X limpa |
| Référence (ex. Jean 3.16) | Ligne «Aller à…» → `loadChapter` directo |

O sheet `BibleSearchSheet` mantém-se para versículos detalhados; o picker só sugere **livros** ou **saut**.

## ViewState (anti layout shift)

| Módulo | Papel |
|--------|--------|
| `src/bible/viewState/*` | Contratos `PassageViewState`, `CatalogViewState`, `pickerViewState`, `audioViewState` |
| `src/bible/passageRepository.ts` | I/O + `performance.mark` (`passage-layout-*`, `passage-idb-read-*`, `passage-viewstate-emit`) |
| `src/hooks/usePassageViewModel.ts` | UDF: `NAVIGATE` → loading com **schema dimensional** (sem `passage = null`) |
| IDB `chapter_layout` (v2) | `verseCount` / `contentCharLength` por capítulo, indexado com cada livro |

Regras:

- UI reage só a **ViewState**, não a modelos crus do IDB.
- Mudança de capítulo: `isOpening` + skeleton com IDs estáveis (`skeleton:USFM:vN`); reload do mesmo USFM: `stalePassage` + `is-chapter-reload` (sem desmontar versos).
- Picker: grelhas skeleton com `slotIds` fixos; painel com `min-height` + `contain: layout`.
- Testes: `npm run test:passage-viewstate`.

## Camada de apresentação (chrome)

Selectors puros em `src/bible/viewState/selectors.ts` e `bibleChrome.ts` — a UI **não** combina flags locais (`isHydrating`, `isLoadingLocal`, `loading` + `loadingUi`) à mão.

| Selector / helper | Consumidor | O que deriva |
|-------------------|------------|----------------|
| `passagePresentation` | `usePassageViewModel` → `BibleReaderView` | `ariaBusy`, `statusLine`, `showOpeningSkeleton` (após 120 ms), `isOpening` / `isReloading` |
| `passageLiveStatusLabel` / `PASSAGE_LOADING_COPY` | live region + placeholders | textos FR únicos |
| `biblePickerChrome` | `BibleReaderView` (chips + roll) | `chipsHydrating`, `pickerPanelOpenAllowed`, `controlsDisabled` |
| `passagePickerChrome` | `BiblePassageScrollPicker` | `inFlight`, `showDeferredUi`, `schema` para skeleton de versos |
| `mergeBibleReaderErrors` | barra de erro | prioridade: falha de passagem → erro de chrome (offline/áudio) |

Catálogo: preferir `useBibleCatalog().viewState.status` (`CatalogViewState`) em vez de `isLoadingLocal` / `isLocalReady` isolados.

## Predictable State UI

Fases (`AppReadinessContext`):

| Fase | Critério |
|------|----------|
| `hydrating` | Catálogo ainda em `isHydrating` (máx. 100 ms) ou `!isLocalReady` |
| `local_ready` | Seed + prefs; leitura e navegação liberadas |
| `fully_synced` | Auth + catálogo prontos; sem sync Firebase/CMS em curso |

Chrome da Bíblia:

- Chips com **shimmer in-place** (`BiblePassageChip.is-hydrating`) — botão + caret fixos, sem troca por `span` skeleton.
- Picker desactivado até `biblePickerChrome.pickerPanelOpenAllowed` (catálogo S21 `ready` ou HT98 com livros).
- Cabeçalho **sem** indicador nuvem/sync (toast global `Hors ligne` + ícone offline só se reactivado).
- Classe `is-catalog-offline` segue **evento offline do navegador**, não só a fonte do catálogo em rede.
- Capítulo: **0–120 ms** — só reserva dimensional (`PassageSkeletonSchema` + barra `is-chapter-opening`); **após 120 ms** (`showOpeningSkeleton`) — skeleton com números opacos; reload mantém versos (`stalePassage`) + `is-chapter-reload`.
- **Não** limpar passage na navegação: o ViewModel emite `loading` com schema de destino.
- Offline sem IDB: `BibleOfflineChapterGate` + CTA téléchargement (só sem versículos em memória; texto já lido permanece ao falhar recarga).
- Gate e `BibleChapterLoadingPlaceholder` com **min-height** alinhado para evitar salto entre estados.

## QA manual (homologação)

1. **Modo avião extremo** — fechar app, ativar modo avião, abrir leitor: barra com título do livro (francês) + capítulo + chevrons; picker com 66 livros.
2. **Transição abrupta** — online → offline durante leitura: sem desaparecimento do texto da barra nem do capítulo em cache; hamburger e chips estáveis (sem dot «live»).
3. **Min-width** — livros curtos (ex. Job): chip livro com largura mínima, caret separado do rótulo.
4. **Picker pergaminho** — roll aberto; barra `is-roll-head` visível durante todos os passos (livro/capítulo/versículo).
5. **Skeleton** — cold start no tab Bíblia: shimmer nos chips &lt;100 ms, depois títulos estáveis.
6. **Capítulo lento** — throttle rede: skeleton de versículos ou barra superior; sem texto de outro livro.
7. **Capítulo não indexado** — offline + sem IDB: ecrã gate + botão de download.
8. **Picker sans texte** — deux sections AT / NT, ordre canon.
9. **«1 Rois»** — filtre titre, un ou deux livres mis en évidence.
10. **«amour»** — avec index IDB ou API : plusieurs livres + compteurs ; hors ligne sans index : message + titres si match.
11. **«Jean 3.16»** — pas de grille livres ; bouton Aller à Jean 3.16 ouvre le passage.
12. **Retour recherche** — après un verset : rouvrir le picker retrouve mot, dépliant, scroll et verset ancré ; seul le **X** réinitialise.
13. **Picker ouvert** — texte biblique `inert` + scrim : pas de sélection de verset ; tap sur le fond ou Échap ferme le panneau.
14. **Lecture mobile** — tab bar toujours visible (Accueil, Plan, Bible, Cartes) ; hamburger à droite = outils Bible seulement. Texte `inert` + scrim tant que le menu ou le picker est ouvert. Désactiver le hamburger compact : `VITE_BIBLE_UNIFIED_NAV=0`. Profil via Accueil (icône / titre).

## Sous-système Partager (versets)

### Séparation des responsabilités

| Canal | Rôle |
|--------|------|
| **PNG** (`shareVerseCard.ts`) | Appel visuel : ref, texte avec retours à la ligne, marque en pied — **sans URL** |
| **Texte** (`buildShareText` dans `shareVerse.ts`) | Fidélité intégrale : référence, corps avec `[n]` et `\n\n`, URL complète `Lire dans l’app : …` |

### Sélection multi-versets

`formatSelectedVersesForShare` (`shareVerse.ts`) : chaque verset → `[numéro] texte`, blocs séparés par `\n\n` (utilisé dans `BibleReaderView`).

### Contraintes canvas

- Largeur fixe : **1080px** (`VERSE_SHARE_CARD_WIDTH`).
- Hauteur adaptative jusqu’au plafond **`VERSE_SHARE_MAX_HEIGHT` (2400px)** ; au-delà : clip + dégradé de continuation (anti-OOM / anti-spaghetti dans les feeds).
- Pied : signature de marque centrée (défaut « Biblos »), pas de lien brut.
- Le plafond PNG **ne tronque pas** le texte du clipboard.

### Copier (clipboard)

- Point d’entrée unique : `copyShareCaption` → `writeTextToClipboard` (API Clipboard, repli `execCommand`).
- Verse : `buildVerseShareCaption` ; plan : `buildPlanShareCaption` / `buildPlanShareText` (URL **https** complète).

**QA Copier**

1. **Desktop** — sélectionner 1 verset → Partager → Copier : presse-papiers = ref + `« … »` + `Lire dans l’app : https://www.biblo.digital/v/…`.
2. **Multi-versets** — caption avec `[n]` et paragraphes `\n\n` intacts (pas de fusion en une ligne).
3. **Plan** — Partager le plan → Copier : titre, meta, intro, URL complète (même formule que verset).
4. **PNG long** — passage >2400px : image tronquée avec fade ; clipboard **complet**.
5. **Échec** — message distinct : vide (`Rien à copier`), refus (`Accès au presse-papiers refusé`), HTTP non sécurisé.
6. **Android** (futur) — si l’API échoue après repli, envisager `@capacitor/clipboard`.
