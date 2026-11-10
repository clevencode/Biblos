# Arquitetura skeleton (Biblos)

Camada inspirada na API de [react-loading-skeleton](https://github.com/dvtng/react-loading-skeleton), sem dependência npm — shimmer unificado, tema via CSS e presets alinhados ao domínio (passagem, picker, planos).

## Peças

| Peça | Ficheiro | Papel |
|------|----------|--------|
| `Skeleton` | `src/skeleton/Skeleton.tsx` | Bloco base (`width`, `height`, `circle`, `pill`, `count`, `opaque`) |
| `SkeletonTheme` | `src/skeleton/SkeletonTheme.tsx` | Tokens `--skeleton-base`, `--skeleton-highlight`, duração |
| `SkeletonStack` | `src/skeleton/SkeletonStack.tsx` | Coluna com gaps consistentes (CLS) |
| Presets | `src/skeleton/presets/*` | Morfologia de negócio |

## Onde é usado

- **Capítulo** — `BibleChapterVersesSkeleton` → números reais + linhas shimmer (`BibleChapterLoadingPlaceholder`)
- **Picker** — `BiblePickerDiscoverySkeleton`, `BiblePickGridSkeleton` + `skeleton-picker-cell`
- **Busca por versículos** — `BibleVerseHitSnippetSkeleton`
## Regras de negócio

1. **Layout fixo** — presets mantêm a mesma caixa que o conteúdo final (evita CLS).
2. **`opaque`** — rótulos tabulares (nº versículo, placeholder «Livre») sem animação.
3. **`prefers-reduced-motion`** — shimmer desligado em `skeleton.css`.
4. **A11y** — `role="status"`, `aria-busy`, texto `sr-only` onde já existia (abertura de capítulo).

## Tema

A classe `skeleton-theme` está em `.app` (`App.tsx`). Opcional: envolver subárvores com `<SkeletonTheme baseColor="…" highlightColor="…" />`.

## Novo preset

1. Definir morfologia (grid/lista) igual ao componente carregado.
2. Compor com `Skeleton` / `SkeletonStack`.
3. Exportar em `src/skeleton/index.ts` se for partilhado.
