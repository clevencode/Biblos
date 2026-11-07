# Ícones (coolicons)

O Biblos usa [coolicons](https://github.com/krystonschwarze/coolicons) (`@coolicons/react`) para ícones de interface.

## Camadas

| Camada | Ficheiro | Uso |
|--------|----------|-----|
| Config | `src/icons/config.ts` | Variante `line`, raio `round`, espessura do traço |
| Registo | `src/icons/registry.ts` | Nome estável do app → componente coolicons |
| Facade | `src/components/YvIcon.tsx` | API usada nas views (`name`, `filled`, `opsz`) |
| Tab bar | `src/components/ModeTabIcon.tsx` | coolicons `line` inactivo · `fill` activo (`round`) |

## Convenções

- **Nomes** no código mantêm o vocabulário legado (`chevron_left`, `ios_share`, …); o mapa vive em `registry.ts`.
- **`filled`** escolhe a variante `fill/round` quando existe (play/pause, círculo com check, notificações activas).
- **Tamanho**: classes CSS definem `font-size` no `.yv-icon`; o SVG escala com `size="1em"`.
- **Excepção**: logótipo Google em `SignInModal` (marca externa, não coolicons).

## Adicionar um ícone

1. Confirmar o glifo em [coolicons.cool](https://coolicons.cool) (preferir `line` + `round`).
2. Importar em `registry.ts` e acrescentar a chave em `BiblosIconName` + `ICON_REGISTRY`.
3. Usar `<YvIcon name="…" />` na UI.

## Pacote

```sh
npm install @coolicons/react
```

MIT — ver repositório upstream.
