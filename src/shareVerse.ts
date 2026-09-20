/** Partage de versets — image PNG (pas d’OG / aperçu de lien). */

import {
  formatShareUrlForCard,
  plainShareText,
  renderPlanShareCard,
  renderVerseShareCard,
} from "./shareVerseCard";

export const SHARE_ORIGIN = "https://www.biblo.digital";

const USFM_PATH_RE = /^\/v\/([A-Za-z0-9]{2,3}(?:\.\d+(?:-\d+)*)+)/i;

export function buildShareUrl(usfm: string): string {
  const cleaned = String(usfm || "")
    .trim()
    .replace(/^\/+/, "")
    .toUpperCase();
  return `${SHARE_ORIGIN}/v/${encodeURIComponent(cleaned)}`;
}

/** Lien d’invitation au plan (app) — pas une ref verset. */
export function buildPlanShareUrl(): string {
  return SHARE_ORIGIN;
}

export function parseShareRefFromLocation(
  loc: Pick<Location, "pathname" | "search"> = window.location,
): string | null {
  const pathMatch = loc.pathname.match(USFM_PATH_RE);
  if (pathMatch?.[1]) {
    try {
      return decodeURIComponent(pathMatch[1]).toUpperCase();
    } catch {
      return pathMatch[1].toUpperCase();
    }
  }
  try {
    const params = new URLSearchParams(loc.search);
    const fromQuery = params.get("v")?.trim();
    if (fromQuery && /^[A-Z0-9]{2,3}\.\d+/i.test(fromQuery)) {
      return fromQuery.toUpperCase();
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Lit la ref partagée et nettoie l’URL (replaceState → `/`). */
export function consumeShareRefFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const ref = parseShareRefFromLocation(window.location);
  if (!ref) return null;
  try {
    const url = new URL(window.location.href);
    url.pathname = "/";
    url.searchParams.delete("v");
    const qs = url.searchParams.toString();
    window.history.replaceState(null, "", qs ? `/?${qs}${url.hash}` : `/${url.hash}`);
  } catch {
    /* ignore */
  }
  return ref;
}

/**
 * Caption pour copie / Web Share :
 * référence, verset, puis lien (le lien n’apparaît pas sur l’image).
 */
export function buildShareText(
  refLabel: string,
  verseText = "",
  url = "",
): string {
  const ref = String(refLabel || "").trim();
  const body = String(verseText || "").trim();
  const link = formatShareUrlForCard(String(url || "").trim());
  const parts: string[] = [];
  if (ref) parts.push(ref);
  if (body) parts.push(`« ${body} »`);
  if (link) parts.push(link);
  return parts.join("\n\n");
}

/** Caption plan : titre, intro, lien app. */
export function buildPlanShareText(input: {
  title: string;
  description?: string;
  meta?: string;
  url?: string;
}): string {
  const title = plainShareText(input.title || "Plan de lecture");
  const description = plainShareText(input.description || "");
  const meta = plainShareText(input.meta || "");
  const link = formatShareUrlForCard(String(input.url || buildPlanShareUrl()).trim());
  const parts: string[] = [];
  if (title) parts.push(title);
  if (meta) parts.push(meta);
  if (description) {
    const short =
      description.length > 420 ? `${description.slice(0, 417).trimEnd()}…` : description;
    parts.push(short);
  }
  if (link) parts.push(link);
  return parts.join("\n\n");
}

export type SharePlanInput = {
  title: string;
  description?: string;
  meta?: string;
  accentHex?: string | null;
};

export async function renderPlanShareBlob(
  input: SharePlanInput,
): Promise<{ blob: Blob; url: string; text: string }> {
  const url = buildPlanShareUrl();
  const blob = await renderPlanShareCard({
    title: input.title,
    description: input.description,
    meta: input.meta,
    accentHex: input.accentHex,
    shareUrl: url,
  });
  return {
    blob,
    url,
    text: buildPlanShareText({
      title: input.title,
      description: input.description,
      meta: input.meta,
      url,
    }),
  };
}

export type ShareVerseDirectInput = {
  refLabel: string;
  verseText: string;
  usfm: string;
  accentHex?: string | null;
};

/**
 * Génère le cartão PNG et ouvre le partage système
 * (caption = ref + verset + URL).
 */
export async function shareVerseDirect(
  input: ShareVerseDirectInput,
): Promise<ShareVerseResult> {
  const shareUrl = buildShareUrl(input.usfm);
  const blob = await renderVerseShareCard({
    refLabel: input.refLabel,
    verseText: input.verseText,
    accentHex: input.accentHex,
    shareUrl,
  });
  return shareVersePayload({
    title: input.refLabel.trim() || "Biblos",
    text: buildShareText(input.refLabel, input.verseText, shareUrl),
    url: shareUrl,
    file: blob,
  });
}

/** Copie le texte du verset (ref + corps + lien) dans le presse-papiers. */
export async function copyVerseText(input: {
  refLabel: string;
  verseText: string;
  usfm: string;
}): Promise<ShareVerseResult> {
  const shareUrl = buildShareUrl(input.usfm);
  const text = buildShareText(input.refLabel, input.verseText, shareUrl);
  if (!text) {
    return { ok: false, error: "Rien à copier" };
  }
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
      return { ok: true, method: "clipboard" };
    }
  } catch {
    /* fall through */
  }
  return { ok: false, error: "Impossible de copier le texte" };
}

