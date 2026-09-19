/** Partage de versets — image PNG (pas d’OG / aperçu de lien). */

export const SHARE_ORIGIN = "https://www.biblo.digital";

const USFM_PATH_RE = /^\/v\/([A-Za-z0-9]{2,3}(?:\.\d+(?:-\d+)*)+)/i;

export function buildShareUrl(usfm: string): string {
  const cleaned = String(usfm || "")
    .trim()
    .replace(/^\/+/, "")
    .toUpperCase();
  return `${SHARE_ORIGIN}/v/${encodeURIComponent(cleaned)}`;
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

/** Texte court (référence seule) — sans URL, pour accompagner l’image. */
export function buildShareText(refLabel: string, verseText = ""): string {
  const ref = String(refLabel || "").trim();
  const body = String(verseText || "").trim();
  if (ref && body) return `${ref}\n\n« ${body} »`;
  return ref || body;
}

export type ShareVersePayload = {
  title: string;
  text?: string;
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

/** Partage uniquement l’image (Web Share files) — pas de lien OG. */
export async function shareVersePayload(
  payload: ShareVersePayload,
): Promise<ShareVerseResult> {
  const title = payload.title.trim() || "Biblos";
  const text = String(payload.text || "").trim();
  const file = toShareFile(payload.file);
  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  if (canShare) {
    try {
      const withText: ShareData = { title, text, files: [file] };
      const filesOnly: ShareData = { files: [file] };
      const data =
        text &&
        (typeof navigator.canShare !== "function" || navigator.canShare(withText))
          ? withText
          : filesOnly;
      if (
        typeof navigator.canShare !== "function" ||
        navigator.canShare(data)
      ) {
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
