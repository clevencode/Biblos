/**
 * Verificação de update do APK nativo via HTTP HEAD no ficheiro R2.
 * Sem version.json — compara ETag (ou Last-Modified / Content-Length).
 *
 * CTA: descarrega para cache/Biblos.apk (sobrescrita) e abre o instalador
 * via plugin ApkInstaller — sem acumular ficheiros em Downloads.
 *
 * CORS: o bucket R2 deve permitir HEAD (e GET) a partir do origin Capacitor
 * (tipicamente https://localhost). Falhas de rede/CORS são ignoradas em silêncio.
 */

import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { useCallback, useEffect, useState } from "react";
import { ApkInstaller } from "../native/apkInstaller";

const ETAG_KEY = "biblos-apk-etag";

export type ApkUpdateState = {
  available: boolean;
  busy: boolean;
  update: () => Promise<void>;
  dismiss: () => void;
};

function apkDownloadUrl(): string {
  return String(import.meta.env.VITE_APK_DOWNLOAD_URL ?? "").trim();
}

function fingerprintFromHeaders(headers: Headers): string | null {
  const etag = headers.get("etag")?.trim();
  if (etag) return etag;
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

export function useApkUpdate(): ApkUpdateState {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingFingerprint, setPendingFingerprint] = useState<string | null>(
    null,
  );
  const [sessionDismissed, setSessionDismissed] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    const url = apkDownloadUrl();
    if (!url) return;

    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(url, { method: "HEAD", cache: "no-store" });
        if (cancelled || !res.ok) return;
        const fp = fingerprintFromHeaders(res.headers);
        if (!fp || cancelled) return;

        const stored = readStoredFingerprint();
        if (!stored) {
          writeStoredFingerprint(fp);
          return;
        }
        if (fp !== stored) {
          setPendingFingerprint(fp);
          setAvailable(true);
        }
      } catch {
        /* offline / CORS / rede — silencioso */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(() => {
    setSessionDismissed(true);
    setAvailable(false);
  }, []);

  const update = useCallback(async () => {
    const url = apkDownloadUrl();
    if (!url || busy) return;
    setBusy(true);
    try {
      if (pendingFingerprint) {
        writeStoredFingerprint(pendingFingerprint);
      }
      try {
        await ApkInstaller.downloadAndInstall({ url });
        setAvailable(false);
      } catch (error) {
        console.warn("[apk] in-app install failed, fallback browser", error);
        await openApkUrl(url);
        setAvailable(false);
      }
    } finally {
      setBusy(false);
    }
  }, [busy, pendingFingerprint]);

  return {
    available: available && !sessionDismissed,
    busy,
    update,
    dismiss,
  };
}
