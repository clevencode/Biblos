import { useEffect, useId, useRef, useState } from "react";
import {
  adjacentChapter,
  chapterUsfm,
  fetchBooks,
  fetchPassage,
  openOnBibleCom,
  parseUsfmParts,
  S21_BIBLE_ID,
  type YouVersionBible,
  type YouVersionBook,
  type YouVersionPassage,
} from "../youversion/client";
import { formatVerseCardFront } from "../youversion/usfm";
import { createVerseFlashcard } from "../verseCard";
import type { Flashcard } from "../types";

const STORAGE_KEY = "biblos-bible-reader";
const FONT_MIN = 16;
const FONT_MAX = 26;
const FONT_DEFAULT = 19;

type ReaderPrefs = {
  bookId?: string;
  chapterId?: string;
  fontSize?: number;
};

type BibleReaderViewProps = {
  /** Référence initiale (ex. Jean 3.16). */
  initialRef?: string;
  /** Navigation externe (rappel → Lecture). */
  focusRef?: string | null;
  focusSeq?: number;
  onBack?: () => void;
  /** Après création d’une VERSECARD (catalogue local). */
  onFlashcardCreated?: (card: Flashcard) => void;
};

function readPrefs(): ReaderPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ReaderPrefs;
  } catch {
    return {};
  }
}

function writePrefs(prefs: ReaderPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode */
  }
}

function isLikelyVerseTitle(text: string, number: number): boolean {
  if (number !== 1) return false;
  const t = text.trim();
  return t.length > 0 && t.length < 48 && !/[.!?…]$/.test(t);
}

