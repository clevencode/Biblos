import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { flushSync } from "react-dom";
import { YvIcon } from "./YvIcon";
import {
  adjacentChapter,
  chapterUsfm,
  parseUsfmParts,
  LSG_BIBLE_ID,
  type BibleSearchHit,
} from "../youversion/client";
import {
  BIBLE_TEXT_VERSIONS,
  isBibleTextVersionId,
  readBibleTextVersionPref,
  type BibleTextVersionId,
} from "../bible/bibleVersions";
import { versionedBibleId } from "../bible/passageForVersion";
import {
  HT1998_BIBLE_META,
  ht1998Books,
  invalidateHt1998CatalogCache,
} from "../bible/ht1998";
import {
  clearHt1998Offline,
  downloadHt1998Offline,
  isHt1998OfflineReady,
} from "../bible/ht1998Offline";
import {
  fetchBibleAudioCatalog,
  loadAudioPositions,
  saveAudioPosition,
  type BibleAudioEpisode,
} from "../youversion/audio";
import { BibleAudioFloat } from "./BibleAudioFloat";
import { BibleHistorySheet } from "./BibleHistorySheet";
import { BibleShareSheet } from "./BibleShareSheet";
import { BiblePassageScrollPicker } from "./BiblePassageScrollPicker";
import { BiblePassageChip } from "./BiblePassageChip";
import { BibleOfflineChapterGate } from "./BibleOfflineChapterGate";
import { BibleChapterLoadingPlaceholder } from "./BibleChapterLoadingPlaceholder";
import { usePassageDiscovery } from "../hooks/usePassageDiscovery";
import type { DiscoveryJump } from "../bible/passageDiscovery/types";
import {
  EMPTY_PASSAGE_DISCOVERY_SESSION,
  type PassageDiscoverySession,
} from "../bible/passageDiscovery/session";
import {
  OVERLAY_DISMISS_SWALLOW_MS,
  PASSAGE_LOADING_COPY,
  biblePickerChrome,
  bibleReaderErrorMessage,
  mergeBibleReaderErrors,
  overlayDismissTarget,
  passageLiveStatusLabel,
  passagePickerChromeFromPresentation,
  passageSchemaCssVars,
  pickerVerseNumberOptions,
  planReaderOnStep,
  planStepProgressLabel,
  passagePickerRollOpen,
  readerSurfaceChrome,
  showOfflineChapterGate,
} from "../bible/viewState";
import { usePassageViewModel } from "../hooks/usePassageViewModel";
import { useAppReadiness } from "../context/AppReadinessContext";
import { CircularColorEditor } from "./CircularColorEditor";
import { ACTIVITY_UI_ENABLED } from "../activityLog";
import {
  bindBibleAudioControls,
  clearBibleAudioControls,
  syncBibleAudioControls,
} from "../bibleAudioControls";
import { createVerseFlashcard, verseCardId } from "../verseCard";
import { formatSelectedVersesForShare } from "../shareVerse";
import {
  clearOfflineBible,
  downloadOfflineBible,
  isOfflineBibleReady,
  type OfflineDownloadProgress,
} from "../bibleOffline";
import {
  BIBLE_READER_PREFS_KEY,
  resolveBookDisplay,
} from "../bible/bibleCatalogRepository";
import { useBibleCatalog } from "../hooks/useBibleCatalog";
import { useLocalBundledBible } from "../bibleEngine";
import {
  adaptVerseColorForTheme,
  formatVerseColorHex,
  loadPreferredVerseColor,
  normalizeVerseColor,
  savePreferredVerseColor,
  verseActionTone,
  verseColorHueLabel,
  verseSwatchCheckInk,
} from "../verseColors";
import { resolveTheme, themePrefLabel, type ResolvedTheme, type ThemePref } from "../theme";
import { loadChapterMarks, setVerseMarks } from "../verseMarks";
import type { Flashcard } from "../types";
const STORAGE_KEY = BIBLE_READER_PREFS_KEY;
/** Panneau verset : pas de Flashcard tant que l’onglet Cartes est désactivé. */
const VERSE_SUITE_FLASHCARDS_ENABLED = false;
const FONT_MIN = 15;
const FONT_MAX = 28;
const FONT_DEFAULT = 19;
const FONT_STEP = 0.5;

function clampFontSize(n: number) {
  const stepped = Math.round(n / FONT_STEP) * FONT_STEP;
  return Math.min(FONT_MAX, Math.max(FONT_MIN, stepped));
}
/**
 * Título do capítulo: estado discreto + histerese (anti-tremedeira).
 * Sem CSS variable por pixel — evita reflow/layout thrash no scroll.
 */
const BIBLE_HEAD_COMPACT_ENTER_PX = 52;
const BIBLE_HEAD_COMPACT_EXIT_PX = 14;

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
/** Scroll do utilizador (px) para desligar o texto opaco do verso focado. */
const FOCUS_DIM_CLEAR_PX = 6;

const EMPTY_VERSES: number[] = [];

/** UI atom: hero ↔ compacto no topo (histerese). Devolve o próximo estado — React controla a classe. */
function nextHeadCompact(compact: boolean, scrollTop: number): boolean {
  if (!compact && scrollTop >= BIBLE_HEAD_COMPACT_ENTER_PX) return true;
  if (compact && scrollTop <= BIBLE_HEAD_COMPACT_EXIT_PX) return false;
  return compact;
}

/** Sélection multi-versets (toggle, pas forcément contigus). */
type VerseSelection = number[];

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

