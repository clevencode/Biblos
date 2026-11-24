/**
 * Leitores seguros — Visibility, Network, Battery (com fallbacks).
 */

import type { DeviceConstraints } from "../contracts/power-governor.contract";

type NetworkConnection = {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

type BatteryManager = {
  level: number;
  charging: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

function getConnection(): NetworkConnection | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & {
    connection?: NetworkConnection;
    mozConnection?: NetworkConnection;
    webkitConnection?: NetworkConnection;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

export function readVisibility(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState !== "hidden";
}

export function readOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

export function readNetwork(): {
  saveDataEnabled: boolean;
  effectiveNetworkType: string;
} {
  const conn = getConnection();
  if (!conn) {
    return { saveDataEnabled: false, effectiveNetworkType: "unknown" };
  }
  const type = String(conn.effectiveType || "unknown").toLowerCase();
  return {
    saveDataEnabled: Boolean(conn.saveData),
    effectiveNetworkType: type || "unknown",
  };
}

export function readConstraints(
  battery: { level: number; charging: boolean } | null,
): DeviceConstraints {
  const net = readNetwork();
  const isLowBattery = Boolean(
    battery && !battery.charging && battery.level < 0.15,
  );
  return {
    isPageVisible: readVisibility(),
    isOnline: readOnline(),
    saveDataEnabled: net.saveDataEnabled,
    effectiveNetworkType: net.effectiveNetworkType,
    isLowBattery,
  };
}

export type SensorCleanup = () => void;

/**
 * Liga listeners de hardware; chama `onChange` quando qualquer sinal muda.
 * Retorna cleanup + getter de battery snapshot.
 */
export function bindHardwareSensors(onChange: () => void): {
  cleanup: SensorCleanup;
  getBatterySnapshot: () => { level: number; charging: boolean } | null;
} {
  let battery: BatteryManager | null = null;
  let batterySnapshot: { level: number; charging: boolean } | null = null;

  const onVisibility = () => onChange();
  const onOnline = () => onChange();
  const onOffline = () => onChange();
  const onConnection = () => onChange();
  const onBattery = () => {
    if (battery) {
      batterySnapshot = { level: battery.level, charging: battery.charging };
    }
    onChange();
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
  }

  const conn = getConnection();
  conn?.addEventListener?.("change", onConnection);

  const getBattery = (
    navigator as Navigator & {
      getBattery?: () => Promise<BatteryManager>;
    }
  ).getBattery;

  if (typeof getBattery === "function") {
    void getBattery()
      .then((mgr) => {
        battery = mgr;
        batterySnapshot = { level: mgr.level, charging: mgr.charging };
        mgr.addEventListener("levelchange", onBattery);
        mgr.addEventListener("chargingchange", onBattery);
        onChange();
      })
      .catch(() => undefined);
  }

  return {
    getBatterySnapshot: () => batterySnapshot,
    cleanup: () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      }
      conn?.removeEventListener?.("change", onConnection);
      if (battery) {
        battery.removeEventListener("levelchange", onBattery);
        battery.removeEventListener("chargingchange", onBattery);
      }
    },
  };
}
