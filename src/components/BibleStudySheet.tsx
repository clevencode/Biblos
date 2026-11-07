import { useEffect, useId, useRef, useState } from "react";
import { YvIcon } from "./YvIcon";
import { loadVerseStudy, type VerseStudyBundle } from "../bible/studyQueries";
import type { TskeRef } from "../bible/tske";

export type BibleStudySheetProps = {
  open: boolean;
  onClose: () => void;
  bookId: string;
  chapterId: string;
  verse: number;
  refLabel: string;
  onOpenRef: (usfm: string) => void;
};

function RefList({
  refs,
  onOpenRef,
}: {
  refs: TskeRef[];
  onOpenRef: (usfm: string) => void;
}) {
  if (!refs.length) {
    return (
      <p className="bible-study-empty muted">
        Aucune référence croisée pour ce verset.
      </p>
    );
  }
  return (
    <ul className="bible-study-ref-list" role="list">
      {refs.map((item) => (
        <li key={item.usfm ?? item.label}>
          <button
            type="button"
            className="bible-study-ref"
            disabled={!item.usfm}
            onClick={() => {
              if (item.usfm) onOpenRef(item.usfm);
            }}
          >
            <YvIcon name="menu_book" className="bible-study-ref-icon" />
            <span className="bible-study-ref-label">{item.label}</span>
            {item.usfm ? (
              <YvIcon name="chevron_right" className="bible-study-ref-chevron" />
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function BibleStudySheet({
  open,
  onClose,
  bookId,
  chapterId,
  verse,
  refLabel,
  onOpenRef,
}: BibleStudySheetProps) {
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<VerseStudyBundle | null>(null);
  const reqGen = useRef(0);

  useEffect(() => {
    if (!open) return;
    const gen = ++reqGen.current;
    setBusy(true);
    setError(null);
    setBundle(null);
    void loadVerseStudy(bookId, chapterId, verse)
      .then((data) => {
        if (gen !== reqGen.current) return;
        setBundle(data);
      })
      .catch((err) => {
        if (gen !== reqGen.current) return;
        setError(err instanceof Error ? err.message : "Erreur de chargement");
      })
      .finally(() => {
        if (gen === reqGen.current) setBusy(false);
      });
  }, [open, bookId, chapterId, verse]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const heading = bundle?.tske?.heading;
  const refs = bundle?.tske?.refs ?? [];

  return (
    <div
      className="bible-search-sheet bible-study-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <header className="bible-search-sheet-head bible-history-sheet-head">
        <button
          type="button"
          className="bible-search-sheet-back"
          onClick={onClose}
          aria-label="Fermer les références"
        >
          <YvIcon name="chevron_left" className="bible-search-sheet-back-icon" />
        </button>
        <h2 className="bible-search-sheet-title" id={titleId}>
          Références
        </h2>
        <span className="bible-search-sheet-spacer" aria-hidden />
      </header>

      <div className="bible-search-sheet-meta" aria-live="polite">
        {busy ? (
          <span>Chargement…</span>
        ) : error ? (
          <span>Références croisées (TSKe)</span>
        ) : (
          <span>
            {refs.length} lien{refs.length === 1 ? "" : "s"} · {refLabel}
          </span>
        )}
      </div>

      {heading ? <p className="bible-study-heading">{heading}</p> : null}

      {busy ? (
        <p className="bible-study-status muted" aria-hidden>
          …
        </p>
      ) : error ? (
        <p className="bible-search-sheet-error" role="alert">
          {error}
        </p>
      ) : (
        <RefList refs={refs} onOpenRef={onOpenRef} />
      )}
    </div>
  );
}
