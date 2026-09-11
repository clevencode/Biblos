import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
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
import { createVerseFlashcard, verseCardId } from "../verseCard";
import { DEFAULT_VERSE_COLOR, VERSE_COLORS, normalizeVerseColor } from "../verseColors";
import type { Flashcard } from "../types";

const STORAGE_KEY = "biblos-bible-reader";
const BOOKS_CACHE_KEY = "biblos-bible-books-lsg";
const FONT_MIN = 16;
const FONT_MAX = 26;
const FONT_DEFAULT = 19;
/** Distância de scroll (px) para o título do capítulo colapsar no topo. */
const BIBLE_HEAD_COLLAPSE_PX = 88;

/**
 * Hide-on-scroll anti-tremedeira (chrome: topo + dock + tabs).
 * Uma só fonte de verdade; decisão estável via acumulador + histerese + locks.
 * Animação: só transform/opacity (CSS).
 */
const CHROME_NOISE_PX = 1;
const CHROME_HIDE_ACCUM_PX = 24;
const CHROME_SHOW_ACCUM_PX = 10;
const CHROME_HIDE_LOCK_MS = 200;
const CHROME_SHOW_LOCK_MS = 120;
const CHROME_TOP_SAFE_PX = 12;
const CHROME_NEAR_END_PX = 72;
const CHROME_MIN_SCROLLABLE_PX = 140;
const CHROME_PROGRAMMATIC_LOCK_MS = 320;

const EMPTY_VERSES: number[] = [];

/** UI atom: `--bible-head-progress` 0 (hero) → 1 (compacto no topo). */
function applyBibleHeadProgress(reader: HTMLElement | null, scrollTop: number) {
  if (!reader) return;
  const progress = Math.min(1, Math.max(0, scrollTop / BIBLE_HEAD_COLLAPSE_PX));
  reader.style.setProperty("--bible-head-progress", String(Math.round(progress * 1000) / 1000));
  reader.classList.toggle("is-head-compact", progress >= 0.55);
}

/** Sélection multi-versets (toggle, pas forcément contigus). */
type VerseSelection = number[];

