# Documentação modular de componentes (Biblos)

Cada ficheiro descreve um **módulo de UI** (ou fatia coesa de interface): responsabilidade, ficheiros no repo, contratos de props/estado, fluxos, viewState, CSS, acessibilidade e regras para evoluir sem regressões.

**Visão unificada:** [Bibloscomponents.md](./Bibloscomponents.md) — reúne todos os módulos num único documento.

## Convenção de ficheiros

| Campo no doc | Significado |
|--------------|-------------|
| **ID** | Identificador estável (`passage-verse-selector`) |
| **Superfície** | O que o utilizador vê / interage |
| **Dono do estado** | Onde vive `useState` / refs (geralmente `BibleReaderView` ou `App`) |
| **ViewState** | Funções puras em `src/bible/viewState/` |
| **Dependências** | Filhos directos, hooks, repositórios |

## Índice

| ID | Documento | Estado |
|----|-----------|--------|
| — | **[Bibloscomponents.md](./Bibloscomponents.md)** | Índice mestre + resumos |
| `app-shell` | [app-shell.md](./app-shell.md) | Documentado |
| `reader-surface` | [reader-surface.md](./reader-surface.md) | Documentado |
| `passage-bar` | [passage-bar.md](./passage-bar.md) | Estado actual (test) |
| `passage-roll` | [passage-roll.md](./passage-roll.md) | Documentado |
| `passage-chips` | [passage-chips.md](./passage-chips.md) | Documentado |
| `passage-scroll-picker` | [passage-scroll-picker.md](./passage-scroll-picker.md) | Documentado |
| `passage-discovery` | [passage-discovery.md](./passage-discovery.md) | Documentado |
| `passage-verse-selector` | [barra-seletor-versiculo.md](./barra-seletor-versiculo.md) | Documentado |
| `audio-float` | [audio-float.md](./audio-float.md) | Documentado |
| `share-history` | [share-history.md](./share-history.md) | Documentado |
| `study-sheets` | [study-sheets.md](./study-sheets.md) | Documentado |

## Modelo de secções (copiar em novos docs)

1. Resumo e superfície
2. Mapa de ficheiros
3. Fluxo do utilizador
4. Contratos (props / callbacks)
5. Estado e orquestração
6. ViewState e carregamento
7. Estilos e layout
8. Acessibilidade
9. Casos limite e regras de negócio
10. Alterações seguras / anti-padrões

---

Ver também: [architecture-guide.md](../architecture-guide.md).
