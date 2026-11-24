/** Contratos — Background Efficiency Engine (PowerGovernor). */

export type SystemPowerMode = "performance" | "balanced" | "eco-background";

export interface DeviceConstraints {
  isPageVisible: boolean;
  isOnline: boolean;
  /** navigator.connection?.saveData */
  saveDataEnabled: boolean;
  /** '4g' | '3g' | '2g' | 'slow-2g' | 'unknown' */
  effectiveNetworkType: string;
  /** true se bateria < 15% e não estiver a carregar */
  isLowBattery: boolean;
}

export interface IdleTaskOptions {
  /** Tempo máximo de espera antes de forçar execução */
  timeoutMs?: number;
  priority?: "low" | "normal";
}

export type PowerModeListener = (
  mode: SystemPowerMode,
  constraints: DeviceConstraints,
) => void;

export interface PowerGovernorEngine {
  getCurrentMode(): SystemPowerMode;
  getConstraints(): DeviceConstraints;
  scheduleIdleTask(
    task: () => void | Promise<void>,
    options?: IdleTaskOptions,
  ): () => void;
  subscribe(listener: PowerModeListener): () => void;
  destroy(): void;
}
