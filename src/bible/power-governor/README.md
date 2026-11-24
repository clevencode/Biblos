# Background Efficiency Engine (PowerGovernor)

Máquina headless de eficiência energética / rede para a BiblosApp.

## Modos

| Modo | Quando |
|------|--------|
| `performance` | Página visível, rede boa, bateria ok |
| `balanced` | `saveData`, 2g/3g, ou bateria &lt; 15% sem carregar |
| `eco-background` | `document.hidden` |

## Uso

```ts
import {
  getSharedPowerGovernor,
  prefetchPolicyFor,
} from "@/bible/power-governor";

const gov = getSharedPowerGovernor();
gov.subscribe((mode) => {
  document.documentElement.dataset.powerMode = mode; // já aplicado pelo engine
  const policy = prefetchPolicyFor(mode);
  // Navigation / sync / Podcast Anchor leem policy
});
```

## CSS / animações

```css
html[data-power-mode="eco-background"] .heavy-anim {
  animation: none !important;
}
```

## Política de prefetch

- `performance` — N±1 + warm SQLite
- `balanced` — só N+1
- `eco-background` — off

Sync outbox: 15s (`performance`) vs 60s (`balanced` / `eco-background`).

Podcast Anchor (quando existir): desactivar preload 85% em `balanced` / `eco-background`.

## Critérios

- Zero React dentro desta pasta
- `destroy()` remove todos os listeners
- Capacitor só hospeda o WebView
