import { useEffect, useId, useRef, useState } from "react";
import { YvIcon } from "./YvIcon";
import {
  fetchStrongLexiconEntry,
  formatStrongDisplayCode,
  type StrongLexiconEntry,
} from "../bible/strongLexicon";

export type BibleStrongSheetProps = {
  open: boolean;
  code: string | null;
  lemma?: string;
  onClose: () => void;
};

function detailLabel(type?: string): string {
  if (type === "bdb") return "BDB";
  if (type === "thayer") return "Thayer";
  return "Lexique";
}

export function BibleStrongSheet({ open, code, lemma, onClose }: BibleStrongSheetProps) {
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<StrongLexiconEntry | null>(null);
  const reqGen = useRef(0);

  useEffect(() => {
    if (!open || !code) return;
    const gen = ++reqGen.current;
    setBusy(true);
    setError(null);
    setEntry(null);
    void fetchStrongLexiconEntry(code)
      .then((data) => {
        if (gen !== reqGen.current) return;
        if (!data) {
          setError("Entrée Strong introuvable dans le lexique local.");
          return;
        }
        setEntry(data);
      })
      .catch((err) => {
        if (gen !== reqGen.current) return;
        setError(err instanceof Error ? err.message : "Erreur de chargement");
      })
      .finally(() => {
        if (gen === reqGen.current) setBusy(false);
      });
  }, [open, code]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !code) return null;

  const label = formatStrongDisplayCode(code);

  return (
    <div
      className="bible-search-sheet bible-strong-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <header className="bible-search-sheet-head bible-history-sheet-head">
        <button
          type="button"
          className="bible-search-sheet-back"
          onClick={onClose}
          aria-label="Fermer le lexique"
        >
          <YvIcon name="chevron_left" className="bible-search-sheet-back-icon" />
        </button>
        <h2 className="bible-search-sheet-title" id={titleId}>
          Strong {label}
        </h2>
        <span className="bible-search-sheet-spacer" aria-hidden />
      </header>

      <div className="bible-search-sheet-meta" aria-live="polite">
        {lemma ? (
          <span>
            Mot : <strong>{lemma}</strong>
          </span>
        ) : (
          <span>Lexique Strong (H/G)</span>
        )}
      </div>

      <div className="bible-strong-body">
        {busy ? (
          <p className="bible-study-status muted">Chargement…</p>
        ) : error ? (
          <p className="bible-search-sheet-error" role="alert">
            {error}
          </p>
        ) : entry ? (
          <>
            {entry.original ? (
              <p className="bible-strong-line">
                <span className="bible-strong-k">Original</span>
                <span className="bible-strong-v bible-strong-original" dir="auto">
                  {entry.original}
                </span>
              </p>
            ) : null}
            {entry.transliteration ? (
              <p className="bible-strong-line">
                <span className="bible-strong-k">Translitération</span>
                <span className="bible-strong-v">{entry.transliteration}</span>
              </p>
            ) : null}
            {entry.phonetic ? (
              <p className="bible-strong-line">
                <span className="bible-strong-k">Phonétique</span>
                <span className="bible-strong-v">{entry.phonetic}</span>
              </p>
            ) : null}
            {entry.partOfSpeech ? (
              <p className="bible-strong-line">
                <span className="bible-strong-k">Catégorie</span>
                <span className="bible-strong-v">{entry.partOfSpeech}</span>
              </p>
            ) : null}
            {entry.definition ? (
              <section className="bible-strong-block">
                <h3 className="bible-strong-block-title">Définition Strong</h3>
                <p className="bible-strong-def">{entry.definition}</p>
                <p className="bible-strong-lang muted">Texte source en anglais</p>
              </section>
            ) : null}
            {entry.detail ? (
              <section className="bible-strong-block">
                <h3 className="bible-strong-block-title">{detailLabel(entry.detailType)}</h3>
                <p className="bible-strong-def">{entry.detail}</p>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
