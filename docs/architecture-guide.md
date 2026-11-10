# Architecture guide (Biblos)

Documento mestre de arquitetura do app. Aqui ficam princípios, convenções e decisões que orientam código novo e refactors. Guias temáticos detalhados continuam em ficheiros separados sob `docs/` (ligados abaixo).

> **Como usar:** preencha cada secção com regras acionáveis (o quê, onde no repo, o que evitar). Quando um tópico crescer demais, extraia para `docs/<tema>.md` e deixe neste ficheiro só o resumo + ligação.

---

## Índice

1. [Visão geral](#visão-geral)
2. [Stack e runtime](#stack-e-runtime)
3. [Estrutura de pastas](#estrutura-de-pastas)
4. [Camadas e dependências](#camadas-e-dependências)
5. [Estado e dados](#estado-e-dados)
6. [UI, tema e acessibilidade](#ui-tema-e-acessibilidade)
7. [Offline, mobile e assets](#offline-mobile-e-assets)
8. [Integrações externas](#integrações-externas)
9. [Testes e qualidade](#testes-e-qualidade)
10. [Decisões (ADR)](#decisões-adr)
11. [Documentação relacionada](#documentação-relacionada)

---

## Visão geral

<!-- Propósito do produto, limites arquiteturais, o que não pertence ao app -->

_(a preencher)_

---

## Stack e runtime

| Camada | Escolha | Notas |
|--------|---------|--------|
| UI | React + TypeScript | Vite |
| Mobile | Capacitor (Android) | scripts `mobile:*` |
| Build | `tsc` + Vite | ver `package.json` |

_(regras adicionais: versões mínimas, ambientes, variáveis — a preencher)_

---

## Estrutura de pastas

Convenção atual (resumo; detalhar regras aqui):

```
src/
  components/     # UI partilhada e shells de leitura
  features/       # módulos por domínio (ex.: reading-plans, editorial-auth)
  bible/          # catálogo, passagens, viewState, offline
  skeleton/       # loading / shimmer (ver guia skeleton)
  hooks/          # hooks transversais
  icons/          # registry e config de ícones
  typography/     # fontes
docs/             # escopo, arquitetura temática, tokens visuais
```

_(convenções de naming, quando criar `features/` vs pasta em `src/bible/`, barrels `index.ts` — a preencher)_

---

## Camadas e dependências

<!-- Ex.: domain não importa React; data não importa presentation; etc. -->

### Feature modules (`src/features/<nome>/`)

Padrão observado em módulos como reading-plans:

| Pasta | Responsabilidade |
|-------|------------------|
| `domain/` | tipos, regras puras, serialização |
| `data/` | Firebase, repositórios, config |
| `presentation/` | componentes, hooks de UI, admin |

_(regras de import entre camadas, erros, boundaries — a preencher)_

### Módulo Bíblia (`src/bible/`)

_(viewState, repositórios, offline — a preencher)_

---

## Estado e dados

<!-- localStorage vs remoto, viewState vs hooks, caches -->

_(a preencher — ver também `docs/bible-offline-first-ui.md`)_

---

## UI, tema e acessibilidade

<!-- tokens em brand/, tipografia, ícones, shells -->

_(a preencher — ver `docs/typography.md`, `docs/icons.md`)_

---

## Offline, mobile e assets

<!-- bibles em public/, staging scripts, Capacitor -->

_(a preencher — ver `docs/bible-offline-first-ui.md`, `docs/bible-mobile-audio-sync.md`)_

---

## Integrações externas

<!-- YouVersion, Firebase, Firestore rules, APIs em vite -->

_(a preencher — ver `docs/reading-plans-firestore.md` quando aplicável)_

---

## Testes e qualidade

<!-- o que testar, scripts existentes, critérios de PR -->

_(a preencher — ex.: `npm run test:passage-viewstate`)_

---

## Decisões (ADR)

Registo curto de decisões irreversíveis ou caras de mudar.

| Data | Decisão | Contexto | Consequências |
|------|---------|----------|---------------|
| | | | |

_(adicionar linhas à medida que decidir)_

---

## Documentação relacionada

| Documento | Conteúdo |
|-----------|----------|
| [bible-product-scope.md](./bible-product-scope.md) | Escopo do produto |
| [skeleton-architecture.md](./skeleton-architecture.md) | Camada skeleton / loading |
| [bible-offline-first-ui.md](./bible-offline-first-ui.md) | Offline-first na UI |
| [bible-mobile-audio-sync.md](./bible-mobile-audio-sync.md) | Áudio e sync mobile |
| [bible-study.md](./bible-study.md) | Estudo (TSKE, Strong, etc.) |
| [reading-plans-firestore.md](./reading-plans-firestore.md) | Planos de leitura / Firestore |
| [typography.md](./typography.md) | Tipografia |
| [icons.md](./icons.md) | Ícones |
| [components/README.md](./components/README.md) | Documentação modular por componente / módulo de UI |

---

_Última atualização: 2026-11-10 — mantenha esta linha ao editar._
