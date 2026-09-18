import { useEffect, useState } from "react";
import { YvIcon } from "./YvIcon";
import {
  buildShareText,
  buildShareUrl,
  copyShareLink,
  shareVersePayload,
} from "../shareVerse";
import { renderVerseShareCard } from "../shareVerseCard";

export type VerseShareSheetProps = {
  open: boolean;
  refLabel: string;
  verseText: string;
  usfm: string;
  accentHex?: string | null;
  onClose: () => void;
};

export function VerseShareSheet({
  open,
  refLabel,
  verseText,
  usfm,
  accentHex,
  onClose,
}: VerseShareSheetProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const shareUrl = buildShareUrl(usfm);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setBusy(true);
    setMsg(null);
    setPreviewUrl(null);
    setBlob(null);

    void (async () => {
      try {
        const png = await renderVerseShareCard({
          refLabel,
          verseText,
          accentHex,
        });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(png);
        setBlob(png);
        setPreviewUrl(objectUrl);
      } catch {
        if (!cancelled) setMsg("Impossible de préparer l’image");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, refLabel, verseText, accentHex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function onShare() {
    setMsg(null);
    setBusy(true);
    try {
      const text = buildShareText(refLabel, verseText, shareUrl);
      const result = await shareVersePayload({
        title: refLabel || "Biblos",
        text,
        url: shareUrl,
        file: blob,
      });
      if (result.ok) {
        setMsg(
          result.method === "clipboard"
            ? "Lien copié"
            : "Partagé",
        );
        return;
      }
      if (!result.cancelled) setMsg(result.error);
    } finally {
      setBusy(false);
    }
  }

  async function onCopyLink() {
    setMsg(null);
    setBusy(true);
    try {
      const result = await copyShareLink(shareUrl);
      setMsg(result.ok ? "Lien copié" : result.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="verse-share-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Partager le verset"
    >
      <button
        type="button"
        className="verse-share-sheet-backdrop"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="verse-share-sheet-panel">
        <div className="verse-share-sheet-head">
          <p className="verse-share-sheet-title">Partager</p>
          <button
            type="button"
            className="verse-share-sheet-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="verse-share-sheet-preview">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="verse-share-sheet-img" />
          ) : (
            <div className="verse-share-sheet-skeleton" aria-busy="true">
              {busy ? "Préparation…" : "—"}
            </div>
          )}
        </div>

        <p className="verse-share-sheet-url muted">{shareUrl}</p>

        <div className="verse-share-sheet-actions">
          <button
            type="button"
            className="bible-yv-chip verse-share-sheet-copy"
            disabled={busy}
            onClick={() => void onCopyLink()}
          >
            <YvIcon name="link" className="bible-verse-cta-icon" />
            <span>Copier le lien</span>
          </button>
          <button
            type="button"
            className="bible-yv-chip is-primary verse-share-sheet-share"
            disabled={busy || !blob}
            onClick={() => void onShare()}
          >
            <YvIcon name="ios_share" className="bible-verse-cta-icon" />
            <span>Partager</span>
          </button>
        </div>

        {msg ? <p className="verse-share-sheet-msg">{msg}</p> : null}
      </div>
    </div>
  );
}
