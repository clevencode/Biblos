import { useEffect, useId, useRef, useState } from "react";
import {
  adjacentChapter,
  chapterUsfm,
  fetchBooks,
  fetchPassage,
  openOnBibleCom,
  parseUsfmParts,
  LSG_BIBLE_ID,
  type YouVersionBible,
  type YouVersionBook,
  type YouVersionPassage,
} from "../youversion/client";

const STORAGE_KEY = "biblos-bible-reader";
const BOOKS_CACHE_KEY = "biblos-bible-books-lsg";
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
  /** Mode lecture de plan : un pas = un chapitre, › = chapitre suivant. */
  planReading?: {
    label: string;
    isFirst: boolean;
    isLast: boolean;
    verseStart?: number | null;
    verseEnd?: number | null;
    onPrev: () => void;
    onAdvance: () => void;
  } | null;
};

/** Ids USFM (JHN, 1SA) — ignore un livre fantôme type VERSECARD. */
function isUsfmBookId(id: string): boolean {
  return /^[1-3]?[A-Z]{2,3}$/i.test(String(id || "").trim());
}

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

function readBooksCache(): { bible: YouVersionBible; books: YouVersionBook[] } | null {
  try {
    const raw = localStorage.getItem(BOOKS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { bible?: YouVersionBible; books?: YouVersionBook[]; at?: number };
    if (!parsed?.books?.length) return null;
    if (parsed.at && Date.now() - parsed.at > 7 * 86_400_000) return null;
    return {
      bible: parsed.bible ?? {
        id: LSG_BIBLE_ID,
        abbreviation: "LSG",
        title: "Louis Segond 1910",
        languageCode: "fr",
      },
      books: parsed.books,
    };
  } catch {
    return null;
  }
}

function writeBooksCache(bible: YouVersionBible | null, books: YouVersionBook[]) {
  try {
    localStorage.setItem(
      BOOKS_CACHE_KEY,
      JSON.stringify({
        at: Date.now(),
        bible: bible ?? {
          id: LSG_BIBLE_ID,
          abbreviation: "LSG",
          title: "Louis Segond 1910",
          languageCode: "fr",
        },
        books,
      }),
    );
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
  planReading = null,
}: BibleReaderViewProps) {
  const prefs = readPrefs();
  const prefsBookOk = isUsfmBookId(prefs.bookId || "");
  const initialParts = parseUsfmParts(
    prefsBookOk && prefs.chapterId
      ? chapterUsfm(prefs.bookId!, prefs.chapterId)
      : initialRef,
  );

  const [passage, setPassage] = useState<YouVersionPassage | null>(null);
  const [bible, setBible] = useState<YouVersionBible | null>(() => readBooksCache()?.bible ?? null);
  const [bibleId, setBibleId] = useState<number | null>(LSG_BIBLE_ID);
  const [books, setBooks] = useState<YouVersionBook[]>(() => readBooksCache()?.books ?? []);
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
  const [fontSize, setFontSize] = useState(() => {
    const n = Number(prefs.fontSize);
    return Number.isFinite(n) ? Math.min(FONT_MAX, Math.max(FONT_MIN, n)) : FONT_DEFAULT;
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const statusId = useId();
  const highlightRef = useRef<HTMLElement | null>(null);
  const booted = useRef(false);
  const loadGen = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cached = readBooksCache();
      if (cached && !cancelled) {
        setBooks(cached.books);
        setBible(cached.bible);
        setBibleId(cached.bible.id);
      }
      const result = await fetchBooks();
      if (cancelled) return;
      if (result.ok && result.books?.length) {
        setBooks(result.books);
        if (result.bible) {
          setBible(result.bible);
          setBibleId(result.bible.id);
        }
        writeBooksCache(result.bible ?? null, result.books);
      } else if (result.error && !cached?.books.length) {
        setError(result.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isUsfmBookId(bookId)) {
      writePrefs({ bookId, chapterId, fontSize });
      return;
    }
    writePrefs({ fontSize });
  }, [bookId, chapterId, fontSize]);

  useEffect(() => {
    if (!books.length) return;
    const known = books.some((b) => b.id.toUpperCase() === bookId.toUpperCase());
    if (known) return;
    const fallback = books[0]!;
    void loadChapter(fallback.id, fallback.chapters?.[0]?.id ?? "1", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books, bookId]);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void loadChapter(initialParts.bookId, initialParts.chapterId, initialParts.verse ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!focusSeq || !focusRef?.trim()) return;
    const parts = parseUsfmParts(focusRef);
    if (!isUsfmBookId(parts.bookId)) return;
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
    const gen = ++loadGen.current;
    setBookId(nextBook);
    setChapterId(nextChapter);
    setHighlightVerse(verse);
    setSelectedVerse(verse);
    setPickerOpen(false);
    setLoading(true);
    setError(null);
    const usfm = chapterUsfm(nextBook, nextChapter);
    const result = await fetchPassage(usfm);
    if (gen !== loadGen.current) return;
    setLoading(false);
    if (!result.ok || !result.passage) {
      // Garde le texte précédent en cas de rate limit / erreur transitoire
      setError(result.error ?? "Passage introuvable");
      return;
    }
    setPassage(result.passage);
    setError(null);
    if (result.bibleId) setBibleId(result.bibleId);
    if (result.bible) setBible(result.bible);
  }

  function goAdjacent(delta: -1 | 1) {
    const next = adjacentChapter(books, bookId, chapterId, delta);
    if (!next) return;
    void loadChapter(next.bookId, next.chapterId, null);
  }

  function selectVerse(number: number) {
    setSelectedVerse((current) => (current === number ? null : number));
    setHighlightVerse(number);
    setMoreOpen(false);
  }

  const selectedBook = books.find((b) => b.id.toUpperCase() === bookId.toUpperCase());
  const chapters =
    selectedBook?.chapters?.length
      ? selectedBook.chapters.map((c) => c.id)
      : Array.from({ length: 50 }, (_, i) => String(i + 1));

  const canPrev = Boolean(adjacentChapter(books, bookId, chapterId, -1));
  const canNext = Boolean(adjacentChapter(books, bookId, chapterId, 1));
  const bookTitle = selectedBook?.title ?? bookId;
  const locationLabel = `${bookTitle} ${chapterId}`;

  return (
    <section
      className="bible-reader bible-reader--yv"
      style={{ ["--bible-font-size" as string]: `${fontSize}px` }}
      onKeyDown={(event) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
          return;
        }
        if (planReading) {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            if (!planReading.isFirst) planReading.onPrev();
          } else if (event.key === "ArrowRight" || event.key === "Enter") {
            event.preventDefault();
            planReading.onAdvance();
          } else if (event.key === "Escape") {
            setPickerOpen(false);
            setMoreOpen(false);
            onBack?.();
          }
          return;
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          goAdjacent(-1);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          goAdjacent(1);
        } else if (event.key === "Escape") {
          setPickerOpen(false);
          setMoreOpen(false);
        }
      }}
      tabIndex={-1}
    >
      <header className="bible-yv-top" aria-label="Navigation biblique">
        <p className="bible-yv-top-title">{locationLabel}</p>
        <div className="bible-yv-top-actions">
          <button
            type="button"
            className={`bible-yv-icon-btn${moreOpen ? " is-on" : ""}`}
            onClick={() => {
              setMoreOpen((v) => !v);
              setPickerOpen(false);
            }}
            aria-expanded={moreOpen}
            aria-label="Plus d’options"
          >
            ⋮
          </button>
          <span className="bible-yv-version" title={bible?.title || "La Bible Segond 1910"}>
            LSG
          </span>
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
              openOnBibleCom(chapterUsfm(bookId, chapterId), bibleId ?? LSG_BIBLE_ID)
            }
          >
            Ouvrir sur midvash.com
          </button>
        </div>
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
        <div className="bible-yv-error-bar" role="alert">
          <p className="bible-yv-error">{error}</p>
          <button
            type="button"
            className="bible-yv-chip"
            onClick={() => void loadChapter(bookId, chapterId, highlightVerse)}
            disabled={loading}
          >
            Réessayer
          </button>
        </div>
      ) : null}

      <article className="bible-passage" aria-busy={loading}>
        <header className="bible-passage-head">
          <p className="bible-book-name">{bookTitle}</p>
          <p className="bible-chapter-num">{chapterId}</p>
        </header>

        {loading && !passage ? (
          <p className="bible-yv-muted bible-loading">Chargement du texte…</p>
        ) : null}

        {passage?.verses?.length ? (
          <div className="bible-verses">
            {passage.verses.map((verse) => {
              const inPlanRange = Boolean(
                planReading &&
                  (() => {
                    const start = planReading.verseStart;
                    const end = planReading.verseEnd;
                    if (start == null || end == null) return true;
                    const a = Math.min(start, end);
                    const b = Math.max(start, end);
                    return verse.number >= a && verse.number <= b;
                  })(),
              );
              const rangeStart =
                planReading?.verseStart != null
                  ? Math.min(
                      planReading.verseStart,
                      planReading.verseEnd ?? planReading.verseStart,
                    )
                  : null;
              const rangeEnd =
                planReading?.verseEnd != null
                  ? Math.max(
                      planReading.verseStart ?? planReading.verseEnd,
                      planReading.verseEnd,
                    )
                  : null;
              const isRangeAnchor = planReading
                ? rangeStart != null
                  ? verse.number === rangeStart
                  : verse.number === (passage.verses?.[0]?.number ?? 1)
                : highlightVerse === verse.number;
              const active = planReading ? inPlanRange : highlightVerse === verse.number;
              const selected = planReading ? false : selectedVerse === verse.number;
              const titleLike = isLikelyVerseTitle(verse.text, verse.number);
              const rangeEdge =
                planReading && inPlanRange
                  ? verse.number === rangeStart
                    ? "is-range-start"
                    : verse.number === rangeEnd
                      ? "is-range-end"
                      : "is-range-mid"
                  : "";
              return (
                <button
                  key={verse.number}
                  type="button"
                  className={[
                    "bible-verse",
                    active ? "is-focus" : "",
                    selected ? "is-selected" : "",
                    planReading && inPlanRange ? "is-plan-range" : "",
                    rangeEdge,
                    titleLike ? "is-title" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-verse={verse.number}
                  aria-label={`Verset ${verse.number}`}
                  aria-pressed={selected || (planReading ? inPlanRange : false)}
                  ref={
                    isRangeAnchor
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

      <footer
        className={`bible-yv-dock${planReading ? " is-plan" : ""}`}
        aria-label={planReading ? "Lecture du plan" : "Chapitre"}
      >
        {planReading ? (
          <div className="bible-yv-dock-nav bible-yv-dock-nav--plan">
            <button
              type="button"
              className="bible-yv-dock-arrow"
              onClick={planReading.onPrev}
              disabled={planReading.isFirst}
              aria-label="Chapitre précédent"
            >
              ‹
            </button>
            <span className="bible-yv-dock-location is-static">{planReading.label}</span>
            <button
              type="button"
              className={`bible-yv-dock-advance${planReading.isLast ? " is-complete" : ""}`}
              onClick={planReading.onAdvance}
              aria-label={planReading.isLast ? "Conclure la lecture du jour" : "Chapitre suivant du jour"}
            >
              {planReading.isLast ? "✓" : "›"}
            </button>
          </div>
        ) : (
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
        )}
      </footer>
    </section>
  );
}