/** Versets du chapitre qui ont déjà une flashcard. */
function verseNumbersWithCards(
  bookId: string,
  chapterId: string,
  ids: ReadonlySet<string> | undefined,
): Set<number> {
  const found = new Set<number>();
  if (!ids?.size) return found;
  const chapterPrefix = `verse-${chapterUsfm(bookId, chapterId)}.`.toUpperCase();
  for (const id of ids) {
    const upper = String(id || "").toUpperCase();
    if (!upper.startsWith(chapterPrefix)) continue;
    const listPart = upper.slice(chapterPrefix.length);
    for (const chunk of listPart.split(".")) {
      const match = chunk.match(/^(\d+)(?:-(\d+))?$/);
      if (!match) continue;
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : start;
      const a = Math.min(start, end);
      const b = Math.max(start, end);
      for (let n = a; n <= b; n += 1) found.add(n);
    }
  }
  return found;
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
  textVersion?: BibleTextVersionId;
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
    /** Titre du plan pour Partager (thème). */
    planShareTitle?: string;
    /** Intro Notion / Devotional. */
    planDescription?: string;
    /** Id du plan (deep link app). */
    planShareId?: string | null;
    /** Ex. « 40 jours ». */
    planMeta?: string;
    label: string;
    /** Référence du pas courant — pour détecter une navigation hors plan. */
    focusRef: string;
    isFirst: boolean;
    isLast: boolean;
    stepIndex: number;
    stepCount: number;
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
  /** Préférence thème (clair / sombre / système). */
  themePref?: ThemePref;
  /** Cycle le thème (clair → sombre → système). */
  onCycleTheme?: () => void;
  /** Si true, Marquer demande d’abord le nom (compte créé seulement alors). */
  requireNameToMark?: boolean;
  /** Demande le nom avant de marquer ; le marquage reprend via authorizedMark*. */
  onRequestNameToMark?: (payload: {
    color: string;
    verses: number[];
    bookId: string;
    chapterId: string;
    bookTitle: string;
  }) => void;
  /** Marquage autorisé après saisie du nom. */
  authorizedMarkSeq?: number;
  authorizedMark?: {
    color: string;
    verses: number[];
    bookId: string;
    chapterId: string;
    bookTitle: string;
  } | null;
  onAuthorizedMarkConsumed?: () => void;
  /** Activité + sync VerseMark : versets surlignés (color null = effacer). */
  onVerseMarked?: (payload: {
    color: string | null;
    verses: number[];
    bookId: string;
    chapterId: string;
    bookTitle: string;
  }) => void;
  /** Activité : chapitre lu / ouvert. */
  onBibleRead?: (payload: {
    bookId: string;
    chapterId: string;
    verse: number | null;
    label: string;
  }) => void;
  /** Historique de lecture modifié (suppression). */
  onReadingHistoryChange?: () => void;
  /** Mobile : hamburger à droite (outils Bible uniquement). */
  compactToolsMenu?: boolean;
  /** Viewport compact (sincronizado com `app.is-narrow`). */
  compactViewport?: boolean;
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
  const selectors = [
    ".bible-verse-actions",
    ".bible-yv-dock",
    ".bible-yv-passage-scroll-panel.is-open",
  ];
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
    // Preferir topo do versículo se for mais alto que a área útil (painel Marquer).
    delta =
      vRect.height > visibleHeight * 0.85
        ? vRect.top - visibleTop
        : vRect.bottom - visibleBottom;
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
  themePref = "system",
  onCycleTheme,
  requireNameToMark = false,
  onRequestNameToMark,
  authorizedMarkSeq = 0,
  authorizedMark = null,
  onAuthorizedMarkConsumed,
  onVerseMarked,
  onBibleRead,
  onReadingHistoryChange,
  compactToolsMenu = false,
  compactViewport = false,
}: BibleReaderViewProps) {
  const prefs = readPrefs();
  const prefsBookOk = isUsfmBookId(prefs.bookId || "");
  const initialParts = parseUsfmParts(
    prefsBookOk && prefs.chapterId
      ? chapterUsfm(prefs.bookId!, prefs.chapterId)
      : initialRef,
  );

  const {
    books: catalogBooks,
    bible,
    setBible,
    isOffline: catalogOffline,
    viewState: catalogViewState,
    refreshCatalog,
  } = useBibleCatalog();
  const [textVersion, setTextVersion] = useState<BibleTextVersionId>(() => {
    const fromPrefs = readPrefs().textVersion;
    if (isBibleTextVersionId(fromPrefs)) return fromPrefs;
    return readBibleTextVersionPref();
  });
  const [htBooks, setHtBooks] = useState<typeof catalogBooks | null>(null);
  const [htCatalogLoading, setHtCatalogLoading] = useState(false);
  const [htCatalogError, setHtCatalogError] = useState<string | null>(null);
  const textVersionRef = useRef<BibleTextVersionId>(textVersion);
  const books =
    textVersion === "ht98" ? (htBooks ?? []) : catalogBooks;
  const resolveBookTitleActive = useCallback(
    (id: string) => resolveBookDisplay(id, books),
    [books],
  );
  const { setCatalogHydrating, setCatalogLocalReady } = useAppReadiness();
  const [, setBibleId] = useState<number | null>(() => bible.id ?? LSG_BIBLE_ID);
  const [bookId, setBookId] = useState(initialParts.bookId);
  const [chapterId, setChapterId] = useState(initialParts.chapterId);
  const [highlightVerse, setHighlightVerse] = useState<number | null>(
    initialParts.verse ?? null,
  );
  const [highlightVerseEnd, setHighlightVerseEnd] = useState<number | null>(null);
  /** Título compacto no topo — estado React (não classList) para sobreviver a re-renders. */
  const [headCompact, setHeadCompact] = useState(false);
  /** Texto opaco (foco YouVersion) após escolher livro/capítulo/verso — some no 1.º scroll. */
  const [focusDimActive, setFocusDimActive] = useState(
    () => initialParts.verse != null,
  );
  const focusDimActiveRef = useRef(initialParts.verse != null);
  /** Salto no picker: prioriza o verso saltado sobre a janela do plano. */
  const preferJumpFocusRef = useRef(false);
  const [selection, setSelection] = useState<VerseSelection | null>(null);
  const [passageUiError, setPassageUiError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(() => {
    const n = Number(prefs.fontSize);
    return Number.isFinite(n) ? clampFontSize(n) : FONT_DEFAULT;
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [passageStep, setPassageStep] = useState<"book" | "chapter" | "verse">("book");
  const [bookSearchQuery, setBookSearchQuery] = useState("");
  const [discoverySession, setDiscoverySession] = useState<PassageDiscoverySession>(
    () => ({ ...EMPTY_PASSAGE_DISCOVERY_SESSION }),
  );
  const discoveryListScrollRaf = useRef(0);
  const discoveryVerseScrollRaf = useRef<Record<string, number>>({});
  const [narrowChrome, setNarrowChrome] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardMsg, setCardMsg] = useState<string | null>(null);
  const [cardColor, setCardColor] = useState(() => loadPreferredVerseColor());
  const [chapterMarks, setChapterMarks] = useState<ReadonlyMap<number, string>>(
    () => new Map(),
  );
  const [chromeHidden, setChromeHidden] = useState(false);
  const [audioByUsfm, setAudioByUsfm] = useState<Record<string, BibleAudioEpisode>>({});
  const [audioPodcast, setAudioPodcast] = useState("Bible | Podcast.s21");
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioActiveUsfm, setAudioActiveUsfm] = useState<string | null>(null);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareMode, setShareMode] = useState<"verse" | "plan">("verse");
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement | null>(null);
  const overlayDismissSwallowRef = useRef(false);
  const overlayDismissSwallowTimerRef = useRef<number | undefined>(undefined);

  function markOverlayDismissSwallow() {
    overlayDismissSwallowRef.current = true;
    window.clearTimeout(overlayDismissSwallowTimerRef.current);
    overlayDismissSwallowTimerRef.current = window.setTimeout(() => {
      overlayDismissSwallowRef.current = false;
    }, OVERLAY_DISMISS_SWALLOW_MS);
  }

  function takeOverlayDismissSwallow(): boolean {
    if (!overlayDismissSwallowRef.current) return false;
    overlayDismissSwallowRef.current = false;
    window.clearTimeout(overlayDismissSwallowTimerRef.current);
    return true;
  }

  const [offlineReady, setOfflineReady] = useState(false);
  const [htOfflineReady, setHtOfflineReady] = useState(false);
  const {
    passage,
    error: passageLoadError,
    passageErrorKind,
    loadChapter: commitPassageLoad,
    retryChapter,
    presentation,
    activeSchema,
  } = usePassageViewModel({
    active,
    textVersion,
    books,
    catalogOffline,
    offlineReady: textVersion === "ht98" ? htOfflineReady : offlineReady,
    resolveBookTitle: resolveBookTitleActive,
    onResolved: (outcome) => {
      if (outcome.bible) setBible(outcome.bible);
      if (outcome.bibleId) setBibleId(outcome.bibleId);
      else setBibleId(versionedBibleId(textVersionRef.current));
      onBibleRead?.({
        bookId: outcome.bookId,
        chapterId: outcome.chapterId,
        verse: outcome.verse,
        label: outcome.label,
      });
    },
  });

  const pickerChrome = useMemo(
    () =>
      biblePickerChrome({
        textVersion,
        catalog: catalogViewState,
        htCatalogLoading,
        htBooksReady: Boolean(htBooks?.length),
        passageInFlight: presentation.inFlight,
      }),
    [
      textVersion,
      catalogViewState,
      htCatalogLoading,
      htBooks?.length,
      presentation.inFlight,
    ],
  );

  const passageRollOpen = useMemo(
    () => passagePickerRollOpen(pickerOpen, pickerChrome.pickerPanelOpenAllowed),
    [pickerOpen, pickerChrome.pickerPanelOpenAllowed],
  );

  const passageDiscoveryEnabled =
    passageRollOpen && passageStep === "book";

  const { result: passageDiscovery, busy: passageDiscoveryBusy } = usePassageDiscovery(
    bookSearchQuery,
    books,
    passageDiscoveryEnabled,
    textVersion,
  );

  const pickerPassageChrome = useMemo(
    () => passagePickerChromeFromPresentation(presentation, activeSchema),
    [presentation, activeSchema],
  );

  const surfaceError = useMemo(
    () =>
      mergeBibleReaderErrors(passageLoadError, passageErrorKind, passageUiError),
    [passageLoadError, passageErrorKind, passageUiError],
  );
  const error = bibleReaderErrorMessage(surfaceError);

  const [offlineBusy, setOfflineBusy] = useState(false);
  const [offlineProgress, setOfflineProgress] = useState<OfflineDownloadProgress | null>(null);
  const offlineAbortRef = useRef<AbortController | null>(null);
  const [colorEditorOpen, setColorEditorOpen] = useState(false);
  const [uiTheme, setUiTheme] = useState<ResolvedTheme>(() => resolveTheme());
  const statusId = useId();
  const highlightRef = useRef<HTMLElement | null>(null);
  const passageRollRef = useRef<HTMLDivElement | null>(null);
  const passageScrollRef = useRef<HTMLElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioBookRef = useRef<string>("");
  const lastScrollTop = useRef(0);
  const scrollAcc = useRef(0);
  const chromeHiddenRef = useRef(false);
  const chromeLockUntil = useRef(0);
  /** Bloqueia limpar focus-dim durante scroll programático (independente do chrome). */
  const suppressFocusDimClearUntil = useRef(0);
  const forceChromeRef = useRef(false);
  const scrollRaf = useRef(0);
  const readerRef = useRef<HTMLElement | null>(null);
  const verseActionsSheetRef = useRef<HTMLDivElement | null>(null);
  const pendingVerseStep = useRef(false);
  const pendingScrollVerse = useRef<PendingVerseScroll | null>(null);
  const verseScrollSeq = useRef(0);
  const lastAppliedVerseScroll = useRef("");
  const booted = useRef(false);

  useLayoutEffect(() => {
    if (!active) {
      setNarrowChrome(false);
      return;
    }
    const mq = window.matchMedia("(max-width: 860px)");
    const sync = () => setNarrowChrome(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [active]);

  const setFocusDim = (active: boolean) => {
    focusDimActiveRef.current = active;
    setFocusDimActive(active);
  };

  const clearFocusDimOnUserScroll = () => {
    if (!focusDimActiveRef.current) return;
    focusDimActiveRef.current = false;
    preferJumpFocusRef.current = false;
    setFocusDimActive(false);
  };

  const syncHeadCompact = (scrollTop: number) => {
    setHeadCompact((prev) => nextHeadCompact(prev, scrollTop));
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchBibleAudioCatalog();
      if (cancelled || !result.ok || !result.books) return;
      setAudioByUsfm(result.books);
      if (result.podcast) setAudioPodcast(result.podcast);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    audio.preload = "none";

    const onPlay = () => setAudioPlaying(true);
    const onPause = () => {
      setAudioPlaying(false);
      if (audioBookRef.current && Number.isFinite(audio.currentTime)) {
        saveAudioPosition(audioBookRef.current, audio.currentTime);
      }
    };
    const onEnded = () => {
      setAudioPlaying(false);
      if (audioBookRef.current) saveAudioPosition(audioBookRef.current, 0);
      setAudioTime(0);
      void clearBibleAudioControls();
    };
    const onWaiting = () => setAudioBusy(true);
    const onCanPlay = () => setAudioBusy(false);
    const onTime = () => {
      setAudioTime(audio.currentTime || 0);
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setAudioDuration(audio.duration);
      }
    };
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setAudioDuration(audio.duration);
      }
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);

    let unbindNative: (() => void) | undefined;
    void bindBibleAudioControls({
      onPlay: () => {
        void audio.play().catch(() => undefined);
      },
      onPause: () => {
        audio.pause();
      },
      onSkipBackward: () => {
        const next = Math.max(0, (audio.currentTime || 0) - 15);
        audio.currentTime = next;
        setAudioTime(next);
      },
      onSkipForward: () => {
        const max = Number.isFinite(audio.duration) ? audio.duration : (audio.currentTime || 0) + 30;
        const next = Math.min(max, (audio.currentTime || 0) + 30);
        audio.currentTime = next;
        setAudioTime(next);
      },
      onDestroy: () => {
        audio.pause();
        void clearBibleAudioControls();
      },
    }).then((unbind) => {
      unbindNative = unbind;
    });

    return () => {
      unbindNative?.();
      void clearBibleAudioControls();
      audio.pause();
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      if (audioBookRef.current && Number.isFinite(audio.currentTime)) {
        saveAudioPosition(audioBookRef.current, audio.currentTime);
      }
    };
  }, []);

  useEffect(() => {
    const usfm = (audioActiveUsfm || audioBookRef.current || "").toUpperCase();
    const episode = usfm ? audioByUsfm[usfm] : null;
    if (!episode) {
      if (!audioPlaying) void clearBibleAudioControls();
      return;
    }
    void syncBibleAudioControls({
      track: episode.title,
      artist: audioPodcast,
      album: "Segond 21",
      isPlaying: audioPlaying,
      duration: audioDuration,
      elapsed: audioTime,
    });
  }, [audioPlaying, audioActiveUsfm, audioDuration, audioPodcast, audioByUsfm]);

  useEffect(() => {
    if (!audioPlaying) return;
    const id = window.setInterval(() => {
      const audio = audioRef.current;
      const usfm = (audioActiveUsfm || audioBookRef.current || "").toUpperCase();
      const episode = usfm ? audioByUsfm[usfm] : null;
      if (!audio || !episode) return;
      void syncBibleAudioControls({
        track: episode.title,
        artist: audioPodcast,
        album: "Segond 21",
        isPlaying: !audio.paused,
        duration: Number.isFinite(audio.duration) ? audio.duration : audioDuration,
        elapsed: audio.currentTime || 0,
      });
    }, 2500);
    return () => window.clearInterval(id);
  }, [audioPlaying, audioActiveUsfm, audioByUsfm, audioPodcast, audioDuration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const usfm = bookId.toUpperCase();
    if (audioBookRef.current === usfm) return;
    if (!audio.paused) {
      audio.pause();
    }
    audio.removeAttribute("src");
    audio.load();
    audioBookRef.current = "";
    setAudioActiveUsfm(null);
    setAudioPlaying(false);
    setAudioBusy(false);
    setAudioTime(0);
    setAudioDuration(0);
    void clearBibleAudioControls();
  }, [bookId]);

  useEffect(() => {
    let cancelled = false;
    void isOfflineBibleReady().then((ready) => {
      if (!cancelled) setOfflineReady(ready);
    });
    void isHt1998OfflineReady().then((ready) => {
      if (!cancelled) setHtOfflineReady(ready);
    });
    return () => {
      cancelled = true;
      offlineAbortRef.current?.abort();
    };
  }, []);

  const versionOfflineReady =
    textVersion === "ht98" ? htOfflineReady : offlineReady;

  useEffect(() => {
    const sync = () => setUiTheme(resolveTheme());
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    textVersionRef.current = textVersion;
  }, [textVersion]);

  useEffect(() => {
    if (textVersion !== "ht98") return;
    let cancelled = false;
    setHtCatalogLoading(true);
    setHtCatalogError(null);
    void ht1998Books()
      .then((list) => {
        if (!cancelled) setHtBooks(list);
      })
      .catch((err) => {
        if (!cancelled) {
          setHtCatalogError(
            err instanceof Error ? err.message : "Version haïtienne indisponible",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setHtCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [textVersion]);

  useEffect(() => {
    const id =
      textVersion === "ht98" ? HT1998_BIBLE_META.id : (bible.id ?? LSG_BIBLE_ID);
    setBibleId(id);
    if (textVersion === "ht98") setBible(HT1998_BIBLE_META);
  }, [bible.id, setBible, textVersion]);

  useEffect(() => {
    setCatalogHydrating(catalogViewState.status === "loading");
    setCatalogLocalReady(catalogViewState.status === "ready");
  }, [catalogViewState.status, setCatalogHydrating, setCatalogLocalReady]);

  useEffect(() => {
    const base = { ...readPrefs(), fontSize, textVersion };
    if (isUsfmBookId(bookId)) {
      writePrefs({ ...base, bookId, chapterId });
      return;
    }
    writePrefs(base);
  }, [bookId, chapterId, fontSize, textVersion]);

  useEffect(() => {
    setChapterMarks(loadChapterMarks(bookId, chapterId));
  }, [bookId, chapterId]);

  useEffect(() => {
    if (!active) return;
    const known = books.some((b) => b.id.toUpperCase() === bookId.toUpperCase());
    if (known) return;
    const fallback = books[0];
    if (!fallback) return;
    void loadChapter(fallback.id, fallback.chapters?.[0]?.id ?? "1", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books, bookId, active]);

  useEffect(() => {
    if (!active) return;
    if (presentation.inFlight) return;
    if (passage?.verses?.length || passage?.content) return;
    if (!isUsfmBookId(bookId)) return;
    if (!booted.current) {
      booted.current = true;
      void loadChapter(
        initialParts.bookId,
        initialParts.chapterId,
        initialParts.verse ?? null,
      );
      return;
    }
    void loadChapter(
      bookId,
      chapterId,
      highlightVerse ?? null,
      highlightVerseEnd ?? null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    active,
    bookId,
    chapterId,
    presentation.inFlight,
    passage?.id,
    passage?.verses?.length,
    passage?.content,
  ]);

  useEffect(() => {
    if (!focusSeq || !focusRef?.trim() || !active) return;
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
  }, [focusSeq, focusRef, active]);

  useEffect(() => {
    if (!pickerOpen) return;
    const id = window.setTimeout(() => {
      if (passageStep === "book") {
        const input = passageRollRef.current?.querySelector(
          ".bible-yv-pick-search",
        ) as HTMLInputElement | null;
        input?.focus();
        return;
      }
      const chip = passageRollRef.current?.querySelector(
        ".bible-yv-passage-chip.is-chapter",
      ) as HTMLButtonElement | null;
      chip?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [pickerOpen, passageStep]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (target instanceof Element && target.closest(".bible-yv-dock")) return;
      const roll = passageRollRef.current;
      if (!roll) return;
      if (roll.contains(target)) return;
      event.preventDefault();
      event.stopPropagation();
      markOverlayDismissSwallow();
      closePicker();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
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
    if (presentation.inFlight) return;
    pendingVerseStep.current = false;
    setPassageStep("verse");
  }, [pickerOpen, presentation.inFlight, chapterId, passage?.id]);

  function loadChapter(
    nextBook: string,
    nextChapter: string,
    verse: number | null = null,
    verseEnd: number | null = null,
  ) {
    pendingScrollVerse.current =
      verse != null
        ? { number: verse, mode: "start", seq: ++verseScrollSeq.current }
        : { number: 0, mode: "top", seq: ++verseScrollSeq.current };
    preferJumpFocusRef.current = false;
    setBookId(nextBook);
    setChapterId(nextChapter);
    setHighlightVerse(verse);
    setHighlightVerseEnd(
      verse != null && verseEnd != null && verseEnd !== verse ? verseEnd : null,
    );
    setFocusDim(verse != null);
    setSelection(null);
    setCardMsg(null);
    setPassageUiError(null);
    void commitPassageLoad(nextBook, nextChapter, verse, verseEnd);
  }

  function goAdjacent(delta: -1 | 1) {
    const next = adjacentChapter(books, bookId, chapterId, delta);
    if (!next) return;
    void loadChapter(next.bookId, next.chapterId, null);
  }

  function selectVerse(number: number) {
    if (takeOverlayDismissSwallow()) return;
    if (pickerOpen || toolsMenuOpen || shareSheetOpen || historyOpen) return;
    // Side-effects fora do updater (React pode correr updaters na fase de render).
    preferJumpFocusRef.current = false;
    const current = selection;
    const next = new Set(current ?? []);
    if (next.has(number)) next.delete(number);
    else next.add(number);

    if (!next.size) {
      pendingScrollVerse.current = null;
      lastAppliedVerseScroll.current = "";
      setHighlightVerse(null);
      setHighlightVerseEnd(null);
      setFocusDim(false);
      setSelection(null);
    } else {
      const mode: VerseScrollMode = current?.length ? "nearest" : "start";
      pendingScrollVerse.current = { number, mode, seq: ++verseScrollSeq.current };
      setHighlightVerse(number);
      setHighlightVerseEnd(null);
      setFocusDim(false);
      if (!current?.length) setCardColor(loadPreferredVerseColor());
      setSelection(sortVerses(next));
    }
    setCardMsg(null);
    setPickerOpen(false);
  }

  function jumpToVerse(number: number) {
    preferJumpFocusRef.current = true;
    pendingScrollVerse.current = { number, mode: "start", seq: ++verseScrollSeq.current };
    setSelection(null);
    setHighlightVerse(number);
    setHighlightVerseEnd(null);
    setFocusDim(true);
    setCardMsg(null);
    setPickerOpen(false);
  }

  function patchDiscoverySession(patch: Partial<PassageDiscoverySession>) {
    setDiscoverySession((prev) => ({ ...prev, ...patch }));
  }

  function setDiscoveryListScroll(scrollTop: number) {
    if (discoveryListScrollRaf.current) {
      cancelAnimationFrame(discoveryListScrollRaf.current);
    }
    discoveryListScrollRaf.current = requestAnimationFrame(() => {
      patchDiscoverySession({ listScrollTop: scrollTop });
    });
  }

  function setDiscoveryVerseListScroll(bookId: string, scrollTop: number) {
    const id = String(bookId || "").toUpperCase();
    if (!id) return;
    const prevRaf = discoveryVerseScrollRaf.current[id];
    if (prevRaf) cancelAnimationFrame(prevRaf);
    discoveryVerseScrollRaf.current[id] = requestAnimationFrame(() => {
      setDiscoverySession((prev) => ({
        ...prev,
        verseScrollByBook: { ...prev.verseScrollByBook, [id]: scrollTop },
      }));
    });
  }

  function clearBookSearch() {
    setBookSearchQuery("");
    setDiscoverySession({ ...EMPTY_PASSAGE_DISCOVERY_SESSION });
  }

  function closePicker() {
    setPickerOpen(false);
    setPassageStep("book");
    pendingVerseStep.current = false;
  }

  function openPassagePicker(step: "book" | "chapter") {
    if (!pickerChrome.pickerPanelOpenAllowed) return;
    setToolsMenuOpen(false);
    setPassageStep(step);
    pendingVerseStep.current = false;
    setPickerOpen(true);
  }

  function renderTopPassageNav(extraClass = "", rollOpen = false) {
    const compactBar = extraClass.includes("is-plan-chrome");
    const showChapterStep = true;
    return (
      <nav
        className={`bible-yv-compact-ref bible-yv-top-passage${extraClass}`.trim()}
        aria-label="Livre et chapitre"
      >
        <div
          className={`bible-yv-top-passage-bar${compactBar ? " is-compact" : ""}${
            rollOpen
              ? " is-roll-head is-roll-chrome-active"
              : pickerOpen
                ? " is-roll-chrome-active"
                : ""
          }${pickerChrome.chipsHydrating ? " is-hydrating" : ""}`}
        >
          {showChapterStep ? (
            <button
              type="button"
              className="bible-yv-top-passage-arrow"
              onClick={() => {
                if (pickerOpen) setPassageStep("chapter");
                goAdjacent(-1);
              }}
              disabled={!canPrev || pickerChrome.controlsDisabled}
              aria-label="Chapitre précédent"
            >
              <YvIcon name="skip_previous" className="bible-yv-top-passage-arrow-icon" />
            </button>
          ) : null}
          <div className="bible-yv-top-passage-segments">
            <BiblePassageChip
              variant="book"
              label={bookTitle}
              loading={pickerChrome.chipsHydrating}
              open={passageRollOpen && passageStep === "book"}
              disabled={pickerChrome.controlsDisabled}
              ariaLabel={`Choisir un livre · ${bookTitle}`}
              title={bookTitle}
              onClick={() => openPassagePicker("book")}
            />
            <span className="bible-yv-top-passage-divider" aria-hidden />
            <BiblePassageChip
              variant="chapter"
              label={chapterId}
              loading={pickerChrome.chipsHydrating}
              open={passageRollOpen && passageStep === "chapter"}
              disabled={pickerChrome.controlsDisabled}
              ariaLabel={`Choisir un chapitre · ${chapterId}`}
              title={`Chapitre ${chapterId}`}
              onClick={() => openPassagePicker("chapter")}
            />
          </div>
          {showChapterStep ? (
            <button
              type="button"
              className="bible-yv-top-passage-arrow"
              onClick={() => {
                if (pickerOpen) setPassageStep("chapter");
                goAdjacent(1);
              }}
              disabled={!canNext || pickerChrome.controlsDisabled}
              aria-label="Chapitre suivant"
            >
              <YvIcon name="skip_next" className="bible-yv-top-passage-arrow-icon" />
            </button>
          ) : null}
        </div>
      </nav>
    );
  }

  function renderPassageRoll(extraClass = "") {
    const rollOpen = passageRollOpen;
    return (
      <div
        ref={passageRollRef}
        className={`bible-yv-passage-roll${rollOpen ? " is-open" : ""}${
          pickerChrome.chipsHydrating ? " is-hydrating" : ""
        }`}
        onPointerDownCapture={(event) => {
          if (!overlayDismissSwallowRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          takeOverlayDismissSwallow();
        }}
        onClickCapture={(event) => {
          if (!takeOverlayDismissSwallow()) return;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {renderTopPassageNav(extraClass, rollOpen)}
        <BiblePassageScrollPicker
          open={rollOpen}
          step={passageStep}
          bookId={bookId}
          bookTitle={bookTitle}
          chapterId={chapterId}
          bookSearchQuery={bookSearchQuery}
          books={books}
          discovery={passageDiscovery}
          discoveryBusy={passageDiscoveryBusy}
          textVersion={textVersion}
          discoverySession={discoverySession}
          onDiscoveryListScroll={setDiscoveryListScroll}
          onDiscoveryExpandedBookChange={(bookId) =>
            patchDiscoverySession({ expandedBookId: bookId })
          }
          onDiscoveryVerseListScroll={setDiscoveryVerseListScroll}
          chapters={chapters}
          verseOptions={verseOptions}
          passageChrome={pickerPassageChrome}
          highlightVerse={highlightVerse}
          verseSelected={(n) => verseInSelection(selection, n)}
          onBack={handlePickBack}
          onSearchChange={setBookSearchQuery}
          onSearchClear={clearBookSearch}
          onPickBook={pickBook}
          onPickJump={pickDiscoveryJump}
          onPickVerse={pickVerseSearchHit}
          onPickChapter={pickChapter}
          onJumpVerse={jumpToVerse}
        />
      </div>
    );
  }

  function handlePickBack() {
    if (passageStep === "verse") {
      setPassageStep("chapter");
      return;
    }
    if (passageStep === "chapter") {
      setPassageStep("book");
      return;
    }
    closePicker();
  }

  function pickBook(nextBook: string) {
    pendingVerseStep.current = false;
    setPassageStep("chapter");
    if (nextBook.toUpperCase() === bookId.toUpperCase()) return;
    void loadChapter(nextBook, "1", null);
  }

  function pickVerseSearchHit(hit: BibleSearchHit) {
    const parts = parseUsfmParts(hit.usfm);
    pendingVerseStep.current = false;
    patchDiscoverySession({
      expandedBookId: parts.bookId.toUpperCase(),
      anchorVerseUsfm: hit.usfm.toUpperCase(),
    });
    setPickerOpen(false);
    setPassageStep("book");
    void loadChapter(parts.bookId, String(hit.chapter), hit.verse, null);
  }

  function pickDiscoveryJump(jump: DiscoveryJump) {
    pendingVerseStep.current = jump.passage.verse != null;
    patchDiscoverySession({
      expandedBookId: jump.passage.bookId.toUpperCase(),
      anchorVerseUsfm: jump.passage.usfm || null,
    });
    setPickerOpen(false);
    setPassageStep("book");
    const chapter = String(jump.passage.chapter);
    const verse = jump.passage.verse;
    const verseEnd = jump.passage.verseEnd;
    void loadChapter(
      jump.passage.bookId,
      chapter,
      verse,
      verse != null && verseEnd != null && verseEnd !== verse ? verseEnd : null,
    );
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
    preferJumpFocusRef.current = false;
    setSelection(null);
    setHighlightVerse(null);
    setHighlightVerseEnd(null);
    setFocusDim(false);
    setCardMsg(null);
    setCardColor(loadPreferredVerseColor());
    setColorEditorOpen(false);
    setShareSheetOpen(false);
  }

  async function toggleOfflineBible() {
    if (useLocalBundledBible() && textVersion === "s21") return;

    if (offlineBusy) {
      offlineAbortRef.current?.abort();
      return;
    }

    if (textVersion === "ht98") {
      if (htOfflineReady) {
        const ok = window.confirm(
          "Supprimer la Bible haïtienne hors ligne (~8 Mo) de cet appareil ?",
        );
        if (!ok) return;
        await clearHt1998Offline();
        invalidateHt1998CatalogCache();
        setHtOfflineReady(false);
        setOfflineProgress(null);
        return;
      }

      const ac = new AbortController();
      offlineAbortRef.current = ac;
      setOfflineBusy(true);
      setOfflineProgress({ done: 0, total: 2, usfm: "" });
      setPassageUiError(null);
      try {
        await downloadHt1998Offline(
          (p) => setOfflineProgress({ done: p.done, total: p.total, usfm: "" }),
          ac.signal,
        );
        invalidateHt1998CatalogCache();
        setHtOfflineReady(true);
        setOfflineProgress(null);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          setPassageUiError(
            err instanceof Error ? err.message : "Échec du téléchargement HAT98.",
          );
        }
      } finally {
        setOfflineBusy(false);
        offlineAbortRef.current = null;
      }
      return;
    }

    if (offlineReady) {
      const ok = window.confirm(
        "Supprimer la Bible hors ligne (~6 Mo) de cet appareil ?",
      );
      if (!ok) return;
      await clearOfflineBible();
      setOfflineReady(false);
      setOfflineProgress(null);
      return;
    }

    let list = books;
    if (!list.length) {
      const hydrated = await refreshCatalog();
      list = hydrated.books;
      if (!list.length) {
        setPassageUiError("Impossible de préparer le téléchargement.");
        return;
      }
    }

    const ac = new AbortController();
    offlineAbortRef.current = ac;
    setOfflineBusy(true);
    setOfflineProgress({ done: 0, total: list.length, usfm: "" });
    setPassageUiError(null);
    try {
      await downloadOfflineBible(list, (p) => setOfflineProgress({ ...p }), ac.signal);
      setOfflineReady(true);
      setOfflineProgress(null);
      await refreshCatalog();
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setPassageUiError(
          err instanceof Error ? err.message : "Échec du téléchargement hors ligne.",
        );
      }
    } finally {
      setOfflineBusy(false);
      offlineAbortRef.current = null;
    }
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
    const color = adaptVerseColorForTheme(normalizeVerseColor(cardColor), uiTheme);
    setCardBusy(true);
    setCardMsg(null);
    try {
      // Même logique que Marquer : une VERSECARD s’appuie sur un verset marqué.
      if (!selection.some((n) => chapterMarks.has(n))) {
        if (requireNameToMark && onRequestNameToMark) {
          onRequestNameToMark({
            color,
            verses: [...selection],
            bookId,
            chapterId,
            bookTitle: title,
          });
          return;
        }
        setChapterMarks(setVerseMarks(bookId, chapterId, selection, color));
        onVerseMarked?.({
          color,
          verses: [...selection],
          bookId,
          chapterId,
          bookTitle: title,
        });
      }
      const result = createVerseFlashcard({
        frente,
        verso,
        usfm,
        color,
      });
      if (!result.ok) {
        setCardMsg(result.error);
        return;
      }
      onFlashcardCreated?.(result.card);
      setCardMsg(`Carte créée pour ${frente}`);
      closeCreateCard();
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
  const bookTitle = resolveBookTitleActive(bookId);
  /** Offline de navegador — não depende só da fonte do catálogo (evita salto de chrome). */
  const catalogOfflineHint = catalogOffline;
  const localBundledBible = useLocalBundledBible();
  const showOfflineChapterGateUi = showOfflineChapterGate({
    passageErrorKind,
    localBundledAvailable: localBundledBible,
    versesInMemory: Boolean(passage?.verses?.length),
  });
  const locationLabel = selection?.length
    ? `${bookTitle} ${chapterId}.${formatVerseList(selection)}`
    : `${bookTitle} ${chapterId}`;
  const onPlanStep = Boolean(
    planReading &&
      planReaderOnStep({
        planFocusRef: planReading.focusRef,
        planLabel: planReading.label,
        bookId,
        chapterId,
      }),
  );
  const planStepProgress = planReading
    ? planStepProgressLabel(planReading.stepIndex, planReading.stepCount)
    : null;

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
    // Sur le pas courant → toujours l’écran d’origine (‹ dock = chapitre précédent).
    onBack?.();
  }

  const verseOptions = pickerVerseNumberOptions({
    bookId,
    chapterId,
    schema: activeSchema,
    passageUsfm: passage?.id ?? null,
    passageVerseNumbers: passage?.verses?.map((verse) => verse.number),
  });
  const selectedVerses = selection ?? EMPTY_VERSES;
  const selectedVerseText =
    selectedVerses.length && passage?.verses
      ? formatSelectedVersesForShare(
          passage.verses.filter((item) => selectedVerses.includes(item.number)),
        )
      : "";

  const shareRefLabel = selectedVerses.length
    ? formatSelectionFront(selectedBook?.title ?? bookId, chapterId, selectedVerses)
    : "";
  const shareUsfm = selectedVerses.length
    ? selectionUsfm(bookId, chapterId, selectedVerses)
    : "";
  const shareVerseText = selectedVerseText;
  const canShareVerse = Boolean(shareUsfm && shareVerseText);
  const canSharePlan = Boolean(
    planReading &&
      (planReading.planShareTitle?.trim() ||
        planReading.planName?.trim() ||
        planReading.planDescription?.trim()),
  );
  const selectedVerseCardId = useMemo(() => {
    if (!selection?.length) return null;
    return verseCardId(selectionUsfm(bookId, chapterId, selection));
  }, [bookId, chapterId, selection]);
  const existingVerseCard =
    Boolean(selectedVerseCardId && existingVerseCardIds?.has(selectedVerseCardId));
  const chapterCardVerses = useMemo(
    () => verseNumbersWithCards(bookId, chapterId, existingVerseCardIds),
    [bookId, chapterId, existingVerseCardIds],
  );

  useEffect(() => {
    if (!selectedVerseCardId) return;
    const stored = existingVerseCardColors?.get(selectedVerseCardId);
    setCardColor(stored ? normalizeVerseColor(stored) : loadPreferredVerseColor());
  }, [selectedVerseCardId, existingVerseCardColors]);

  function pickVerseColor(hex: string) {
    const next = adaptVerseColorForTheme(normalizeVerseColor(hex), uiTheme);
    setCardColor(next);
    savePreferredVerseColor(next);
    if (existingVerseCard && selectedVerseCardId && onUpdateVerseCardColor) {
      onUpdateVerseCardColor(selectedVerseCardId, next);
    }
  }

  function applyPickerColor(hex: string) {
    const next = adaptVerseColorForTheme(normalizeVerseColor(hex), uiTheme);
    pickVerseColor(next);
    if (!selection?.length) return;
    if (!selectedVerses.some((n) => chapterMarks.has(n))) return;
    setChapterMarks(setVerseMarks(bookId, chapterId, selection, next));
    onVerseMarked?.({
      color: next,
      verses: [...selection],
      bookId,
      chapterId,
      bookTitle: selectedBook?.title ?? bookId,
    });
  }

  function markSelection(hex: string) {
    if (!selection?.length) return;
    const next = adaptVerseColorForTheme(normalizeVerseColor(hex), uiTheme);
    pickVerseColor(next);
    setChapterMarks(setVerseMarks(bookId, chapterId, selection, next));
    onVerseMarked?.({
      color: next,
      verses: [...selection],
      bookId,
      chapterId,
      bookTitle: selectedBook?.title ?? bookId,
    });
    closeCreateCard();
  }

  function requestMarkSelection(hex: string) {
    if (!selection?.length) return;
    const next = adaptVerseColorForTheme(normalizeVerseColor(hex), uiTheme);
    if (requireNameToMark && onRequestNameToMark) {
      onRequestNameToMark({
        color: next,
        verses: [...selection],
        bookId,
        chapterId,
        bookTitle: selectedBook?.title ?? bookId,
      });
      return;
    }
    markSelection(next);
  }

  useEffect(() => {
    if (!authorizedMarkSeq || !authorizedMark) return;
    if (
      authorizedMark.bookId.toUpperCase() !== bookId.toUpperCase() ||
      String(authorizedMark.chapterId) !== String(chapterId)
    ) {
      onAuthorizedMarkConsumed?.();
      return;
    }
    const verses = authorizedMark.verses.filter((n) => Number.isFinite(n));
    if (!verses.length) {
      onAuthorizedMarkConsumed?.();
      return;
    }
    setSelection(verses);
    const next = adaptVerseColorForTheme(
      normalizeVerseColor(authorizedMark.color),
      uiTheme,
    );
    pickVerseColor(next);
    setChapterMarks(setVerseMarks(bookId, chapterId, verses, next));
    onVerseMarked?.({
      color: next,
      verses,
      bookId,
      chapterId,
      bookTitle: authorizedMark.bookTitle || selectedBook?.title || bookId,
    });
    closeCreateCard();
    onAuthorizedMarkConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorizedMarkSeq]);

  function clearSelectionMarks() {
    if (!selection?.length) return;
    setChapterMarks(setVerseMarks(bookId, chapterId, selection, null));
    onVerseMarked?.({
      color: null,
      verses: [...selection],
      bookId,
      chapterId,
      bookTitle: selectedBook?.title ?? bookId,
    });
    closeCreateCard();
  }

  const actionTone = useMemo(
    () => verseActionTone(adaptVerseColorForTheme(cardColor, uiTheme)),
    [cardColor, uiTheme],
  );
  const activeVerseColor = adaptVerseColorForTheme(normalizeVerseColor(cardColor), uiTheme);
  const selectionHasMark = selectedVerses.some((n) => chapterMarks.has(n));
  const selectionMarkColor = useMemo(() => {
    for (const n of selectedVerses) {
      const hex = chapterMarks.get(n);
      if (hex) return adaptVerseColorForTheme(normalizeVerseColor(hex), uiTheme);
    }
    return null;
  }, [selectedVerses, chapterMarks, uiTheme]);
  const pickerColor = selectionMarkColor ?? activeVerseColor;
  /** Accent marque (cartão PNG) — or brand, pas la couleur de surlignage. */
  const shareAccentHex = "#C4A574";

  const showCreateCard = Boolean(
    selectedVerses.length && selectedVerseText && !pickerOpen && !shareSheetOpen,
  );

  useLayoutEffect(() => {
    const reader = readerRef.current;
    const sheet = verseActionsSheetRef.current;
    if (!reader) return;
    if (!showCreateCard || !sheet) {
      reader.style.removeProperty("--verse-actions-sheet-h");
      return;
    }
    const apply = () => {
      reader.style.setProperty("--verse-actions-sheet-h", `${sheet.offsetHeight}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(sheet);
    return () => {
      ro.disconnect();
      reader.style.removeProperty("--verse-actions-sheet-h");
    };
  }, [
    showCreateCard,
    selectedVerses.length,
    cardMsg,
    selectionHasMark,
    existingVerseCard,
    narrowChrome,
  ]);
  const surfaceChrome = useMemo(
    () =>
      readerSurfaceChrome({
        pickerOpen,
        pickerPanelOpenAllowed: pickerChrome.pickerPanelOpenAllowed,
        toolsMenuOpen,
        historyOpen,
        shareSheetOpen,
        verseActionsOpen: showCreateCard,
      }),
    [
      pickerOpen,
      pickerChrome.pickerPanelOpenAllowed,
      toolsMenuOpen,
      historyOpen,
      shareSheetOpen,
      showCreateCard,
    ],
  );

  function dismissPassageSurfaceOverlay() {
    markOverlayDismissSwallow();
    const target = overlayDismissTarget({
      pickerOpen,
      pickerPanelOpenAllowed: pickerChrome.pickerPanelOpenAllowed,
      toolsMenuOpen,
      historyOpen,
      shareSheetOpen,
      verseActionsOpen: showCreateCard,
    });
    if (target === "picker") {
      closePicker();
      return;
    }
    if (target === "tools") {
      setToolsMenuOpen(false);
      return;
    }
    if (target === "history") {
      setHistoryOpen(false);
      return;
    }
    if (target === "share") {
      setShareSheetOpen(false);
    }
  }

  const forceChrome = surfaceChrome.forceChromeVisible;
  const hideChrome = chromeHidden && !forceChrome;
  forceChromeRef.current = forceChrome;

  useEffect(() => {
    if (!toolsMenuOpen) return;
    const onPointer = (event: PointerEvent) => {
      const root = toolsMenuRef.current;
      if (!root || !(event.target instanceof Node)) return;
      if (!root.contains(event.target)) {
        event.preventDefault();
        event.stopPropagation();
        markOverlayDismissSwallow();
        setToolsMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        markOverlayDismissSwallow();
        setToolsMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [toolsMenuOpen]);

  function stopBibleAudio() {
    const audio = audioRef.current;
    if (audio) {
      if (
        !audio.paused &&
        audioBookRef.current &&
        Number.isFinite(audio.currentTime)
      ) {
        saveAudioPosition(audioBookRef.current, audio.currentTime);
      }
      if (!audio.paused) audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    audioBookRef.current = "";
    setAudioActiveUsfm(null);
    setAudioPlaying(false);
    setAudioBusy(false);
    setAudioTime(0);
    setAudioDuration(0);
    void clearBibleAudioControls();
  }

  async function switchTextVersion(next: BibleTextVersionId) {
    if (next === textVersion) return;
    stopBibleAudio();
    setTextVersion(next);
    writePrefs({ ...readPrefs(), textVersion: next, bookId, chapterId, fontSize });
    if (next === "ht98") {
      setHtCatalogLoading(true);
      setHtCatalogError(null);
      try {
        const list = await ht1998Books();
        setHtBooks(list);
        const exists = list.some((b) => b.id.toUpperCase() === bookId.toUpperCase());
        void loadChapter(
          exists ? bookId : (list[0]?.id ?? "GEN"),
          exists ? chapterId : "1",
          null,
        );
      } catch (err) {
        setHtCatalogError(
          err instanceof Error ? err.message : "Version haïtienne indisponible",
        );
      } finally {
        setHtCatalogLoading(false);
      }
      return;
    }
    const exists = catalogBooks.some((b) => b.id.toUpperCase() === bookId.toUpperCase());
    void loadChapter(
      exists ? bookId : (catalogBooks[0]?.id ?? "GEN"),
      exists ? chapterId : "1",
      null,
    );
  }

  function renderTopToolsMenu(placement: "header" | "float" = "header") {
    const themeLabel = themePrefLabel(themePref);
    return (
      <div
        className={`bible-yv-tools-menu${placement === "float" ? " is-float-br" : ""}`}
        ref={toolsMenuRef}
      >
        <button
          type="button"
          className={`bible-yv-tools-menu-btn${toolsMenuOpen ? " is-on" : ""}`}
          aria-label="Menu"
          aria-haspopup="menu"
          aria-expanded={toolsMenuOpen}
          onClick={() => setToolsMenuOpen((open) => !open)}
        >
          <YvIcon name="menu" className="bible-yv-tool-icon" />
        </button>
        {toolsMenuOpen ? (
          <div
            className="bible-yv-tools-popover"
            role="menu"
            aria-label="Menu Bible"
          >
            <div
              className="bible-yv-tools-version"
              role="group"
              aria-label="Version de la Bible"
            >
              <span className="bible-yv-tools-version-label">Version</span>
              <div className="bible-yv-tools-version-options">
                {BIBLE_TEXT_VERSIONS.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    className={`bible-yv-tools-version-chip${textVersion === version.id ? " is-on" : ""}${
                      htCatalogLoading && version.id === "ht98" ? " is-busy" : ""
                    }`}
                    disabled={htCatalogLoading && version.id === "ht98"}
                    aria-pressed={textVersion === version.id}
                    title={version.title}
                    onClick={() => void switchTextVersion(version.id)}
                  >
                    {version.abbreviation}
                  </button>
                ))}
              </div>
            </div>
            {htCatalogError ? (
              <p className="bible-yv-tools-version-msg" role="alert">
                {htCatalogError}
              </p>
            ) : null}
            {onCycleTheme ? (
              <button
                type="button"
                role="menuitem"
                className="bible-yv-tools-item"
                onClick={() => onCycleTheme()}
              >
                {themePref === "light" ? (
                  <YvIcon name="light_mode" className="bible-yv-tools-item-icon" />
                ) : themePref === "dark" ? (
                  <YvIcon name="dark_mode" className="bible-yv-tools-item-icon" />
                ) : (
                  <YvIcon name="routine" className="bible-yv-tools-item-icon" />
                )}
                <span>{themeLabel}</span>
              </button>
            ) : null}
            {textVersion === "s21" && useLocalBundledBible() ? null : (
            <button
              type="button"
              role="menuitem"
              className={`bible-yv-tools-item${versionOfflineReady ? " is-ready" : ""}${offlineBusy ? " is-busy" : ""}`}
              onClick={() => {
                if (!offlineBusy) setToolsMenuOpen(false);
                void toggleOfflineBible();
              }}
              aria-label={
                offlineBusy
                  ? `Téléchargement… ${offlineProgress?.done ?? 0}/${offlineProgress?.total ?? (textVersion === "ht98" ? 2 : 66)} (toucher pour annuler)`
                  : versionOfflineReady
                    ? "Bible hors ligne disponible (toucher pour supprimer)"
                    : textVersion === "ht98"
                      ? "Télécharger la Bible haïtienne hors ligne (~8 Mo)"
                      : "Télécharger la Bible hors ligne (~6 Mo)"
              }
            >
              {versionOfflineReady ? (
                <YvIcon name="check_circle" filled className="bible-yv-tools-item-icon" />
              ) : (
                <YvIcon name="download" className="bible-yv-tools-item-icon" />
              )}
              <span>
                {offlineBusy
                  ? `Téléchargement… ${offlineProgress?.done ?? 0}/${offlineProgress?.total ?? (textVersion === "ht98" ? 2 : 66)}`
                  : versionOfflineReady
                    ? "Bible hors ligne"
                    : "Télécharger hors ligne"}
              </span>
            </button>
            )}
            {ACTIVITY_UI_ENABLED ? (
              <button
                type="button"
                role="menuitem"
                className="bible-yv-tools-item"
                onClick={() => {
                  setToolsMenuOpen(false);
                  setHistoryOpen(true);
                }}
              >
                <YvIcon name="history" className="bible-yv-tools-item-icon" />
                <span>Historique</span>
              </button>
            ) : null}
            <div className="bible-yv-tools-font" role="group" aria-label="Taille du texte">
              <span className="bible-yv-tools-font-label">Texte</span>
              <div className="bible-yv-font">
                <button
                  type="button"
                  className="bible-yv-font-btn"
                  onClick={() => setFontSize((n) => clampFontSize(n - FONT_STEP))}
                  disabled={fontSize <= FONT_MIN}
                  aria-label="Réduire la taille du texte"
                >
                  A−
                </button>
                <span className="bible-yv-font-value" aria-live="polite">
                  {Number.isInteger(fontSize) ? fontSize : fontSize.toFixed(1)}
                </span>
                <button
                  type="button"
                  className="bible-yv-font-btn"
                  onClick={() => setFontSize((n) => clampFontSize(n + FONT_STEP))}
                  disabled={fontSize >= FONT_MAX}
                  aria-label="Augmenter la taille du texte"
                >
                  A+
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  useLayoutEffect(() => {
    if (presentation.inFlight || !active) return;
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
    // 2ᵉ passe : hauteur réelle du panneau Marquer après layout.
    if (showCreateCard && verseEl) {
      requestAnimationFrame(() => {
        alignVerseInScroller(root, reader, verseEl, pending.mode === "start" ? "start" : "nearest");
        lastScrollTop.current = root.scrollTop;
        syncHeadCompact(root.scrollTop);
        suppressFocusDimClearUntil.current = performance.now() + CHROME_PROGRAMMATIC_LOCK_MS;
      });
    }
    lastScrollTop.current = root.scrollTop;
    scrollAcc.current = 0;
    const lockUntil = performance.now() + CHROME_PROGRAMMATIC_LOCK_MS;
    chromeLockUntil.current = lockUntil;
    suppressFocusDimClearUntil.current = lockUntil;
    syncHeadCompact(root.scrollTop);
    lastAppliedVerseScroll.current = key;
  }, [
    active,
    presentation.inFlight,
    passage?.id,
    highlightVerse,
    selection,
    showCreateCard,
    pickerOpen,
    planReading?.label,
  ]);

  const bookAudio = audioByUsfm[bookId.toUpperCase()] ?? null;
  const canPlayBookAudio = textVersion === "s21" && Boolean(bookAudio?.audioUrl);

  async function playUsfmAudio(targetUsfm: string) {
    const usfm = targetUsfm.toUpperCase();
    const audio = audioRef.current;
    if (!audio) return;

    const episode = audioByUsfm[usfm];
    if (!episode?.audioUrl) return;

    // Aligne le sélecteur Livre/chapitre sur le livre audio choisi.
    if (usfm !== bookId.toUpperCase() && isUsfmBookId(usfm)) {
      void loadChapter(usfm, "1", null);
    }

    try {
      setAudioBusy(true);
      setAudioActiveUsfm(usfm);
      if (audioBookRef.current !== usfm || !String(audio.src || "").includes(episode.audioUrl)) {
        if (audioBookRef.current && Number.isFinite(audio.currentTime)) {
          saveAudioPosition(audioBookRef.current, audio.currentTime);
        }
        audio.src = episode.audioUrl;
        audioBookRef.current = usfm;
        setAudioTime(0);
        setAudioDuration(0);
        const resume = loadAudioPositions()[usfm];
        if (resume && resume > 2) {
          const onMeta = () => {
            audio.currentTime = Math.min(resume, Math.max(0, (audio.duration || resume) - 1));
            setAudioTime(audio.currentTime);
            audio.removeEventListener("loadedmetadata", onMeta);
          };
          audio.addEventListener("loadedmetadata", onMeta);
        }
      }
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: episode.title,
          artist: audioPodcast,
          album: "Segond 21",
        });
      }
      await audio.play();
    } catch {
      setAudioPlaying(false);
      setPassageUiError("Audio indisponible pour le moment.");
    } finally {
      setAudioBusy(false);
    }
  }

  async function toggleBookAudio() {
    const usfm = (audioActiveUsfm || bookId).toUpperCase();
    const audio = audioRef.current;
    if (audio && audioBookRef.current === usfm && !audio.paused) {
      audio.pause();
      return;
    }
    await playUsfmAudio(usfm);
  }

  function handleAudioTransport() {
    const usfm = bookId.toUpperCase();
    setAudioActiveUsfm(audioBookRef.current || usfm);
    if (!canPlayBookAudio && !audioByUsfm[usfm]) return;
    const audio = audioRef.current;
    if (
      audio &&
      audioBookRef.current === usfm &&
      (audio.src || audio.currentSrc)
    ) {
      void toggleBookAudio();
      return;
    }
    void playUsfmAudio(usfm);
  }

  function seekAudio(seconds: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    const max = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : seconds;
    audio.currentTime = Math.min(Math.max(0, seconds), Math.max(0, max));
    setAudioTime(audio.currentTime);
    if (audioBookRef.current) saveAudioPosition(audioBookRef.current, audio.currentTime);
  }

  function setReadingChrome(hidden: boolean, force = false) {
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
  }

  useEffect(() => {
    if (!forceChrome) return;
    chromeLockUntil.current = 0;
    setReadingChrome(false, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setReadingChrome is a render-local helper
  }, [forceChrome]);

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
    syncHeadCompact(passageScrollRef.current?.scrollTop ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setReadingChrome is a render-local helper
  }, [bookId, chapterId, planReading?.label]);

  useEffect(() => {
    if (planReading && onPlanStep) setFocusDim(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional plan focus reset
  }, [planReading?.label, planReading?.verseStart, planReading?.verseEnd, onPlanStep]);

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
    syncHeadCompact(root.scrollTop);

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
        syncHeadCompact(top);

        // 1.º scroll do utilizador: desliga o texto opaco (não partilha lock do chrome).
        if (
          focusDimActiveRef.current &&
          Math.abs(delta) >= FOCUS_DIM_CLEAR_PX &&
          performance.now() >= suppressFocusDimClearUntil.current
        ) {
          clearFocusDimOnUserScroll();
        }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setReadingChrome is a render-local helper
  }, [active, bookId, chapterId]);

  return (
    <section
      ref={readerRef}
      className={`bible-reader bible-reader--yv${hideChrome ? " is-chrome-hidden" : ""}${audioPlaying ? " is-audio-playing" : ""}${showCreateCard ? " has-verse-actions" : ""}${shareSheetOpen ? " is-share-open" : ""}${headCompact ? " is-head-compact" : ""}${surfaceChrome.rootClassPassageRollOpen ? " is-passage-roll-open" : ""}${compactToolsMenu ? " is-compact-tools" : ""}${toolsMenuOpen ? " is-tools-menu-open" : ""}`}
      style={{ ["--bible-font-size" as string]: `${fontSize}px` }}
      onKeyDown={(event) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
          return;
        }
        if (planReading) {
          if (event.key === "Escape") {
            event.preventDefault();
            if (shareSheetOpen) {
              setShareSheetOpen(false);
              return;
            }
            if (pickerOpen) {
              closePicker();
              return;
            }
            if (showCreateCard) {
              closeCreateCard();
              return;
            }
            handlePlanBack();
            return;
          }
          if (
            pickerOpen ||
            showCreateCard ||
            toolsMenuOpen ||
            historyOpen ||
            shareSheetOpen
          ) {
            return;
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            if (onPlanStep) {
              if (!planReading.isFirst) planReading.onPrev();
            } else {
              goAdjacent(-1);
            }
          } else if (event.key === "ArrowRight" || event.key === "Enter") {
            event.preventDefault();
            if (onPlanStep) {
              planReading.onAdvance();
            } else {
              goAdjacent(1);
            }
          }
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          if (shareSheetOpen) {
            setShareSheetOpen(false);
            return;
          }
          if (pickerOpen) {
            closePicker();
            return;
          }
          if (showCreateCard) {
            closeCreateCard();
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
        className={`bible-yv-top${planReading ? " is-plan" : " is-free"}${surfaceChrome.rootClassPassageRollOpen ? " is-passage-roll-open" : ""}${catalogOfflineHint ? " is-catalog-offline" : ""}${compactToolsMenu ? " is-compact-tools" : ""}`}
        aria-label="Navigation biblique"
      >
        {planReading ? (
          <>
            <button
              type="button"
              className="bible-yv-back bible-yv-plan-exit"
              onClick={handlePlanBack}
              aria-label={
                onPlanStep
                  ? "Quitter la lecture du plan"
                  : "Retour au passage du plan"
              }
            >
              <YvIcon name="chevron_left" className="bible-yv-back-icon" />
            </button>
            {renderPassageRoll(" is-plan-chrome")}
          </>
        ) : (
          renderPassageRoll()
        )}
        <div className="bible-yv-top-tools">
          {planReading ? (
            <button
              type="button"
              className="bible-yv-search-btn"
              aria-label="Partager le plan"
              title="Partager le plan"
              disabled={!canSharePlan}
              onClick={() => {
                setToolsMenuOpen(false);
                setShareMode("plan");
                setShareSheetOpen(true);
              }}
            >
              <YvIcon name="ios_share" className="bible-yv-tool-icon" />
            </button>
          ) : null}
          {!compactToolsMenu ? renderTopToolsMenu("header") : null}
        </div>
      </header>

      <div id={statusId} className="sr-only" aria-live="polite">
        {passageLiveStatusLabel({ presentation, locationLabel, error })}
      </div>

      <div
        className={`bible-yv-read-surface${
          surfaceChrome.passageInputBlocked ? " is-overlay-occluding" : ""
        }`}
        onClickCapture={(event) => {
          if (!takeOverlayDismissSwallow()) return;
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerDownCapture={(event) => {
          if (!surfaceChrome.toolsMenuPassThroughDismiss) return;
          const target = event.target;
          if (!(target instanceof Element)) return;
          if (toolsMenuRef.current?.contains(target)) return;
          if (
            !target.closest(".bible-passage") &&
            !target.classList.contains("bible-yv-read-surface")
          ) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          markOverlayDismissSwallow();
          setToolsMenuOpen(false);
        }}
      >
        {surfaceChrome.passageSurfaceScrimOpen ? (
          <button
            type="button"
            className={`bible-yv-passage-roll-scrim${
              surfaceChrome.scrimIsTools ? " is-tools" : ""
            }${surfaceChrome.scrimIsPickerDismiss ? " is-picker-dismiss" : ""}`}
            aria-label="Fermer"
            onPointerDown={(event) => {
              event.preventDefault();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              dismissPassageSurfaceOverlay();
            }}
          />
        ) : null}

        {error && passageErrorKind !== "offline_not_cached" ? (
          <div className="bible-yv-error-bar" role="alert" aria-live="assertive">
            <p className="bible-yv-error" id={error ? `${statusId}-error` : undefined}>
              {error}
            </p>
            <button
              type="button"
              className="bible-yv-chip"
              onClick={() => retryChapter(bookId, chapterId)}
              disabled={presentation.inFlight || pickerOpen}
              aria-describedby={`${statusId}-error`}
            >
              Réessayer
            </button>
          </div>
        ) : null}

        <article
        ref={passageScrollRef}
        className={[
          "bible-passage",
          presentation.isReloading ? " is-chapter-loading is-chapter-reload" : "",
          presentation.isOpening ? " is-chapter-opening" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-busy={presentation.ariaBusy}
        aria-hidden={surfaceChrome.passageInputBlocked || undefined}
        inert={surfaceChrome.passageInputBlocked || undefined}
        style={
          {
            ["--verse-tint" as string]: actionTone.tint,
            ...(activeSchema ? passageSchemaCssVars(activeSchema) : {}),
          } as CSSProperties
        }
        onClick={() => {
          if (takeOverlayDismissSwallow()) return;
          if (surfaceChrome.passageInputBlocked) return;
          // Tap to reveal chrome (YouVersion).
          if (chromeHiddenRef.current) setReadingChrome(false, true);
        }}
      >
        <header className="bible-passage-head">
          <p className="bible-book-name">{bookTitle}</p>
          <p className="bible-chapter-num">{chapterId}</p>
        </header>

        {showOfflineChapterGateUi ? (
          <BibleOfflineChapterGate
            onDownload={() => void toggleOfflineBible()}
            offlineBusy={offlineBusy}
          />
        ) : presentation.showOpeningSkeleton ? (
          <BibleChapterLoadingPlaceholder
            bookTitle={bookTitle}
            chapterId={chapterId}
            presentation={presentation}
            lineCount={activeSchema?.skeletonVerseSlots}
            schema={activeSchema ?? undefined}
          />
        ) : passage?.verses?.length ? (
          <div
            className={[
              "bible-verses",
              selection?.length ? "is-dimming" : "",
              !selection?.length &&
              focusDimActive &&
              ((planReading && onPlanStep) || highlightVerse != null)
                ? "is-passage-focus"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {passage.verses.map((verse) => {
              const jumpFocus = preferJumpFocusRef.current;
              const inPlanRange = Boolean(
                planReading &&
                  onPlanStep &&
                  !jumpFocus &&
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
                planReading && onPlanStep && !jumpFocus && planReading.verseStart != null
                  ? Math.min(
                      planReading.verseStart,
                      planReading.verseEnd ?? planReading.verseStart,
                    )
                  : highlightVerse;
              const focusLo =
                highlightVerse != null
                  ? Math.min(highlightVerse, highlightVerseEnd ?? highlightVerse)
                  : null;
              const focusHi =
                highlightVerse != null
                  ? Math.max(highlightVerse, highlightVerseEnd ?? highlightVerse)
                  : null;
              const inDeeplink = Boolean(
                !selection?.length &&
                  focusLo != null &&
                  focusHi != null &&
                  verse.number >= focusLo &&
                  verse.number <= focusHi &&
                  (jumpFocus || !planReading || !onPlanStep),
              );
              const inRange = inPlanRange || inDeeplink;
              const isRangeAnchor = selection?.length
                ? highlightVerse === verse.number
                : rangeStart != null
                  ? verse.number === rangeStart
                  : highlightVerse === verse.number;
              const active = selection?.length
                ? highlightVerse === verse.number
                : isRangeAnchor;
              const selected = verseInSelection(selection, verse.number);
              const markColor = chapterMarks.get(verse.number);
              const markDisplay = markColor
                ? adaptVerseColorForTheme(markColor, uiTheme)
                : null;
              const selEdge = selectionEdgeClass(selection, verse.number);
              const hasFlashcard = chapterCardVerses.has(verse.number);
              const titleLike = isLikelyVerseTitle(verse.text, verse.number);
              return (
                <button
                  key={verse.number}
                  type="button"
                  className={[
                    "bible-verse",
                    active ? "is-focus" : "",
                    inRange ? "is-in-range" : "",
                    selected ? "is-selected" : "",
                    markDisplay ? "is-marked" : "",
                    hasFlashcard ? "has-card" : "",
                    selEdge,
                    titleLike ? "is-title" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-verse={verse.number}
                  style={
                    markDisplay
                      ? ({ ["--verse-mark" as string]: markDisplay } as CSSProperties)
                      : undefined
                  }
                  aria-label={
                    hasFlashcard
                      ? `Verset ${verse.number}, flashcard`
                      : `Verset ${verse.number}`
                  }
                  aria-pressed={selected}
                  aria-current={inRange && !selected ? "true" : undefined}
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
                  {hasFlashcard ? (
                    <span className="bible-verse-card-icon" aria-hidden="true">
                      <YvIcon name="style" />
                    </span>
                  ) : null}
                  <span className="bible-verse-text">{verse.text}</span>
                </button>
              );
            })}
          </div>
        ) : passage?.content ? (
          <p className="bible-text">{passage.content}</p>
        ) : presentation.isOpening || presentation.inFlight ? null : !presentation.ariaBusy &&
            !isUsfmBookId(bookId) ? (
          <p className="bible-yv-muted">{PASSAGE_LOADING_COPY.emptyPassage}</p>
        ) : null}
      </article>
      </div>

      {showCreateCard ? (
          <div
            ref={verseActionsSheetRef}
            className={`bible-verse-actions is-sheet${narrowChrome ? " is-tab-chrome" : ""}`}
            role="dialog"
            aria-modal="false"
            aria-label="Actions du verset"
            style={
              {
                ["--verse-tint" as string]: actionTone.tint,
                ["--verse-action-fill" as string]: actionTone.fill,
                ["--verse-action-ink" as string]: actionTone.ink,
              } as CSSProperties
            }
          >
            <div className="bible-verse-actions-head">
              <div className="bible-verse-actions-title">
                <p className="bible-verse-actions-ref">
                  {selectedVerses.length
                    ? formatSelectionFront(bookTitle, chapterId, selectedVerses)
                    : ""}
                  {existingVerseCard ? (
                    <span className="bible-verse-actions-card-icon" aria-hidden="true">
                      <YvIcon name="style" />
                    </span>
                  ) : null}
                </p>
                {selectedVerses.length > 1 ? (
                  <p className="bible-verse-actions-hint">
                    {selectedVerses.length} versets · tape pour ajouter ou retirer
                  </p>
                ) : (
                  <p className="bible-verse-actions-hint">
                    Tape d&apos;autres versets pour compléter la sélection
                  </p>
                )}
              </div>
              <button
                type="button"
                className="bible-verse-actions-close"
                onClick={closeCreateCard}
                aria-label="Fermer"
              >
                <YvIcon name="close" className="bible-verse-actions-close-icon" />
              </button>
            </div>

            <div className="bible-verse-actions-body">
          <div className="bible-verse-action-block">
            <p className="bible-verse-action-label" id="bible-verse-color-label">
              Marquer
            </p>

            <div className="bible-verse-color-row" role="group" aria-labelledby="bible-verse-color-label">
              <button
                type="button"
                className={`bible-verse-color-picker${selectionHasMark ? " is-marked" : ""}`}
                style={
                  {
                    ["--swatch" as string]: pickerColor,
                    ["--swatch-check" as string]: verseSwatchCheckInk(pickerColor),
                  } as CSSProperties
                }
                title="Personnaliser la couleur"
                aria-label={`Couleur ${verseColorHueLabel(pickerColor)} ${formatVerseColorHex(pickerColor)}. Ouvrir l’éditeur`}
                aria-labelledby="bible-verse-color-label"
                aria-haspopup="dialog"
                aria-expanded={colorEditorOpen}
                onClick={() => setColorEditorOpen(true)}
              >
                <span className="bible-verse-color-picker-plus" aria-hidden>
                  +
                </span>
              </button>
              <button
                type="button"
                className={`bible-yv-chip bible-mark-toggle${selectionHasMark ? " is-marked" : ""}`}
                aria-pressed={selectionHasMark}
                onClick={() => {
                  if (selectionHasMark) {
                    clearSelectionMarks();
                    return;
                  }
                  requestMarkSelection(activeVerseColor);
                }}
              >
                {selectionHasMark ? (
                  <YvIcon name="bookmark_remove" className="bible-verse-cta-icon" />
                ) : (
                  <YvIcon name="bookmark" className="bible-verse-cta-icon" />
                )}
                <span>{selectionHasMark ? "Démarquer" : "Marquer"}</span>
              </button>
            </div>

            <CircularColorEditor
              open={colorEditorOpen}
              initialHex={pickerColor}
              theme={uiTheme}
              onClose={() => setColorEditorOpen(false)}
              onConfirm={(hex) => {
                setColorEditorOpen(false);
                applyPickerColor(hex);
              }}
            />
          </div>

          <div className="bible-verse-action-block is-actions">
            <p className="bible-verse-action-label" id="bible-verse-actions-label">
              Suite
            </p>
            <div
              className={`bible-verse-cta-row${VERSE_SUITE_FLASHCARDS_ENABLED ? "" : " is-single"}`}
              role="group"
              aria-labelledby="bible-verse-actions-label"
            >
              {VERSE_SUITE_FLASHCARDS_ENABLED ? (
                existingVerseCard && selectedVerseCardId ? (
                  <button
                    type="button"
                    className="bible-yv-chip bible-make-card is-carded bible-view-card"
                    disabled={cardBusy || !onViewFlashcard}
                    onClick={() => onViewFlashcard?.(selectedVerseCardId)}
                  >
                    <YvIcon name="style" className="bible-verse-cta-icon" />
                    <span>Voir</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="bible-yv-chip bible-make-card"
                    disabled={cardBusy}
                    onClick={() => void makeFlashcard()}
                  >
                    {cardBusy ? (
                      "…"
                    ) : (
                      <>
                        <YvIcon name="style" className="bible-verse-cta-icon" />
                        <span>Flashcard</span>
                      </>
                    )}
                  </button>
                )
              ) : null}
              <button
                type="button"
                className="bible-yv-chip bible-share-verse"
                disabled={!canShareVerse}
                onClick={() => {
                  setShareMode("verse");
                  setShareSheetOpen(true);
                }}
              >
                <YvIcon name="ios_share" className="bible-verse-cta-icon" />
                <span>Partager</span>
              </button>
            </div>
          </div>
            </div>
          {cardMsg ? <p className="bible-verse-actions-msg">{cardMsg}</p> : null}
        </div>
      ) : null}

      {compactToolsMenu ? renderTopToolsMenu("float") : null}

      {(() => {
        const compactDock = compactViewport || narrowChrome;
        const freeReadingDock = !planReading;
        return (
      <footer
        className={`bible-yv-dock${planReading ? " is-plan" : ""}${showCreateCard ? " has-verse-actions" : ""}${audioPlaying ? " is-playing" : ""}${compactDock ? " is-floating" : ""}${freeReadingDock ? " is-play-only" : ""}`}
        aria-hidden={hideChrome && planReading ? true : undefined}
        inert={hideChrome && planReading ? true : undefined}
        aria-label={freeReadingDock ? "Lecteur audio" : "Lecture du plan"}
      >
        <BibleAudioFloat
          hasAudio={canPlayBookAudio}
          playing={audioPlaying}
          busy={audioBusy}
          currentTime={audioTime}
          duration={audioDuration}
          onTogglePlay={() => handleAudioTransport()}
          onSeek={(seconds) => seekAudio(seconds)}
        />
        {planReading ? (
        <div className="bible-yv-dock-nav bible-yv-dock-nav--plan">
          <button
            type="button"
            className="bible-yv-dock-arrow"
            onClick={() => planReading.onPrev()}
            disabled={planReading.isFirst || presentation.inFlight}
            aria-label="Passage précédent du plan"
          >
            <YvIcon name="chevron_left" className="bible-yv-dock-icon" />
          </button>
          <div
            className={`bible-yv-dock-location is-static${onPlanStep ? "" : " is-off-step"}`}
            title={planReading.planName}
          >
            <span className="bible-yv-dock-location-text">{planReading.label}</span>
            {planStepProgress ? (
              <span className="bible-yv-dock-plan-progress" aria-hidden>
                {planStepProgress}
              </span>
            ) : null}
            {!onPlanStep ? (
              <button
                type="button"
                className="bible-yv-dock-plan-resync"
                onClick={() => handlePlanBack()}
              >
                Revenir au passage
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className={`bible-yv-dock-advance${planReading.isLast ? " is-complete" : ""}`}
            onClick={() => planReading.onAdvance()}
            disabled={presentation.inFlight}
            aria-label={
              planReading.isLast
                ? "Conclure la lecture du jour"
                : "Passage suivant du plan"
            }
          >
            {planReading.isLast ? (
              <YvIcon name="check" className="bible-yv-dock-icon" />
            ) : (
              <YvIcon name="chevron_right" className="bible-yv-dock-icon" />
            )}
          </button>
        </div>
        ) : null}
      </footer>
        );
      })()}

      <BibleShareSheet
        open={shareSheetOpen}
        layoutRootRef={readerRef}
        onClose={() => setShareSheetOpen(false)}
        mode={shareMode}
        refLabel={shareRefLabel}
        verseText={shareVerseText}
        usfm={shareUsfm}
        accentHex={shareAccentHex}
        planTitle={
          planReading?.planShareTitle?.trim() ||
          planReading?.planName?.trim() ||
          ""
        }
        planDescription={planReading?.planDescription ?? ""}
        planMeta={planReading?.planMeta ?? ""}
        planId={planReading?.planShareId ?? null}
      />

      {ACTIVITY_UI_ENABLED ? (
        <BibleHistorySheet
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onSelect={({ bookId, chapterId, verse }) => {
            setHistoryOpen(false);
            setPickerOpen(false);
            void loadChapter(bookId, chapterId, verse);
          }}
          onHistoryChange={onReadingHistoryChange}
        />
      ) : null}
    </section>
  );
}
