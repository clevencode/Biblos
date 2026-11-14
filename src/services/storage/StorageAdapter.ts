/**
 * Storage híbrido WebApp + Capacitor (fase 1: prefs KV).
 * Nativo → @capacitor/preferences; Web → localStorage.
 * Conteúdo bíblico: assets APK / Cache Storage (sem IndexedDB).
 * Pending: perfil, marks, notes, activity → Preferences nas próximas fases.
 */

import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

export type StorageAdapter = {
  getString(key: string): Promise<string | null>;
  setString(key: string, value: string): Promise<void>;
  getJson<T>(key: string): Promise<T | null>;
  setJson(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  /** Chaves com o prefixo dado (web: localStorage; nativo: Preferences.keys filtradas). */
  keys(prefix?: string): Promise<string[]>;
};

function webAdapter(): StorageAdapter {
  return {
    async getString(key: string) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    async setString(key: string, value: string) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* private mode / quota */
      }
    },
    async getJson<T>(key: string) {
      try {
        const raw = localStorage.getItem(key);
        if (raw == null) return null;
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },
    async setJson(key: string, value: unknown) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* private mode / quota */
      }
    },
    async remove(key: string) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
    async keys(prefix = "") {
      try {
        const out: string[] = [];
        for (let i = 0; i < localStorage.length; i += 1) {
          const k = localStorage.key(i);
          if (k && k.startsWith(prefix)) out.push(k);
        }
        return out;
      } catch {
        return [];
      }
    },
  };
}

function nativeAdapter(): StorageAdapter {
  const getString = async (key: string): Promise<string | null> => {
    try {
      const { value } = await Preferences.get({ key });
      return value;
    } catch {
      return null;
    }
  };

  const setString = async (key: string, value: string): Promise<void> => {
    try {
      await Preferences.set({ key, value });
      // Espelho para scripts síncronos (index.html theme) e callers legacy.
      try {
        localStorage.setItem(key, value);
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
  };

  return {
    getString,
    setString,
    async getJson<T>(key: string) {
      const raw = await getString(key);
      if (raw == null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },
    async setJson(key: string, value: unknown) {
      await setString(key, JSON.stringify(value));
    },
    async remove(key: string) {
      try {
        await Preferences.remove({ key });
        try {
          localStorage.removeItem(key);
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      }
    },
    async keys(prefix = "") {
      try {
        const { keys: all } = await Preferences.keys();
        return prefix ? all.filter((k) => k.startsWith(prefix)) : all;
      } catch {
        return [];
      }
    },
  };
}

let singleton: StorageAdapter | null = null;

export function createStorageAdapter(): StorageAdapter {
  return Capacitor.isNativePlatform() ? nativeAdapter() : webAdapter();
}

export function getStorageAdapter(): StorageAdapter {
  if (!singleton) singleton = createStorageAdapter();
  return singleton;
}

/**
 * No boot nativo: copia Preferences → localStorage para leituras síncronas
 * (tema inline, reader prefs) antes do 1.º paint React útil.
 */
export async function hydratePrefsMirror(
  keys: readonly string[],
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const store = getStorageAdapter();
  await Promise.all(
    keys.map(async (key) => {
      const value = await store.getString(key);
      if (value == null) return;
      try {
        localStorage.setItem(key, value);
      } catch {
        /* ignore */
      }
    }),
  );
}

/** Prefs críticas fase 1. */
export const STORAGE_PREF_KEYS = {
  theme: "biblos-theme",
  reader: "biblos-bible-reader",
  cleanSlate: "biblos-clean-slate",
  apkBannerDismissed: "biblos-apk-banner-dismissed",
} as const;

export const STORAGE_PREF_KEY_LIST = Object.values(STORAGE_PREF_KEYS);

/** Flag: mirror Preferences → localStorage concluído no boot (antes do React). */
let prefsMirrorReady = false;

export function markPrefsMirrorReady(): void {
  prefsMirrorReady = true;
}

export function isPrefsMirrorReady(): boolean {
  return prefsMirrorReady;
}