export function BibleReaderView({
  initialRef = "Jean 3.16",
  focusRef = null,
  focusSeq = 0,
  onBack,
  onFlashcardCreated,
}: BibleReaderViewProps) {
  const prefs = readPrefs();
  const initialParts = parseUsfmParts(
    prefs.bookId && prefs.chapterId
      ? chapterUsfm(prefs.bookId, prefs.chapterId)
      : initialRef,
  );

  const [query, setQuery] = useState(initialRef);
  const [passage, setPassage] = useState<YouVersionPassage | null>(null);
  const [bible, setBible] = useState<YouVersionBible | null>(null);
  const [bibleId, setBibleId] = useState<number | null>(S21_BIBLE_ID);
  const [usingFallback, setUsingFallback] = useState(false);
  const [books, setBooks] = useState<YouVersionBook[]>([]);
  const [bookId, setBookId] = useState(initialParts.bookId);
  const [chapterId, setChapterId] = useState(initialParts.chapterId);
  const [highlightVerse, setHighlightVerse] = useState<number | null>(
    initialParts.verse ?? null,
  );
  const [selectedVerse, setSelectedVerse] = useState<number | null>(
    initialParts.verse ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [fontSize, setFontSize] = useState(() => {
    const n = Number(prefs.fontSize);
    return Number.isFinite(n) ? Math.min(FONT_MAX, Math.max(FONT_MIN, n)) : FONT_DEFAULT;
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardMsg, setCardMsg] = useState<string | null>(null);
  const statusId = useId();
  const highlightRef = useRef<HTMLElement | null>(null);
  const booted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchBooks();
      if (cancelled) return;
      setHasKey(result.hasKey ?? null);
      if (result.ok && result.books) {
        setBooks(result.books);
        if (result.bible) {
          setBible(result.bible);
          setBibleId(result.bible.id);
        }
        setUsingFallback(Boolean(result.usingFallback));
      } else if (result.error) {
        setError(result.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    writePrefs({ bookId, chapterId, fontSize });
  }, [bookId, chapterId, fontSize]);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const parts = parseUsfmParts(
      prefs.bookId && prefs.chapterId
        ? chapterUsfm(prefs.bookId, prefs.chapterId)
        : initialRef,
    );
    void loadChapter(parts.bookId, parts.chapterId, parts.verse ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!focusSeq || !focusRef?.trim()) return;
    setQuery(focusRef);
    const parts = parseUsfmParts(focusRef);
    void loadChapter(parts.bookId, parts.chapterId, parts.verse ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSeq, focusRef]);

  useEffect(() => {
    if (!highlightVerse || !highlightRef.current) return;
    highlightRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightVerse, passage?.id, loading]);

  async function loadChapter(
    nextBook: string,
    nextChapter: string,
    verse: number | null = null,
  ) {
    setBookId(nextBook);
    setChapterId(nextChapter);
    setHighlightVerse(verse);
    setSelectedVerse(verse);
    setCardMsg(null);
    setPickerOpen(false);
    setLoading(true);
    setError(null);
    const usfm = chapterUsfm(nextBook, nextChapter);
    setQuery(verse ? `${usfm}.${verse}` : usfm);
    const result = await fetchPassage(usfm, bibleId ?? S21_BIBLE_ID);
    setHasKey(result.hasKey ?? null);
    setLoading(false);
    if (!result.ok || !result.passage) {
      setPassage(null);
      setError(result.error ?? "Passage introuvable");
      return;
    }
    setPassage(result.passage);
    if (result.bibleId) setBibleId(result.bibleId);
    if (result.bible) setBible(result.bible);
    if (typeof result.usingFallback === "boolean") setUsingFallback(result.usingFallback);
  }

  async function loadFromQuery(ref: string) {
    const parts = parseUsfmParts(ref);
    await loadChapter(parts.bookId, parts.chapterId, parts.verse ?? null);
    setSearchOpen(false);
  }

  function goAdjacent(delta: -1 | 1) {
    const next = adjacentChapter(books, bookId, chapterId, delta);
    if (!next) return;
    void loadChapter(next.bookId, next.chapterId, null);
  }

  function selectVerse(number: number) {
    setSelectedVerse((current) => (current === number ? null : number));
    setHighlightVerse(number);
    setCardMsg(null);
    setMoreOpen(false);
  }

  async function makeFlashcard() {
    if (!selectedVerse || !passage?.verses?.length || cardBusy) return;
    const verse = passage.verses.find((item) => item.number === selectedVerse);
    if (!verse?.text?.trim()) return;
    const bookTitle = selectedBook?.title ?? bookId;
    const frente = formatVerseCardFront(bookTitle, chapterId, selectedVerse);
    const usfm = `${chapterUsfm(bookId, chapterId)}.${selectedVerse}`;
    setCardBusy(true);
    setCardMsg(null);
    const result = createVerseFlashcard({
      frente,
      verso: verse.text.trim(),
      usfm,
    });
    setCardBusy(false);
    if (!result.ok) {
      setCardMsg(result.error || "Échec de création");
      return;
    }
    onFlashcardCreated?.(result.card);
    setCardMsg(`Flashcard · ${frente}`);
  }

  const selectedBook = books.find((b) => b.id.toUpperCase() === bookId.toUpperCase());
  const selectedVerseText =
    selectedVerse && passage?.verses
      ? passage.verses.find((item) => item.number === selectedVerse)?.text?.trim() ?? ""
      : "";
  const chapters =
    selectedBook?.chapters?.length
      ? selectedBook.chapters.map((c) => c.id)
      : Array.from({ length: 50 }, (_, i) => String(i + 1));

  const canPrev = Boolean(adjacentChapter(books, bookId, chapterId, -1));
  const canNext = Boolean(adjacentChapter(books, bookId, chapterId, 1));
  const bookTitle = selectedBook?.title ?? bookId;
  const locationLabel = `${bookTitle} ${chapterId}`;
  const versionLabel =
    bible?.abbreviation || (bibleId === S21_BIBLE_ID ? "S21" : usingFallback ? "LSG" : "…");

  return (
    <section
      className="bible-reader bible-reader--yv"
      style={{ ["--bible-font-size" as string]: `${fontSize}px` }}
      onKeyDown={(event) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
          return;
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          goAdjacent(-1);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          goAdjacent(1);
        } else if (event.key === "Escape") {
          setSearchOpen(false);
          setPickerOpen(false);
          setMoreOpen(false);
        }
      }}
      tabIndex={-1}
    >
      <header className="bible-yv-top" aria-label="Navigation biblique">
        <button
          type="button"
          className="bible-yv-icon-btn"
          onClick={() => onBack?.()}
          aria-label="Retour"
          disabled={!onBack}
        >
          ←
        </button>
        <div className="bible-yv-top-actions">
          <button
            type="button"
            className={`bible-yv-icon-btn${searchOpen ? " is-on" : ""}`}
            onClick={() => {
              setSearchOpen((v) => !v);
              setMoreOpen(false);
              setPickerOpen(false);
            }}
            aria-expanded={searchOpen}
            aria-label="Rechercher une référence"
          >
            ⌕
          </button>
          <button
            type="button"
            className={`bible-yv-icon-btn${moreOpen ? " is-on" : ""}`}
            onClick={() => {
              setMoreOpen((v) => !v);
              setSearchOpen(false);
            }}
            aria-expanded={moreOpen}
            aria-label="Plus d’options"
          >
            ⋮
          </button>
          <button
            type="button"
            className={`bible-yv-version${usingFallback ? " is-fallback" : ""}`}
            title={
              usingFallback
                ? `${bible?.title ?? "LSG"} — fallback`
                : bible?.title || "La Bible Segond 21"
            }
            onClick={() =>
              openOnBibleCom(chapterUsfm(bookId, chapterId), bibleId ?? S21_BIBLE_ID)
            }
          >
            <span aria-hidden="true">🌐</span>
            {versionLabel}
          </button>
        </div>
      </header>

      {moreOpen ? (
        <div className="bible-yv-more" role="menu">
          <div className="bible-yv-more-row" role="none">
            <span>Taille</span>
            <div className="bible-font" role="group" aria-label="Taille du texte">
              <button
                type="button"
                className="bible-yv-chip"
                onClick={() => setFontSize((n) => Math.max(FONT_MIN, n - 1))}
                disabled={fontSize <= FONT_MIN}
              >
                A−
              </button>
              <button
                type="button"
                className="bible-yv-chip"
                onClick={() => setFontSize((n) => Math.min(FONT_MAX, n + 1))}
                disabled={fontSize >= FONT_MAX}
              >
                A+
              </button>
            </div>
          </div>
          <button
            type="button"
            className="bible-yv-more-link"
            role="menuitem"
            onClick={() =>
              openOnBibleCom(chapterUsfm(bookId, chapterId), bibleId ?? S21_BIBLE_ID)
            }
          >
            Ouvrir sur bible.com
          </button>
        </div>
      ) : null}

      {searchOpen ? (
        <form
          className="bible-search bible-yv-search"
          onSubmit={(e) => {
            e.preventDefault();
            void loadFromQuery(query);
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jean 3.16 ou JHN.3"
            aria-label="Référence biblique"
            autoFocus
          />
          <button type="submit" className="bible-yv-chip is-primary" disabled={loading}>
            Aller
          </button>
        </form>
      ) : null}

      {pickerOpen ? (
        <div className="bible-yv-picker" role="dialog" aria-label="Choisir livre et chapitre">
          <label className="bible-field">
            <span className="sr-only">Livre</span>
            <select
              value={bookId}
              onChange={(e) => void loadChapter(e.target.value, "1", null)}
              disabled={!books.length || loading}
            >
              {books.length ? (
                books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title}
                  </option>
                ))
              ) : (
                <option value={bookId}>{bookId}</option>
              )}
            </select>
          </label>
          <label className="bible-field bible-field--chapter">
            <span className="sr-only">Chapitre</span>
            <select
              value={chapterId}
              onChange={(e) => void loadChapter(bookId, e.target.value, null)}
              disabled={loading}
            >
              {chapters.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div id={statusId} className="sr-only" aria-live="polite">
        {loading ? "Chargement du chapitre…" : error ? error : locationLabel}
      </div>

      {error ? (
        <p className="bible-yv-error" role="alert">
          {error}
        </p>
      ) : null}

      <article className="bible-passage" aria-busy={loading}>
        <header className="bible-passage-head">
          <p className="bible-book-name">{bookTitle}</p>
          <p className="bible-chapter-num">{chapterId}</p>
          {hasKey === false ? (
            <p className="bible-yv-muted">Clé YouVersion manquante dans .env</p>
          ) : null}
        </header>

        {loading && !passage ? (
          <p className="bible-yv-muted bible-loading">Chargement du texte…</p>
        ) : null}

        {passage?.verses?.length ? (
          <div className="bible-verses">
            {passage.verses.map((verse) => {
              const active = highlightVerse === verse.number;
              const selected = selectedVerse === verse.number;
              const titleLike = isLikelyVerseTitle(verse.text, verse.number);
              return (
                <button
                  key={verse.number}
                  type="button"
                  className={[
                    "bible-verse",
                    active ? "is-focus" : "",
                    selected ? "is-selected" : "",
                    titleLike ? "is-title" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-verse={verse.number}
                  aria-label={`Verset ${verse.number}`}
                  aria-pressed={selected}
                  ref={
                    active
                      ? (el) => {
                          highlightRef.current = el;
                        }
                      : undefined
                  }
                  onClick={() => selectVerse(verse.number)}
                >
                  <sup className="bible-verse-num">{verse.number}</sup>
                  <span className="bible-verse-text">{verse.text}</span>
                </button>
              );
            })}
          </div>
        ) : passage?.content ? (
          <p className="bible-text">{passage.content}</p>
        ) : !loading ? (
          <p className="bible-yv-muted">Choisis un livre et un chapitre pour lire.</p>
        ) : null}
      </article>

      {selectedVerse && selectedVerseText ? (
        <div className="bible-verse-actions" role="region" aria-label="Flashcard du verset">
          <p className="bible-verse-actions-ref">
            {formatVerseCardFront(selectedBook?.title ?? bookId, chapterId, selectedVerse)}
          </p>
          <button
            type="button"
            className="bible-yv-chip is-primary bible-make-card"
            disabled={cardBusy}
            onClick={() => makeFlashcard()}
          >
            {cardBusy ? "Création…" : "Créer flashcard"}
          </button>
          {cardMsg ? <p className="bible-verse-actions-msg">{cardMsg}</p> : null}
        </div>
      ) : null}

      <footer className="bible-yv-dock" aria-label="Chapitre">
        <div className="bible-yv-dock-nav">
          <button
            type="button"
            className="bible-yv-dock-arrow"
            onClick={() => goAdjacent(-1)}
            disabled={!canPrev || loading}
            aria-label="Chapitre précédent"
          >
            ‹
          </button>
          <button
            type="button"
            className="bible-yv-dock-location"
            onClick={() => {
              setPickerOpen((v) => !v);
              setSearchOpen(false);
              setMoreOpen(false);
            }}
            aria-expanded={pickerOpen}
          >
            {locationLabel}
          </button>
          <button
            type="button"
            className="bible-yv-dock-arrow"
            onClick={() => goAdjacent(1)}
            disabled={!canNext || loading}
            aria-label="Chapitre suivant"
          >
            ›
          </button>
        </div>
      </footer>
    </section>
  );
}
