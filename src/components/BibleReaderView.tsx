import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from "react";
import {
  adjacentChapter,
  chapterUsfm,
  fetchBooks,
  fetchPassage,
  parseUsfmParts,
  LSG_BIBLE_ID,
  type YouVersionBible,
  type YouVersionBook,
  type YouVersionPassage,
} from "../youversion/client";
import { formatVerseCardFront } from "../youversion/usfm";
import { createVerseFlashcard, verseCardId } from "../verseCard";
import { DEFAULT_VERSE_COLOR, VERSE_COLORS, normalizeVerseColor } from "../verseColors";
import type { Flashcard } from "../types";

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
  /** Après création d’une VERSECARD (catalogue local). */
  onFlashcardCreated?: (card: Flashcard) => void;
  /** Ids des VERSECARD déjà enregistrées (ex. verse-HAG.2.10). */
  existingVerseCardIds?: ReadonlySet<string>;
  /** Couleurs actuelles des VERSECARD (id → hex). */
  existingVerseCardColors?: ReadonlyMap<string, string>;
  /** Persiste une nouvelle couleur sur un flashcard existant. */
  onUpdateVerseCardColor?: (cardId: string, color: string) => void;
  /** Ouvre Cartes sur la flashcard du verset. */
  onViewFlashcard?: (cardId: string) => void;
  /** Lecture immersive : chrome (tabs) masqué au scroll. */
  onReadingChromeChange?: (hidden: boolean) => void;
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
  onFlashcardCreated,
  existingVerseCardIds,
  existingVerseCardColors,
  onUpdateVerseCardColor,
  onViewFlashcard,
  onReadingChromeChange,
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
  const [passageStep, setPassageStep] = useState<"book" | "chapter" | "verse">("book");
  const [cardBusy, setCardBusy] = useState(false);
  const [cardMsg, setCardMsg] = useState<string | null>(null);
  const [cardColor, setCardColor] = useState(DEFAULT_VERSE_COLOR);
  const [chromeHidden, setChromeHidden] = useState(false);
  const statusId = useId();
  const highlightRef = useRef<HTMLElement | null>(null);
  const dockLocationRef = useRef<HTMLButtonElement | null>(null);
  const passageScrollRef = useRef<HTMLElement | null>(null);
  const lastScrollTop = useRef(0);
  const scrollAcc = useRef(0);
  const chromeHiddenRef = useRef(false);
  const chromeLockUntil = useRef(0);
  const forceChromeRef = useRef(false);
  const scrollRaf = useRef(0);
  const readerRef = useRef<HTMLElement | null>(null);
  const pendingVerseStep = useRef(false);
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
    if (!pickerOpen) return;
    const id = window.setTimeout(() => dockLocationRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen || passageStep !== "book") return;
    const root = document.querySelector(".bible-yv-pick-grid.is-books") as HTMLElement | null;
    const cell = document.getElementById(`bible-pick-book-${bookId}`);
    if (!root || !cell) return;
    const top = cell.offsetTop - Math.max(8, (root.clientHeight - cell.clientHeight) / 3);
    root.scrollTop = Math.max(0, Math.min(top, root.scrollHeight - root.clientHeight));
  }, [pickerOpen, passageStep, bookId]);

  useEffect(() => {
    if (!pickerOpen || !pendingVerseStep.current) return;
    if (loading) return;
    pendingVerseStep.current = false;
    setPassageStep("verse");
  }, [pickerOpen, loading, chapterId, passage?.id]);

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
    setCardMsg(null);
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
    setSelectedVerse((current) => {
      const next = current === number ? null : number;
      setHighlightVerse(next);
      if (next != null) setCardColor(DEFAULT_VERSE_COLOR);
      return next;
    });
    setCardMsg(null);
    setPickerOpen(false);
  }

  function jumpToVerse(number: number) {
    setSelectedVerse(number);
    setHighlightVerse(number);
    setCardColor(DEFAULT_VERSE_COLOR);
    setCardMsg(null);
    setPickerOpen(false);
  }

  function closePicker() {
    setPickerOpen(false);
    setPassageStep("book");
    pendingVerseStep.current = false;
  }

  function togglePicker() {
    setPickerOpen((open) => {
      const next = !open;
      if (next) {
        setPassageStep("book");
        pendingVerseStep.current = false;
      }
      return next;
    });
  }

  function pickBook(nextBook: string) {
    pendingVerseStep.current = false;
    setPassageStep("chapter");
    if (nextBook.toUpperCase() === bookId.toUpperCase()) return;
    void loadChapter(nextBook, "1", null);
  }

  function pickChapter(nextChapter: string) {
    if (nextChapter === chapterId && passage?.verses?.length) {
      setPassageStep("verse");
      return;
    }
    pendingVerseStep.current = true;
    void loadChapter(bookId, nextChapter, null);
  }

  function closeCreateCard() {
    setSelectedVerse(null);
    setHighlightVerse(null);
    setCardMsg(null);
    setCardColor(DEFAULT_VERSE_COLOR);
  }

  async function makeFlashcard() {
    if (!selectedVerse || !passage?.verses?.length || cardBusy) return;
    const verse = passage.verses.find((item) => item.number === selectedVerse);
    if (!verse?.text?.trim()) return;
    const title = selectedBook?.title ?? bookId;
    const frente = formatVerseCardFront(title, chapterId, selectedVerse);
    const usfm = `${chapterUsfm(bookId, chapterId)}.${selectedVerse}`;
    setCardBusy(true);
    setCardMsg(null);
    try {
      const result = createVerseFlashcard({
        frente,
        verso: verse.text.trim(),
        usfm,
        color: cardColor,
      });
      if (!result.ok) {
        setCardMsg(result.error);
        return;
      }
      onFlashcardCreated?.(result.card);
      setCardMsg(`Flashcard · ${frente}`);
    } finally {
      setCardBusy(false);
    }
  }

  const selectedBook = books.find((b) => b.id.toUpperCase() === bookId.toUpperCase());
  const chapters =
    selectedBook?.chapters?.length
      ? selectedBook.chapters.map((c) => c.id)
      : Array.from({ length: 50 }, (_, i) => String(i + 1));

  const canPrev = Boolean(adjacentChapter(books, bookId, chapterId, -1));
  const canNext = Boolean(adjacentChapter(books, bookId, chapterId, 1));
  const bookTitle = selectedBook?.title ?? bookId;
  const locationLabel =
    selectedVerse != null ? `${bookTitle} ${chapterId}.${selectedVerse}` : `${bookTitle} ${chapterId}`;
  const verseOptions =
    passage?.verses?.map((verse) => verse.number) ??
    (selectedVerse != null ? [selectedVerse] : []);
  const selectedVerseText =
    selectedVerse && passage?.verses
      ? (passage.verses.find((item) => item.number === selectedVerse)?.text?.trim() ?? "")
      : "";
  const selectedVerseCardId = useMemo(() => {
    if (selectedVerse == null) return null;
    return verseCardId(`${chapterUsfm(bookId, chapterId)}.${selectedVerse}`);
  }, [bookId, chapterId, selectedVerse]);
  const existingVerseCard =
    Boolean(selectedVerseCardId && existingVerseCardIds?.has(selectedVerseCardId));

  useEffect(() => {
    if (!selectedVerseCardId) return;
    const stored = existingVerseCardColors?.get(selectedVerseCardId);
    setCardColor(stored ? normalizeVerseColor(stored) : DEFAULT_VERSE_COLOR);
  }, [selectedVerseCardId, existingVerseCardColors]);

  function pickVerseColor(hex: string) {
    const next = normalizeVerseColor(hex);
    setCardColor(next);
    if (existingVerseCard && selectedVerseCardId && onUpdateVerseCardColor) {
      onUpdateVerseCardColor(selectedVerseCardId, next);
    }
  }

  const showCreateCard = Boolean(selectedVerse && selectedVerseText && !planReading && !pickerOpen);
  const forceChrome = pickerOpen || showCreateCard;
  const hideChrome = chromeHidden && !forceChrome;
  forceChromeRef.current = forceChrome;
  const dockPickLabel =
    !pickerOpen
      ? locationLabel
      : passageStep === "book"
        ? "Livre"
        : passageStep === "chapter"
          ? bookTitle
          : `${bookTitle} ${chapterId}`;

  const setReadingChrome = useEffectEvent((hidden: boolean) => {
    if (chromeHiddenRef.current === hidden) return;
    const now = performance.now();
    // Only throttle re-hide right after a reveal — upward reveal stays snappy.
    if (hidden && now < chromeLockUntil.current) return;
    chromeHiddenRef.current = hidden;
    chromeLockUntil.current = now + (hidden ? 220 : 140);

    // Apply both chrome classes in the same frame (avoids dock/tabs lag jitter).
    readerRef.current?.classList.toggle("is-chrome-hidden", hidden);
    document.querySelector(".app.biblos-shell")?.classList.toggle("is-bible-chrome-hidden", hidden);

    setChromeHidden(hidden);
    onReadingChromeChange?.(hidden);
  });

  useEffect(() => {
    if (!forceChrome) return;
    chromeLockUntil.current = 0;
    setReadingChrome(false);
  }, [forceChrome, setReadingChrome]);

  useEffect(() => {
    return () => {
      document.querySelector(".app.biblos-shell")?.classList.remove("is-bible-chrome-hidden");
      onReadingChromeChange?.(false);
    };
  }, [onReadingChromeChange]);

  useEffect(() => {
    setReadingChrome(false);
    lastScrollTop.current = 0;
    scrollAcc.current = 0;
    chromeLockUntil.current = 0;
  }, [bookId, chapterId, planReading?.label, setReadingChrome]);

  useEffect(() => {
    const root = passageScrollRef.current;
    if (!root) return;

    const onScroll = () => {
      if (scrollRaf.current) return;
      scrollRaf.current = window.requestAnimationFrame(() => {
        scrollRaf.current = 0;
        const top = root.scrollTop;
        const delta = top - lastScrollTop.current;
        lastScrollTop.current = top;

        if (forceChromeRef.current) {
          scrollAcc.current = 0;
          return;
        }

        if (top <= 10) {
          scrollAcc.current = 0;
          setReadingChrome(false);
          return;
        }

        if (Math.abs(delta) < 0.5) return;

        const hidden = chromeHiddenRef.current;
        const locked = performance.now() < chromeLockUntil.current;

        // While locked after reveal, ignore downward noise; still accept upward.
        if (locked && !hidden && delta >= 0) {
          scrollAcc.current = 0;
          return;
        }

        if ((delta > 0 && scrollAcc.current < 0) || (delta < 0 && scrollAcc.current > 0)) {
          scrollAcc.current = 0;
        }
        // Weight upward flicks so chrome returns without reaching the top.
        scrollAcc.current += hidden && delta < 0 ? delta * 1.6 : delta;

        if (!hidden && scrollAcc.current > 36) {
          scrollAcc.current = 0;
          setReadingChrome(true);
        } else if (hidden && scrollAcc.current < -6) {
          scrollAcc.current = 0;
          setReadingChrome(false);
        }
      });
    };

    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (scrollRaf.current) {
        window.cancelAnimationFrame(scrollRaf.current);
        scrollRaf.current = 0;
      }
    };
  }, [setReadingChrome]);

  return (
    <section
      ref={readerRef}
      className={`bible-reader bible-reader--yv${hideChrome ? " is-chrome-hidden" : ""}`}
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
            setPassageStep("book");
            onBack?.();
          }
          return;
        }
        if (event.key === "Escape") {
          if (pickerOpen) {
            event.preventDefault();
            closePicker();
            return;
          }
        }
        if (pickerOpen) return;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          goAdjacent(-1);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          goAdjacent(1);
        }
      }}
      tabIndex={-1}
    >
      <header className="bible-yv-top" aria-label="Navigation biblique">
        <div className="bible-yv-font" role="group" aria-label="Taille du texte">
          <button
            type="button"
            className="bible-yv-font-btn"
            onClick={() => setFontSize((n) => Math.max(FONT_MIN, n - 1))}
            disabled={fontSize <= FONT_MIN}
            aria-label="Réduire la taille du texte"
          >
            A−
          </button>
          <button
            type="button"
            className="bible-yv-font-btn"
            onClick={() => setFontSize((n) => Math.min(FONT_MAX, n + 1))}
            disabled={fontSize >= FONT_MAX}
            aria-label="Augmenter la taille du texte"
          >
            A+
          </button>
        </div>
        <div className="bible-yv-top-actions">
          <span className="bible-yv-version" title={bible?.title || "La Bible Segond 1910"}>
            LSG
          </span>
        </div>
      </header>

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

      <article
        ref={passageScrollRef}
        className="bible-passage"
        aria-busy={loading}
        style={{ ["--verse-tint" as string]: cardColor }}
        onClick={() => {
          if (pickerOpen) {
            closePicker();
            return;
          }
          // Tap to reveal chrome (YouVersion).
          if (chromeHiddenRef.current) setReadingChrome(false);
        }}
      >
        <header className="bible-passage-head">
          <p className="bible-book-name">{bookTitle}</p>
          <p className="bible-chapter-num">{chapterId}</p>
        </header>

        {loading && !passage ? (
          <p className="bible-yv-muted bible-loading">Chargement du texte…</p>
        ) : null}

        {passage?.verses?.length ? (
          <div
            className={`bible-verses${selectedVerse != null && !planReading ? " is-dimming" : ""}`}
          >
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

      {showCreateCard ? (
        <div
          className="bible-verse-actions"
          role="region"
          aria-label="Flashcard du verset"
          style={{ ["--verse-tint" as string]: cardColor }}
        >
          <div className="bible-verse-actions-head">
            <p className="bible-verse-actions-ref">
              {formatVerseCardFront(bookTitle, chapterId, selectedVerse!)}
            </p>
            <button
              type="button"
              className="bible-verse-actions-close"
              onClick={closeCreateCard}
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
          <div className="bible-verse-colors" role="group" aria-label="Couleur du surligneur">
            {VERSE_COLORS.map((swatch) => {
              const on = normalizeVerseColor(cardColor) === swatch.hex;
              return (
                <button
                  key={swatch.id}
                  type="button"
                  className={`bible-verse-color${on ? " is-on" : ""}`}
                  style={{ ["--swatch" as string]: swatch.hex }}
                  aria-label={swatch.label}
                  aria-pressed={on}
                  onClick={() => pickVerseColor(swatch.hex)}
                />
              );
            })}
          </div>
          <button
            type="button"
            className="bible-yv-chip is-primary bible-make-card"
            style={{ background: cardColor, borderColor: cardColor }}
            disabled={cardBusy}
            onClick={() => {
              if (existingVerseCard && selectedVerseCardId && onViewFlashcard) {
                onViewFlashcard(selectedVerseCardId);
                return;
              }
              void makeFlashcard();
            }}
          >
            {cardBusy
              ? "Création…"
              : existingVerseCard
                ? "Visualiser flashcard"
                : "Créer flashcard"}
          </button>
          {cardMsg ? <p className="bible-verse-actions-msg">{cardMsg}</p> : null}
        </div>
      ) : null}

      {pickerOpen && !planReading ? (
        <div
          className={`bible-yv-pick-sheet is-${passageStep}`}
          role="dialog"
          aria-label="Choisir livre, chapitre ou verset"
        >
          <div className="bible-yv-pick-sheet-head">
            {passageStep === "verse" ? (
              <button
                type="button"
                className="bible-yv-pick-back"
                onClick={() => setPassageStep("chapter")}
              >
                ← Ch. {chapterId}
              </button>
            ) : passageStep === "chapter" ? (
              <button
                type="button"
                className="bible-yv-pick-back"
                onClick={() => setPassageStep("book")}
              >
                ← {bookTitle}
              </button>
            ) : (
              <span className="bible-yv-pick-title">Choisir un livre</span>
            )}
            {passageStep !== "book" ? (
              <span className="bible-yv-pick-hint">
                {passageStep === "chapter" ? "Chapitre" : "Verset"}
              </span>
            ) : null}
          </div>
          <div
            className={`bible-yv-pick-grid${passageStep === "book" ? " is-books" : ""}`}
            role="listbox"
          >
            {passageStep === "book"
              ? books.map((book) => {
                  const on = book.id.toUpperCase() === bookId.toUpperCase();
                  return (
                    <button
                      key={book.id}
                      id={`bible-pick-book-${book.id}`}
                      type="button"
                      role="option"
                      aria-selected={on}
                      className={`bible-yv-pick-cell is-book${on ? " is-on" : ""}`}
                      onClick={() => pickBook(book.id)}
                      disabled={loading}
                    >
                      {book.title}
                    </button>
                  );
                })
              : passageStep === "chapter"
                ? chapters.map((id) => {
                    const on = id === chapterId;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="option"
                        aria-selected={on}
                        className={`bible-yv-pick-cell${on ? " is-on" : ""}`}
                        onClick={() => pickChapter(id)}
                        disabled={loading}
                      >
                        {id}
                      </button>
                    );
                  })
                : verseOptions.map((n) => {
                    const on = n === selectedVerse;
                    return (
                      <button
                        key={n}
                        type="button"
                        role="option"
                        aria-selected={on}
                        className={`bible-yv-pick-cell${on ? " is-on" : ""}`}
                        onClick={() => jumpToVerse(n)}
                        disabled={loading}
                      >
                        {n}
                      </button>
                    );
                  })}
          </div>
          {passageStep === "book" && !books.length ? (
            <p className="bible-yv-pick-loading bible-yv-muted">Chargement des livres…</p>
          ) : null}
          {passageStep === "verse" && loading ? (
            <p className="bible-yv-pick-loading bible-yv-muted">Chargement…</p>
          ) : null}
          {passageStep === "verse" && !loading && !verseOptions.length ? (
            <p className="bible-yv-pick-loading bible-yv-muted">Aucun verset</p>
          ) : null}
        </div>
      ) : null}

      <footer
        className={`bible-yv-dock${planReading ? " is-plan" : ""}${showCreateCard ? " has-verse-actions" : ""}`}
        aria-label={planReading ? "Lecture du plan" : pickerOpen ? "Choisir livre et passage" : "Chapitre"}
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
              onClick={() => {
                if (pickerOpen) setPassageStep("chapter");
                goAdjacent(-1);
              }}
              disabled={!canPrev || loading}
              aria-label="Chapitre précédent"
            >
              ‹
            </button>
            <button
              ref={dockLocationRef}
              type="button"
              className={`bible-yv-dock-location${pickerOpen ? " is-open" : ""}`}
              onClick={togglePicker}
              aria-expanded={pickerOpen}
              aria-label={
                pickerOpen
                  ? `Fermer le choix · ${locationLabel}`
                  : `Choisir un passage · ${locationLabel}`
              }
            >
              <span className="bible-yv-dock-location-text">{dockPickLabel}</span>
              <span className="bible-yv-dock-caret" aria-hidden="true">
                ▾
              </span>
            </button>
            <button
              type="button"
              className="bible-yv-dock-arrow"
              onClick={() => {
                if (pickerOpen) setPassageStep("chapter");
                goAdjacent(1);
              }}
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
