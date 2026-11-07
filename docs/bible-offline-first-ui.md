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

## Predictable State UI

Fases (`AppReadinessContext`):

| Fase | Critério |
|------|----------|
| `hydrating` | Catálogo ainda em `isHydrating` (máx. 100 ms) ou `!isLocalReady` |
| `local_ready` | Seed + prefs; leitura e navegação liberadas |
| `fully_synced` | Auth + catálogo prontos; sem sync Firebase/CMS em curso |

Chrome da Bíblia:

- Chips com **skeleton** (`BiblePassageChip`) — sem caret órfão durante `isLoadingLocal`.
- Picker desactivado até `isLocalReady`.
- `BibleSyncIndicator`: `cloud_sync` com pulso suave (nuvem), `cloud_done`, `cloud_off` — sem rotação agressiva.
- Capítulo: regra **120 ms** — skeleton de versículos (`BibleChapterLoadingPlaceholder`) ao mudar passagem; recarregar o mesmo capítulo escurece ligeiramente o texto + barra de progresso no topo do artigo.
- Limpar `passage` quando o USFM muda, para o header e o corpo não divergirem.
- Offline sem IDB: `BibleOfflineChapterGate` + CTA téléchargement.

## QA manual (homologação)

1. **Modo avião extremo** — fechar app, ativar modo avião, abrir leitor: barra com título do livro (francês) + capítulo + chevrons; picker com 66 livros.
2. **Transição abrupta** — online → offline durante leitura: sem desaparecimento do texto da barra; ícone offline pode surgir.
3. **Min-width** — livros curtos (ex. Job): chip livro com largura mínima, caret separado do rótulo.
4. **Picker pergaminho** — roll aberto; barra `is-roll-head` visível durante todos os passos (livro/capítulo/versículo).
5. **Skeleton** — cold start no tab Bíblia: shimmer nos chips &lt;100 ms, depois títulos estáveis.
6. **Capítulo lento** — throttle rede: skeleton de versículos ou barra superior; sem texto de outro livro.
7. **Capítulo não indexado** — offline + sem IDB: ecrã gate + botão de download.
