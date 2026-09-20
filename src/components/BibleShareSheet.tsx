import { useEffect, useId, useRef, useState } from "react";
import { YvIcon } from "./YvIcon";
import {
  buildShareText,
  buildShareUrl,
  copyVerseText,
  renderPlanShareBlob,
  shareVersePayload,
} from "../shareVerse";
import { renderVerseShareCard } from "../shareVerseCard";

export type BibleShareSheetProps = {
  open: boolean;
  onClose: () => void;
  /** `plan` = cartão + texte du plan entier ; `verse` = verset sélectionné. */
  mode?: "verse" | "plan";
  refLabel: string;
  verseText: string;
  usfm: string;
  accentHex?: string | null;
  planTitle?: string;
  planDescription?: string;
  planMeta?: string;
  /** Id du plan dans Biblos (lien ?plan=). */
  planId?: string | null;
};

export function BibleShareSheet({
  open,
  onClose,
  mode = "verse",
  refLabel,
  verseText,
  usfm,
  accentHex,
  planTitle = "",
  planDescription = "",
  planMeta = "",
  planId = null,
}: BibleShareSheetProps) {
  const titleId = useId();
  const blobRef = useRef<Blob | null>(null);
  const planTextRef = useRef<string>("");
  const planUrlRef = useRef<string>("");
  const objectUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isPlan = mode === "plan";
  const displayLabel = isPlan
    ? planTitle.trim() || refLabel || "Plan de lecture"
    : refLabel;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      blobRef.current = null;
      planTextRef.current = "";
      planUrlRef.current = "";
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setPreviewUrl(null);
      setPreviewError(null);
      setMsg(null);
      setPreviewBusy(false);
      setCopyBusy(false);
      setShareBusy(false);
      return;
    }

    let cancelled = false;
    setPreviewBusy(true);
    setPreviewError(null);
    setMsg(null);

    void (async () => {
      try {
        let blob: Blob;
        if (isPlan) {
          const result = await renderPlanShareBlob({
            title: planTitle || refLabel || "Plan de lecture",
            description: planDescription,
            meta: planMeta,
            planId,
            accentHex,
          });
          blob = result.blob;
          planTextRef.current = result.text;
          planUrlRef.current = result.url;
        } else {
          const shareUrl = buildShareUrl(usfm);
          blob = await renderVerseShareCard({
            refLabel,
            verseText,
            accentHex,
            shareUrl,
          });
          planTextRef.current = "";
          planUrlRef.current = "";
        }
        if (cancelled) return;
        blobRef.current = blob;
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const href = URL.createObjectURL(blob);
        objectUrlRef.current = href;
        setPreviewUrl(href);
      } catch {
        if (!cancelled) {
          blobRef.current = null;
          setPreviewUrl(null);
          setPreviewError("Impossible de générer l’image");
        }
      } finally {
        if (!cancelled) setPreviewBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    isPlan,
    refLabel,
    verseText,
    usfm,
    accentHex,
    planTitle,
    planDescription,
    planMeta,
    planId,
  ]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  async function handleCopy() {
    if (copyBusy) return;
    setCopyBusy(true);
    setMsg(null);
    try {
      if (isPlan) {
        const text = planTextRef.current.trim();
        if (!text) {
          setMsg("Rien à copier");
          return;
        }
        if (
          typeof navigator !== "undefined" &&
          navigator.clipboard &&
          typeof navigator.clipboard.writeText === "function"
        ) {
          await navigator.clipboard.writeText(text);
          setMsg("Texte copié");
          return;
        }
        setMsg("Impossible de copier le texte");
        return;
      }
      const result = await copyVerseText({ refLabel, verseText, usfm });
      if (result.ok) {
        setMsg("Texte copié");
        return;
      }
      setMsg(result.error);
    } catch {
      setMsg("Impossible de copier le texte");
    } finally {
      setCopyBusy(false);
    }
  }

  async function handleShare() {
    if (shareBusy || !blobRef.current) return;
    setShareBusy(true);
    setMsg(null);
    try {
      if (isPlan) {
        const result = await shareVersePayload({
          title: planTitle.trim() || "Biblos",
          text: planTextRef.current,
          url: planUrlRef.current,
          file: blobRef.current,
        });
        if (result.ok) {
          setMsg(
            result.method === "clipboard"
              ? "Image copiée"
              : result.method === "download"
                ? "Image téléchargée"
                : null,
          );
          return;
        }
        if (!result.cancelled) setMsg(result.error);
        return;
      }
      const shareUrl = buildShareUrl(usfm);
      const result = await shareVersePayload({
        title: refLabel.trim() || "Biblos",
        text: buildShareText(refLabel, verseText, shareUrl),
        url: shareUrl,
        file: blobRef.current,
      });
      if (result.ok) {
        setMsg(
          result.method === "clipboard"
            ? "Image copiée"
            : result.method === "download"
              ? "Image téléchargée"
              : null,
        );
        return;
      }
      if (!result.cancelled) setMsg(result.error);
    } catch {
      setMsg("Impossible de partager");
    } finally {
      setShareBusy(false);
    }
  }

  if (!open) return null;

  const canShare = Boolean(blobRef.current) && !previewBusy && !previewError;
  const canCopy = isPlan
    ? Boolean(planTitle.trim() || planDescription.trim() || displayLabel.trim())
    : Boolean(verseText);

  return (
    <div
      className="bible-search-sheet bible-share-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <header className="bible-search-sheet-head bible-share-sheet-head">
        <button
          type="button"
          className="bible-search-sheet-back"
          onClick={onClose}
          aria-label="Fermer le partage"
        >
          <YvIcon name="chevron_left" className="bible-search-sheet-back-icon" />
        </button>
        <p id={titleId} className="bible-search-sheet-title">
          {isPlan ? "Partager le plan" : "Partager"}
        </p>
        <span className="bible-search-sheet-spacer" aria-hidden />
      </header>

      <p className="bible-share-sheet-ref">{displayLabel}</p>

      <div className="bible-share-sheet-preview" aria-busy={previewBusy || undefined}>
        {previewBusy ? (
          <p className="bible-share-sheet-preview-status muted">Préparation…</p>
        ) : previewError ? (
          <p className="bible-share-sheet-preview-status" role="alert">
            {previewError}
          </p>
        ) : previewUrl ? (
          <img
            className="bible-share-sheet-card"
            src={previewUrl}
            alt={`Carte ${displayLabel}`}
          />
        ) : null}
      </div>

      <div className="bible-share-sheet-footer">
        <div className="bible-share-sheet-actions">
          <button
            type="button"
            className="bible-yv-chip bible-share-sheet-copy"
            disabled={copyBusy || !canCopy}
            onClick={() => void handleCopy()}
          >
            {copyBusy ? (
              "…"
            ) : (
              <>
                <YvIcon name="content_copy" className="bible-verse-cta-icon" />
                <span>Copier</span>
              </>
            )}
          </button>
          <button
            type="button"
            className="bible-yv-chip is-primary bible-share-sheet-share"
            disabled={shareBusy || !canShare}
            onClick={() => void handleShare()}
          >
            {shareBusy ? (
              "…"
            ) : (
              <>
                <YvIcon name="ios_share" className="bible-verse-cta-icon" />
                <span>Partager</span>
              </>
            )}
          </button>
        </div>
        {msg ? <p className="bible-share-sheet-msg">{msg}</p> : null}
      </div>
    </div>
  );
}
