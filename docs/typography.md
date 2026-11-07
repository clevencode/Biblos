# Tipografia (gratuita / OFL)

Pilha alinhada ao visual actual: pílulas suaves, acento dourado (`#c4a574`), ícones coolicons em traço fino.

| Papel | Família | Licença | Uso no Biblos |
|-------|---------|---------|----------------|
| UI | [Outfit](https://fonts.google.com/specimen/Outfit) Variable | OFL-1.1 | tabs, botões, títulos, labels |
| Leitura | [Source Serif 4](https://fonts.google.com/specimen/Source+Serif+4) Variable | OFL-1.1 | versículos, planos, corpo longo |
| Mono | [JetBrains Mono](https://www.jetbrains.com/lp/mono/) Variable | OFL-1.1 | IDs, snippets técnicos |

## Tokens CSS

Definidos em `src/index.css` (app) e `brand/tokens.css` (marca):

- `--font-ui`, `--font-read`, `--font-bible`, `--font-mono`
- Escala: `--type-display-*` … `--type-caption-*`
- Classes utilitárias: `.type-title`, `.type-body`, `.type-label`, etc.

## Carregamento

`src/typography/fonts.ts` importa pacotes `@fontsource-variable/*` (auto-host, `font-display: swap`).

## Porque este par

- **Outfit** — sans géometrica com formas próximas dos ícones coolicons; boa legibilidade em labels pequenos (FR com acentos via latin-ext).
- **Source Serif 4** — serif contemporânea pensada para ecrã; contraste claro com a UI sem parecer “app corporativa”.
- Ambas são **gratuitas** e não exigem conta Adobe nem fontes de sistema pagas.

## Adicionar peso ou itálico

Com variáveis, use `font-weight` / `font-style: italic` em CSS — não é preciso novo `@import` por peso.
