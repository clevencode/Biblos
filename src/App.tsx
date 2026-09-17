import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import seed from "./data/seed.json";
import { FlashcardDeck } from "./components/FlashcardDeck";
import { ModeTabIcon } from "./components/ModeTabIcon";
import { ProfileOnboarding } from "./components/ProfileOnboarding";
import { ProfileView } from "./components/ProfileView";
import { PrivacyEntryGate, hasPrivacyAck } from "./components/PrivacyLegal";
import { ensureNotificationPrefsIfPrivacyAccepted } from "./notificationPrefs";
import { TodayView } from "./components/TodayView";
import { HomeView } from "./components/HomeView";
import { PlanGallery } from "./components/PlanGallery";
import { BibleReaderView } from "./components/BibleReaderView";
import type { Catalog, CenterMode, Flashcard, ReadingPlan, Seed } from "./types";
import { appendActivity, recordBibleRead } from "./activityLog";
import { listAllVerseMarks } from "./verseMarks";
import { createVerseMarkFlashcard, verseMarkCardId } from "./verseCard";
import { formatVerseCardFront } from "./youversion/usfm";
import { chapterUsfm } from "./youversion/client";
import {
  completeOnboarding,
  isClevencodeAdmin,
  isProfileOnboarded,
  loadOrCreateProfile,
  preferredDisplayName,
  saveUserProfile,
  type UserProfile,
} from "./userProfile";
import { syncUserProfileToNotion, startPresenceAndUsageSync } from "./userProfileSync";
import { startAppUsageTracking } from "./appUsage";
import { flushAdminMessageOutbox } from "./adminMessage";
import {
  listAllFlashcards,
  planCardIds,
} from "./catalog";
import { mergeCard } from "./cardOverrides";
import { hydrateCatalogFromCache, persistCatalogCache, removeCardFromCatalog } from "./catalogSync";
import {
  calendarJour,
  ensurePlanStart,
  ensureDayCompleted,
  latestPlanJour,
  loadPlanProgress,
  markDayRead,
  resetPlanProgress,
} from "./planProgress";
import { sanitizePlanDays } from "./plan";
import { loadDayNote } from "./planDayNote";
import {
  createPlanReadingSession,
  currentPlanStep,
  isFirstPlanStep,
  isLastPlanStep,
  type PlanReadingReturnTo,
  type PlanReadingSession,
} from "./planReading";
import { useNotionSync } from "./useNotionSync";
import {
  countUnreadAppNotifications,
  syncContextualNotifications,
} from "./appNotifications";
import { useNarrow, useSplitLayout } from "./layout";
import { chapterFocusFromRef, isPassageRef } from "./youversion/usfm";
import { syncNativeChrome } from "./nativeChrome";
import {
  applyTheme,
  loadThemePref,
  nextThemePref,
  saveThemePref,
  watchSystemTheme,
  type ThemePref,
} from "./theme";

const UI_KEY = "biblos-ui";
const seedCatalog = hydrateCatalogFromCache(seed as Catalog);

const modes: { id: CenterMode; label: string }[] = [
  { id: "home", label: "Accueil" },
  { id: "today", label: "Plan" },
  { id: "bible", label: "Bible" },
  { id: "cards", label: "Cartes" },
  { id: "profile", label: "Profil" },
];

type UiSession = {
  home?: boolean;
  mode?: CenterMode;
  planId?: string;
};

function readUi(): UiSession {
  try {
    const raw = localStorage.getItem(UI_KEY) ?? sessionStorage.getItem(UI_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as UiSession & { materiaIds?: unknown };
    if (!localStorage.getItem(UI_KEY) && sessionStorage.getItem(UI_KEY)) {
      localStorage.setItem(UI_KEY, raw);
      sessionStorage.removeItem(UI_KEY);
    }
    return parsed && typeof parsed === "object"
      ? { home: parsed.home, mode: parsed.mode, planId: parsed.planId }
      : {};
  } catch {
    return {};
  }
}

function writeUi(session: UiSession) {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(session));
    sessionStorage.removeItem(UI_KEY);
  } catch {
    /* private mode / quota */
  }
}

function isMode(value: unknown): value is CenterMode {
  return modes.some((item) => item.id === value);
}

function resolveInitialMode(session: UiSession): CenterMode {
  const value = session.mode as string | undefined;
  if (value === "calendar" || value === "inbox") return "cards";
  if (isMode(value)) return value;
  return "home";
}