function verseRange(start: number, end: number): number[] {
  const a = Math.min(start, end);
  const b = Math.max(start, end);
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

function sortVerses(verses: Iterable<number>): number[] {
  return [...new Set(verses)].sort((a, b) => a - b);
}

function verseInSelection(sel: VerseSelection | null, number: number): boolean {
  return Boolean(sel?.includes(number));
}

/** Regroupe 7,8,9,12 → [{7,9},{12,12}]. */
function verseRuns(verses: number[]): Array<{ start: number; end: number }> {
  const sorted = sortVerses(verses);
  if (!sorted.length) return [];
  const runs: Array<{ start: number; end: number }> = [];
  let start = sorted[0]!;
  let end = start;
  for (let i = 1; i < sorted.length; i += 1) {
    const n = sorted[i]!;
    if (n === end + 1) {
      end = n;
      continue;
    }
    runs.push({ start, end });
    start = end = n;
  }
  runs.push({ start, end });
  return runs;
}

function formatVerseList(verses: number[]): string {
  return verseRuns(verses)
    .map(({ start, end }) => (start === end ? String(start) : `${start}-${end}`))
    .join(" · ");
}

function formatSelectionFront(bookTitle: string, chapter: string | number, verses: number[]): string {
  const book = String(bookTitle || "")
    .trim()
    .toUpperCase();
  const list = formatVerseList(verses);
  return list ? `${book} ${chapter}.${list}` : book;
}

function selectionUsfm(bookId: string, chapterId: string, verses: number[]): string {
  const base = chapterUsfm(bookId, chapterId);
  const list = formatVerseList(verses).replace(/ · /g, ".");
  return list ? `${base}.${list}` : base;
}

function selectionEdgeClass(sel: VerseSelection | null, number: number): string {
  if (!verseInSelection(sel, number)) return "";
  const prev = verseInSelection(sel, number - 1);
  const next = verseInSelection(sel, number + 1);
  if (!prev && !next) return "is-sel-single";
  if (!prev && next) return "is-sel-start";
  if (prev && !next) return "is-sel-end";
  return "is-sel-mid";
}

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
  /** Onglet Lecture visible (le panneau peut être `hidden` au montage). */
  active?: boolean;
  onBack?: () => void;
  /** Mode lecture de plan : un pas = un chapitre, › = chapitre suivant. */
  planReading?: {
    /** Nom affiché en haut (thème / titre du plan). */
    planName: string;
    label: string;
    /** Référence du pas courant — pour détecter une navigation hors plan. */
    focusRef: string;
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

type VerseScrollMode = "start" | "nearest" | "top";
type PendingVerseScroll = { number: number; mode: VerseScrollMode; seq: number };

function overlayReserve(scroller: HTMLElement, reader: HTMLElement): { top: number; bottom: number } {
  const sRect = scroller.getBoundingClientRect();
  const chromeHidden = reader.classList.contains("is-chrome-hidden");
  let top = 8;
  if (!chromeHidden) {
    const topBar = reader.querySelector(".bible-yv-top");
    if (topBar) {
      const t = topBar.getBoundingClientRect();
      top = Math.max(top, t.bottom - sRect.top + 8);
    }
  }
  let bottom = 16;
  const selectors = [".bible-verse-actions", ".bible-yv-dock", ".bible-yv-pick-sheet"];
  for (const sel of selectors) {
    const el = reader.querySelector(sel);
    if (!el || !(el instanceof HTMLElement)) continue;
    if (sel === ".bible-yv-dock" && chromeHidden) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom <= sRect.top || r.top >= sRect.bottom) continue;
    bottom = Math.max(bottom, sRect.bottom - r.top + 12);
  }
  return { top, bottom };
}

function alignVerseInScroller(
  scroller: HTMLElement,
  reader: HTMLElement,
  verseEl: HTMLElement | null,
  mode: VerseScrollMode,
) {
  if (mode === "top" || !verseEl) {
    scroller.scrollTop = 0;
    return;
  }
  const reserve = overlayReserve(scroller, reader);
  const sRect = scroller.getBoundingClientRect();
  const vRect = verseEl.getBoundingClientRect();
  const visibleTop = sRect.top + reserve.top;
  const visibleBottom = sRect.bottom - reserve.bottom;
  const visibleHeight = Math.max(64, visibleBottom - visibleTop);

  let delta = 0;
  if (mode === "start") {
    delta = vRect.top - visibleTop;
  } else if (vRect.top < visibleTop - 1) {
    delta = vRect.top - visibleTop;
  } else if (vRect.bottom > visibleBottom + 1) {
    delta = vRect.height > visibleHeight ? vRect.top - visibleTop : vRect.bottom - visibleBottom;
  }
  if (Math.abs(delta) < 1) return;
  scroller.scrollTop += delta;
}

export function BibleReaderView({
  initialRef = "Jean 3.16",
  focusRef = null,
  focusSeq = 0,
  active = true,
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
  const [, setBibleId] = useState<number | null>(LSG_BIBLE_ID);
  const [books, setBooks] = useState<YouVersionBook[]>(() => readBooksCache()?.books ?? []);
  const [bookId, setBookId] = useState(initialParts.bookId);
  const [chapterId, setChapterId] = useState(initialParts.chapterId);
  const [highlightVerse, setHighlightVerse] = useState<number | null>(
    initialParts.verse ?? null,
  );
  const [selection, setSelection] = useState<VerseSelection | null>(() =>
    initialParts.verse != null ? [initialParts.verse] : null,
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
  const pendingScrollVerse = useRef<PendingVerseScroll | null>(null);
  const verseScrollSeq = useRef(0);
  const lastAppliedVerseScroll = useRef("");
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
    const start = parts.verse ?? planReading?.verseStart ?? null;
    const end =
      planReading?.verseStart != null && planReading.verseEnd != null
        ? planReading.verseEnd
        : parts.verse != null && focusRef.includes("-")
          ? (() => {
              const match = focusRef.match(/[.:](\d+)\s*[-–—]\s*(\d+)/);
              return match ? Number(match[2]) : null;
            })()
          : null;
    void loadChapter(parts.bookId, parts.chapterId, start, end);
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
    verseEnd: number | null = null,
  ) {
    const gen = ++loadGen.current;
    pendingScrollVerse.current =
      verse != null
        ? { number: verse, mode: "start", seq: ++verseScrollSeq.current }
        : { number: 0, mode: "top", seq: ++verseScrollSeq.current };
    setBookId(nextBook);
    setChapterId(nextChapter);
    setHighlightVerse(verse);
    setSelection(
      verse != null
        ? verseEnd != null
          ? verseRange(verse, verseEnd)
          : [verse]
        : null,
    );
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
    setSelection((current) => {
      const next = new Set(current ?? []);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      if (!next.size) {
        pendingScrollVerse.current = null;
        lastAppliedVerseScroll.current = "";
        setHighlightVerse(null);
        return null;
      }
      pendingScrollVerse.current = { number, mode: "nearest", seq: ++verseScrollSeq.current };
      setHighlightVerse(number);
      if (!current?.length) setCardColor(DEFAULT_VERSE_COLOR);
      return sortVerses(next);
    });
    setCardMsg(null);
    setPickerOpen(false);
  }

  function jumpToVerse(number: number) {
    pendingScrollVerse.current = { number, mode: "start", seq: ++verseScrollSeq.current };
    setSelection([number]);
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
    setSelection(null);
    setHighlightVerse(null);
    setCardMsg(null);
    setCardColor(DEFAULT_VERSE_COLOR);
  }

  async function makeFlashcard() {
    if (!selection?.length || !passage?.verses?.length || cardBusy) return;
    const selected = new Set(selection);
    const verses = passage.verses.filter((item) => selected.has(item.number));
    if (!verses.length || verses.some((item) => !item.text?.trim())) return;
    const title = selectedBook?.title ?? bookId;
    const frente = formatSelectionFront(title, chapterId, selection);
    const usfm = selectionUsfm(bookId, chapterId, selection);
    const verso = verses.map((item) => item.text.trim()).join(" ");
    setCardBusy(true);
    setCardMsg(null);
    try {
      const result = createVerseFlashcard({
        frente,
        verso,
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
  const locationLabel = selection?.length
    ? `${bookTitle} ${chapterId}.${formatVerseList(selection)}`
    : `${bookTitle} ${chapterId}`;
  const chapterLabel = `${bookTitle} ${chapterId}`;
  const onPlanStep = Boolean(
    planReading &&
      (() => {
        const parts = parseUsfmParts(planReading.focusRef || planReading.label);
        return (
          parts.bookId.toUpperCase() === bookId.toUpperCase() &&
          String(parts.chapterId) === String(chapterId)
        );
      })(),
  );
  const planHeaderTitle = planReading
    ? onPlanStep
      ? planReading.planName
      : chapterLabel
    : "";

  function handlePlanBack() {
    if (!planReading) {
      onBack?.();
      return;
    }
    // Hors du chapitre du pas → revenir au chapitre du plan en cours.
    if (!onPlanStep) {
      const parts = parseUsfmParts(planReading.focusRef || planReading.label);
      if (isUsfmBookId(parts.bookId)) {
        const start = parts.verse ?? planReading.verseStart ?? null;
        const end = planReading.verseEnd ?? start;
        void loadChapter(parts.bookId, parts.chapterId, start, end);
        return;
      }
    }
    // Sur le pas courant → chapitre précédent du plan, sinon quitter (timeline du jour).
    if (!planReading.isFirst) {
      planReading.onPrev();
      return;
    }
    onBack?.();
  }

  const verseOptions =
    passage?.verses?.map((verse) => verse.number) ?? (selection?.length ? selection : []);
  const selectedVerses = selection ?? EMPTY_VERSES;
  const selectedVerseText =
    selectedVerses.length && passage?.verses
      ? passage.verses
          .filter((item) => selectedVerses.includes(item.number))
          .map((item) => item.text.trim())
          .filter(Boolean)
          .join(" ")
      : "";
  const selectedVerseCardId = useMemo(() => {
    if (!selection?.length) return null;
    return verseCardId(selectionUsfm(bookId, chapterId, selection));
  }, [bookId, chapterId, selection]);
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

  const showCreateCard = Boolean(selectedVerses.length && selectedVerseText && !pickerOpen);
  const forceChrome = pickerOpen || showCreateCard;
  const hideChrome = chromeHidden && !forceChrome;
  forceChromeRef.current = forceChrome;

  useLayoutEffect(() => {
    if (loading || !active) return;
    const pending = pendingScrollVerse.current;
    if (!pending) return;
    const root = passageScrollRef.current;
    const reader = readerRef.current;
    if (!root || !reader || root.clientHeight < 40) return;
    const key = `${pending.seq}:${pending.mode}:${pending.number}:${passage?.id}:${showCreateCard}`;
    if (lastAppliedVerseScroll.current === key) return;
    const verseEl =
      pending.mode === "top"
        ? null
        : (root.querySelector(`[data-verse="${pending.number}"]`) as HTMLElement | null);
    if (pending.mode !== "top" && !verseEl) return;
    alignVerseInScroller(root, reader, verseEl, pending.mode);
    lastScrollTop.current = root.scrollTop;
    scrollAcc.current = 0;
    chromeLockUntil.current = performance.now() + CHROME_PROGRAMMATIC_LOCK_MS;
    applyBibleHeadProgress(reader, root.scrollTop);
    lastAppliedVerseScroll.current = key;
  }, [active, loading, passage?.id, highlightVerse, selection, showCreateCard, pickerOpen, planReading?.label]);

  const dockPickLabel =
    !pickerOpen
      ? locationLabel
      : passageStep === "book"
        ? "Livre"
        : passageStep === "chapter"
          ? bookTitle
          : `${bookTitle} ${chapterId}`;

  const setReadingChrome = useEffectEvent((hidden: boolean, force = false) => {
    if (chromeHiddenRef.current === hidden) return;
    const now = performance.now();
    // Lock após toggle: não aceitar o sentido contrário imediatamente.
    if (!force && now < chromeLockUntil.current) return;
    chromeHiddenRef.current = hidden;
    chromeLockUntil.current = now + (hidden ? CHROME_HIDE_LOCK_MS : CHROME_SHOW_LOCK_MS);

    // flushSync: leitor + shell (dock/tabs) no mesmo paint — evita race classList vs className.
    flushSync(() => {
      setChromeHidden(hidden);
      onReadingChromeChange?.(hidden);
    });
  });

  useEffect(() => {
    if (!forceChrome) return;
    chromeLockUntil.current = 0;
    setReadingChrome(false, true);
  }, [forceChrome, setReadingChrome]);

  useEffect(() => {
    return () => {
      onReadingChromeChange?.(false);
    };
  }, [onReadingChromeChange]);

  useEffect(() => {
    setReadingChrome(false, true);
    lastScrollTop.current = passageScrollRef.current?.scrollTop ?? 0;
    scrollAcc.current = 0;
    chromeLockUntil.current = performance.now() + CHROME_PROGRAMMATIC_LOCK_MS;
    applyBibleHeadProgress(readerRef.current, passageScrollRef.current?.scrollTop ?? 0);
  }, [bookId, chapterId, planReading?.label, setReadingChrome]);

  useEffect(() => {
    if (!active) {
      scrollAcc.current = 0;
      setReadingChrome(false, true);
      return;
    }

    const root = passageScrollRef.current;
    if (!root) return;

    // Sync baseline so a restored/programmatic offset doesn't look like a huge down-scroll.
    lastScrollTop.current = root.scrollTop;
    scrollAcc.current = 0;
    applyBibleHeadProgress(readerRef.current, root.scrollTop);

    const onScroll = () => {
      if (scrollRaf.current) return;
      scrollRaf.current = window.requestAnimationFrame(() => {
        scrollRaf.current = 0;
        const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
        const rawTop = root.scrollTop;
        // Overscroll / rubber-band: deltas fora do range não dirigem o chrome.
        if (rawTop < 0 || rawTop > maxScroll) {
          scrollAcc.current = 0;
          lastScrollTop.current = Math.min(maxScroll, Math.max(0, rawTop));
          return;
        }

        const top = rawTop;
        const delta = top - lastScrollTop.current;
        lastScrollTop.current = top;
        applyBibleHeadProgress(readerRef.current, top);

        if (forceChromeRef.current) {
          scrollAcc.current = 0;
          if (chromeHiddenRef.current) setReadingChrome(false, true);
          return;
        }

        // Capítulos curtos: sem scroll útil → chrome sempre visível.
        if (maxScroll < CHROME_MIN_SCROLLABLE_PX) {
          scrollAcc.current = 0;
          if (chromeHiddenRef.current) setReadingChrome(false, true);
          return;
        }

        const nearTop = top <= CHROME_TOP_SAFE_PX;
        const nearEnd = maxScroll - top <= CHROME_NEAR_END_PX;

        // Zonas seguras: estado fixo (visível).
        if (nearTop || nearEnd) {
          scrollAcc.current = 0;
          setReadingChrome(false, true);
          return;
        }

        // Dead zone / ruído.
        if (Math.abs(delta) < CHROME_NOISE_PX) return;

        // Lock pós-toggle ou programático: não decidir show/hide.
        if (performance.now() < chromeLockUntil.current) {
          scrollAcc.current = 0;
          return;
        }

        // Mudança de direção → zerar acumulador.
        if ((delta > 0 && scrollAcc.current < 0) || (delta < 0 && scrollAcc.current > 0)) {
          scrollAcc.current = 0;
        }

        scrollAcc.current += delta;

        // Histerese: limiares diferentes para esconder vs mostrar.
        if (!chromeHiddenRef.current && scrollAcc.current >= CHROME_HIDE_ACCUM_PX) {
          scrollAcc.current = 0;
          setReadingChrome(true);
        } else if (chromeHiddenRef.current && scrollAcc.current <= -CHROME_SHOW_ACCUM_PX) {
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
  }, [active, setReadingChrome, bookId, chapterId]);

  return (
    <section
      ref={readerRef}
      className={`bible-reader bible-reader--yv${hideChrome ? " is-chrome-hidden" : ""}${showCreateCard ? " has-verse-actions" : ""}`}
      style={{ ["--bible-font-size" as string]: `${fontSize}px` }}
      onKeyDown={(event) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
          return;
        }
        if (planReading) {
          if (event.key === "Escape") {
            event.preventDefault();
            if (pickerOpen) {
              closePicker();
              return;
            }
            handlePlanBack();
            return;
          }
          if (pickerOpen) return;
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            if (!planReading.isFirst) planReading.onPrev();
          } else if (event.key === "ArrowRight" || event.key === "Enter") {
            event.preventDefault();
            planReading.onAdvance();
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
      <header
        className={`bible-yv-top${planReading ? " is-plan" : " is-free"}`}
        aria-label="Navigation biblique"
      >
        {planReading ? (
          <>
            <div className="bible-yv-top-plan">
              <button
                type="button"
                className="bible-yv-back"
                onClick={handlePlanBack}
                aria-label={
                  onPlanStep
                    ? planReading.isFirst
                      ? "Quitter la lecture du plan"
                      : "Chapitre précédent du plan"
                    : "Retour au chapitre du plan"
                }
              >
                ←
              </button>
              <p className="bible-yv-plan-name" title={planHeaderTitle}>
                {planHeaderTitle}
              </p>
            </div>
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
          </>
        ) : (
          <>
            <p className="bible-yv-compact-ref" aria-hidden="true">
              <span className="bible-yv-compact-book">{bookTitle}</span>
              <span className="bible-yv-compact-num">{chapterId}</span>
            </p>
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
          </>
        )}
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
          if (chromeHiddenRef.current) setReadingChrome(false, true);
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
            className={`bible-verses${selection?.length ? " is-dimming" : ""}`}
          >
            {passage.verses.map((verse) => {
              const inPlanRange = Boolean(
                planReading &&
                  !selection?.length &&
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
              const isRangeAnchor = selection?.length
                ? highlightVerse === verse.number
                : planReading
                  ? rangeStart != null
                    ? verse.number === rangeStart
                    : verse.number === (passage.verses?.[0]?.number ?? 1)
                  : highlightVerse === verse.number;
              const active = selection?.length
                ? highlightVerse === verse.number
                : planReading
                  ? inPlanRange
                  : highlightVerse === verse.number;
              const selected = verseInSelection(selection, verse.number);
              const selEdge = selectionEdgeClass(selection, verse.number);
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
                    selEdge,
                    inPlanRange ? "is-plan-range" : "",
                    rangeEdge,
                    titleLike ? "is-title" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-verse={verse.number}
                  aria-label={`Verset ${verse.number}`}
                  aria-pressed={selected || inPlanRange}
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
          aria-label="Flashcard du passage"
          style={{ ["--verse-tint" as string]: cardColor }}
        >
          <div className="bible-verse-actions-head">
            <p className="bible-verse-actions-ref">
              {selectedVerses.length
                ? formatSelectionFront(bookTitle, chapterId, selectedVerses)
                : ""}
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
          {selectedVerses.length > 1 ? (
            <p className="bible-verse-actions-hint muted">
              {selectedVerses.length} versets · tape un verset pour ajouter ou retirer
            </p>
          ) : (
            <p className="bible-verse-actions-hint muted">
              Tape d&apos;autres versets pour ajouter à la sélection
            </p>
          )}
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
                ? "Voir la carte"
                : "Créer flashcard"}
          </button>
          {cardMsg ? <p className="bible-verse-actions-msg">{cardMsg}</p> : null}
        </div>
      ) : null}

      {pickerOpen ? (
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
                    const on = verseInSelection(selection, n);
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
        aria-hidden={hideChrome || undefined}
        inert={hideChrome || undefined}
        aria-label={planReading ? "Lecture du plan" : pickerOpen ? "Choisir livre et passage" : "Chapitre"}
      >
        <div className={`bible-yv-dock-nav${planReading ? " bible-yv-dock-nav--plan" : ""}`}>
          <button
            type="button"
            className="bible-yv-dock-arrow"
            onClick={() => {
              if (planReading) {
                planReading.onPrev();
                return;
              }
              if (pickerOpen) setPassageStep("chapter");
              goAdjacent(-1);
            }}
            disabled={planReading ? planReading.isFirst : !canPrev || loading}
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
            <span className="bible-yv-dock-location-text">
              {pickerOpen ? dockPickLabel : locationLabel}
            </span>
            <span className="bible-yv-dock-caret" aria-hidden="true">
              ▾
            </span>
          </button>
          {planReading ? (
            <button
              type="button"
              className={`bible-yv-dock-advance${planReading.isLast ? " is-complete" : ""}`}
              onClick={planReading.onAdvance}
              aria-label={planReading.isLast ? "Conclure la lecture du jour" : "Chapitre suivant du jour"}
            >
              {planReading.isLast ? "✓" : "›"}
            </button>
          ) : (
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
          )}
        </div>
      </footer>
    </section>
  );
}
