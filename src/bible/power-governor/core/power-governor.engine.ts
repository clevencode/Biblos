/**
 * Máquina de estados central — PowerGovernor.
 */

import type {
  DeviceConstraints,
  IdleTaskOptions,
  PowerGovernorEngine,
  PowerModeListener,
  SystemPowerMode,
} from "../contracts/power-governor.contract";
import {
  bindHardwareSensors,
  readConstraints,
} from "../sensors/hardware.sensors";
import { scheduleIdleTask as scheduleIdle } from "../scheduler/idle.scheduler";

function computeMode(c: DeviceConstraints): SystemPowerMode {
  if (!c.isPageVisible) return "eco-background";
  const slowNet =
    c.effectiveNetworkType === "2g" ||
    c.effectiveNetworkType === "slow-2g" ||
    c.effectiveNetworkType === "3g";
  if (c.saveDataEnabled || slowNet || c.isLowBattery) return "balanced";
  return "performance";
}

export function createPowerGovernorEngine(): PowerGovernorEngine {
  const listeners = new Set<PowerModeListener>();
  let destroyed = false;
  let mode: SystemPowerMode = "performance";
  let constraints: DeviceConstraints = readConstraints(null);

  const sensors = bindHardwareSensors(() => {
    if (destroyed) return;
    recompute();
  });

  function recompute(): void {
    constraints = readConstraints(sensors.getBatterySnapshot());
    const next = computeMode(constraints);
    const changed = next !== mode;
    mode = next;
    if (typeof document !== "undefined") {
      document.documentElement.dataset.powerMode = mode;
    }
    if (changed) {
      for (const listener of listeners) {
        try {
          listener(mode, constraints);
        } catch {
          /* isolado */
        }
      }
    }
  }

  recompute();

  return {
    getCurrentMode: () => mode,
    getConstraints: () => ({ ...constraints }),
    scheduleIdleTask(task, options?: IdleTaskOptions) {
      if (destroyed) return () => undefined;
      // Em eco-background, adia tarefas low até voltar a visível (timeout força).
      if (mode === "eco-background" && options?.priority === "low") {
        return scheduleIdle(task, {
          ...options,
          timeoutMs: options.timeoutMs ?? 30_000,
        });
      }
      return scheduleIdle(task, options);
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(mode, constraints);
      return () => listeners.delete(listener);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      listeners.clear();
      sensors.cleanup();
      if (typeof document !== "undefined") {
        delete document.documentElement.dataset.powerMode;
      }
    },
  };
}

/** Singleton opcional para o app (lazy). */
let shared: PowerGovernorEngine | null = null;

export function getSharedPowerGovernor(): PowerGovernorEngine {
  if (!shared) shared = createPowerGovernorEngine();
  return shared;
}

export function destroySharedPowerGovernor(): void {
  shared?.destroy();
  shared = null;
}
