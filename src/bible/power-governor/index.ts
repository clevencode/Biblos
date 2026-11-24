export type {
  SystemPowerMode,
  DeviceConstraints,
  IdleTaskOptions,
  PowerModeListener,
  PowerGovernorEngine,
} from "./contracts/power-governor.contract";

export {
  createPowerGovernorEngine,
  getSharedPowerGovernor,
  destroySharedPowerGovernor,
} from "./core/power-governor.engine";

export { scheduleIdleTask } from "./scheduler/idle.scheduler";

export {
  readConstraints,
  readVisibility,
  readOnline,
  readNetwork,
  bindHardwareSensors,
} from "./sensors/hardware.sensors";

/** Flags de política lidas pelo Navigation / prefetch / Podcast Anchor. */
export type PrefetchPolicy = {
  /** Prefetch N−1 */
  allowPrev: boolean;
  /** Prefetch N+1 */
  allowNext: boolean;
  /** Warm SQLite / FTS */
  allowWarmSqlite: boolean;
  /** Podcast Anchor: preload aos 85% */
  allowAudioPreload85: boolean;
  /**
   * Intervalo sugerido para telemetria / drains especulativos (ms).
   * Não aplica a voidUserDataPush (marcas/notas ficam ~1200ms).
   */
  syncIntervalMs: number;
};

export function prefetchPolicyFor(
  mode: import("./contracts/power-governor.contract").SystemPowerMode,
): PrefetchPolicy {
  switch (mode) {
    case "performance":
      return {
        allowPrev: true,
        allowNext: true,
        allowWarmSqlite: true,
        allowAudioPreload85: true,
        syncIntervalMs: 15_000,
      };
    case "balanced":
      return {
        allowPrev: false,
        allowNext: true,
        allowWarmSqlite: false,
        allowAudioPreload85: false,
        syncIntervalMs: 60_000,
      };
    case "eco-background":
    default:
      return {
        allowPrev: false,
        allowNext: false,
        allowWarmSqlite: false,
        allowAudioPreload85: false,
        syncIntervalMs: 60_000,
      };
  }
}
