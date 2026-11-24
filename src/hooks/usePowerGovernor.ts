/**
 * Bridge React — PowerGovernor singleton ↔ UI / engines.
 * Aplica data-power-mode e propaga política a prefetch / sync.
 */

import { useEffect, useState } from "react";
import {
  getSharedPowerGovernor,
  prefetchPolicyFor,
  type DeviceConstraints,
  type PrefetchPolicy,
  type SystemPowerMode,
} from "../bible/power-governor";
import { setSyncPushDebounceMs } from "../features/user-sync/data/userDataSync";
import { setPrefetchPolicy } from "../bible/passageWindowCache";
import { setWarmSqliteAllowed } from "../bible/verseSearchClient";

export function usePowerGovernor(): {
  mode: SystemPowerMode;
  constraints: DeviceConstraints;
  policy: PrefetchPolicy;
} {
  const [mode, setMode] = useState<SystemPowerMode>("performance");
  const [constraints, setConstraints] = useState<DeviceConstraints>(() => ({
    isPageVisible: true,
    isOnline: true,
    saveDataEnabled: false,
    effectiveNetworkType: "unknown",
    isLowBattery: false,
  }));

  useEffect(() => {
    const gov = getSharedPowerGovernor();
    return gov.subscribe((nextMode, nextConstraints) => {
      setMode(nextMode);
      setConstraints(nextConstraints);
      const policy = prefetchPolicyFor(nextMode);
      setPrefetchPolicy(policy);
      setWarmSqliteAllowed(policy.allowWarmSqlite);
      setSyncPushDebounceMs(policy.syncIntervalMs);
    });
  }, []);

  return {
    mode,
    constraints,
    policy: prefetchPolicyFor(mode),
  };
}
