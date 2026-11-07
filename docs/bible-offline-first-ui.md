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

## Indicador offline

Com rede indisponível e catálogo não vindo da API (`catalogSource !== 'network'`), o header mostra o ícone `cloud_off` (classe `is-catalog-offline`).

## QA manual (homologação)

1. **Modo avião extremo** — fechar app, ativar modo avião, abrir leitor: barra com título do livro (francês) + capítulo + chevrons; picker com 66 livros.
2. **Transição abrupta** — online → offline durante leitura: sem desaparecimento do texto da barra; ícone offline pode surgir.
3. **Min-width** — livros curtos (ex. Job): chip livro com largura mínima, caret separado do rótulo.
4. **Picker pergaminho** — roll aberto; barra `is-roll-head` visível durante todos os passos (livro/capítulo/versículo).
