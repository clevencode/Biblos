/**
 * Verificação de update do APK nativo via HTTP HEAD no ficheiro R2.
 * Sem version.json — compara ETag (ou Last-Modified / Content-Length).
 *
 * CTA: descarrega para cache/Biblos.apk (sobrescrita) e abre o instalador
 * via plugin ApkInstaller — sem acumular ficheiros em Downloads.
 *
 * CORS: o bucket R2 deve permitir HEAD (e GET) a partir do origin Capacitor
 * (tipicamente https://localhost) e ExposeHeaders: ETag. Ver scripts/r2-cors-apk.json.
 */

import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { useCallback, useEffect, useState } from "react";
import { isAllowedApkDownloadUrl } from "../native/apkDownloadAllowlist";
import { ApkInstaller, isUnknownSourcesError } from "../native/apkInstaller";

const ETAG_KEY = "biblos-apk-etag";
/** HEAD curto — não bloquear boot em rede móvel lenta. */
const HEAD_TIMEOUT_MS = 5_000;

export type ApkUpdateState = {
  available: boolean;
  busy: boolean;
  update: () => Promise<void>;
  dismiss: () => void;
};

function apkDownloadUrl(): string {
  const raw = String(import.meta.env.VITE_APK_DOWNLOAD_URL ?? "").trim();
  if (!raw) return "";
  return isAllowedApkDownloadUrl(raw) ? raw : "";
}

/**
 * Fingerprint bruto: preserva aspas e sufixos multipart (`"abc"-1`).
 * Sem ETag exposto (CORS) → fallback lm:/cl: + warn em DEV.
 */
function fingerprintFromHeaders(headers: Headers): string | null {
  const etagRaw = headers.get("etag");
  const etag = etagRaw?.trim();
  if (etag) return etag;

  if (import.meta.env.DEV) {
    console.warn(
      "[apk] HEAD sem header ETag (null). Confirma Access-Control-Expose-Headers: ETag no CORS do R2 (scripts/r2-cors-apk.json). A usar Last-Modified / Content-Length se existirem.",
    );
  }

  const lastModified = headers.get("last-modified")?.trim();
  if (lastModified) return `lm:${lastModified}`;
  const length = headers.get("content-length")?.trim();
  if (length) return `cl:${length}`;
  return null;
}

function readStoredFingerprint(): string | null {
  try {
    const raw = localStorage.getItem(ETAG_KEY);
    return raw && raw.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

function writeStoredFingerprint(value: string): void {
  try {
    localStorage.setItem(ETAG_KEY, value);
  } catch {
    /* ignore quota / private mode */
  }
}

async function openApkUrl(url: string): Promise<void> {
  try {
    await Browser.open({ url });
  } catch {
    try {
      window.open(url, "_blank");
    } catch {
      /* ignore */
    }
  }
}

export type UseApkUpdateOptions = {
  /** Update APK — só admin. Default: false. */
  enabled?: boolean;
};

export function useApkUpdate(
  options: UseApkUpdateOptions = {},
): ApkUpdateState {
  const enabled = Boolean(options.enabled);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingFingerprint, setPendingFingerprint] = useState<string | null>(
    null,
  );
  const [sessionDismissed, setSessionDismissed] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setAvailable(false);
      setPendingFingerprint(null);
      return;
    }
    if (!Capacitor.isNativePlatform()) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    const url = apkDownloadUrl();
    if (!url) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);

    void (async () => {
      try {
        const res = await fetch(url, {
          method: "HEAD",
          cache: "no-store",
          signal: controller.signal,
        });
        if (controller.signal.aborted || !res.ok) return;
        const fp = fingerprintFromHeaders(res.headers);
        if (!fp || controller.signal.aborted) return;

        const stored = readStoredFingerprint();
        /* 1.ª ligação bem-sucedida (ou storage vazio) — seed sem banner. */
        if (!stored) {
          writeStoredFingerprint(fp);
          return;
        }
        if (fp !== stored) {
          setPendingFingerprint(fp);
          setAvailable(true);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        /* offline / CORS / rede / timeout — silencioso */
        if (import.meta.env.DEV && error instanceof Error) {
          console.warn("[apk] HEAD update check failed:", error.message);
        }
      } finally {
        window.clearTimeout(timer);
      }
    })();

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled]);

  const dismiss = useCallback(() => {
    setSessionDismissed(true);
    setAvailable(false);
  }, []);

  const update = useCallback(async () => {
    if (!enabled) return;
    const url = apkDownloadUrl();
    if (!url || busy) return;
    setBusy(true);
    try {
      try {
        await ApkInstaller.downloadAndInstall({ url });
        /* Só após sucesso — evita “consumir” o ETag se o user recusar install. */
        if (pendingFingerprint) {
          writeStoredFingerprint(pendingFingerprint);
        }
        setAvailable(false);
      } catch (error) {
        if (isUnknownSourcesError(error)) {
          /* Nativo já abriu Settings — manter banner para retry. */
          if (import.meta.env.DEV) {
            console.warn(
              "[apk] unknown sources: Settings aberto; sem fallback browser",
              error,
            );
          }
          return;
        }
        console.warn("[apk] in-app install failed, fallback browser", error);
        await openApkUrl(url);
        setAvailable(false);
      }
    } finally {
      setBusy(false);
    }
  }, [busy, enabled, pendingFingerprint]);

  return {
    available: available && !sessionDismissed,
    busy,
    update,
    dismiss,
  };
}
