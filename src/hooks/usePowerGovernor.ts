/**
 * Bridge PowerGovernor ↔ prefetch / warm SQLite.
 * Bootstrap sem setState — evita re-render do App em visibility/rede/bateria.
 */

import { useEffect, useState } from "react";
import {
  getSharedPowerGovernor,
  prefetchPolicyFor,
  type DeviceConstraints,
  type PrefetchPolicy,
  type SystemPowerMode,
} from "../bible/power-governor";
import { setPrefetchPolicy } from "../bible/passageWindowCache";
import { setWarmSqliteAllowed } from "../bible/verseSearchClient";

let booted = false;
let bootUnsub: (() => void) | null = null;

function applyPolicy(mode: SystemPowerMode): void {
  const policy = prefetchPolicyFor(mode);
  setPrefetchPolicy(policy);
  setWarmSqliteAllowed(policy.allowWarmSqlite);
  // syncIntervalMs NÃO altera voidUserDataPush — push de marcas fica ~1200ms.
}

/** Liga o singleton uma vez; seguro chamar várias vezes. */
export function bootPowerGovernor(): () => void {
  if (booted) return () => undefined;
  booted = true;
  const gov = getSharedPowerGovernor();
  bootUnsub = gov.subscribe((mode) => {
    applyPolicy(mode);
  });
  return () => {
    bootUnsub?.();
    bootUnsub = null;
    booted = false;
  };
}

/**
 * Hook fino só quando UI precisa do modo (não usar no App shell).
 */
export function usePowerGovernorMode(): {
  mode: SystemPowerMode;
  constraints: DeviceConstraints;
  policy: PrefetchPolicy;
} {
  const [mode, setMode] = useState<SystemPowerMode>(() =>
    getSharedPowerGovernor().getCurrentMode(),
  );
  const [constraints, setConstraints] = useState<DeviceConstraints>(() =>
    getSharedPowerGovernor().getConstraints(),
  );

  useEffect(() => {
    const stopBoot = bootPowerGovernor();
    const gov = getSharedPowerGovernor();
    const unsub = gov.subscribe((nextMode, nextConstraints) => {
      setMode(nextMode);
      setConstraints(nextConstraints);
    });
    return () => {
      unsub();
      stopBoot();
    };
  }, []);

  return {
    mode,
    constraints,
    policy: prefetchPolicyFor(mode),
  };
}
