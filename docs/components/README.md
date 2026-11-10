# Documentação modular de componentes (Biblos)

Cada ficheiro descreve um **módulo de UI** (ou fatia coesa de interface): responsabilidade, ficheiros no repo, contratos de props/estado, fluxos, viewState, CSS, acessibilidade e regras para evoluir sem regressões.

## Convenção de ficheiros

| Campo no doc | Significado |
|--------------|-------------|
| **ID** | Identificador estável (`passage-verse-selector`) |
| **Superfície** | O que o utilizador vê / interage |
| **Dono do estado** | Onde vive `useState` / refs (geralmente `BibleReaderView`) |
| **ViewState** | Funções puras em `src/bible/viewState/` |
| **Dependências** | Filhos diretos, hooks, repositórios |

## Índice

| ID | Documento | Estado |
|----|-----------|--------|
| `passage-verse-selector` | [barra-seletor-versiculo.md](./barra-seletor-versiculo.md) | Documentado |
| `passage-roll` | [passage-roll.md](./passage-roll.md) | Documentado |
| `passage-chips` | [passage-chips.md](./passage-chips.md) | Documentado |
| `passage-discovery` | [passage-discovery.md](./passage-discovery.md) | Documentado |
| `reader-surface` | _(capítulo, versículos, seleção)_ | Pendente |
| `audio-float` | _(BibleAudioFloat)_ | Pendente |
| `study-sheets` | _(Strong, busca, estudo)_ | Pendente |
| `share-history` | _(partilha, histórico)_ | Pendente |
| `app-shell` | _(nav, home, perfil, settings)_ | Pendente |

Atualize esta tabela à medida que novos módulos forem documentados.

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
