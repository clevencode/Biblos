import { forwardRef } from "react";
import { YvIcon } from "./YvIcon";
import type { YouVersionBook } from "../youversion/client";

export type PassagePickStep = "book" | "chapter" | "verse";

type BiblePassageScrollPickerProps = {
  step: PassagePickStep;
  open: boolean;
  bookId: string;
  bookTitle: string;
  chapterId: string;
  bookSearchQuery: string;
  books: YouVersionBook[];
  chapters: string[];
  verseOptions: number[];
  loading: boolean;
  loadingUi: boolean;
  highlightVerse: number | null;
  verseSelected: (n: number) => boolean;
  onBack: () => void;
  onSearchChange: (value: string) => void;
  onPickBook: (id: string) => void;
  onPickChapter: (id: string) => void;
  onJumpVerse: (n: number) => void;
};

function filterBooks(books: YouVersionBook[], query: string) {
  const q = query
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!q) return books;
  return books.filter((book) => {
    const title = String(book.title || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const id = String(book.id || "").toLowerCase();
    return title.includes(q) || id.includes(q);
  });
}

export const BiblePassageScrollPicker = forwardRef<HTMLDivElement, BiblePassageScrollPickerProps>(
  function BiblePassageScrollPicker(
    {
      step,
      open,
      bookId,
      bookTitle,
      chapterId,
      bookSearchQuery,
      books,
      chapters,
      verseOptions,
      loading,
      loadingUi,
      highlightVerse,
      verseSelected,
      onBack,
      onSearchChange,
      onPickBook,
      onPickChapter,
      onJumpVerse,
    },
    ref,
  ) {
    if (!open) return null;

    const ariaLabel =
      step === "book"
        ? "Liste des livres"
        : step === "chapter"
          ? `Chapitres de ${bookTitle}`
          : `Versets du chapitre ${chapterId}`;

    return (
      <div
        ref={ref}
        className={`bible-yv-passage-scroll-panel is-open is-header-roll is-${step}`}
        role="dialog"
        aria-modal="false"
        aria-label={ariaLabel}
      >
        {step === "book" ? (
          <div className="bible-yv-pick-roll-search">
            <YvIcon name="search" opsz={20} className="bible-yv-pick-roll-search-icon" />
            <input
              type="search"
              className="bible-yv-pick-search"
              value={bookSearchQuery}
              placeholder="Rechercher…"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              aria-label="Rechercher un livre"
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
        ) : step === "verse" ? (
          <div className="bible-yv-pick-roll-subhead">
            <button
              type="button"
              className="bible-yv-pick-roll-back"
              onClick={onBack}
              aria-label={`Retour aux chapitres de ${bookTitle}`}
            >
              <YvIcon name="chevron_left" className="bible-yv-pick-exit-icon" />
            </button>
            <span className="bible-yv-pick-roll-subhead-label">Verset</span>
          </div>
        ) : step === "chapter" ? (
          <div className="bible-yv-pick-roll-subhead">
            <button
              type="button"
              className="bible-yv-pick-roll-back"
              onClick={onBack}
              aria-label={`Retour à la liste des livres`}
            >
              <YvIcon name="chevron_left" className="bible-yv-pick-exit-icon" />
            </button>
            <span className="bible-yv-pick-roll-subhead-label">{bookTitle}</span>
          </div>
        ) : null}
        <div className={`bible-yv-pick-grid${step === "book" ? " is-books" : ""}`} role="listbox">
          {step === "book"
            ? (() => {
                const filtered = filterBooks(books, bookSearchQuery);
                if (!filtered.length) {
                  return (
                    <p className="bible-yv-pick-loading bible-yv-muted bible-yv-pick-roll-empty">
                      Aucun livre trouvé
                    </p>
                  );
                }
                return filtered.map((book) => {
                  const on = book.id.toUpperCase() === bookId.toUpperCase();
                  return (
                    <button
                      key={book.id}
                      id={`bible-pick-book-${book.id}`}
                      type="button"
                      role="option"
                      aria-selected={on}
                      className={`bible-yv-pick-cell is-book${on ? " is-on" : ""}`}
                      onClick={() => onPickBook(book.id)}
                      disabled={loading}
                    >
                      {book.title}
                    </button>
                  );
                });
              })()
            : step === "chapter"
              ? chapters.map((id) => {
                  const on = id === chapterId;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="option"
                      aria-selected={on}
                      className={`bible-yv-pick-cell${on ? " is-on" : ""}`}
                      onClick={() => onPickChapter(id)}
                      disabled={loading}
                    >
                      {id}
                    </button>
                  );
                })
              : verseOptions.map((n) => {
                  const on = highlightVerse === n || verseSelected(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      role="option"
                      aria-selected={on}
                      className={`bible-yv-pick-cell${on ? " is-on" : ""}`}
                      onClick={() => onJumpVerse(n)}
                      disabled={loading}
                    >
                      {n}
                    </button>
                  );
                })}
        </div>
        {step === "book" && !books.length ? (
          <p className="bible-yv-pick-loading bible-yv-muted bible-yv-pick-roll-empty">
            Préparation de la liste…
          </p>
        ) : null}
        {step === "verse" && loadingUi ? (
          <p className="bible-yv-pick-loading bible-yv-muted bible-yv-pick-roll-empty">Ouverture…</p>
        ) : null}
        {step === "verse" && !loadingUi && !verseOptions.length ? (
          <p className="bible-yv-pick-loading bible-yv-muted bible-yv-pick-roll-empty">Aucun verset</p>
        ) : null}
        <div className="bible-yv-passage-scroll-edge" aria-hidden />
      </div>
    );
  },
);
