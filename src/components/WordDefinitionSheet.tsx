/**
 * Definição de uma palavra do HT98 no Diksyonè Kreyòl Vilsen.
 * Mesmo padrão de modal das refs cruzadas (portal, X / Escape, scrim visual).
 */

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  loadHtDictionary,
  lookupHtWord,
  parseSenses,
  posLabel,
  type HtDictEntry,
  type HtWordLookup,
} from "../bible/htDictionary";
import { useUiLocale } from "../i18n/UiLocaleContext";
import { YvIcon } from "./YvIcon";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; lookup: HtWordLookup; attribution: string }
  | { status: "missing" };

function EntryBlock({ entry }: { entry: HtDictEntry }) {
  const senses = useMemo(() => parseSenses(entry.gloss), [entry.gloss]);
  const label = posLabel(entry.pos);
  return (
    <article className="dict-entry">
      <h4 className="dict-entry-lemma">
        {entry.lemma}
        {entry.pos ? (
          <span className="dict-entry-pos" title={label || undefined}>
            {label || entry.pos}
          </span>
        ) : null}
      </h4>
      {senses.length > 1 ? (
        <ol className="dict-entry-senses">
          {senses.map((sense, i) => (
            <li key={i}>{sense}</li>
          ))}
        </ol>
      ) : (
        <p className="dict-entry-gloss">{senses[0] ?? entry.gloss}</p>
      )}
    </article>
  );
}

export function WordDefinitionSheet({
  word,
  verseNumber,
  verseText,
  onClose,
  onSearchBible,
}: {
  word: string;
  verseNumber: number | null;
  verseText: string;
  onClose: () => void;
  onSearchBible: (query: string) => void;
}) {
  const { t } = useUiLocale();
  const titleId = useId();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    void loadHtDictionary().then((dict) => {
      if (cancelled) return;
      setState(
        dict
          ? { status: "ready", lookup: lookupHtWord(dict, word, verseText), attribution: dict.attribution }
          : { status: "missing" },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [word, verseText]);

  useEffect(() => {
    /* Capture: fecha só este modal (como nas refs cruzadas). */
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const lookup = state.status === "ready" ? state.lookup : null;
  const searchQuery = lookup?.entries[0]?.lemma ?? word;
  const showBiblicalForm =
    lookup && lookup.entries.length > 0 && (lookup.via === "alias" || lookup.via === "contraction");

  return createPortal(
    <div
      className="bible-study-ref-modal dict-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="bible-study-ref-modal-scrim" aria-hidden="true" onClick={onClose} />
      <div className="bible-study-ref-modal-card">
        <div className="bible-study-ref-modal-surface">
          <header className="bible-study-ref-modal-head">
            <h3 className="bible-study-ref-modal-title" id={titleId}>
              {word}
              {verseNumber != null ? (
                <span className="dict-modal-verse">{t("dict.verse", { n: verseNumber })}</span>
              ) : null}
            </h3>
            <button
              type="button"
              className="bible-study-ref-modal-close"
              onClick={onClose}
              aria-label={t("dict.close")}
            >
              <YvIcon name="close" className="bible-study-ref-modal-close-icon" />
            </button>
          </header>
          <div className="bible-study-ref-modal-body dict-modal-body" aria-busy={state.status === "loading"}>
            {state.status === "loading" ? (
              <div className="dict-skeleton" aria-label={t("dict.loading")}>
                <span />
                <span />
                <span />
              </div>
            ) : state.status === "missing" || !lookup?.entries.length ? (
              <p className="bible-study-ref-modal-text muted" role="status">
                {t("dict.notFound")}
              </p>
            ) : (
              <>
                {showBiblicalForm ? (
                  <p className="dict-modal-form muted">{t("dict.biblicalForm", { word })}</p>
                ) : null}
                {lookup.entries.map((entry) => (
                  <EntryBlock key={entry.id} entry={entry} />
                ))}
              </>
            )}
            {lookup?.expressions.length ? (
              <section className="dict-modal-expressions">
                <h4 className="dict-modal-subtitle">{t("dict.expressions")}</h4>
                {lookup.expressions.map((entry) => (
                  <EntryBlock key={entry.id} entry={entry} />
                ))}
              </section>
            ) : null}
          </div>
          <footer className="bible-study-ref-modal-foot dict-modal-foot">
            <button
              type="button"
              className="bible-study-ref-modal-go"
              onClick={() => {
                onClose();
                onSearchBible(searchQuery);
              }}
            >
              {t("dict.searchBible")}
            </button>
            {state.status === "ready" ? (
              <small className="dict-modal-attribution">{state.attribution}</small>
            ) : null}
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  );
}