export function App() {
  const initialUi = readUi();
  const [catalog, setCatalog] = useState<Catalog>(() => seedCatalog);
  const notes = catalog.notas;
  const plans = catalog.plans;
  const [mode, setMode] = useState<CenterMode>(() => resolveInitialMode(initialUi));
  /** Sous l’onglet Plan : détail du jour vs liste. */
  const [planDay, setPlanDay] = useState(
    () => initialUi.mode === "today" && initialUi.home === false,
  );
  const [planId, setPlanId] = useState(() => initialUi.planId ?? plans[0]?.id ?? "");
  const [planProgressTick, setPlanProgressTick] = useState(0);
  const [offlineToast, setOfflineToast] = useState(false);
  const offlineToastSeen = useRef(false);
  const narrow = useNarrow();
  const splitLayout = useSplitLayout();
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const [cardFocusId, setCardFocusId] = useState<string | null>(null);
  const [cardFocusSeq, setCardFocusSeq] = useState(0);
  /** Ouverture « Voir la carte » depuis Lecture → ← revient à Lecture. */
  const [cardReturnToBible, setCardReturnToBible] = useState(false);
  const [bibleFocusRef, setBibleFocusRef] = useState<string | null>(null);
  const [bibleFocusSeq, setBibleFocusSeq] = useState(0);
  const [planReading, setPlanReading] = useState<PlanReadingSession | null>(null);
  const [dayNoteFocus, setDayNoteFocus] = useState<{ jour: number; seq: number } | null>(null);
  const [planIntroFocus, setPlanIntroFocus] = useState<{ seq: number } | null>(null);
  const [planResumeSeq, setPlanResumeSeq] = useState(0);
  const [retentionTick, setRetentionTick] = useState(0);
  const [bibleChromeHidden, setBibleChromeHidden] = useState(false);
  const [themePref, setThemePref] = useState<ThemePref>(() => loadThemePref());
  const [profile, setProfile] = useState<UserProfile>(() => loadOrCreateProfile());
  /** Empêche le retour de l’écran Bienvenue si un sync stale réécrit le profil. */
  const [onboardingDone, setOnboardingDone] = useState(() =>
    isProfileOnboarded(loadOrCreateProfile()),
  );
  const [activityTick, setActivityTick] = useState(0);
  const [privacyOk, setPrivacyOk] = useState(() => {
    const ok = hasPrivacyAck();
    ensureNotificationPrefsIfPrivacyAccepted(ok);
    return ok;
  });
  const openedLogged = useRef(false);

  function applySyncedProfile(remote: UserProfile | undefined) {
    if (!remote) return;
    setProfile((prev) => {
      if (isProfileOnboarded(prev) && !isProfileOnboarded(remote)) return prev;
      return remote;
    });
  }

  useEffect(() => {
    if (openedLogged.current || !isProfileOnboarded(profile)) return;
    openedLogged.current = true;
    appendActivity("app.open", undefined, profile.id);
    setActivityTick((n) => n + 1);
  }, [profile]);

  useEffect(() => {
    if (!isProfileOnboarded(profile)) return undefined;
    const stopPresence = startPresenceAndUsageSync((next) => applySyncedProfile(next));
    const stopUsage = startAppUsageTracking(() => {
      void syncUserProfileToNotion(undefined, { presence: "Online" }).then((result) => {
        applySyncedProfile(result.profile);
      });
    });
    return () => {
      stopUsage();
      stopPresence();
    };
  }, [profile.id, profile.onboardedAt]);

  useEffect(() => {
    function onOffline() {
      offlineToastSeen.current = false;
      setOfflineToast(true);
      window.setTimeout(() => setOfflineToast(false), 4200);
    }
    function onOnline() {
      setOfflineToast(false);
      void flushAdminMessageOutbox();
      void syncUserProfileToNotion(undefined, { presence: "Online" }).then((result) => {
        applySyncedProfile(result.profile);
      });
    }
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    const resolved = applyTheme(themePref);
    void syncNativeChrome(resolved);
    if (themePref !== "system") return undefined;
    return watchSystemTheme(() => {
      void syncNativeChrome(applyTheme("system"));
    });
  }, [themePref]);

  useEffect(() => {
    if (mode !== "cards" && mode !== "bible") {
      setCardReturnToBible(false);
    }
  }, [mode]);

  function cycleTheme() {
    const next = nextThemePref(themePref);
    saveThemePref(next);
    setThemePref(next);
    if (isProfileOnboarded(profile)) {
      appendActivity("theme.change", { pref: next }, profile.id);
      setActivityTick((n) => n + 1);
    }
  }

  function setThemePreference(pref: ThemePref) {
    saveThemePref(pref);
    setThemePref(pref);
    if (isProfileOnboarded(profile)) {
      appendActivity("theme.change", { pref }, profile.id);
      setActivityTick((n) => n + 1);
    }
  }

  function finishOnboarding(input: {
    firstName: string;
    lastName: string;
    preferredName: string;
  }) {
    const next = completeOnboarding(input);
    setOnboardingDone(true);
    setProfile(next);
    appendActivity(
      "onboarding.complete",
      { name: preferredDisplayName(next) },
      next.id,
    );
    openedLogged.current = true;
    appendActivity("app.open", undefined, next.id);
    setActivityTick((n) => n + 1);
    setMode("home");
    void syncUserProfileToNotion(next).then((result) => {
      applySyncedProfile(result.profile);
    });
  }

  function handleProfileSave(input: {
    firstName: string;
    lastName: string;
    preferredName: string;
  }) {
    const next = saveUserProfile({
      firstName: input.firstName,
      lastName: input.lastName,
      preferredName: input.preferredName,
    });
    setProfile(next);
    appendActivity(
      "profile.update",
      { name: preferredDisplayName(next) },
      next.id,
    );
    setActivityTick((n) => n + 1);
    void syncUserProfileToNotion(next).then((result) => {
      applySyncedProfile(result.profile);
    });
  }

  const activePlan = useMemo(
    () => plans.find((plan) => plan.id === planId) ?? plans[0] ?? null,
    [planId, plans],
  );
  const scopedCardIds = useMemo(() => planCardIds(activePlan), [activePlan]);

  const cards = useMemo(
    () => listAllFlashcards(notes, scopedCardIds).map(mergeCard),
    [scopedCardIds, notes, retentionTick],
  );
  const verseCardIds = useMemo(() => {
    const ids = new Set<string>();
    for (const card of listAllFlashcards(notes, null)) {
      if (String(card.id || "").startsWith("verse-")) ids.add(card.id);
    }
    return ids;
  }, [notes, retentionTick]);
  const verseCardColors = useMemo(() => {
    const colors = new Map<string, string>();
    for (const card of listAllFlashcards(notes, null)) {
      if (!String(card.id || "").startsWith("verse-")) continue;
      if (card.color) colors.set(card.id, card.color);
    }
    return colors;
  }, [notes, retentionTick]);

  function openVerseFlashcard(cardId: string) {
    if (activePlan?.cardIds?.length && !activePlan.cardIds.includes(cardId)) {
      setCatalog((current) => {
        const plans = (current.plans ?? []).map((plan) =>
          plan.id === activePlan.id
            ? { ...plan, cardIds: [cardId, ...(plan.cardIds ?? [])] }
            : plan,
        );
        const next = { ...current, plans };
        persistCatalogCache(next);
        return next;
      });
    }
    setCardReturnToBible(true);
    setMode("cards");
    setCardFocusId(cardId);
    setCardFocusSeq((value) => value + 1);
  }

  function returnFromVerseFlashcard() {
    setCardReturnToBible(false);
    setCardFocusId(null);
    setMode("bible");
  }
  const allFlashcards = useMemo(
    () => listAllFlashcards(notes, null).map(mergeCard),
    [notes, retentionTick],
  );
  const savedVerses = useMemo(() => {
    void mode;
    void activityTick;
    void retentionTick;
    void notes;
    return listAllVerseMarks();
  }, [mode, activityTick, retentionTick, notes]);

  const activeCardsCount = useMemo(
    () => cards.filter((card) => card.status !== "encerrado").length,
    [cards],
  );

  const [homeUnread, setHomeUnread] = useState(0);

  useEffect(() => {
    syncContextualNotifications(plans);
    setHomeUnread(countUnreadAppNotifications());
    const id = window.setInterval(() => {
      setHomeUnread(countUnreadAppNotifications());
    }, 15_000);
    return () => window.clearInterval(id);
  }, [plans, planProgressTick, mode]);

  const planProgress = useMemo(() => {
    if (!activePlan) return null;
    void planProgressTick;
    return loadPlanProgress(activePlan.id) ?? ensurePlanStart(activePlan.id);
  }, [activePlan, planProgressTick]);

  const planDays = useMemo(
    () => (activePlan ? sanitizePlanDays(activePlan.days) : []),
    [activePlan],
  );

  const todayJour = useMemo(() => {
    if (!activePlan || !planProgress) return 1;
    return calendarJour(planProgress.startDate, planDays.length || 1);
  }, [activePlan, planProgress, planDays.length]);

  const focusJour = useMemo(() => {
    if (!activePlan) return 1;
    return latestPlanJour({ ...activePlan, days: planDays }, planProgress);
  }, [activePlan, planProgress, planDays]);

  const { notionHealth } = useNotionSync({
    catalog,
    setCatalog,
    notesRef,
    setRetentionTick,
    mode,
    cardIds: scopedCardIds,
    activePlan,
  });

  useEffect(() => {
    // Uniquement le vrai hors ligne réseau — pas l’échec d’API Notion.
    if (typeof navigator === "undefined" || navigator.onLine !== false) return undefined;
    if (offlineToastSeen.current) return undefined;
    offlineToastSeen.current = true;
    setOfflineToast(true);
    const timer = window.setTimeout(() => setOfflineToast(false), 4200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (plans.length && !plans.some((plan) => plan.id === planId)) {
      setPlanId(plans[0].id);
    }
  }, [planId, plans]);

  useEffect(() => {
    writeUi({
      home: mode === "today" ? !planDay : undefined,
      mode,
      planId: activePlan?.id,
    });
  }, [activePlan?.id, mode, planDay]);

  useEffect(() => {
    if (mode !== "bible") setBibleChromeHidden(false);
  }, [mode]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (mode === "today" && planDay) {
        event.preventDefault();
        goGalerie();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, planDay]);

  function goGalerie() {
    setPlanDay(false);
    setMode("today");
  }

  function goHome() {
    setMode("home");
  }

  function pickPlan(plan: ReadingPlan) {
    setPlanId(plan.id);
    setPlanDay(true);
    setMode("today");
  }

  function openPassageInBible(reference: string, opts?: { keepPlanReading?: boolean }) {
    const ref = reference.trim();
    if (!ref) return;
    if (!opts?.keepPlanReading) setPlanReading(null);
    setBibleFocusRef(ref);
    setBibleFocusSeq((value) => value + 1);
    setMode("bible");
  }

  function openCardChapter(card: Flashcard) {
    const frente = card.frente?.trim() ?? "";
    // Ouvre Lecture sur le verset de la carte (pas seulement le chapitre).
    if (isPassageRef(frente)) {
      openPassageInBible(frente);
      return;
    }
    const chapter = chapterFocusFromRef(frente);
    if (chapter) openPassageInBible(chapter);
  }

  function startPlanReading(
    jour: number,
    passageHint = "",
    opts?: { returnTo?: PlanReadingReturnTo },
  ) {
    if (!activePlan) return;
    const returnTo = opts?.returnTo ?? "timeline";
    const session = createPlanReadingSession({
      planId: activePlan.id,
      startJour: jour,
      days: activePlan.days,
      returnTo,
    });
    if (!session) {
      if (passageHint.trim()) openPassageInBible(passageHint);
      return;
    }
    const hint = passageHint.trim().toLowerCase();
    let index = 0;
    if (hint) {
      const found = session.steps.findIndex((step) => {
        const label = step.label.toLowerCase();
        const focus = step.focusRef.toLowerCase();
        return label === hint || focus === hint || label.includes(hint) || hint.includes(label);
      });
      if (found >= 0) index = found;
    }
    const next = { ...session, index };
    setPlanReading(next);
    const step = currentPlanStep(next);
    if (step) openPassageInBible(step.focusRef, { keepPlanReading: true });
  }

  function restorePlanFlow(returnTo: PlanReadingReturnTo, jour: number) {
    setPlanDay(true);
    setMode("today");
    if (returnTo === "dayNote") {
      setDayNoteFocus({ jour, seq: Date.now() });
      setPlanIntroFocus(null);
      return;
    }
    if (returnTo === "intro") {
      setDayNoteFocus(null);
      setPlanIntroFocus({ seq: Date.now() });
      return;
    }
    setDayNoteFocus(null);
    setPlanIntroFocus(null);
    setPlanResumeSeq((value) => value + 1);
  }

  /** ← : toujours l’écran d’origine de cette session de lecture. */
  function exitPlanReading() {
    if (!planReading) {
      setPlanDay(true);
      setMode("today");
      setPlanResumeSeq((value) => value + 1);
      return;
    }
    const { returnTo, startJour } = planReading;
    setPlanReading(null);
    restorePlanFlow(returnTo, startJour);
  }

  function planReadingPrev() {
    if (!planReading || isFirstPlanStep(planReading)) return;
    const next = { ...planReading, index: planReading.index - 1 };
    setPlanReading(next);
    const step = currentPlanStep(next);
    if (step) openPassageInBible(step.focusRef, { keepPlanReading: true });
  }

  function planReadingAdvance() {
    if (!planReading) return;
    const current = currentPlanStep(planReading);
    if (isLastPlanStep(planReading)) {
      const origin = planReading.returnTo;
      const jour = current?.jour ?? planReading.startJour;
      if (current) {
        const prior = loadPlanProgress(planReading.planId);
        const alreadySeen = prior?.completedDays.includes(current.jour) ?? false;
        const existingNote = loadDayNote(planReading.planId, current.jour);
        const noteAlready =
          Boolean(existingNote?.text?.trim() || existingNote?.notionUrl);
        ensureDayCompleted(planReading.planId, current.jour);
        setPlanProgressTick((value) => value + 1);
        setPlanReading(null);
        // Flux avant : si on venait de la note → note ; sinon invite note une fois ; sinon timeline.
        // (← seul restaure intro ; conclure ne revient pas à l’intro.)
        if (origin === "dayNote") {
          restorePlanFlow("dayNote", jour);
        } else if (!alreadySeen && !noteAlready) {
          setPlanDay(true);
          setMode("today");
          setPlanIntroFocus(null);
          setDayNoteFocus({ jour: current.jour, seq: Date.now() });
        } else {
          restorePlanFlow("timeline", jour);
        }
        return;
      }
      setPlanReading(null);
      restorePlanFlow(origin === "dayNote" ? "dayNote" : "timeline", jour);
      return;
    }
    const next = { ...planReading, index: planReading.index + 1 };
    setPlanReading(next);
    const step = currentPlanStep(next);
    if (step) openPassageInBible(step.focusRef, { keepPlanReading: true });
  }

  function handleVerseCardColor(cardId: string, color: string) {
    setCatalog((current) => {
      let changed = false;
      const notas = (current.notas ?? []).map((note) => {
        let noteChanged = false;
        const flashcards = (note.flashcards ?? []).map((card) => {
          if (card.id !== cardId) return card;
          if (card.color === color) return card;
          noteChanged = true;
          changed = true;
          return { ...card, color };
        });
        return noteChanged ? { ...note, flashcards } : note;
      });
      if (!changed) return current;
      const next = { ...current, notas };
      persistCatalogCache(next);
      return next;
    });
    setRetentionTick((value) => value + 1);
  }

  function handleMarkRead(jour: number) {
    if (!activePlan) return;
    markDayRead(activePlan.id, jour);
    setPlanProgressTick((value) => value + 1);
    appendActivity(
      "plan.day_read",
      { planId: activePlan.id, jour },
      profile.id,
    );
    setActivityTick((n) => n + 1);
  }

  function handleRestartPlan() {
    if (!activePlan) return;
    resetPlanProgress(activePlan.id);
    setPlanProgressTick((value) => value + 1);
  }

  function handleFlashcardCreated(card: Flashcard) {
    let previousUrl = "";
    let previousColor: string | null | undefined;
    setCatalog((current) => {
      const notas = [...(current.notas ?? [])];
      const bucketKey = String(card.cardCategory || "VERSECARD");
      const bucketId = `bucket-${bucketKey.toLowerCase()}`;
      let seed = notas.find((item) => item.nota.id === bucketId);
      if (!seed) {
        seed = {
          nota: {
            id: bucketId,
            titulo: bucketKey,
            url: "",
            criadoEm: card.criadoEm || new Date().toISOString(),
            cartoes: 0,
          },
          materia: { id: `cat-${bucketKey.toLowerCase()}`, nome: bucketKey },
          disciplina: { id: `disc-${bucketKey.toLowerCase()}`, nome: bucketKey },
          flashcards: [],
        };
        notas.push(seed);
      }
      const existing = seed.flashcards.find(
        (item) => item.id === card.id || (card.url && item.url === card.url),
      );
      if (existing) {
        previousUrl = existing.url || "";
        previousColor = existing.color;
      }
      const merged: Flashcard = existing
        ? {
            ...existing,
            ...card,
            url: card.url || existing.url || "",
          }
        : card;
      const flashcards = existing
        ? seed.flashcards.map((item) => (item.id === existing.id ? merged : item))
        : [merged, ...seed.flashcards];
      const nextSeed: Seed = {
        ...seed,
        flashcards,
        nota: { ...seed.nota, cartoes: flashcards.length },
      };
      const nextNotas = notas.map((item) => (item.nota.id === nextSeed.nota.id ? nextSeed : item));

      const plans = (current.plans ?? []).map((plan) => {
        if (!activePlan || plan.id !== activePlan.id) return plan;
        if (!plan.cardIds?.length) return plan;
        if (plan.cardIds.includes(card.id)) return plan;
        return { ...plan, cardIds: [card.id, ...plan.cardIds] };
      });

      const next = { ...current, notas: nextNotas, plans };
      persistCatalogCache(next);
      return next;
    });
    setRetentionTick((value) => value + 1);

    if (String(card.cardCategory || "").toUpperCase() !== "VERSEMARK") {
      appendActivity(
        "flashcard.create",
        { cardId: card.id, frente: card.frente?.slice(0, 80) ?? "" },
        profile.id,
      );
      setActivityTick((n) => n + 1);
    }

    void (async () => {
      if (!isClevencodeAdmin(profile)) return;
      const { syncVerseCardToNotion, attachNotionUrlToCatalog, archiveRemoteVerseCard } =
        await import("./verseCardSync");
      const isMark = String(card.cardCategory || "").toUpperCase() === "VERSEMARK";
      const colorChanged =
        isMark &&
        previousUrl &&
        previousColor != null &&
        card.color != null &&
        previousColor !== card.color;
      if (colorChanged) {
        await archiveRemoteVerseCard({ id: card.id, url: previousUrl });
      }
      const toSync: Flashcard = colorChanged ? { ...card, url: "" } : { ...card, url: card.url || previousUrl };
      const result = await syncVerseCardToNotion(toSync);
      if (result.ok && result.url) {
        setCatalog((prev) => attachNotionUrlToCatalog(prev, card.id, result.url!));
      }
    })();
  }

  function handleVerseMarked(payload: {
    color: string | null;
    verses: number[];
    bookId: string;
    chapterId: string;
    bookTitle: string;
  }) {
    const { color, verses, bookId, chapterId, bookTitle } = payload;
    if (!verses.length) return;

    if (color) {
      appendActivity(
        "verse.mark",
        { color, verseCount: verses.length },
        profile.id,
      );
      setActivityTick((n) => n + 1);
      for (const verse of verses) {
        const usfm = `${chapterUsfm(bookId, chapterId)}.${verse}`;
        const frente = formatVerseCardFront(bookTitle, chapterId, verse);
        const result = createVerseMarkFlashcard({ frente, usfm, color });
        if (result.ok) handleFlashcardCreated(result.card);
      }
      return;
    }

    for (const verse of verses) {
      const usfm = `${chapterUsfm(bookId, chapterId)}.${verse}`;
      const cardId = verseMarkCardId(usfm);
      let cardToArchive: Flashcard | null = null;
      for (const note of catalog.notas ?? []) {
        const hit = (note.flashcards ?? []).find((c) => c.id === cardId);
        if (hit) {
          cardToArchive = hit;
          break;
        }
      }
      setCatalog((current) => removeCardFromCatalog(current, cardId));
      setRetentionTick((value) => value + 1);
      if (cardToArchive && isClevencodeAdmin(profile)) {
        const archived = cardToArchive;
        void (async () => {
          const { archiveRemoteVerseCard } = await import("./verseCardSync");
          await archiveRemoteVerseCard(archived);
        })();
      }
    }
  }

  function handleRemoveCard(card: Flashcard) {
    const label = card.frente?.trim() || "cette carte";
    if (!window.confirm(`Supprimer « ${label} » ?`)) return;
    setCatalog((current) => removeCardFromCatalog(current, card.id));
    setRetentionTick((value) => value + 1);
    void (async () => {
      if (!isClevencodeAdmin(profile)) return;
      const { archiveRemoteVerseCard } = await import("./verseCardSync");
      await archiveRemoteVerseCard(card);
    })();
  }

  /** Toggle VERSECARD depuis Lecture (sans confirm — même logique que Démarquer). */
  function handleFlashcardRemovedFromBible(cardId: string) {
    let cardToArchive: Flashcard | null = null;
    for (const note of catalog.notas ?? []) {
      const hit = (note.flashcards ?? []).find((c) => c.id === cardId);
      if (hit) {
        cardToArchive = hit;
        break;
      }
    }
    setCatalog((current) => removeCardFromCatalog(current, cardId));
    setRetentionTick((value) => value + 1);
    if (cardToArchive && isClevencodeAdmin(profile)) {
      const archived = cardToArchive;
      void (async () => {
        const { archiveRemoteVerseCard } = await import("./verseCardSync");
        await archiveRemoteVerseCard(archived);
      })();
    }
  }

  function onTabKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const items = modes.map((item) => item.id);
    const index = Math.max(0, items.indexOf(mode));
    const next = items[(index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length];
    if (next === "today") setPlanDay(false);
    setMode(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  const themePanel = (
    <TodayView
      plan={activePlan}
      progress={planProgress}
      planJour={todayJour}
      focusJour={focusJour}
      resumeSeq={planResumeSeq}
      dayNoteFocus={dayNoteFocus}
      introFocus={planIntroFocus}
      onClearDayNoteFocus={() => setDayNoteFocus(null)}
      onClearIntroFocus={() => setPlanIntroFocus(null)}
      onSelectGalerie={goGalerie}
      onMarkRead={handleMarkRead}
      onOpenPassage={openPassageInBible}
      onStartPlanReading={startPlanReading}
      onRestartPlan={handleRestartPlan}
    />
  );

  const homePanel = (
    <HomeView
      profile={profile}
      plans={plans}
      progressTick={planProgressTick}
      onOpenPlan={pickPlan}
      onBrowsePlans={goGalerie}
      onOpenVerse={(reference) => openPassageInBible(reference)}
    />
  );

  const onboarded = onboardingDone || isProfileOnboarded(profile);

  if (!privacyOk) {
    return (
      <div className={`app biblos-shell${narrow ? " is-narrow" : ""}`}>
        <PrivacyEntryGate
          onAccepted={() => {
            ensureNotificationPrefsIfPrivacyAccepted(true);
            setPrivacyOk(true);
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`app biblos-shell${narrow ? " is-narrow" : ""}${mode === "bible" ? " is-bible-mode" : ""}${bibleChromeHidden ? " is-bible-chrome-hidden" : ""}`}
    >
      <a className="skip" href="#workspace">
        Aller au contenu
      </a>
      {!onboarded ? (
        <ProfileOnboarding onComplete={finishOnboarding} />
      ) : null}
      {offlineToast ? (
        <div className="offline-toast" role="status" aria-live="polite">
          <p>Hors ligne — tout reste enregistré sur cet appareil.</p>
          <button
            type="button"
            className="offline-toast-dismiss"
            aria-label="Fermer"
            onClick={() => setOfflineToast(false)}
          >
            ×
          </button>
        </div>
      ) : null}

      <main
        id="workspace"
        className={`workspace${narrow ? " is-mobile-vista" : ""}`}
      >
        <div className="note-shell">
          <div className="note-shell-main">
            <div className={`mode-tabs${mode === "bible" && narrow ? " has-bible-tools" : ""}`}>
              {mode === "bible" && narrow ? (
                <div id="bible-chrome-dock" className="mode-tabs-bible-tools" />
              ) : null}
              <div
                className="mode-tabs-nav"
                role="tablist"
                aria-label="Vues"
                onKeyDown={onTabKey}
              >
                {modes.map((item) => {
                  const on = mode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      id={`tab-${item.id}`}
                      className={on ? "is-on" : ""}
                      aria-selected={on}
                      aria-controls={`panel-${item.id}`}
                      aria-label={
                        item.id === "cards" && activeCardsCount
                          ? `${item.label}, ${activeCardsCount} carte${activeCardsCount === 1 ? "" : "s"} active${activeCardsCount === 1 ? "" : "s"}`
                          : item.id === "home" && homeUnread
                            ? `${item.label}, ${homeUnread} notification${homeUnread === 1 ? "" : "s"}`
                            : item.label
                      }
                      title={item.label}
                      tabIndex={on ? 0 : -1}
                      onClick={() => {
                        if (item.id === "today") setPlanDay(false);
                        setMode(item.id);
                      }}
                    >
                      <ModeTabIcon name={item.id} active={on} />
                      <span className="mode-tab-label">{item.label}</span>
                      {item.id === "cards" && activeCardsCount ? (
                        <span className="mode-tab-badge" aria-hidden="true">
                          {activeCardsCount}
                        </span>
                      ) : null}
                      {item.id === "home" && homeUnread > 0 ? (
                        <span className="mode-tab-badge" aria-hidden="true">
                          {homeUnread > 9 ? "9+" : homeUnread}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <section className="graph-pane" aria-label="Contenu">
              <div className="graph-pane-body">
                <div
                  id="panel-home"
                  role="tabpanel"
                  aria-labelledby="tab-home"
                  hidden={mode !== "home"}
                  className="pane-body"
                >
                  {homePanel}
                </div>
                <div
                  id="panel-today"
                  role="tabpanel"
                  aria-labelledby="tab-today"
                  hidden={mode !== "today"}
                  className="pane-body"
                >
                  {planDay ? (
                    themePanel
                  ) : (
                    <PlanGallery
                      embedded={narrow}
                      plans={plans}
                      selectedId={activePlan?.id ?? null}
                      onPick={pickPlan}
                    />
                  )}
                </div>
                <div
                  id="panel-bible"
                  role="tabpanel"
                  aria-labelledby="tab-bible"
                  hidden={mode !== "bible"}
                  className="pane-body"
                >
                  <BibleReaderView
                    initialRef="Jean 3.16"
                    focusRef={bibleFocusRef}
                    focusSeq={bibleFocusSeq}
                    active={mode === "bible"}
                    onBack={planReading ? exitPlanReading : () => {
                      if (planDay) setMode("today");
                      else goHome();
                    }}
                    planReading={
                      planReading && activePlan
                        ? {
                            planName: (() => {
                              const theme = activePlan.theme?.trim() ?? "";
                              const nome = activePlan.nome?.trim() ?? "";
                              const generic = (value: string) => !value || /^plan$/i.test(value);
                              if (!generic(theme)) return theme;
                              if (!generic(nome)) return nome;
                              return theme || nome || "Plan";
                            })(),
                            label: currentPlanStep(planReading)?.label ?? "",
                            focusRef: currentPlanStep(planReading)?.focusRef ?? "",
                            isFirst: isFirstPlanStep(planReading),
                            isLast: isLastPlanStep(planReading),
                            verseStart: currentPlanStep(planReading)?.verseStart ?? null,
                            verseEnd: currentPlanStep(planReading)?.verseEnd ?? null,
                            onPrev: planReadingPrev,
                            onAdvance: planReadingAdvance,
                          }
                        : null
                    }
                    onFlashcardCreated={handleFlashcardCreated}
                    onFlashcardRemoved={handleFlashcardRemovedFromBible}
                    existingVerseCardIds={verseCardIds}
                    existingVerseCardColors={verseCardColors}
                    onUpdateVerseCardColor={handleVerseCardColor}
                    onViewFlashcard={openVerseFlashcard}
                    onReadingChromeChange={setBibleChromeHidden}
                    themePref={themePref}
                    onCycleTheme={cycleTheme}
                    onVerseMarked={handleVerseMarked}
                    onBibleRead={(payload) => {
                      const logged = recordBibleRead({
                        ...payload,
                        userId: profile.id,
                      });
                      if (logged) setActivityTick((n) => n + 1);
                    }}
                    onReadingHistoryChange={() => {
                      setActivityTick((n) => n + 1);
                    }}
                  />
                </div>
                <div
                  id="panel-cards"
                  role="tabpanel"
                  aria-labelledby="tab-cards"
                  hidden={mode !== "cards"}
                  className="pane-body"
                >
                  <FlashcardDeck
                    key={activePlan?.id ?? "none"}
                    cards={cards}
                    active={mode === "cards"}
                    selectedId={cardFocusId}
                    focusSeq={cardFocusSeq}
                    splitLayout={splitLayout}
                    onRemoveCard={handleRemoveCard}
                    onReadChapter={openCardChapter}
                    onBackFromFocus={cardReturnToBible ? returnFromVerseFlashcard : undefined}
                  />
                </div>
                <div
                  id="panel-profile"
                  role="tabpanel"
                  aria-labelledby="tab-profile"
                  hidden={mode !== "profile"}
                  className="pane-body"
                >
                  <ProfileView
                    profile={profile}
                    themePref={themePref}
                    onThemePrefChange={setThemePreference}
                    onProfileSave={handleProfileSave}
                    activityTick={activityTick}
                    savedVerses={savedVerses}
                    flashcards={allFlashcards}
                    notionHealth={notionHealth}
                    onSyncNow={async () => {
                      const {
                        enqueuePendingVerseCreatesFromCatalog,
                        flushVerseCardCreates,
                        attachNotionUrlToCatalog,
                      } = await import("./verseCardSync");
                      const { pullCatalog } = await import("./catalogSync");
                      enqueuePendingVerseCreatesFromCatalog(catalogRef.current);
                      const push = await flushVerseCardCreates();
                      let base = catalogRef.current;
                      if (push.updates.length) {
                        for (const item of push.updates) {
                          base = attachNotionUrlToCatalog(base, item.localId, item.url);
                        }
                        setCatalog(base);
                        catalogRef.current = base;
                      }
                      const pulled = await pullCatalog(base);
                      if (pulled.ok && pulled.changed) {
                        setCatalog(pulled.catalog);
                        catalogRef.current = pulled.catalog;
                        setRetentionTick((v) => v + 1);
                      } else if (push.pushed) {
                        setRetentionTick((v) => v + 1);
                      }
                      if (push.error) throw new Error(push.error);
                    }}
                    onOpenVerse={(mark) => {
                      openPassageInBible(`${mark.bookId}.${mark.chapterId}.${mark.verse}`);
                    }}
                    onOpenFlashcard={(cardId) => {
                      const card = allFlashcards.find((item) => item.id === cardId);
                      if (card) {
                        openCardChapter(card);
                        return;
                      }
                      openVerseFlashcard(cardId);
                    }}
                    onOpenReading={({ bookId, chapterId, verse }) => {
                      const ref =
                        verse != null
                          ? `${bookId}.${chapterId}.${verse}`
                          : `${bookId}.${chapterId}`;
                      openPassageInBible(ref);
                    }}
                    onReadingHistoryChange={() => {
                      setActivityTick((n) => n + 1);
                    }}
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
