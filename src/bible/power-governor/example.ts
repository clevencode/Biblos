/**
 * Exemplo headless — simula performance → balanced → eco-background.
 * Correr: npx tsx src/bible/power-governor/example.ts
 * (em browser real os sensores ligam-se automaticamente)
 */

import type {
  DeviceConstraints,
  SystemPowerMode,
} from "./contracts/power-governor.contract";
import { scheduleIdleTask } from "./scheduler/idle.scheduler";

function computeMode(c: DeviceConstraints): SystemPowerMode {
  if (!c.isPageVisible) return "eco-background";
  const slowNet =
    c.effectiveNetworkType === "2g" ||
    c.effectiveNetworkType === "slow-2g" ||
    c.effectiveNetworkType === "3g";
  if (c.saveDataEnabled || slowNet || c.isLowBattery) return "balanced";
  return "performance";
}

const scenarios: DeviceConstraints[] = [
  {
    isPageVisible: true,
    isOnline: true,
    saveDataEnabled: false,
    effectiveNetworkType: "4g",
    isLowBattery: false,
  },
  {
    isPageVisible: true,
    isOnline: true,
    saveDataEnabled: true,
    effectiveNetworkType: "3g",
    isLowBattery: false,
  },
  {
    isPageVisible: false,
    isOnline: true,
    saveDataEnabled: false,
    effectiveNetworkType: "4g",
    isLowBattery: false,
  },
];

console.log("[power-governor] demo modos:");
for (const c of scenarios) {
  console.log(`  ${computeMode(c)}`, c);
}

const cancel = scheduleIdleTask(
  () => console.log("[power-governor] idle task executada"),
  { timeoutMs: 50, priority: "normal" },
);

setTimeout(() => {
  cancel();
  console.log("[power-governor] demo ok (performance → balanced → eco-background)");
}, 100);
