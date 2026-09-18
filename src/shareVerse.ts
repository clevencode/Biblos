/** Partage de versets — URL canónica biblo.digital + Web Share / clipboard. */

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

export function buildShareText(refLabel: string, verseText: string, url: string): string {
  const ref = String(refLabel || "").trim();
  const body = String(verseText || "").trim();
  const link = String(url || "").trim();
  const parts = [ref, body ? `« ${body} »` : "", link].filter(Boolean);
  return parts.join("\n\n");
}

export type ShareVersePayload = {
  title: string;
  text: string;
  url: string;
  file?: File | Blob | null;
};

export type ShareVerseResult =
  | { ok: true; method: "share" | "clipboard" }
  | { ok: false; cancelled?: boolean; error: string };

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

function toShareFile(file: File | Blob, filename = "biblos-verset.png"): File {
  if (file instanceof File) return file;
  return new File([file], filename, { type: file.type || "image/png" });
}

export async function shareVersePayload(
  payload: ShareVersePayload,
): Promise<ShareVerseResult> {
  const title = payload.title.trim() || "Biblos";
  const text = payload.text.trim();
  const url = payload.url.trim();
  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  if (canShare) {
    try {
      if (payload.file) {
        const file = toShareFile(payload.file);
        const data: ShareData = { title, text, url, files: [file] };
        if (
          typeof navigator.canShare !== "function" ||
          navigator.canShare(data)
        ) {
          await navigator.share(data);
          return { ok: true, method: "share" };
        }
      }
      await navigator.share({ title, text, url });
      return { ok: true, method: "share" };
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "AbortError") {
        return { ok: false, cancelled: true, error: "Partage annulé" };
      }
      /* fall through to clipboard */
    }
  }

  const copied = await copyText(url || text);
  if (copied) return { ok: true, method: "clipboard" };
  return { ok: false, error: "Impossible de partager ou copier le lien" };
}

export async function copyShareLink(url: string): Promise<ShareVerseResult> {
  const copied = await copyText(url.trim());
  if (copied) return { ok: true, method: "clipboard" };
  return { ok: false, error: "Impossible de copier le lien" };
}
