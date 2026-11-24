# Background Efficiency Engine (PowerGovernor)

Máquina headless de eficiência energética / rede para a BiblosApp.

**UI silenciosa** — sem badge “Eco” / definições de modo. O utilizador só nota leitura mais leve (menos prefetch, menos loops CSS).

## Modos

| Modo | Quando |
|------|--------|
| `performance` | Página visível, rede boa, bateria ok |
| `balanced` | `saveData`, 2g/3g, ou bateria &lt; 15% sem carregar |
| `eco-background` | `document.hidden` |

## Boot (app)

```ts
import { bootPowerGovernor } from "@/hooks/usePowerGovernor";

// App.tsx — useEffect uma vez; sem setState (não re-renderiza o shell)
useEffect(() => bootPowerGovernor(), []);
```

O engine escreve `document.documentElement.dataset.powerMode`.

## CSS / animações

Em `balanced` / `eco-background`, o CSS pausa **só loops** (skeleton pulse, spinners). Micro-interações de leitura (sheets, seleção de verso) mantêm-se.

```css
html[data-power-mode="balanced"] .loop,
html[data-power-mode="eco-background"] .loop {
  animation: none !important;
}
```

## Política de prefetch

- `performance` — N±1 + warm SQLite
- `balanced` — só N+1
- `eco-background` — off

## Sync

- **Push de marcas/notas** (`voidUserDataPush`): debounce fixo ~**1200ms** (gesto do utilizador).
- **`policy.syncIntervalMs`** (15s / 60s): telemetria / drains especulativos futuros — **não** altera o push interativo.

Podcast Anchor (quando existir): desactivar preload 85% em `balanced` / `eco-background` via `allowAudioPreload85`.

## Critérios

- Zero React dentro desta pasta
- `destroy()` remove todos os listeners
- Capacitor só hospeda o WebView