export type ShareVersePayload = {
  title: string;
  text?: string;
  url?: string;
  file: File | Blob;
};

export type ShareVerseResult =
  | { ok: true; method: "share" | "clipboard" | "download" }
  | { ok: false; cancelled?: boolean; error: string };

function toShareFile(file: File | Blob, filename = "biblos-verset.png"): File {
  if (file instanceof File) return file;
  return new File([file], filename, { type: file.type || "image/png" });
}

function downloadBlob(blob: Blob, filename: string): boolean {
  try {
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 1500);
    return true;
  } catch {
    return false;
  }
}

function canShareData(data: ShareData): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return false;
  }
  if (typeof navigator.canShare !== "function") return true;
  try {
    return navigator.canShare(data);
  } catch {
    return false;
  }
}

/** Partage l’image PNG (+ caption / URL si le système l’accepte) — pas de lien OG. */
export async function shareVersePayload(
  payload: ShareVersePayload,
): Promise<ShareVerseResult> {
  const title = payload.title.trim() || "Biblos";
  const text = String(payload.text || "").trim();
  const url = String(payload.url || "").trim();
  const file = toShareFile(payload.file);
  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  if (canShare) {
    try {
      const candidates: ShareData[] = [];
      if (text && url) {
        candidates.push({ title, text, url, files: [file] });
      }
      if (text) {
        candidates.push({ title, text, files: [file] });
      }
      if (url) {
        candidates.push({ title, url, files: [file] });
      }
      candidates.push({ files: [file] });

      const data = candidates.find((item) => canShareData(item));
      if (data) {
        await navigator.share(data);
        return { ok: true, method: "share" };
      }
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "AbortError") {
        return { ok: false, cancelled: true, error: "Partage annulé" };
      }
      /* fall through */
    }
  }

  const copied = await copyShareImage(payload.file);
  if (copied.ok) return copied;
  return { ok: false, error: "Impossible de partager l’image" };
}

/** Copie l’image PNG dans le presse-papiers, sinon téléchargement. */
export async function copyShareImage(
  file: File | Blob,
): Promise<ShareVerseResult> {
  const blob =
    file instanceof Blob
      ? file.type
        ? file
        : new Blob([file], { type: "image/png" })
      : new Blob([file], { type: "image/png" });
  const png =
    blob.type === "image/png"
      ? blob
      : new Blob([blob], { type: "image/png" });

  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof ClipboardItem !== "undefined"
    ) {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": png }),
      ]);
      return { ok: true, method: "clipboard" };
    }
  } catch {
    /* fall through */
  }

  if (downloadBlob(png, "biblos-verset.png")) {
    return { ok: true, method: "download" };
  }
  return { ok: false, error: "Impossible de copier l’image" };
}
