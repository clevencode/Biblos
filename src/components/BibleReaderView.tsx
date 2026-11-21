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
import { HeaderTriggerButton } from "./HeaderTriggerButton";
import { YvIcon } from "./YvIcon";
import { usePwaInstall } from "../hooks/usePwaInstall";
import {
  adjacentChapter,
  chapterUsfm,
  parseUsfmParts,
  LSG_BIBLE_ID,
  type BibleSearchHit,
} from "../youversion/client";
import { parseUsfmLocation, type ParsedPassage } from "../youversion/usfm";
import {
  isBibleTextVersionId,
  readBibleTextVersionPref,
  type BibleTextVersionId,
} from "../bible/bibleVersions";
import type {
  ProfileOverlayRequest,
  ProfileReadingChrome,
} from "../bible/profileReadingChrome";
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
import { BibleMarksSheet } from "./BibleMarksSheet";
import { BibleShareSheet } from "./BibleShareSheet";
import { SearchBooksModal } from "./SearchBooksModal";
import {
  VerseStudyPanel,
  getRefsListScroll,
  setRefsListScroll,
} from "./VerseStudyDrawer";
import { BiblePassageScrollPicker } from "./BiblePassageScrollPicker";
import { BiblePassageChip } from "./BiblePassageChip";
import {
  languageForVersion,
  verseStudyKey,
  versionBadgeFor,
} from "../bible/readingScope";
import {
  studyJumpReturnOverlay,
  useStudyJumpStack,
  type PendingStudyReturn,
  type StudyJumpReturnTo,
} from "../bible/viewState/studyJumpStack";
import { useUiLocale } from "../i18n/UiLocaleContext";
import { notifyUiLocale, subscribeUiLocale } from "../i18n/uiLocale";
import { subscribeShellRadial } from "../shellRadial";
import { subscribeReaderShellBack } from "../shellBackStack";
import {
  formatPassagePillRef,
  isPassagePillUnified,
} from "../bible/passagePillLayout";
import { passagePickerSkipsVerseStep } from "../bible/passagePickerFlow";
import { passageBarSkipIcons } from "../bible/passageBarSkipIcons";
import { isPassageBarPanelCompactTopbar } from "../bible/passageBarPanelLayout";
import { BiblePassageWordSearchPanel } from "./BiblePassageWordSearchPanel";
import { BibleOfflineChapterGate } from "./BibleOfflineChapterGate";
import type { DiscoveryJump } from "../bible/passageDiscovery/types";
import {
  OVERLAY_DISMISS_SWALLOW_MS,
  PASSAGE_LOADING_COPY,
  biblePickerChrome,
  bibleReaderErrorMessage,
  mergeBibleReaderErrors,
  overlayDismissTarget,
  passageLiveStatusLabel,
  passagePickerChromeFromPresentation,
  pickerVerseNumberOptions,
  planReaderOnStep,
  readerSurfaceChrome,
  showOfflineChapterGate,
} from "../bible/viewState";
import { usePassageViewModel } from "../hooks/usePassageViewModel";
import { useBibleOverlayController } from "../hooks/useBibleOverlayController";
import { usePassageBarController } from "../hooks/usePassageBarController";
import { useAppReadiness } from "../context/AppReadinessContext";
import { CircularColorEditor } from "./CircularColorEditor";
import { ACTIVITY_UI_ENABLED } from "../activityLog";
import { PlanStageNotePanel } from "../features/reading-plans/presentation/PlanStageNotePanel";
import {
  bindBibleAudioControls,
  clearBibleAudioControls,
  syncBibleAudioControls,
} from "../bibleAudioControls";
import {
  destroyNativeBibleAudio,
  ensureNativeAudioNotificationPermission,
  getNativeActiveAudioId,
  getNativeBibleAudioTime,
  getNativePreparedUrl,
  isNativeBibleAudio,
  isNativeBibleAudioPlaying,
  isNativeBibleAudioReady,
  pauseNativeBibleAudio,
  playNativeBibleAudio,
  prepareNativeBibleAudio,
  seekNativeBibleAudio,
} from "../bibleNativeAudio";
import { verseCardId } from "../verseCard";
import {
  buildShareText,
  buildShareUrl,
  formatSelectedVersesForShare,
  sharePlainText,
} from "../shareVerse";
import {
  clearOfflineBible,
  downloadOfflineBible,
  isOfflineBibleReady,
  type OfflineDownloadProgress,
} from "../bibleOffline";
import {
  classifyOfflineDownloadError,
  clearVersionAvailabilityError,
  clearVersionDownloadProgress,
  setVersionAvailabilityError,
  setVersionDownloadProgress,
} from "../bible/bibleVersionStatus";
import {
  BIBLE_READER_PREFS_KEY,
  writeReadingPrefs,
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
import { resolveTheme, type ResolvedTheme } from "../theme";
import { loadChapterMarks, setVerseMarks } from "../verseMarks";
import type { Flashcard } from "../types";
const STORAGE_KEY = BIBLE_READER_PREFS_KEY;
/** Panneau verset : pas de Flashcard tant que l’onglet Cartes est désactivé. */
const FONT_MIN = 15;
const FONT_MAX = 28;
const FONT_DEFAULT = 19;
const FONT_STEP = 0.5;

type BibleFontFamily = "serif" | "sans";

const BIBLE_FONT_FAMILIES: readonly {
  id: BibleFontFamily;
  label: string;
}[] = [
  { id: "serif", label: "Serif" },
  { id: "sans", label: "Sans" },
];

function isBibleFontFamily(value: unknown): value is BibleFontFamily {
  return value === "serif" || value === "sans";
}

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

/** Lock curto ao forçar show do chrome (modal / restore). Hide-on-scroll desactivado. */
const CHROME_SHOW_LOCK_MS = 120;
const CHROME_PROGRAMMATIC_LOCK_MS = 320;
/** Scroll do utilizador (px) para desligar o texto opaco do verso focado. */
const FOCUS_DIM_CLEAR_PX = 6;

const EMPTY_VERSES: number[] = [];

/** Larguras % das linhas skeleton no cold open (anti-CLS). */
const PASSAGE_OPENING_SKELETON_WIDTHS = [
  92, 78, 88, 64, 84, 71, 90, 58, 86, 74, 81, 67,
] as const;

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

/** Rótulo de origem do estudo (barra Retour) — título de leitura, sem ALL CAPS. */
function formatStudyOriginLabel(
  bookTitle: string,
  chapter: string | number,
  verse: number,
): string {
  const book = String(bookTitle || "").trim() || "—";
  const ch = String(chapter ?? "").trim();
  if (!ch) return book;
  return `${book} ${ch}.${verse}`;
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
  fontFamily?: BibleFontFamily;
  textVersion?: BibleTextVersionId;
};

type BibleReaderViewProps = {
  /** Référence initiale (ex. Jean 3.16). */
  initialRef?: string;
  /** Navigation externe (rappel → Lecture). */
  focusRef?: string | null;
  /** Força a versão ativa antes de aplicar `focusRef` (histórico isolado). */
  focusVersionId?: BibleTextVersionId | null;
  focusSeq?: number;
  /** Onglet Lecture visible (le panneau peut être `hidden` au montage). */
  active?: boolean;
  onBack?: () => void;
  /** Mode lecture de plan : un pas = un chapitre, › = chapitre suivant. */
  planReading?: {
    planId: string;
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
    jour: number;
    /** Référence du pas courant — pour détecter une navigation hors plan. */
    focusRef: string;
    isFirst: boolean;
    isLast: boolean;
    /** Dernier jour de l’étape — skip › → ✓. */
    isStageLast?: boolean;
    stageName?: string;
    stageIndex?: number;
    stageCount?: number;
    stageDayIndex?: number;
    stageDayCount?: number;
    stepIndex: number;
    stepCount: number;
    verseStart?: number | null;
    verseEnd?: number | null;
    onPrev: () => void;
    onAdvance: () => void;
    onAdvanceAfterNote?: () => void;
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
  /** Navbar shell: hide só com modal ativo (não ao scroll). */
  onReadingChromeChange?: (hidden: boolean) => void;
  /** Soft gate: exige compte après cota de marques guest. */
  requireAccountToMark?: boolean;
  /** Pedido externo (perfil) para abrir history/marks quando o leitor fica activo. */
  openOverlayRequest?: ProfileOverlayRequest | null;
  onOpenOverlayRequestConsumed?: () => void;
  /** Fechar history/marks abertos a partir do perfil → reabrir Profile (não o menu). */
  onReturnToProfile?: () => void;
  /** Snapshot versão/offline para o painel de conta. */
  onProfileReadingChromeChange?: (chrome: ProfileReadingChrome) => void;
  /** Demande login antes de marcar; retoma via authorizedMark*. */
  onRequestAccountToMark?: (payload: {
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
    versionId: BibleTextVersionId;
    language: string;
    versionBadge: string;
    localizedBookName: string;
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
  writeReadingPrefs(prefs);
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
  focusVersionId = null,
  focusSeq = 0,
  active = true,
  onBack,
  planReading = null,
  existingVerseCardIds,
  existingVerseCardColors,
  onUpdateVerseCardColor,
  onReadingChromeChange,
  requireAccountToMark = false,
  onRequestAccountToMark,
  authorizedMarkSeq = 0,
  authorizedMark = null,
  onAuthorizedMarkConsumed,
  onVerseMarked,
  onBibleRead,
  onReadingHistoryChange,
  compactToolsMenu = false,
  compactViewport = false,
  openOverlayRequest = null,
  onOpenOverlayRequestConsumed,
  onReturnToProfile,
  onProfileReadingChromeChange,
}: BibleReaderViewProps) {
  const { t } = useUiLocale();
  const pwaInstall = usePwaInstall();
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
  const switchTextVersionRef = useRef<
    (next: BibleTextVersionId) => Promise<void>
  >(async () => {});
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
  const [fontFamily, setFontFamily] = useState<BibleFontFamily>(() =>
    isBibleFontFamily(prefs.fontFamily) ? prefs.fontFamily : "serif",
  );
  const [narrowChrome, setNarrowChrome] = useState(false);
  const [cardMsg, setCardMsg] = useState<string | null>(null);
  const [cardColor, setCardColor] = useState(() => loadPreferredVerseColor());
  const [chapterMarks, setChapterMarks] = useState<ReadonlyMap<number, string>>(
    () => new Map(),
  );
  const [chromeHidden, setChromeHidden] = useState(false);
  /** Fade do texto ao trocar de capítulo. */
  const [passageFadeIn, setPassageFadeIn] = useState(false);
  const [audioByUsfm, setAudioByUsfm] = useState<Record<string, BibleAudioEpisode>>({});
  const [audioPodcast, setAudioPodcast] = useState("Bible | Podcast.s21");
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioActiveUsfm, setAudioActiveUsfm] = useState<string | null>(null);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareMode] = useState<"verse" | "plan">("verse");
  /** Tabs do modal de seleção: Verset | Référence */
  const [verseActionsTab, setVerseActionsTab] = useState<"verse" | "refs">(
    "verse",
  );
  /** Pilha LIFO de estudo (Aller au verset) — só pop / × a limpam. */
  const {
    top: studyJumpTop,
    depth: studyJumpDepth,
    push: pushStudyJump,
    pop: popStudyJump,
    clear: clearStudyJump,
  } = useStudyJumpStack();
  const [pendingStudyReturn, setPendingStudyReturn] =
    useState<PendingStudyReturn | null>(null);
  /** Scroll da lista Référence a forçar após pop (até Options fechar). */
  const [refsRestoreScrollTop, setRefsRestoreScrollTop] = useState<
    number | null
  >(null);
  /** Sticky: Options na tab Référence após retorno da pilha. */
  const preferRefsTabOnOpenRef = useRef(false);
  const [dayNoteOpen, setDayNoteOpen] = useState(false);
  /** Fin d’étape / fin de plan → retour plans après la note. */
  const [dayNoteReturnsToPlans, setDayNoteReturnsToPlans] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement | null>(null);
  const verseSelectListRef = useRef<HTMLUListElement | null>(null);
  const verseSelectAnchoredRef = useRef(false);
  const restoreHistoryFocusRef = useRef(true);
  const historyWasOpenRef = useRef(false);
  const restoreToolsFocusRef = useRef(true);
  /** History/marks abertos via Profile — back devolve ao Profile, não ao menu. */
  const overlayReturnToProfileRef = useRef(false);
  const onReturnToProfileRef = useRef(onReturnToProfile);
  onReturnToProfileRef.current = onReturnToProfile;
  const toolsWasOpenRef = useRef(false);
  const overlayDismissSwallowRef = useRef(false);
  const overlayDismissSwallowTimerRef = useRef<number | undefined>(undefined);

  const markOverlayDismissSwallow = useCallback(() => {
    overlayDismissSwallowRef.current = true;
    window.clearTimeout(overlayDismissSwallowTimerRef.current);
    overlayDismissSwallowTimerRef.current = window.setTimeout(() => {
      overlayDismissSwallowRef.current = false;
    }, OVERLAY_DISMISS_SWALLOW_MS);
  }, []);

  const takeOverlayDismissSwallow = useCallback((): boolean => {
    if (!overlayDismissSwallowRef.current) return false;
    overlayDismissSwallowRef.current = false;
    window.clearTimeout(overlayDismissSwallowTimerRef.current);
    return true;
  }, []);

  /**
   * Fechar Options para navegar (Référence chip → DiscoveryJump): o clear da
   * seleção não pode apagar pendingScroll/highlight que loadChapter define.
   * NÃO consumir aqui — leaveVerseActions no updater pode reentrar (Strict Mode);
   * o adaptador do jump desliga o flag só depois do navigate + close.
   */
  const preservePassageNavRef = useRef(false);

  const clearVerseSelectionUi = useCallback(() => {
    if (!preservePassageNavRef.current) {
      preferJumpFocusRef.current = false;
      pendingScrollVerse.current = null;
      lastAppliedVerseScroll.current = "";
      setHighlightVerse(null);
      setHighlightVerseEnd(null);
      setFocusDim(false);
      preferRefsTabOnOpenRef.current = false;
      setRefsRestoreScrollTop(null);
    }
    setSelection(null);
    setCardMsg(null);
    setCardColor(loadPreferredVerseColor());
    setColorEditorOpen(false);
  }, []);

  const {
    activeOverlay,
    hasActiveModal,
    openOverlay,
    closeOverlay,
    toggleOverlay,
  } = useBibleOverlayController({
    onClearVerseSelection: clearVerseSelectionUi,
  });

  const pickerOpen = activeOverlay.type === "passage_picker";
  const wordSearchOpen = activeOverlay.type === "word_search";
  const bookSearchOpen = activeOverlay.type === "book_search";
  const toolsMenuOpen = activeOverlay.type === "reader_settings";
  const historyOpen = activeOverlay.type === "history";
  const marksOpen = activeOverlay.type === "marks";
  const hasActiveModalRef = useRef(hasActiveModal);
  hasActiveModalRef.current = hasActiveModal;

  /** WAI: ao fechar histórico, focus no hamburger (histórico saiu da topbar). */
  useLayoutEffect(() => {
    if (historyOpen) {
      historyWasOpenRef.current = true;
      return;
    }
    if (!historyWasOpenRef.current) return;
    historyWasOpenRef.current = false;
    if (!restoreHistoryFocusRef.current) {
      restoreHistoryFocusRef.current = true;
      return;
    }
    const trigger = toolsMenuRef.current?.querySelector(
      "button.bible-yv-tools-menu-btn",
    ) as HTMLButtonElement | null;
    trigger?.focus({ preventScroll: true });
  }, [historyOpen]);

  /** WAI: ao fechar menu, focus no trigger hamburger. */
  useLayoutEffect(() => {
    if (toolsMenuOpen) {
      toolsWasOpenRef.current = true;
      return;
    }
    if (!toolsWasOpenRef.current) return;
    toolsWasOpenRef.current = false;
    if (!restoreToolsFocusRef.current) {
      restoreToolsFocusRef.current = true;
      return;
    }
    const trigger = toolsMenuRef.current?.querySelector(
      "button.bible-yv-tools-menu-btn",
    ) as HTMLButtonElement | null;
    trigger?.focus({ preventScroll: true });
  }, [toolsMenuOpen]);

  const requestOpenPassagePicker = useCallback(() => {
    setShareSheetOpen(false);
    openOverlay({ type: "passage_picker" });
  }, [openOverlay]);

  const requestClosePicker = useCallback(() => {
    closeOverlay();
  }, [closeOverlay]);

  const requestCloseWordSearch = useCallback(() => {
    closeOverlay();
  }, [closeOverlay]);

  const requestToggleWordSearch = useCallback(() => {
    setShareSheetOpen(false);
    toggleOverlay("word_search");
  }, [toggleOverlay]);

  const closeToolsMenu = useCallback(
    (options?: { restoreFocus?: boolean }) => {
      restoreToolsFocusRef.current = options?.restoreFocus !== false;
      closeOverlay();
    },
    [closeOverlay],
  );

  /** Fecha history/marks: se vieram do Profile, reabre Profile; senão volta ao menu. */
  const leaveHistoryOrMarks = useCallback(
    (mode: "back" | "dismiss" = "back") => {
      if (overlayReturnToProfileRef.current) {
        overlayReturnToProfileRef.current = false;
        restoreHistoryFocusRef.current = false;
        restoreToolsFocusRef.current = false;
        closeOverlay();
        onReturnToProfileRef.current?.();
        return;
      }
      if (mode === "back") {
        restoreHistoryFocusRef.current = false;
        openOverlay({ type: "reader_settings" });
        return;
      }
      restoreHistoryFocusRef.current = true;
      closeOverlay();
    },
    [closeOverlay, openOverlay],
  );

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
      const vId = textVersionRef.current;
      const localizedBookName =
        resolveBookTitleActive(outcome.bookId) || outcome.bookId;
      onBibleRead?.({
        bookId: outcome.bookId,
        chapterId: outcome.chapterId,
        verse: outcome.verse,
        label: outcome.label,
        versionId: vId,
        language: languageForVersion(vId),
        versionBadge: versionBadgeFor(vId),
        localizedBookName,
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

  const {
    discoverySplitSearch,
    passageStep,
    setPassageStep,
    passageRollOpen,
    bookSearchQuery,
    setBookSearchQuery,
    wordSearchQuery,
    setWordSearchQuery,
    wordSearchScopeFilter,
    setWordSearchScopeFilter,
    wordSearchSelectedBookIds,
    setWordSearchSelectedBookIds,
    wordSearchFacets,
    wordSearchScopeCounts,
    discoverySession,
    passageDiscovery,
    passageDiscoveryBusy,
    wordDiscovery,
    wordDiscoveryBusy,
    wordVerseHits,
    wordVerseTotal,
    wordSearchPage,
    wordSearchPageCount,
    setWordSearchPage,
    wordSearchPaging,
    wordMatchMode,
    wordMatchedTerms,
    passageRollRef,
    wordSearchPanelId,
    passagePickerPanelId,
    armPendingVerseStep,
    patchDiscoverySession,
    setDiscoveryListScroll,
    setDiscoveryVerseListScroll,
    clearBookSearch,
    clearWordSearch,
    closeWordSearch,
    closePicker,
    closeAll,
    togglePassagePicker,
    togglePassagePickerRef,
  } = usePassageBarController({
    pickerPanelOpenAllowed: pickerChrome.pickerPanelOpenAllowed,
    pickerOpen,
    wordSearchOpen,
    requestOpenPassagePicker,
    requestClosePicker,
    requestToggleWordSearch,
    requestCloseWordSearch,
    books,
    textVersion,
    bookId,
    chapterId,
    passageId: passage?.id,
    presentationInFlight: presentation.inFlight,
    markOverlayDismissSwallow,
  });

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
  const passageScrollRef = useRef<HTMLElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioBookRef = useRef<string>("");
  const lastScrollTop = useRef(0);
  const chromeHiddenRef = useRef(false);
  const chromeLockUntil = useRef(0);
  /** Bloqueia limpar focus-dim durante scroll programático (independente do chrome). */
  const suppressFocusDimClearUntil = useRef(0);
  const forceChromeRef = useRef(false);
  const scrollRaf = useRef(0);
  const readerRef = useRef<HTMLElement | null>(null);
  const verseActionsSheetRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollVerse = useRef<PendingVerseScroll | null>(null);
  /** Offset exacto do scroller ao Retourner (depois do sheet Options abrir). */
  const pendingPassageScrollRestoreRef = useRef<number | null>(null);
  const verseScrollSeq = useRef(0);
  const lastAppliedVerseScroll = useRef("");
  const booted = useRef(false);
  /** 1.ª alinhamento de scroll (ou gate offline) antes de libertar o splash. */
  const bootAlignReadyRef = useRef(false);
  const [bootAlignReady, setBootAlignReady] = useState(false);
  const [bootAlignNudge, setBootAlignNudge] = useState(0);
  const skipNextChapterFadeRef = useRef(true);

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
    /* Android: ExoPlayer nativo — sem HTMLAudio / Capgo. */
    if (isNativeBibleAudio()) {
      /* Permissão de notificação fora do tap Play (anti-delay). */
      void ensureNativeAudioNotificationPermission();
      void bindBibleAudioControls({
        onPlay: () => undefined,
        onPause: () => undefined,
        onSkipBackward: () => undefined,
        onSkipForward: () => undefined,
      });
      return () => {
        void (async () => {
          const usfm = audioBookRef.current;
          if (usfm) {
            const t = await getNativeBibleAudioTime();
            if (Number.isFinite(t)) saveAudioPosition(usfm, t);
          }
          await destroyNativeBibleAudio();
        })();
      };
    }

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
      onSeekTo: (seconds) => {
        const max = Number.isFinite(audio.duration) ? audio.duration : seconds;
        const next = Math.max(0, Math.min(max, seconds));
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

  /* Web only: sync MediaSession shim (no-op no Android nativo). */
  useEffect(() => {
    if (isNativeBibleAudio()) return;
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
  }, [audioPlaying, audioActiveUsfm, audioDuration, audioPodcast, audioByUsfm, audioTime]);

  useEffect(() => {
    if (isNativeBibleAudio() || !audioPlaying) return;
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
    if (isNativeBibleAudio()) return;
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      const audio = audioRef.current;
      if (!audio || audio.paused) return;
      const usfm = (audioActiveUsfm || audioBookRef.current || "").toUpperCase();
      const episode = usfm ? audioByUsfm[usfm] : null;
      if (!episode) return;
      void syncBibleAudioControls({
        track: episode.title,
        artist: audioPodcast,
        album: "Segond 21",
        isPlaying: true,
        duration: Number.isFinite(audio.duration) ? audio.duration : audioDuration,
        elapsed: audio.currentTime || 0,
      });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [audioActiveUsfm, audioByUsfm, audioPodcast, audioDuration]);

  useEffect(() => {
    const usfm = bookId.toUpperCase();
    if (audioBookRef.current === usfm && getNativeActiveAudioId() === usfm) {
      return;
    }

    if (isNativeBibleAudio()) {
      let cancelled = false;
      void (async () => {
        if (audioBookRef.current && audioBookRef.current !== usfm) {
          const t = await getNativeBibleAudioTime();
          if (Number.isFinite(t)) saveAudioPosition(audioBookRef.current, t);
          await destroyNativeBibleAudio();
          if (cancelled) return;
          audioBookRef.current = "";
          setAudioActiveUsfm(null);
          setAudioPlaying(false);
          setAudioBusy(false);
          setAudioTime(0);
          setAudioDuration(0);
        }

        if (!active || textVersion !== "s21") return;
        const episode = audioByUsfm[usfm];
        if (!episode?.audioUrl) return;
        if (
          getNativeActiveAudioId() === usfm &&
          getNativePreparedUrl() === episode.audioUrl &&
          isNativeBibleAudioReady()
        ) {
          return;
        }

        try {
          const resume = loadAudioPositions()[usfm];
          await prepareNativeBibleAudio(
            {
              audioId: usfm,
              url: episode.audioUrl,
              title: episode.title,
              artist: audioPodcast,
              albumTitle: "Segond 21",
              resumeAt: resume && resume > 2 ? resume : undefined,
            },
            {
              onReady: (duration) => {
                if (Number.isFinite(duration) && duration > 0) {
                  setAudioDuration(duration);
                }
              },
              onStatus: (status) => {
                setAudioPlaying(status === "playing");
                if (status === "paused" || status === "stopped") {
                  void getNativeBibleAudioTime().then((t) => {
                    if (audioBookRef.current && Number.isFinite(t)) {
                      saveAudioPosition(audioBookRef.current, t);
                    }
                  });
                }
              },
              onTime: (currentTime) => {
                setAudioTime(currentTime);
              },
              onEnd: () => {
                setAudioPlaying(false);
                if (audioBookRef.current) saveAudioPosition(audioBookRef.current, 0);
                setAudioTime(0);
              },
            },
          );
          if (cancelled) return;
          audioBookRef.current = usfm;
          setAudioActiveUsfm(usfm);
        } catch {
          /* prepare-ahead: falha silenciosa — Play tenta de novo */
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (audioBookRef.current === usfm) return;
    const audio = audioRef.current;
    if (!audio) return;
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
  }, [bookId, audioByUsfm, audioPodcast, active, textVersion]);

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

  /** Prefs → idioma (perfil) atualiza a versão bíblica se o leitor já estiver montado. */
  useEffect(() => {
    return subscribeUiLocale((_locale, versionId) => {
      if (versionId === textVersionRef.current) return;
      void switchTextVersionRef.current(versionId);
    });
  }, []);

  /** Warm-up silencioso do índice de busca (IDB → RAM / worker). */
  useEffect(() => {
    if (!active) return;
    void import("../bible/verseSearchClient").then(({ warmSearchIndexInWorker }) => {
      warmSearchIndexInWorker(textVersion);
    });
  }, [active, textVersion]);

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
    const base = { ...readPrefs(), fontSize, fontFamily, textVersion };
    if (isUsfmBookId(bookId)) {
      writePrefs({ ...base, bookId, chapterId });
      return;
    }
    writePrefs(base);
  }, [bookId, chapterId, fontSize, fontFamily, textVersion]);

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
    void (async () => {
      if (
        focusVersionId &&
        isBibleTextVersionId(focusVersionId) &&
        focusVersionId !== textVersionRef.current
      ) {
        await switchTextVersion(focusVersionId);
      }
      void loadChapter(parts.bookId, parts.chapterId, start, end);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSeq, focusRef, focusVersionId, active]);

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
    lastAppliedVerseScroll.current = "";
    const skipFade = skipNextChapterFadeRef.current;
    if (skipFade) skipNextChapterFadeRef.current = false;
    else setPassageFadeIn(true);
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
    if (!skipFade) {
      window.setTimeout(() => setPassageFadeIn(false), 200);
    }
  }

  function goAdjacent(delta: -1 | 1) {
    const next = adjacentChapter(books, bookId, chapterId, delta);
    if (!next) return;
    void loadChapter(next.bookId, next.chapterId, null);
  }

  function selectVerse(number: number) {
    if (takeOverlayDismissSwallow()) return;
    if (
      hasActiveModal &&
      activeOverlay.type !== "verse_actions"
    ) {
      return;
    }
    if (shareSheetOpen || historyOpen) return;
    // Side-effects fora do updater (React pode correr updaters na fase de render).
    preferJumpFocusRef.current = false;
    const current = selection;
    const next = new Set(current ?? []);
    if (next.has(number)) {
      /* Mesma lógica do pai: desmarcar o último fecha o Options full-bleed. */
      next.delete(number);
    } else {
      next.add(number);
    }

    if (!next.size) {
      pendingScrollVerse.current = null;
      lastAppliedVerseScroll.current = "";
      setHighlightVerse(null);
      setHighlightVerseEnd(null);
      setFocusDim(false);
      setSelection(null);
      closeOverlay();
    } else {
      const sorted = sortVerses(next);
      const mode: VerseScrollMode = current?.length ? "nearest" : "start";
      pendingScrollVerse.current = { number, mode, seq: ++verseScrollSeq.current };
      setHighlightVerse(number);
      setHighlightVerseEnd(null);
      setFocusDim(false);
      if (!current?.length) setCardColor(loadPreferredVerseColor());
      setSelection(sorted);
      setShareSheetOpen(false);
      openOverlay({
        type: "verse_actions",
        selectedVerseIds: sorted.map(String),
      });
    }
    setCardMsg(null);
  }

  function jumpToVerse(number: number) {
    preferJumpFocusRef.current = true;
    pendingScrollVerse.current = { number, mode: "start", seq: ++verseScrollSeq.current };
    setSelection(null);
    setHighlightVerse(number);
    setHighlightVerseEnd(null);
    setFocusDim(true);
    setCardMsg(null);
    closePicker({ restoreFocus: false });
  }

  const onPlanStep = Boolean(
    planReading &&
      planReaderOnStep({
        planFocusRef: planReading.focusRef,
        planLabel: planReading.label,
        bookId,
        chapterId,
      }),
  );

  function finishPlanDayNote() {
    const backToPlans = dayNoteReturnsToPlans;
    setDayNoteOpen(false);
    setDayNoteReturnsToPlans(false);
    if (backToPlans) {
      onBack?.();
      return;
    }
    planReading?.onAdvanceAfterNote?.();
  }

  function resyncToPlanStep() {
    if (!planReading) return false;
    const parts = parseUsfmParts(planReading.focusRef || planReading.label);
    if (!isUsfmBookId(parts.bookId)) return false;
    const start = parts.verse ?? planReading.verseStart ?? null;
    const end = planReading.verseEnd ?? start;
    void loadChapter(parts.bookId, parts.chapterId, start, end);
    return true;
  }

  function planOrChapterSkip(delta: -1 | 1) {
    if (pickerOpen) setPassageStep("chapter");
    // Escopo plan : skips = uniquement le flux du plan (jamais chapitres libres).
    // Chip = lecture libre ; hors pas → d’abord revenir au passage du plan.
    if (planReading) {
      if (!onPlanStep) {
        resyncToPlanStep();
        return;
      }
      if (delta < 0) {
        if (!planReading.isFirst) planReading.onPrev();
      } else {
        const returnToPlans = Boolean(
          planReading.isStageLast || planReading.isLast,
        );
        planReading.onAdvance();
        setDayNoteReturnsToPlans(returnToPlans);
        setDayNoteOpen(true);
      }
      return;
    }
    goAdjacent(delta);
  }

  function adjacentPassageLabel(delta: -1 | 1): string | null {
    const next = adjacentChapter(books, bookId, chapterId, delta);
    if (!next) return null;
    const title =
      books.find((b) => b.id.toUpperCase() === next.bookId.toUpperCase())
        ?.title || next.bookId;
    return formatPassagePillRef(title, next.chapterId);
  }

  function renderTopPassageArrow(delta: -1 | 1, hideVisual: boolean) {
    const chapterSkipIcons = passageBarSkipIcons();
    const planSkips = Boolean(planReading);
    const stageComplete = Boolean(planSkips && planReading?.isStageLast);
    const isPrev = delta === -1;
    const disabled = planSkips
      ? (isPrev ? planReading!.isFirst : false) || presentation.inFlight
      : (isPrev ? !canPrev : !canNext) || pickerChrome.controlsDisabled;
    const nextIsCheck = !isPrev && stageComplete;
    const stageTitle = planReading?.stageName?.trim();
    const destLabel = planSkips ? null : adjacentPassageLabel(delta);
    const actionLabel = planSkips
      ? isPrev
        ? t("bible.planPrev")
        : stageComplete
          ? planReading!.isLast
            ? stageTitle
              ? `Terminer · ${stageTitle}`
              : "Terminer"
            : stageTitle
              ? `Terminer · ${stageTitle}`
              : t("bible.planNext")
          : t("bible.planNext")
      : isPrev
        ? t("bible.prevChapter")
        : t("bible.nextChapter");
    const iconName = isPrev
      ? chapterSkipIcons.previous
      : nextIsCheck
        ? "check"
        : chapterSkipIcons.next;
    return (
      <button
        key={isPrev ? "prev" : "next"}
        type="button"
        className={`bible-yv-top-passage-arrow${isPrev ? " is-prev" : " is-next"}${
          nextIsCheck ? " is-stage-complete" : ""
        }${hideVisual ? " is-hidden-slot" : ""}`}
        onClick={() => planOrChapterSkip(delta)}
        disabled={disabled || hideVisual}
        tabIndex={hideVisual ? -1 : undefined}
        aria-hidden={hideVisual || undefined}
        aria-label={
          hideVisual
            ? undefined
            : destLabel
              ? `${actionLabel} · ${destLabel}`
              : actionLabel
        }
        title={
          hideVisual
            ? undefined
            : destLabel
              ? `${actionLabel} · ${destLabel}`
              : actionLabel
        }
      >
        <YvIcon name={iconName} className="bible-yv-top-passage-arrow-icon" />
      </button>
    );
  }

  /** Topbar: ← · pill book picker · → */
  function renderPassageSkipPickerCluster() {
    return renderPassageRoll();
  }

  function renderTopPassageNav(extraClass = "", rollOpen = false) {
    const compactBar = extraClass.includes("is-plan-chrome");
    const splitChrome = isPassageBarPanelCompactTopbar() && !compactBar;
    const unifiedRefPill = isPassagePillUnified();
    const passageRefLabel = formatPassagePillRef(bookTitle, chapterId);
    const hideSkipArrows = Boolean(pickerOpen || rollOpen);

    return (
      <nav
        className={`bible-yv-compact-ref bible-yv-top-passage${extraClass}${
          splitChrome ? " is-split-chrome" : ""
        }`.trim()}
        aria-label={t("bible.bookChapter")}
      >
        <div
          className={`bible-yv-top-passage-bar${compactBar ? " is-compact" : ""}${
            unifiedRefPill ? " is-passage-ref-unified" : ""
          }${
            rollOpen
              ? " is-roll-head is-roll-chrome-active"
              : pickerOpen
                ? " is-roll-chrome-active"
                : ""
          }${hideSkipArrows ? " is-skips-hidden" : ""}${
            pickerChrome.chipsHydrating ? " is-hydrating" : ""
          }`}
        >
          {renderTopPassageArrow(-1, hideSkipArrows)}
          <div
            className={`bible-yv-top-passage-segments${
              unifiedRefPill ? " is-passage-ref-unified" : ""
            }`}
          >
            {unifiedRefPill ? (
              <BiblePassageChip
                variant="ref"
                label={bookTitle}
                chapterLabel={chapterId}
                loading={pickerChrome.chipsHydrating}
                open={
                  passageRollOpen &&
                  (passageStep === "book" || passageStep === "chapter")
                }
                disabled={pickerChrome.controlsDisabled}
                ariaLabel={
                  passageRollOpen &&
                  (passageStep === "book" || passageStep === "chapter")
                    ? `Replier le passage · ${passageRefLabel}`
                    : `Choisir un passage · ${passageRefLabel}`
                }
                title={passageRefLabel}
                panelId={passagePickerPanelId}
                onClick={togglePassagePickerRef}
              />
            ) : (
              <>
                <BiblePassageChip
                  variant="book"
                  label={bookTitle}
                  loading={pickerChrome.chipsHydrating}
                  open={passageRollOpen && passageStep === "book"}
                  disabled={pickerChrome.controlsDisabled}
                  ariaLabel={
                    passageRollOpen && passageStep === "book"
                      ? `Replier · livre ${bookTitle}`
                      : `Choisir un livre · ${bookTitle}`
                  }
                  title={bookTitle}
                  panelId={passagePickerPanelId}
                  onClick={() => togglePassagePicker("book")}
                />
                <span className="bible-yv-top-passage-divider" aria-hidden />
                <BiblePassageChip
                  variant="chapter"
                  label={chapterId}
                  loading={pickerChrome.chipsHydrating}
                  open={passageRollOpen && passageStep === "chapter"}
                  disabled={pickerChrome.controlsDisabled}
                  ariaLabel={
                    passageRollOpen && passageStep === "chapter"
                      ? `Replier · chapitre ${chapterId}`
                      : `Choisir un chapitre · ${chapterId}`
                  }
                  title={t("bible.chapterN", { n: chapterId })}
                  panelId={passagePickerPanelId}
                  onClick={() => togglePassagePicker("chapter")}
                />
              </>
            )}
          </div>
          {renderTopPassageArrow(1, hideSkipArrows)}
        </div>
      </nav>
    );
  }

  /**
   * Chip/roll só — o sheet do livro fica IRMÃO (como word-search), nunca filho do
   * `.passage-roll.is-open` (z=12), senão o scrim z60 cobre o modal com blur.
   */
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
      </div>
    );
  }

  function renderPassageBookSheet() {
    return (
      <BiblePassageScrollPicker
        id={passagePickerPanelId}
        open={passageRollOpen}
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
        onClose={() => closePicker()}
        onSearchChange={setBookSearchQuery}
        onSearchClear={clearBookSearch}
        onPickBook={pickBook}
        onPickJump={pickDiscoveryJump}
        onPickVerse={pickVerseSearchHit}
        onPickChapter={pickChapter}
        onJumpVerse={jumpToVerse}
        discoveryBooksOnly={discoverySplitSearch}
      />
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
    armPendingVerseStep(false);
    setPassageStep("chapter");
    if (nextBook.toUpperCase() === bookId.toUpperCase()) return;
    void loadChapter(nextBook, "1", null);
  }

  function pickVerseSearchHit(hit: BibleSearchHit) {
    const parts = parseUsfmParts(hit.usfm);
    armPendingVerseStep(false);
    patchDiscoverySession({
      expandedBookId: parts.bookId.toUpperCase(),
      anchorVerseUsfm: hit.usfm.toUpperCase(),
    });
    closePicker({ restoreFocus: false });
    pushStudyOriginFromCurrent({
      returnTo: "word_search",
      dest: {
        bookId: parts.bookId,
        chapterId: String(hit.chapter),
        verse: hit.verse ?? null,
      },
    });
    preferJumpFocusRef.current = true;
    if (hit.verse != null) setFocusDim(true);
    void loadChapter(parts.bookId, String(hit.chapter), hit.verse, null);
  }

  /** Núcleo polimórfico: DiscoveryJump (picker) e chips Référence partilham este salto. */
  function navigateToParsedPassage(passage: ParsedPassage) {
    const chapter = String(passage.chapter);
    const verse = passage.verse;
    const verseEnd =
      verse != null &&
      passage.verseEnd != null &&
      passage.verseEnd !== verse
        ? passage.verseEnd
        : null;
    loadChapter(passage.bookId, chapter, verse, verseEnd);
    preferJumpFocusRef.current = true;
    if (verse != null) setFocusDim(true);
    suppressFocusDimClearUntil.current =
      performance.now() + CHROME_PROGRAMMATIC_LOCK_MS * 2;
  }

  /** Adaptador picker — dismiss roll + estado discovery, depois o núcleo. */
  function pickDiscoveryJump(jump: DiscoveryJump) {
    closePicker({ restoreFocus: false });
    armPendingVerseStep(jump.passage.verse != null);
    patchDiscoverySession({
      expandedBookId: jump.passage.bookId.toUpperCase(),
      anchorVerseUsfm: jump.passage.usfm || null,
    });
    setPassageStep("book");
    navigateToParsedPassage(jump.passage);
  }

  /**
   * Empilha a origem actual (LIFO) antes de um salto de estudo.
   * Usado por Référence, histórico, marcas e pesquisa.
   * @returns verse de origem, ou null se não houve push
   */
  function pushStudyOriginFromCurrent(opts?: {
    refsScrollTop?: number;
    returnTo?: StudyJumpReturnTo;
    dest?: { bookId: string; chapterId: string; verse?: number | null };
  }): number | null {
    const fromVerse =
      selection?.[0] ??
      highlightVerse ??
      passage?.verses?.[0]?.number ??
      null;
    if (fromVerse == null) return null;

    const dest = opts?.dest;
    if (
      dest &&
      dest.bookId.toUpperCase() === bookId.toUpperCase() &&
      String(dest.chapterId) === String(chapterId) &&
      (dest.verse == null || dest.verse === fromVerse)
    ) {
      return null;
    }

    const originTitle =
      resolveBookTitleActive(bookId) ||
      books.find((b) => b.id.toUpperCase() === bookId.toUpperCase())?.title ||
      bookId;
    const label = formatStudyOriginLabel(originTitle, chapterId, fromVerse);
    const scrollKey = verseStudyKey(textVersion, bookId, chapterId, fromVerse);
    const refsScrollTop =
      opts?.refsScrollTop ?? getRefsListScroll(scrollKey);
    setRefsListScroll(scrollKey, refsScrollTop);
    pushStudyJump({
      bookId,
      chapterId,
      verse: fromVerse,
      label,
      refsScrollTop,
      passageScrollTop: passageScrollRef.current?.scrollTop ?? 0,
      returnTo: opts?.returnTo ?? "refs",
    });
    return fromVerse;
  }

  /**
   * Aller au verset — botão do RefTextModal: push LIFO + DiscoveryJump sticky.
   * `meta.refsScrollTop` = posição da lista no momento do salto (Retourner).
   */
  function openRefFromStudyModal(
    usfm: string,
    meta?: { refsScrollTop: number },
  ) {
    const loc = parseUsfmLocation(usfm);
    if (!loc || !isUsfmBookId(loc.bookId)) return;

    pushStudyOriginFromCurrent({
      returnTo: "refs",
      refsScrollTop: meta?.refsScrollTop,
      dest: {
        bookId: loc.bookId,
        chapterId: String(loc.chapter),
        verse: loc.verse ?? null,
      },
    });

    preservePassageNavRef.current = true;
    navigateToParsedPassage(loc);
    closeCreateCard();
    queueMicrotask(() => {
      preservePassageNavRef.current = false;
    });
  }

  /** Pop da pilha → navega; Options abre só quando o capítulo origem está pronto. */
  function returnFromStudyJump() {
    const step = popStudyJump();
    if (!step) return;
    setPendingStudyReturn({ step });
    setShareSheetOpen(false);
    setCardMsg(null);
    setPassageUiError(null);
    preferJumpFocusRef.current = false;
    setFocusDim(false);
    setSelection(null);
    /* Após o sheet Options abrir, repõe o scroll de passagem memorizado. */
    pendingPassageScrollRestoreRef.current = step.passageScrollTop;
    void loadChapter(step.bookId, step.chapterId, step.verse, null);
  }

  function dismissStudyJumpStack() {
    clearStudyJump();
    setPendingStudyReturn(null);
    setRefsRestoreScrollTop(null);
    pendingPassageScrollRestoreRef.current = null;
  }

  function pickChapter(nextChapter: string) {
    if (passagePickerSkipsVerseStep()) {
      if (nextChapter !== chapterId || !passage?.verses?.length) {
        void loadChapter(bookId, nextChapter, null);
      }
      closePicker({ restoreFocus: false });
      return;
    }
    if (nextChapter === chapterId && passage?.verses?.length) {
      setPassageStep("verse");
      return;
    }
    armPendingVerseStep(true);
    void loadChapter(bookId, nextChapter, null);
  }

  function closeCreateCard() {
    setShareSheetOpen(false);
    if (activeOverlay.type === "verse_actions") {
      closeOverlay();
      return;
    }
    clearVerseSelectionUi();
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
        clearVersionDownloadProgress("ht98");
        clearVersionAvailabilityError("ht98");
        return;
      }

      const ac = new AbortController();
      offlineAbortRef.current = ac;
      setOfflineBusy(true);
      setOfflineProgress({ done: 0, total: 2, usfm: "" });
      setVersionDownloadProgress("ht98", { done: 0, total: 2 });
      clearVersionAvailabilityError("ht98");
      setPassageUiError(null);
      try {
        await downloadHt1998Offline((p) => {
          setOfflineProgress({ done: p.done, total: p.total, usfm: "" });
          setVersionDownloadProgress("ht98", { done: p.done, total: p.total });
        }, ac.signal);
        invalidateHt1998CatalogCache();
        setHtOfflineReady(true);
        setOfflineProgress(null);
        clearVersionDownloadProgress("ht98");
      } catch (err) {
        clearVersionDownloadProgress("ht98");
        if ((err as Error)?.name !== "AbortError") {
          setVersionAvailabilityError("ht98", classifyOfflineDownloadError(err));
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
      clearVersionDownloadProgress("s21");
      clearVersionAvailabilityError("s21");
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
    setVersionDownloadProgress("s21", { done: 0, total: list.length });
    clearVersionAvailabilityError("s21");
    setPassageUiError(null);
    try {
      await downloadOfflineBible(
        list,
        (p) => {
          setOfflineProgress({ ...p });
          setVersionDownloadProgress("s21", { done: p.done, total: p.total });
        },
        ac.signal,
      );
      setOfflineReady(true);
      setOfflineProgress(null);
      clearVersionDownloadProgress("s21");
      await refreshCatalog();
    } catch (err) {
      clearVersionDownloadProgress("s21");
      if ((err as Error)?.name !== "AbortError") {
        setVersionAvailabilityError("s21", classifyOfflineDownloadError(err));
        setPassageUiError(
          err instanceof Error ? err.message : "Échec du téléchargement hors ligne.",
        );
      }
    } finally {
      setOfflineBusy(false);
      offlineAbortRef.current = null;
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

  /**
   * Boot anti-CLS: splash só some com superfície + scroll inicial aplicados.
   * Loads seguintes usam a barra do topbar + stalePassage (sem esvaziar o corpo).
   * Com aba inactiva: não promover catalogLocalReady só pelo catálogo (shell fallback + Plan skeleton).
   */
  useEffect(() => {
    const catalogLoading = catalogViewState.status === "loading";
    const catalogReady = catalogViewState.status === "ready";

    if (!active) {
      setCatalogHydrating(catalogLoading);
      return;
    }

    const hasPassageSurface = Boolean(
      passage?.verses?.length || passage?.content,
    );
    const passageSurfaceReady =
      hasPassageSurface ||
      showOfflineChapterGateUi ||
      (Boolean(passageLoadError) && !hasPassageSurface);

    if (
      !bootAlignReadyRef.current &&
      (showOfflineChapterGateUi ||
        (Boolean(passageLoadError) && !hasPassageSurface))
    ) {
      bootAlignReadyRef.current = true;
      setBootAlignReady(true);
    }

    setCatalogHydrating(
      catalogLoading ||
        (catalogReady && !(passageSurfaceReady && bootAlignReady)),
    );
    setCatalogLocalReady(
      catalogReady && passageSurfaceReady && bootAlignReady,
    );
  }, [
    active,
    catalogViewState.status,
    passage?.verses?.length,
    passage?.content,
    passageLoadError,
    showOfflineChapterGateUi,
    bootAlignReady,
    setCatalogHydrating,
    setCatalogLocalReady,
  ]);

  const locationLabel = selection?.length
    ? `${bookTitle} ${chapterId}.${formatVerseList(selection)}`
    : `${bookTitle} ${chapterId}`;

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
    /* Marquer → fecha Options (desmarcar mantém o sheet). */
    closeCreateCard();
  }

  function requestMarkSelection(hex: string) {
    if (!selection?.length) return;
    const next = adaptVerseColorForTheme(normalizeVerseColor(hex), uiTheme);
    if (requireAccountToMark && onRequestAccountToMark) {
      onRequestAccountToMark({
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
    onAuthorizedMarkConsumed?.();
    closeCreateCard();
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
    setCardMsg(t("verse.unmarkDone"));
  }

  const activeVerseColor = adaptVerseColorForTheme(normalizeVerseColor(cardColor), uiTheme);
  const selectionHasMark = selectedVerses.some((n) => chapterMarks.has(n));
  const selectionMarkColor = useMemo(() => {
    for (const n of selectedVerses) {
      const hex = chapterMarks.get(n);
      if (hex) return adaptVerseColorForTheme(normalizeVerseColor(hex), uiTheme);
    }
    return null;
  }, [selectedVerses, chapterMarks, uiTheme]);
  /* Tom do CTA Marquer = cor seleccionada (swatch / marca; light + dark). */
  const pickerColor = selectionMarkColor ?? activeVerseColor;
  const actionTone = useMemo(
    () => verseActionTone(pickerColor, uiTheme),
    [pickerColor, uiTheme],
  );
  /** Accent marque (cartão PNG) — or brand, pas la couleur de surlignage. */
  const shareAccentHex = "#C4A574";

  const showCreateCard = Boolean(
    activeOverlay.type === "verse_actions" &&
      selectedVerses.length &&
      selectedVerseText &&
      !shareSheetOpen,
  );
  const showStudyReturnNav = Boolean(
    studyJumpDepth > 0 && !showCreateCard && !pendingStudyReturn,
  );

  /** Ranges pré-calculados — evita min/max por verso no map. */
  const planVerseRangeFull = Boolean(
    planReading &&
      onPlanStep &&
      (planReading.verseStart == null || planReading.verseEnd == null),
  );
  const planVerseRangeLo =
    planReading?.verseStart != null
      ? Math.min(
          planReading.verseStart,
          planReading.verseEnd ?? planReading.verseStart,
        )
      : null;
  const planVerseRangeHi =
    planReading?.verseStart != null
      ? Math.max(
          planReading.verseStart,
          planReading.verseEnd ?? planReading.verseStart,
        )
      : null;
  const focusVerseLo =
    highlightVerse != null
      ? Math.min(highlightVerse, highlightVerseEnd ?? highlightVerse)
      : null;
  const focusVerseHi =
    highlightVerse != null
      ? Math.max(highlightVerse, highlightVerseEnd ?? highlightVerse)
      : null;

  useEffect(() => {
    if (!showCreateCard) return;
    if (preferRefsTabOnOpenRef.current) {
      /* Não consumir o flag aqui: o reload do capítulo pode piscar showCreateCard. */
      setVerseActionsTab("refs");
      return;
    }
    setVerseActionsTab("verse");
  }, [showCreateCard]);

  /* Após pop: reabrir a superfície de origem só com capítulo carregado. */
  useEffect(() => {
    const pending = pendingStudyReturn;
    if (!pending) return;
    if (presentation.inFlight) return;
    if (
      bookId.toUpperCase() !== pending.step.bookId.toUpperCase() ||
      String(chapterId) !== String(pending.step.chapterId)
    ) {
      return;
    }
    const verseReady = passage?.verses?.some(
      (v) => v.number === pending.step.verse,
    );
    if (!verseReady) return;

    const returnTo = pending.step.returnTo;
    setShareSheetOpen(false);
    setHighlightVerse(pending.step.verse);
    setHighlightVerseEnd(null);

    if (returnTo === "refs") {
      const scrollKey = verseStudyKey(
        textVersion,
        pending.step.bookId,
        pending.step.chapterId,
        pending.step.verse,
      );
      setRefsListScroll(scrollKey, pending.step.refsScrollTop);
      setRefsRestoreScrollTop(pending.step.refsScrollTop);
      preferRefsTabOnOpenRef.current = true;
      setVerseActionsTab("refs");
      setSelection([pending.step.verse]);
    } else {
      setSelection(null);
    }

    openOverlay(studyJumpReturnOverlay(pending.step));
    setPendingStudyReturn(null);
  }, [
    pendingStudyReturn,
    presentation.inFlight,
    bookId,
    chapterId,
    passage?.verses,
    openOverlay,
    textVersion,
  ]);

  /** Lista Verset: abrir/ancorar no verso seleccionado (não preso ao v.1). */
  useLayoutEffect(() => {
    const panelOpen = showCreateCard && verseActionsTab === "verse";
    if (!panelOpen) {
      verseSelectAnchoredRef.current = false;
      return;
    }
    const anchor =
      highlightVerse ??
      selectedVerses[selectedVerses.length - 1] ??
      selectedVerses[0];
    if (anchor == null) return;
    const list = verseSelectListRef.current;
    if (!list) return;
    const row = list.querySelector(
      `[data-verse-select="${anchor}"]`,
    ) as HTMLElement | null;
    if (!row) return;
    const firstPaint = !verseSelectAnchoredRef.current;
    verseSelectAnchoredRef.current = true;
    row.scrollIntoView({
      block: firstPaint ? "center" : "nearest",
      inline: "nearest",
    });
  }, [showCreateCard, verseActionsTab, highlightVerse, selectedVerses]);

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
        wordSearchOpen,
        bookSearchOpen,
        toolsMenuOpen,
        historyOpen,
        marksOpen,
        shareSheetOpen,
        verseActionsOpen: showCreateCard,
        verseStudyOpen: false,
      }),
    [
      pickerOpen,
      pickerChrome.pickerPanelOpenAllowed,
      wordSearchOpen,
      bookSearchOpen,
      toolsMenuOpen,
      historyOpen,
      marksOpen,
      shareSheetOpen,
      showCreateCard,
    ],
  );

  function dismissPassageSurfaceOverlay() {
    markOverlayDismissSwallow();
    const target = overlayDismissTarget({
      pickerOpen,
      pickerPanelOpenAllowed: pickerChrome.pickerPanelOpenAllowed,
      wordSearchOpen,
      bookSearchOpen,
      toolsMenuOpen,
      historyOpen,
      marksOpen,
      shareSheetOpen,
      verseActionsOpen: showCreateCard,
      verseStudyOpen: false,
    });
    if (target === "picker") {
      closePicker();
      return;
    }
    if (target === "wordSearch") {
      closeWordSearch();
      return;
    }
    if (target === "history" || target === "marks") {
      leaveHistoryOrMarks("dismiss");
      return;
    }
    if (target === "bookSearch") {
      restoreHistoryFocusRef.current = false;
      closeOverlay();
      return;
    }
    if (target === "tools") {
      closeToolsMenu({ restoreFocus: true });
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
      const target = event.target;
      if (!(target instanceof Node) || !(target instanceof Element)) return;
      if (toolsMenuRef.current?.contains(target)) return;
      if (target.closest(".bible-yv-tools-popover")) return;
      /*
       * Topbar: fechar só pelo pill (hamburger ✕). Resto do `.bible-yv-top`
       * não dismissa — evita fecho ao tocar no chrome vazio.
       */
      if (target.closest(".bible-yv-top")) return;
      if (target.closest(".top-sheet-layer")) return;
      event.preventDefault();
      event.stopPropagation();
      markOverlayDismissSwallow();
      closeToolsMenu();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      markOverlayDismissSwallow();
      closeToolsMenu();
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [toolsMenuOpen, closeToolsMenu, markOverlayDismissSwallow]);

  /**
   * Radial da shell tem precedência sobre chrome flutuante do leitor:
   * fecha overlays / share / discovery e mostra a nav (hub sempre alcançável).
   */
  useEffect(() => {
    return subscribeShellRadial((radialOpen) => {
      if (!radialOpen) return;
      setReadingChrome(false, true);
      setShareSheetOpen(false);
      closeAll();
      closeOverlay();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setReadingChrome is a render-local helper
  }, [closeAll, closeOverlay]);

  /** Back / Esc da shell: um nível de overlay do leitor por pedido. */
  useEffect(() => {
    if (!active) return undefined;
    return subscribeReaderShellBack(() => {
      if (shareSheetOpen) {
        setShareSheetOpen(false);
        return true;
      }
      if (
        pickerOpen ||
        wordSearchOpen ||
        bookSearchOpen ||
        toolsMenuOpen ||
        historyOpen ||
        marksOpen
      ) {
        dismissPassageSurfaceOverlay();
        return true;
      }
      if (showCreateCard) {
        closeCreateCard();
        return true;
      }
      if (chromeHiddenRef.current) {
        setReadingChrome(false, true);
        return true;
      }
      return false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- helpers locais do render
  }, [
    active,
    shareSheetOpen,
    pickerOpen,
    wordSearchOpen,
    bookSearchOpen,
    toolsMenuOpen,
    historyOpen,
    marksOpen,
    showCreateCard,
  ]);

  function stopBibleAudio() {
    if (isNativeBibleAudio()) {
      void (async () => {
        if (audioBookRef.current) {
          const t = await getNativeBibleAudioTime();
          if (Number.isFinite(t)) saveAudioPosition(audioBookRef.current, t);
        }
        await destroyNativeBibleAudio();
      })();
      audioBookRef.current = "";
      setAudioActiveUsfm(null);
      setAudioPlaying(false);
      setAudioBusy(false);
      setAudioTime(0);
      setAudioDuration(0);
      return;
    }

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
    if (next === textVersionRef.current) return;
    stopBibleAudio();
    setTextVersion(next);
    writePrefs({
      ...readPrefs(),
      textVersion: next,
      bookId,
      chapterId,
      fontSize,
      fontFamily,
    });
    notifyUiLocale(next);
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
  switchTextVersionRef.current = switchTextVersion;

  useEffect(() => {
    if (!active || !openOverlayRequest) return;
    const request = openOverlayRequest;
    overlayReturnToProfileRef.current = true;
    restoreToolsFocusRef.current = false;
    restoreHistoryFocusRef.current = false;
    setShareSheetOpen(false);
    openOverlay({ type: request });
    onOpenOverlayRequestConsumed?.();
  }, [active, openOverlayRequest, openOverlay, onOpenOverlayRequestConsumed]);

  useEffect(() => {
    if (!onProfileReadingChromeChange) return;
    onProfileReadingChromeChange({
      textVersion,
      htCatalogLoading,
      htCatalogError,
      versionOfflineReady,
      offlineBusy,
      offlineProgress: offlineProgress
        ? { done: offlineProgress.done, total: offlineProgress.total }
        : null,
      offlineHidden: textVersion === "s21" && localBundledBible,
      fontSize,
      fontFamily,
      fontMin: FONT_MIN,
      fontMax: FONT_MAX,
      switchTextVersion: (id) => {
        void switchTextVersionRef.current?.(id);
      },
      toggleOfflineBible: () => {
        void toggleOfflineBible();
      },
      setFontSize: (size) => {
        setFontSize(clampFontSize(size));
      },
      setFontFamily: (family) => {
        if (isBibleFontFamily(family)) setFontFamily(family);
      },
      bumpFontSize: (delta) => {
        setFontSize((n) => clampFontSize(n + delta));
      },
    });
  }, [
    onProfileReadingChromeChange,
    textVersion,
    htCatalogLoading,
    htCatalogError,
    versionOfflineReady,
    offlineBusy,
    offlineProgress,
    localBundledBible,
    fontSize,
    fontFamily,
  ]);

  function openWordSearchFromMenu() {
    restoreToolsFocusRef.current = false;
    setShareSheetOpen(false);
    openOverlay({ type: "word_search" });
  }

  function studyReturnSurfaceLabel(returnTo: StudyJumpReturnTo): string {
    switch (returnTo) {
      case "history":
        return t("history.title");
      case "marks":
        return t("profile.marks");
      case "word_search":
        return t("word.short");
      case "refs":
      default:
        return t("verse.tabRefs");
    }
  }

  function renderStudyReturnNav() {
    if (!studyJumpTop) return null;
    const surfaceLabel = studyReturnSurfaceLabel(studyJumpTop.returnTo);
    const actionLabel = t("study.returnAction");
    const fullLabel = t("study.returnToLabel", {
      label: surfaceLabel,
    });
    const depthLabel =
      studyJumpDepth > 1
        ? t("study.returnStackDepth", { n: studyJumpDepth })
        : null;
    const navLabel = depthLabel ? `${fullLabel}. ${depthLabel}` : fullLabel;
    return (
      <nav className="bible-study-return-nav" aria-label={navLabel}>
        <div className="bible-study-return-nav-pill" role="group">
          <button
            type="button"
            className="bible-study-return-nav-main"
            onClick={returnFromStudyJump}
            aria-label={fullLabel}
          >
            <YvIcon
              name="chevron_left"
              className="bible-study-return-nav-icon"
            />
            <span className="bible-study-return-nav-copy">
              <span className="bible-study-return-nav-verb">{actionLabel}</span>
              <span className="bible-study-return-nav-ref">{surfaceLabel}</span>
            </span>
            {studyJumpDepth > 1 ? (
              <span
                className="bible-study-return-nav-depth"
                aria-label={depthLabel ?? undefined}
              >
                {studyJumpDepth}
              </span>
            ) : null}
          </button>
          <span className="bible-study-return-nav-sep" aria-hidden="true" />
          <button
            type="button"
            className="bible-study-return-nav-dismiss"
            onClick={dismissStudyJumpStack}
            aria-label={t("study.dismissStudyJump")}
          >
            <YvIcon name="close" className="bible-study-return-nav-dismiss-icon" />
          </button>
        </div>
      </nav>
    );
  }

  function renderVerseActionsToolbar() {
    return (
      <nav
        className="bible-verse-actions-nav"
        aria-label={t("verse.actions")}
        style={
          {
            ["--verse-tint" as string]: actionTone.tint,
            ["--verse-action-fill" as string]: actionTone.fill,
            ["--verse-action-ink" as string]: actionTone.ink,
            /* Swatch = cor seleccionada (adaptada ao tema light/dark) */
            ["--swatch" as string]: pickerColor,
            ["--swatch-check" as string]: verseSwatchCheckInk(pickerColor),
          } as CSSProperties
        }
      >
        <div
          className="bible-verse-actions-nav-pill bible-verse-action-row"
          role="group"
          aria-label={t("verse.actions")}
        >
          <div
            className={`bible-mark-combo${selectionHasMark ? " is-marked" : ""}`}
          >
            <button
              type="button"
              className={`bible-verse-color-picker${selectionHasMark ? " is-marked" : ""}`}
              title={t("verse.colorTitle")}
              aria-label={`${t("verse.colorTitle")} ${verseColorHueLabel(pickerColor)} ${formatVerseColorHex(pickerColor)}`}
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
                requestMarkSelection(pickerColor);
              }}
            >
              <span>
                {selectionHasMark ? t("verse.unmark") : t("verse.mark")}
              </span>
            </button>
          </div>
          <button
            type="button"
            className="bible-yv-chip bible-share-verse"
            disabled={!canShareVerse}
            onClick={() => {
              void (async () => {
                const shareUrl = buildShareUrl(shareUsfm);
                const text = buildShareText(
                  shareRefLabel,
                  shareVerseText,
                  shareUrl,
                );
                const result = await sharePlainText({
                  title: shareRefLabel || "Biblos",
                  text,
                  url: shareUrl,
                });
                if (result.ok) {
                  setCardMsg(
                    result.method === "clipboard"
                      ? t("verse.shareCopied")
                      : null,
                  );
                  return;
                }
                if (!result.cancelled) {
                  setCardMsg(result.error || t("verse.shareFailed"));
                }
              })();
            }}
          >
            <YvIcon name="ios_share" className="bible-verse-cta-icon" />
            <span>{t("verse.share")}</span>
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
      </nav>
    );
  }

  /** Full-bleed na top-sheet-layer — mesmo contrato que search / history / menu. */
  function renderVerseActionsSheet() {
    return (
      <div
        ref={verseActionsSheetRef}
        className={`bible-verse-actions top-floating-sheet is-open${
          verseActionsTab === "refs" ? " is-refs-tab" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={t("verse.actions")}
        style={
          {
            ["--verse-tint" as string]: actionTone.tint,
            ["--verse-action-fill" as string]: actionTone.fill,
            ["--verse-action-ink" as string]: actionTone.ink,
          } as CSSProperties
        }
      >
        <div className="bible-verse-actions-head is-actions-only">
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
                {t("verse.hintMulti", { n: selectedVerses.length })}
              </p>
            ) : (
              <p className="bible-verse-actions-hint">{t("verse.hint")}</p>
            )}
          </div>
        </div>

        <div className="bible-verse-actions-body">
          {cardMsg ? (
            <p className="bible-verse-actions-msg">{cardMsg}</p>
          ) : null}

          <div
            className="bible-verse-actions-tabs"
            role="tablist"
            aria-label={t("verse.actions")}
          >
            <button
              type="button"
              role="tab"
              id="verse-actions-tab-verse"
              aria-selected={verseActionsTab === "verse"}
              aria-controls="verse-actions-panel-verse"
              className={`bible-verse-actions-tab${
                verseActionsTab === "verse" ? " is-on" : ""
              }`}
              onClick={() => setVerseActionsTab("verse")}
            >
              {t("verse.tabVerse")}
            </button>
            <button
              type="button"
              role="tab"
              id="verse-actions-tab-refs"
              aria-selected={verseActionsTab === "refs"}
              aria-controls="verse-actions-panel-refs"
              className={`bible-verse-actions-tab${
                verseActionsTab === "refs" ? " is-on" : ""
              }`}
              onClick={() => setVerseActionsTab("refs")}
            >
              {t("verse.tabRefs")}
            </button>
          </div>

          <div className="bible-verse-actions-panels">
            <div
              id="verse-actions-panel-verse"
              role="tabpanel"
              aria-labelledby="verse-actions-tab-verse"
              hidden={verseActionsTab !== "verse"}
              className={`bible-verse-actions-panel${
                verseActionsTab === "verse" ? " is-active" : ""
              }`}
            >
              {passage?.verses?.length ? (
                <section
                  className="bible-verse-select"
                  aria-label={t("verse.selectTitle")}
                >
                  <ul
                    ref={verseSelectListRef}
                    className={`bible-verse-select-list${
                      selectedVerses.length ? " is-dimming" : ""
                    }`}
                    role="listbox"
                    aria-multiselectable="true"
                    aria-label={t("verse.selectTitle")}
                  >
                    {passage.verses.map((verse) => {
                      const on = selectedVerses.includes(verse.number);
                      const preview = String(verse.text || "").trim();
                      const markColor = chapterMarks.get(verse.number);
                      const markDisplay = markColor
                        ? adaptVerseColorForTheme(markColor, uiTheme)
                        : null;
                      return (
                        <li
                          key={verse.number}
                          className="bible-verse-select-row"
                        >
                          <button
                            type="button"
                            role="option"
                            data-verse-select={verse.number}
                            aria-selected={on}
                            className={[
                              "bible-verse-select-item",
                              on ? "is-on" : "",
                              markDisplay ? "is-marked" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            style={
                              markDisplay
                                ? ({
                                    ["--verse-mark" as string]: markDisplay,
                                  } as CSSProperties)
                                : undefined
                            }
                            onClick={() => selectVerse(verse.number)}
                          >
                            <span className="bible-verse-select-num" aria-hidden>
                              {verse.number}
                            </span>
                            <span className="bible-verse-select-text">
                              {preview || `v. ${verse.number}`}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}
            </div>

            <div
              id="verse-actions-panel-refs"
              role="tabpanel"
              aria-labelledby="verse-actions-tab-refs"
              hidden={verseActionsTab !== "refs"}
              className={`bible-verse-actions-panel${
                verseActionsTab === "refs" ? " is-active" : ""
              }`}
            >
              {selectedVerses[0] != null ? (
                <VerseStudyPanel
                  versionId={textVersion}
                  bookId={bookId}
                  chapterId={chapterId}
                  verse={selectedVerses[0]}
                  books={books}
                  active={verseActionsTab === "refs"}
                  restoreScrollTop={refsRestoreScrollTop}
                  onOpenRef={openRefFromStudyModal}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderToolsPopover(floatAnchor = false) {
    if (!toolsMenuOpen) return null;
    return (
      <div
        className={`bible-yv-tools-popover top-floating-sheet is-open${
          floatAnchor ? " is-float-anchor" : ""
        }`}
        role="menu"
        aria-label={t("bible.menuBible")}
      >
        {discoverySplitSearch && !planReading ? (
          <button
            type="button"
            role="menuitem"
            className="bible-yv-tools-item"
            onClick={openWordSearchFromMenu}
          >
            <YvIcon name="search" className="bible-yv-tools-item-icon" />
            <span>{t("word.panel")}</span>
          </button>
        ) : null}
        {pwaInstall.menuMode === "apk-download" ? (
          <button
            type="button"
            role="menuitem"
            className={`bible-yv-tools-item${pwaInstall.busy ? " is-busy" : ""}`}
            disabled={pwaInstall.busy}
            onClick={() => void pwaInstall.install({ source: "menu" })}
            >
            <YvIcon name="download" className="bible-yv-tools-item-icon" />
            <span>
              {pwaInstall.busy ? t("pwaInstall.busy") : t("pwaInstall.apkCta")}
            </span>
          </button>
        ) : null}
        {pwaInstall.menuMode === "ios-hint" ? (
          <div
            className="bible-yv-tools-version bible-yv-tools-install"
            role="note"
            aria-label={t("pwaInstall.title")}
          >
            <span className="bible-yv-tools-version-label">
              {t("pwaInstall.title")}
            </span>
            <p className="bible-yv-tools-version-hint bible-yv-tools-install-hint">
              <YvIcon name="ios_share" className="bible-yv-tools-item-icon" />
              <span>{t("pwaInstall.iosLead")}</span>
            </p>
          </div>
        ) : null}
        <div
          className="bible-yv-tools-version bible-yv-tools-font-family"
          role="group"
          aria-label={t("bible.font")}
        >
          <span className="bible-yv-tools-version-label">{t("bible.font")}</span>
          <div className="bible-yv-tools-version-options">
            {BIBLE_FONT_FAMILIES.map((family) => (
              <button
                key={family.id}
                type="button"
                className={`bible-yv-tools-version-chip${
                  fontFamily === family.id ? " is-on" : ""
                }`}
                aria-pressed={fontFamily === family.id}
                onClick={() => setFontFamily(family.id)}
              >
                {family.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bible-yv-tools-font" role="group" aria-label={t("bible.fontSize")}>
          <span className="bible-yv-tools-font-label">{t("bible.text")}</span>
          <div className="bible-yv-font">
            <button
              type="button"
              className="bible-yv-font-btn"
              onClick={() => setFontSize((n) => clampFontSize(n - FONT_STEP))}
              disabled={fontSize <= FONT_MIN}
              aria-label={t("bible.fontSmaller")}
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
              aria-label={t("bible.fontLarger")}
            >
              A+
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderTopToolsMenu(placement: "header" | "float" = "header") {
    const isFloat = placement === "float";
    const nestedFromMenu = wordSearchOpen || historyOpen || marksOpen;
    const verseOptionsOpen = showCreateCard;
    const menuSheetOpen = toolsMenuOpen || nestedFromMenu || verseOptionsOpen;
    const sectionPillLabel = verseOptionsOpen
      ? t("verse.passageOptions")
      : marksOpen
        ? t("profile.marks")
        : historyOpen
          ? t("history.title")
          : wordSearchOpen
            ? t("word.short")
            : t("bible.menu");
    const trigger = (
      <HeaderTriggerButton
        open={menuSheetOpen}
        shape={menuSheetOpen ? "pill" : "circle"}
        idleIcon="menu"
        idleLabel={menuSheetOpen ? sectionPillLabel : undefined}
        exitIcon={nestedFromMenu ? "chevron_left" : "close"}
        ariaLabel={
          verseOptionsOpen
            ? t("common.close")
            : nestedFromMenu
              ? `${t("common.back")} — ${sectionPillLabel}`
              : toolsMenuOpen
                ? t("common.close")
                : t("bible.menu")
        }
        ariaHaspopup="menu"
        className={`bible-yv-tools-menu-btn${menuSheetOpen ? " is-on" : ""}${
          menuSheetOpen ? " is-section-pill" : ""
        }`}
        onClick={() => {
          setShareSheetOpen(false);
          /* Verse actions: mesma lógica de fecho pelo pill de secção. */
          if (verseOptionsOpen) {
            closeCreateCard();
            return;
          }
          /* Jornada: search → menu; history/marks do Profile → Profile. */
          if (historyOpen || marksOpen) {
            leaveHistoryOrMarks("back");
            return;
          }
          if (wordSearchOpen) {
            restoreHistoryFocusRef.current = false;
            openOverlay({ type: "reader_settings" });
            return;
          }
          restoreToolsFocusRef.current = true;
          toggleOverlay("reader_settings");
        }}
      />
    );

    /* Float: sheet no FAB. Header: só trigger — sheet na top-sheet-layer (instantâneo). */
    if (isFloat) {
      return (
        <div className="bible-yv-tools-menu is-float-br" ref={toolsMenuRef}>
          {trigger}
          {renderToolsPopover(true)}
        </div>
      );
    }

    return (
      <div className="bible-yv-tools-menu" ref={toolsMenuRef}>
        {trigger}
      </div>
    );
  }

  /** Re-tenta alinhamento até o scroller ter altura / verso no DOM. */
  useEffect(() => {
    if (!active || bootAlignReadyRef.current || presentation.inFlight) return;
    const hasSurface = Boolean(passage?.verses?.length || passage?.content);
    if (!hasSurface) return;
    let frames = 0;
    let raf = 0;
    const tick = () => {
      if (bootAlignReadyRef.current) return;
      frames += 1;
      const root = passageScrollRef.current;
      if (root && root.clientHeight >= 40) {
        setBootAlignNudge((n) => n + 1);
      }
      if (bootAlignReadyRef.current) return;
      if (frames < 45) raf = window.requestAnimationFrame(tick);
      else {
        bootAlignReadyRef.current = true;
        setBootAlignReady(true);
      }
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [
    active,
    presentation.inFlight,
    passage?.id,
    passage?.verses?.length,
    passage?.content,
  ]);

  useLayoutEffect(() => {
    if (presentation.inFlight || !active) return;
    const root = passageScrollRef.current;
    const reader = readerRef.current;
    if (!root || !reader || root.clientHeight < 40) return;

    const markBootAligned = () => {
      if (bootAlignReadyRef.current) return;
      bootAlignReadyRef.current = true;
      setBootAlignReady(true);
    };

    /* Retourner: com Options aberto, repõe o offset exacto memorizado no salto. */
    const restoreTop = pendingPassageScrollRestoreRef.current;
    if (restoreTop != null && showCreateCard) {
      const restoreKey = `study-restore:${restoreTop}:${passage?.id}:sheet`;
      if (lastAppliedVerseScroll.current !== restoreKey) {
        root.scrollTop = restoreTop;
        pendingPassageScrollRestoreRef.current = null;
        lastScrollTop.current = root.scrollTop;
        const lockUntil = performance.now() + CHROME_PROGRAMMATIC_LOCK_MS;
        chromeLockUntil.current = lockUntil;
        suppressFocusDimClearUntil.current = lockUntil;
        syncHeadCompact(root.scrollTop);
        lastAppliedVerseScroll.current = restoreKey;
      }
      markBootAligned();
      return;
    }

    const pending = pendingScrollVerse.current;
    if (!pending) {
      markBootAligned();
      return;
    }
    const key = `${pending.seq}:${pending.mode}:${pending.number}:${passage?.id}:${showCreateCard}`;
    if (lastAppliedVerseScroll.current === key) {
      markBootAligned();
      return;
    }
    const verseEl =
      pending.mode === "top"
        ? null
        : (root.querySelector(`[data-verse="${pending.number}"]`) as HTMLElement | null);
    if (pending.mode !== "top" && !verseEl) {
      if (bootAlignNudge < 10) return;
      alignVerseInScroller(root, reader, null, "top");
      lastAppliedVerseScroll.current = key;
      markBootAligned();
      return;
    }
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
    const lockUntil = performance.now() + CHROME_PROGRAMMATIC_LOCK_MS;
    chromeLockUntil.current = lockUntil;
    suppressFocusDimClearUntil.current = lockUntil;
    syncHeadCompact(root.scrollTop);
    lastAppliedVerseScroll.current = key;
    markBootAligned();
  }, [
    active,
    presentation.inFlight,
    passage?.id,
    highlightVerse,
    selection,
    showCreateCard,
    pickerOpen,
    planReading?.label,
    bootAlignNudge,
  ]);

  const bookAudio = audioByUsfm[bookId.toUpperCase()] ?? null;
  const canPlayBookAudio = textVersion === "s21" && Boolean(bookAudio?.audioUrl);

  async function playUsfmAudio(targetUsfm: string) {
    const usfm = targetUsfm.toUpperCase();
    const episode = audioByUsfm[usfm];
    if (!episode?.audioUrl) return;

    // Aligne le sélecteur Livre/chapitre sur le livre audio choisi.
    if (usfm !== bookId.toUpperCase() && isUsfmBookId(usfm)) {
      void loadChapter(usfm, "1", null);
    }

    if (isNativeBibleAudio()) {
      try {
        setAudioBusy(true);
        setAudioActiveUsfm(usfm);
        const alreadyReady =
          getNativeActiveAudioId() === usfm &&
          getNativePreparedUrl() === episode.audioUrl &&
          isNativeBibleAudioReady();

        if (!alreadyReady) {
          const resume = loadAudioPositions()[usfm];
          if (audioBookRef.current && audioBookRef.current !== usfm) {
            const t = await getNativeBibleAudioTime();
            if (Number.isFinite(t)) saveAudioPosition(audioBookRef.current, t);
          }

          await prepareNativeBibleAudio(
            {
              audioId: usfm,
              url: episode.audioUrl,
              title: episode.title,
              artist: audioPodcast,
              albumTitle: "Segond 21",
              resumeAt: resume && resume > 2 ? resume : undefined,
            },
            {
              onReady: (duration) => {
                if (Number.isFinite(duration) && duration > 0) {
                  setAudioDuration(duration);
                }
              },
              onStatus: (status) => {
                setAudioPlaying(status === "playing");
                if (status === "paused" || status === "stopped") {
                  void getNativeBibleAudioTime().then((t) => {
                    if (audioBookRef.current && Number.isFinite(t)) {
                      saveAudioPosition(audioBookRef.current, t);
                    }
                  });
                }
              },
              onTime: (currentTime) => {
                setAudioTime(currentTime);
              },
              onEnd: () => {
                setAudioPlaying(false);
                if (audioBookRef.current) {
                  saveAudioPosition(audioBookRef.current, 0);
                }
                setAudioTime(0);
              },
            },
          );
        }
        audioBookRef.current = usfm;
        await playNativeBibleAudio();
        setAudioPlaying(true);
      } catch {
        setAudioPlaying(false);
        setPassageUiError("Audio indisponible pour le moment.");
      } finally {
        setAudioBusy(false);
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

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
      void syncBibleAudioControls({
        track: episode.title,
        artist: audioPodcast,
        album: "Segond 21",
        isPlaying: true,
        duration: Number.isFinite(audio.duration) ? audio.duration : audioDuration,
        elapsed: audio.currentTime || 0,
      });
    } catch {
      setAudioPlaying(false);
      setPassageUiError("Audio indisponible pour le moment.");
    } finally {
      setAudioBusy(false);
    }
  }

  async function toggleBookAudio() {
    const usfm = (audioActiveUsfm || bookId).toUpperCase();

    if (isNativeBibleAudio()) {
      if (audioBookRef.current === usfm && (await isNativeBibleAudioPlaying())) {
        await pauseNativeBibleAudio();
        setAudioPlaying(false);
        const t = await getNativeBibleAudioTime();
        if (Number.isFinite(t)) saveAudioPosition(usfm, t);
        return;
      }
      await playUsfmAudio(usfm);
      return;
    }

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

    if (isNativeBibleAudio()) {
      if (audioBookRef.current === usfm && getNativePreparedUrl()) {
        void toggleBookAudio();
        return;
      }
      void playUsfmAudio(usfm);
      return;
    }

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
    if (!Number.isFinite(seconds)) return;

    if (isNativeBibleAudio()) {
      const max =
        Number.isFinite(audioDuration) && audioDuration > 0 ? audioDuration : seconds;
      const next = Math.min(Math.max(0, seconds), Math.max(0, max));
      void seekNativeBibleAudio(next).then(() => {
        setAudioTime(next);
        if (audioBookRef.current) saveAudioPosition(audioBookRef.current, next);
      });
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;
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
    /* Hide-on-scroll off: só show forçado / restore; nav some via modal + CSS :has. */
    chromeLockUntil.current = now + CHROME_SHOW_LOCK_MS;

    // flushSync: leitor + shell no mesmo paint — evita race classList vs className.
    flushSync(() => {
      setChromeHidden(hidden);
      onReadingChromeChange?.(hasActiveModalRef.current || hidden);
    });
  }

  useEffect(() => {
    if (!forceChrome) return;
    chromeLockUntil.current = 0;
    setReadingChrome(false, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setReadingChrome is a render-local helper
  }, [forceChrome]);

  /** Navbar: modal aberto mantém hide mesmo com top chrome forçado visível. */
  useEffect(() => {
    onReadingChromeChange?.(hasActiveModal || chromeHidden);
  }, [hasActiveModal, chromeHidden, onReadingChromeChange]);

  useEffect(() => {
    return () => {
      onReadingChromeChange?.(false);
    };
  }, [onReadingChromeChange]);

  useEffect(() => {
    setReadingChrome(false, true);
    lastScrollTop.current = passageScrollRef.current?.scrollTop ?? 0;
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
      setReadingChrome(false, true);
      return;
    }

    const root = passageScrollRef.current;
    if (!root) return;

    // Sync baseline so a restored/programmatic offset doesn't look like a huge down-scroll.
    lastScrollTop.current = root.scrollTop;
    syncHeadCompact(root.scrollTop);

    const onScroll = () => {
      if (scrollRaf.current) return;
      scrollRaf.current = window.requestAnimationFrame(() => {
        scrollRaf.current = 0;
        const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
        const rawTop = root.scrollTop;
        if (rawTop < 0 || rawTop > maxScroll) {
          lastScrollTop.current = Math.min(maxScroll, Math.max(0, rawTop));
          return;
        }

        const top = rawTop;
        const delta = top - lastScrollTop.current;
        lastScrollTop.current = top;
        syncHeadCompact(top);

        // 1.º scroll do utilizador: desliga o texto opaco.
        if (
          focusDimActiveRef.current &&
          Math.abs(delta) >= FOCUS_DIM_CLEAR_PX &&
          performance.now() >= suppressFocusDimClearUntil.current
        ) {
          clearFocusDimOnUserScroll();
        }

        /* Chrome/nav: estáveis no scroll; hide só por modal / :has. */
        if (chromeHiddenRef.current) setReadingChrome(false, true);
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

  if (dayNoteOpen && planReading) {
    return (
      <PlanStageNotePanel
        planId={planReading.planId}
        planTitle={
          planReading.planShareTitle?.trim() ||
          planReading.planName?.trim() ||
          "Plan"
        }
        jour={planReading.jour}
        lead={
          planReading.isStageLast
            ? "Étape terminée — ajoute une note personnelle (optionnel)."
            : "Note du jour — ajoute une réflexion (optionnel)."
        }
        saveLabel="Enregistrer"
        inputId="plan-reader-day-note"
        onDismiss={finishPlanDayNote}
      />
    );
  }

  const menuJourneyOpen =
    toolsMenuOpen || wordSearchOpen || historyOpen || marksOpen;
  const topSheetOpen =
    wordSearchOpen ||
    surfaceChrome.passagePickerRollOpen ||
    historyOpen ||
    marksOpen ||
    toolsMenuOpen ||
    showCreateCard;

  return (
    <section
      ref={readerRef}
      className={`bible-reader bible-reader--yv${hideChrome ? " is-chrome-hidden" : ""}${hasActiveModal ? " is-overlay-active" : ""}${audioPlaying ? " is-audio-playing" : ""}${showCreateCard ? " has-verse-actions" : ""}${showStudyReturnNav ? " has-study-return" : ""}${shareSheetOpen ? " is-share-open" : ""}${headCompact ? " is-head-compact" : ""}${surfaceChrome.rootClassPassageRollOpen ? " is-passage-roll-open" : ""}${topSheetOpen ? " is-top-sheet-open" : ""}${compactToolsMenu ? " is-compact-tools" : ""}${toolsMenuOpen ? " is-tools-menu-open" : ""}${menuJourneyOpen ? " is-menu-journey-open" : ""}${historyOpen ? " is-history-open" : ""}${fontFamily === "sans" ? " is-font-sans" : " is-font-serif"}`}
      style={{ ["--bible-font-size" as string]: `${fontSize}px` }}
      onKeyDown={(event) => {
        /* Escape deve fechar overlays mesmo com focus no input (padrão dialog). */
        if (
          (event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLSelectElement) &&
          event.key !== "Escape"
        ) {
          return;
        }
        if (planReading) {
          if (event.key === "Escape") {
            event.preventDefault();
            if (shareSheetOpen) {
              setShareSheetOpen(false);
              return;
            }
            if (historyOpen || marksOpen) {
              leaveHistoryOrMarks("back");
              return;
            }
            if (wordSearchOpen) {
              openOverlay({ type: "reader_settings" });
              return;
            }
            if (toolsMenuOpen) {
              closeOverlay();
              return;
            }
            if (pickerOpen) {
              closeAll();
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
            marksOpen ||
            shareSheetOpen ||
            wordSearchOpen
          ) {
            return;
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            planOrChapterSkip(-1);
          } else if (event.key === "ArrowRight" || event.key === "Enter") {
            event.preventDefault();
            planOrChapterSkip(1);
          }
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          if (shareSheetOpen) {
            setShareSheetOpen(false);
            return;
          }
          if (historyOpen || marksOpen) {
            leaveHistoryOrMarks("back");
            return;
          }
          if (wordSearchOpen) {
            openOverlay({ type: "reader_settings" });
            return;
          }
          if (toolsMenuOpen) {
            closeOverlay();
            return;
          }
          if (pickerOpen) {
            closeAll();
            return;
          }
          if (showCreateCard) {
            closeCreateCard();
            return;
          }
        }
        if (topSheetOpen || pickerOpen || wordSearchOpen || marksOpen) return;
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
        className={`bible-yv-top is-free${topSheetOpen ? " is-top-sheet-open" : ""}${surfaceChrome.rootClassPassageRollOpen ? " is-passage-roll-open" : ""}${catalogOfflineHint ? " is-catalog-offline" : ""}${compactToolsMenu ? " is-compact-tools" : ""}${
          presentation.inFlight ? " is-loading" : ""
        }`}
        aria-label={t("bible.nav")}
        aria-busy={presentation.inFlight || undefined}
      >
        <div className="bible-yv-top-tools">
          {!pickerOpen &&
          (!compactToolsMenu || isPassageBarPanelCompactTopbar())
            ? renderTopToolsMenu("header")
            : null}
        </div>
        {!menuJourneyOpen && !showCreateCard ? (
          discoverySplitSearch ? (
            <div className="bible-yv-passage-chrome-cluster">
              {onBack ? (
                <button
                  type="button"
                  className="bible-yv-passage-word-search-trigger"
                  onClick={handlePlanBack}
                  aria-label={
                    planReading
                      ? onPlanStep
                        ? "Quitter la lecture du plan"
                        : "Retour au passage du plan"
                      : t("profile.settings")
                  }
                >
                  <YvIcon
                    name="chevron_left"
                    className="bible-yv-passage-word-search-icon"
                  />
                </button>
              ) : null}
              {isPassageBarPanelCompactTopbar()
                ? renderPassageSkipPickerCluster()
                : renderPassageRoll()}
            </div>
          ) : isPassageBarPanelCompactTopbar() ? (
            renderPassageSkipPickerCluster()
          ) : (
            renderPassageRoll()
          )
        ) : null}
        {presentation.inFlight ? (
          <div
            className="bible-yv-top-loading-bar"
            role="progressbar"
            aria-label={
              presentation.isReloading
                ? PASSAGE_LOADING_COPY.reloadingChapter
                : PASSAGE_LOADING_COPY.openingChapter
            }
          />
        ) : null}
      </header>

      {surfaceChrome.passageSurfaceScrimOpen ? (
        <button
          type="button"
          className={`top-sheet-backdrop${
            surfaceChrome.scrimIsTools ? " is-tools" : ""
          }${surfaceChrome.scrimIsPickerDismiss ? " is-picker-dismiss" : ""}${
            surfaceChrome.passagePickerRollOpen ? " is-book-pill" : ""
          }`}
          aria-label={t("common.close")}
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

      {/*
        Layer z70 acima do scrim (z60). Book/search/history montam AQUI —
        nunca dentro do header (trap) nem como irmão “nu” do scrim com
        backdrop-filter (bug de compositing: sheet parece sob o blur).
      */}
      <div className="top-sheet-layer" data-top-sheet-layer="">
        {renderPassageBookSheet()}
        {discoverySplitSearch && !planReading ? (
          <BiblePassageWordSearchPanel
            id={wordSearchPanelId}
            open={wordSearchOpen}
            query={wordSearchQuery}
            onQueryChange={setWordSearchQuery}
            onQueryClear={clearWordSearch}
            onClose={closeWordSearch}
            discoveryBusy={wordDiscoveryBusy}
            verseHits={wordVerseHits}
            verseTotal={wordVerseTotal}
            page={wordSearchPage}
            pageCount={wordSearchPageCount}
            onPageChange={setWordSearchPage}
            paging={wordSearchPaging}
            contentError={wordDiscovery.contentError}
            textVersion={textVersion}
            books={books}
            matchMode={wordMatchMode}
            matchedTerms={wordMatchedTerms}
            scopeFilter={wordSearchScopeFilter}
            onScopeFilterChange={setWordSearchScopeFilter}
            selectedBookIds={wordSearchSelectedBookIds}
            onSelectedBookIdsChange={setWordSearchSelectedBookIds}
            scopeCounts={wordSearchScopeCounts}
            facets={wordSearchFacets}
            currentBookId={bookId}
            currentBookTitle={bookTitle}
            onPickVerse={(hit) => {
              closeWordSearch({ restoreFocus: false });
              pickVerseSearchHit(hit);
            }}
          />
        ) : null}
        {ACTIVITY_UI_ENABLED ? (
          <BibleHistorySheet
            open={historyOpen}
            onClose={() => {
              leaveHistoryOrMarks("dismiss");
            }}
            onSelect={({ versionId, bookId: destBookId, chapterId: destChapterId, verse }) => {
              overlayReturnToProfileRef.current = false;
              restoreHistoryFocusRef.current = false;
              closeOverlay();
              pushStudyOriginFromCurrent({
                returnTo: "history",
                dest: {
                  bookId: destBookId,
                  chapterId: destChapterId,
                  verse: verse ?? null,
                },
              });
              void (async () => {
                if (versionId !== textVersionRef.current) {
                  await switchTextVersion(versionId);
                }
                preferJumpFocusRef.current = verse != null;
                if (verse != null) setFocusDim(true);
                void loadChapter(destBookId, destChapterId, verse);
              })();
            }}
            onHistoryChange={onReadingHistoryChange}
          />
        ) : null}
        <BibleMarksSheet
          open={marksOpen}
          resolveBookTitle={resolveBookTitleActive}
          onClose={() => {
            leaveHistoryOrMarks("back");
          }}
          onSelect={({ versionId, bookId: destBookId, chapterId: destChapterId, verse }) => {
            overlayReturnToProfileRef.current = false;
            closeOverlay();
            pushStudyOriginFromCurrent({
              returnTo: "marks",
              dest: {
                bookId: destBookId,
                chapterId: destChapterId,
                verse: verse ?? null,
              },
            });
            void (async () => {
              if (versionId !== textVersionRef.current) {
                await switchTextVersion(versionId);
              }
              preferJumpFocusRef.current = verse != null;
              if (verse != null) setFocusDim(true);
              void loadChapter(destBookId, destChapterId, verse);
            })();
          }}
        />
        {/* Menu header: na layer (como search/history) — abertura sem delay/animação */}
        {!compactToolsMenu || isPassageBarPanelCompactTopbar()
          ? renderToolsPopover(false)
          : null}
        {showCreateCard ? renderVerseActionsSheet() : null}
      </div>
      {showCreateCard && verseActionsTab === "verse"
        ? renderVerseActionsToolbar()
        : null}
      {showStudyReturnNav ? renderStudyReturnNav() : null}
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
          closeToolsMenu();
        }}
      >

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
        className={`bible-passage${passageFadeIn ? " is-chapter-fade" : ""}`}
        aria-busy={presentation.ariaBusy || undefined}
        aria-hidden={surfaceChrome.passageInputBlocked || undefined}
        inert={surfaceChrome.passageInputBlocked || undefined}
        style={
          {
            ["--verse-tint" as string]: actionTone.tint,
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
            needsReconnect={
              typeof navigator !== "undefined" &&
              navigator.onLine === false &&
              !versionOfflineReady
            }
          />
        ) : passage?.verses?.length ? (
          <div
            className=            {[
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
              const planRangeActive = Boolean(
                planReading &&
                  onPlanStep &&
                  !jumpFocus &&
                  !selection?.length,
              );
              const inPlanRange = Boolean(
                planRangeActive &&
                  (planVerseRangeFull ||
                    (planVerseRangeLo != null &&
                      planVerseRangeHi != null &&
                      verse.number >= planVerseRangeLo &&
                      verse.number <= planVerseRangeHi)),
              );
              const rangeStart =
                planReading && onPlanStep && !jumpFocus && planReading.verseStart != null
                  ? planVerseRangeLo
                  : highlightVerse;
              const inDeeplink = Boolean(
                !selection?.length &&
                  focusVerseLo != null &&
                  focusVerseHi != null &&
                  verse.number >= focusVerseLo &&
                  verse.number <= focusVerseHi &&
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
        ) : presentation.isOpening ||
          (presentation.inFlight && !passage?.verses?.length) ? (
          <div className="bible-verses is-skeleton" aria-hidden="true">
            {PASSAGE_OPENING_SKELETON_WIDTHS.map((widthPct, index) => (
              <div
                key={`opening-skel-${index}`}
                className="bible-verse is-skeleton"
              >
                <sup className="bible-verse-num">{index + 1}</sup>
                <span
                  className="bible-verse-text"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            ))}
          </div>
        ) : !isUsfmBookId(bookId) ? (
          <p className="bible-yv-muted">{PASSAGE_LOADING_COPY.emptyPassage}</p>
        ) : null}
      </article>
      </div>

      {compactToolsMenu &&
      !isPassageBarPanelCompactTopbar() &&
      !pickerOpen
        ? renderTopToolsMenu("float")
        : null}

      {(() => {
        const compactDock = compactViewport || narrowChrome;
        if (planReading) {
          const stageIdx = planReading.stageIndex ?? 1;
          const stageTotal = planReading.stageCount ?? 1;
          const dayIdx = planReading.stageDayIndex ?? planReading.stepIndex + 1;
          const dayTotal =
            planReading.stageDayCount ?? planReading.stepCount;
          const stageTitle = planReading.stageName?.trim();
          return (
            <footer
              className={`bible-yv-dock is-plan-progress${compactDock ? " is-floating" : ""} is-play-only`}
              aria-label={t("bible.planProgress")}
            >
              <div
                className="bible-yv-plan-progress-chip"
                role="status"
                aria-live="polite"
                title={
                  stageTitle
                    ? `Étape ${stageIdx} · ${stageTitle}`
                    : `Étape ${stageIdx}`
                }
              >
                <span className="bible-yv-plan-progress-stage">
                  Étape {stageIdx}
                  {stageTotal > 1 ? `/${stageTotal}` : ""}
                </span>
                <span className="bible-yv-plan-progress-sep" aria-hidden>
                  ·
                </span>
                <span className="bible-yv-plan-progress-day">
                  Jour {dayIdx}
                  {dayTotal > 1 ? `/${dayTotal}` : ""}
                </span>
              </div>
            </footer>
          );
        }
        return (
      <footer
        className={`bible-yv-dock${audioPlaying ? " is-playing" : ""}${compactDock ? " is-floating" : ""} is-play-only`}
        aria-label="Lecteur audio"
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

      <SearchBooksModal
        open={bookSearchOpen}
        onClose={() => closeOverlay()}
        books={books}
        versionId={textVersion}
        onPick={({ usfm, chapter }) => {
          closeOverlay();
          void loadChapter(usfm, String(chapter), null);
        }}
      />

    </section>
  );
}
