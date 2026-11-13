/**
 * Modal de busca de livros — lista dinâmica do manifesto/catálogo da versão ativa.
 * Sem nomes hardcoded: HT98 → títulos em Kreyòl; S21 → títulos FR.
 */

import { useEffect, useId, useMemo, useState } from "react";
import { YvIcon } from "./YvIcon";
import { normalizeQuery } from "../bible/passageDiscovery/normalizeQuery";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import type { YouVersionBook } from "../youversion/client";
import { versionBadgeFor } from "../bible/readingScope";

export type SearchBooksPick = {
  usfm: string;
  chapter: number;
  localizedBookName: string;
};

export type SearchBooksModalProps = {
  open: boolean;
  onClose: () => void;
  books: YouVersionBook[];
  versionId: BibleTextVersionId;
  onPick: (pick: SearchBooksPick) => void;
};

function chaptersCount(book: YouVersionBook): number {
  return book.chapters?.length ?? 0;
}

export function SearchBooksModal({
  open,
  onClose,
  books,
  versionId,
  onPick,
}: SearchBooksModalProps) {
  const titleId = useId();
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<YouVersionBook | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(null);
  }, [open, versionId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selected) {
          setSelected(null);
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, selected]);

  const filtered = useMemo(() => {
    const q = normalizeQuery(query);
    if (!q) return books;
    return books.filter((book) => {
      const title = normalizeQuery(book.title || book.fullTitle || "");
      const abbr = normalizeQuery(book.abbreviation || "");
      const id = normalizeQuery(book.id);
      return title.includes(q) || abbr.includes(q) || id.includes(q);
    });
  }, [books, query]);

  if (!open) return null;

  const badge = versionBadgeFor(versionId);

  return (
    <div
      className="bible-search-sheet bible-search-books-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <header className="bible-search-sheet-head">
        <button
          type="button"
          className="bible-search-sheet-back"
          onClick={() => {
            if (selected) {
              setSelected(null);
              return;
            }
            onClose();
          }}
          aria-label={selected ? "Retour aux livres" : "Fermer"}
        >
          <YvIcon name="chevron_left" className="bible-search-sheet-back-icon" />
        </button>
        <h2 className="bible-search-sheet-title" id={titleId}>
          {selected
            ? selected.title || selected.id
            : `Livres · ${badge}`}
        </h2>
        <span className="bible-search-sheet-spacer" aria-hidden />
      </header>

      {!selected ? (
        <>
          <div className="bible-search-sheet-field">
            <label className="sr-only" htmlFor={inputId}>
              Rechercher un livre
            </label>
            <div className="bible-search-sheet-input-wrap">
              <YvIcon name="search" className="bible-search-sheet-search-icon" />
              <input
                id={inputId}
                type="search"
                className="bible-search-sheet-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  versionId === "ht98"
                    ? "Jenèz, Sòm, Jan…"
                    : "Genèse, Psaumes, Jean…"
                }
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </div>

          <ul className="bible-search-books-list" aria-label="Livres">
            {filtered.length === 0 ? (
              <li className="bible-search-books-empty muted">Aucun livre</li>
            ) : (
              filtered.map((book) => (
                <li key={book.id}>
                  <button
                    type="button"
                    className="bible-search-books-item"
                    onClick={() => setSelected(book)}
                  >
                    <span className="bible-search-books-title">
                      {book.title || book.fullTitle || book.id}
                    </span>
                    <span className="bible-search-books-meta muted">
                      {chaptersCount(book)} ch.
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </>
      ) : (
        <div className="bible-search-books-chapters">
          <p className="bible-search-sheet-meta">
            {chaptersCount(selected)} chapitre
            {chaptersCount(selected) === 1 ? "" : "s"}
          </p>
          <div
            className="bible-search-books-grid"
            role="list"
            aria-label="Chapitres"
          >
            {selected.chapters.map((ch) => {
              const n = Number(ch.id) || 1;
              return (
                <button
                  key={ch.id}
                  type="button"
                  className="bible-search-books-chapter"
                  role="listitem"
                  onClick={() => {
                    onPick({
                      usfm: selected.id.toUpperCase(),
                      chapter: n,
                      localizedBookName:
                        selected.title || selected.fullTitle || selected.id,
                    });
                    onClose();
                  }}
                >
                  {ch.id}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
