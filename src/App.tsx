import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Capacitor } from "@capacitor/core";
import seed from "./data/seed.json";
import { FlashcardDeck } from "./components/FlashcardDeck";
import { ModeTabIcon } from "./components/ModeTabIcon";
import { FirebaseConfigGate } from "./components/FirebaseConfigGate";
import { SignInModal } from "./components/SignInModal";
import { ProfileOnboarding } from "./components/ProfileOnboarding";
import { useAuth } from "./hooks/useAuth";
import { useAppReadiness } from "./context/AppReadinessContext";
import { useUserCloudSync } from "./hooks/useUserCloudSync";
import { runUserCloudSync } from "./firebase/syncSession";
import { ProfileView } from "./components/ProfileView";
import { hasPrivacyAck, savePrivacyAck } from "./components/PrivacyLegal";
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
  applyFirebaseAuthUser,
  clearFirebaseFromProfile,
  completeOnboarding,
  isFirebaseSignedIn,
  isProfileOnboarded,
  loadOrCreateProfile,
  preferredDisplayName,
  saveUserProfile,
  type UserProfile,
} from "./userProfile";
import { syncUserProfileToCloud, startPresenceAndUsageSync } from "./userProfileSync";
import { startAppUsageTracking } from "./appUsage";
import {
  listAllFlashcards,
  planCardIds,
} from "./catalog";
import { mergeCard } from "./cardOverrides";
import {
  hydrateCatalogFromCache,
  loadCatalogFromCache,
  persistCatalogCache,
  removeCardFromCatalog,
} from "./catalogSync";
import { ensureLocalMarksInCatalog } from "./verseLocalCatalog";
import {
  calendarJour,
  ensurePlanStart,
  ensureDayCompleted,
  latestPlanJour,
  loadPlanProgress,
  markDayRead,
  resetPlanProgress,
} from "./planProgress";
import { sanitizePlanDays, stageForJour } from "./plan";
import { loadDayNote } from "./planDayNote";
import {
  createPlanReadingSession,
  currentPlanStep,
  isFirstPlanStep,
  isLastPlanStep,
  type PlanReadingReturnTo,
  type PlanReadingSession,
} from "./planReading";
import { useCmsSync } from "./useCmsSync";
import {
  countUnreadAppNotifications,
  syncContextualNotifications,
} from "./appNotifications";
import { useNarrow, useSplitLayout } from "./layout";
import { BIBLE_COMPACT_TOOLS_MENU } from "./bible/bibleChromeLayout";
import { chapterFocusFromRef, isPassageRef } from "./youversion/usfm";
import { syncNativeChrome } from "./nativeChrome";
import { consumePlanShareFromUrl, consumeShareRefFromUrl } from "./shareVerse";
import {
  applyTheme,
  loadThemePref,
  nextThemePref,
  saveThemePref,
  watchSystemTheme,
  type ThemePref,
} from "./theme";
import {
  ALL_SHELL_TABS,
  coerceShellMode,
  DEFAULT_SHELL_MODE,
  isShellTabEnabled,
  visibleShellTabs,
} from "./appShellConfig";

const UI_KEY = "biblos-ui";
const seedCatalog = hydrateCatalogFromCache(seed as Catalog);
const shellTabs = visibleShellTabs();

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
  return ALL_SHELL_TABS.some((item) => item.id === value);
}

function resolveInitialMode(session: UiSession): CenterMode {
  const value = session.mode as string | undefined;
  if (value === "calendar" || value === "inbox") return DEFAULT_SHELL_MODE;
  if (isMode(value)) return coerceShellMode(value);
  return DEFAULT_SHELL_MODE;
}

export function App() {
  const { user: firebaseUser, signOut: signOutGoogle, loading: authLoading } = useAuth();
  const { setAuthLoading } = useAppReadiness();

  useEffect(() => {
    setAuthLoading(authLoading);
  }, [authLoading, setAuthLoading]);
  const initialUi = readUi();
  const [catalog, setCatalog] = useState<Catalog>(() => seedCatalog);
  const notes = catalog.notas;
  const plans = catalog.plans;
  const [mode, setMode] = useState<CenterMode>(() => resolveInitialMode(initialUi));
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [bibleMounted, setBibleMounted] = useState(
    () => resolveInitialMode(initialUi) === "bible",
  );
  useEffect(() => {
    if (mode === "bible") setBibleMounted(true);
  }, [mode]);
  const [homeMounted, setHomeMounted] = useState(
    () => isShellTabEnabled("home") && resolveInitialMode(initialUi) === "home",
  );
  const [profileMounted, setProfileMounted] = useState(
    () => resolveInitialMode(initialUi) === "profile",
  );
  useEffect(() => {
    if (isShellTabEnabled("home") && mode === "home") setHomeMounted(true);
    if (mode === "profile") setProfileMounted(true);
  }, [mode]);

  const selectMode = useCallback((next: CenterMode) => {
    const target = coerceShellMode(next);
    setMode((prev) => (prev === target ? prev : target));
  }, []);
  /** Sous l’onglet Plan : détail du jour vs liste. */
  const [planDay, setPlanDay] = useState(
    () => initialUi.mode === "today" && initialUi.home === false,
  );
  const [planId, setPlanId] = useState(() => initialUi.planId ?? plans[0]?.id ?? "");
  const [planProgressTick, setPlanProgressTick] = useState(0);
  const [offlineToast, setOfflineToast] = useState(false);
  const offlineToastSeen = useRef(false);
  const narrow = useNarrow();
  const bibleCompactTools = BIBLE_COMPACT_TOOLS_MENU && narrow && mode === "bible";
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
  const shareBooted = useRef(false);
  const pendingPlanShareRef = useRef<string | null>(null);
  const [nameGateOpen, setNameGateOpen] = useState(false);
  const pendingMarkRef = useRef<{
    color: string;
    verses: number[];
    bookId: string;
    chapterId: string;
    bookTitle: string;
  } | null>(null);
  const [authorizedMarkSeq, setAuthorizedMarkSeq] = useState(0);
  const [authorizedMark, setAuthorizedMark] = useState<{
    color: string;
    verses: number[];
    bookId: string;
    chapterId: string;
    bookTitle: string;
  } | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const pendingAfterAccountRef = useRef<(() => void) | null>(null);
  const [onboardingDone, setOnboardingDone] = useState(() =>
    isProfileOnboarded(loadOrCreateProfile()),
  );
  const [planReading, setPlanReading] = useState<PlanReadingSession | null>(null);
  const [dayNoteFocus, setDayNoteFocus] = useState<{ jour: number; seq: number } | null>(null);
  const [planIntroFocus, setPlanIntroFocus] = useState<{ seq: number } | null>(null);
  const [planResumeSeq, setPlanResumeSeq] = useState(0);
  const [retentionTick, setRetentionTick] = useState(0);
  const [themePref, setThemePref] = useState<ThemePref>(() => loadThemePref());
  const [profile, setProfile] = useState<UserProfile>(() => loadOrCreateProfile());
  useUserCloudSync(profile);
  const [activityTick, setActivityTick] = useState(0);
  const openedLogged = useRef(false);

  const accountReady =
    Boolean(firebaseUser) && isProfileOnboarded(profile);

  function ensureAccountReady(run: () => void): boolean {
    if (!firebaseUser) {
      pendingAfterAccountRef.current = run;
      setSignInOpen(true);
      return false;
    }
    if (!isProfileOnboarded(profile)) {
      pendingAfterAccountRef.current = run;
      return false;
    }
    run();
    return true;
  }

  function requestAccountForMark(payload: {
    color: string;
    verses: number[];
    bookId: string;
    chapterId: string;
    bookTitle: string;
  }) {
    pendingMarkRef.current = payload;
    if (!firebaseUser) {
      setSignInOpen(true);
      return;
    }
    if (!isProfileOnboarded(profile)) {
      setNameGateOpen(true);
      return;
    }
    setAuthorizedMark(payload);
    setAuthorizedMarkSeq((value) => value + 1);
    selectMode("bible");
  }

  useEffect(() => {
    if (!firebaseUser) return;
    if (pendingMarkRef.current && !isProfileOnboarded(profile)) {
      setNameGateOpen(true);
    }
    const pending = pendingAfterAccountRef.current;
    if (pending && isProfileOnboarded(profile)) {
      pendingAfterAccountRef.current = null;
      pending();
    }
  }, [
    firebaseUser?.uid,
    profile.onboardedAt,
    profile.firstName,
    profile.firebaseUid,
  ]);

  useEffect(() => {
    if (!firebaseUser?.uid) return;
    const merged = applyFirebaseAuthUser(firebaseUser);
    setProfile(merged);
    if (isProfileOnboarded(merged)) {
      setOnboardingDone(true);
    }
  }, [firebaseUser?.uid, firebaseUser?.email, firebaseUser?.displayName]);

  // Entrée directe : pas d’écran Confidentialité — ack + prefs par défaut au boot.
  useEffect(() => {
    if (!hasPrivacyAck()) savePrivacyAck();
    ensureNotificationPrefsIfPrivacyAccepted(true);
  }, []);

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
    const stopPresence = startPresenceAndUsageSync((next) => applySyncedProfile(next), {
      pauseWhile: () => Capacitor.isNativePlatform() && modeRef.current === "bible",
    });
    const stopUsage = startAppUsageTracking(() => {
      void syncUserProfileToCloud(undefined, { presence: "Online" }).then((result) => {
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
      if (!isFirebaseSignedIn(loadOrCreateProfile())) return;
      void runUserCloudSync({ push: true, pull: true, presence: "Online" }).then(() => {
        applySyncedProfile(loadOrCreateProfile());
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
    function onStatePulled() {
      setPlanProgressTick((v) => v + 1);
      setRetentionTick((v) => v + 1);
      const cached = loadCatalogFromCache();
      if (cached) {
        setCatalog(() => {
          const merged = ensureLocalMarksInCatalog(cached);
          catalogRef.current = merged;
          return merged;
        });
      }
    }
    window.addEventListener("biblos-user-state-pulled", onStatePulled);
    return () => window.removeEventListener("biblos-user-state-pulled", onStatePulled);
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
    setNameGateOpen(false);

    const pendingMark = pendingMarkRef.current;
    pendingMarkRef.current = null;
    if (pendingMark) {
      setAuthorizedMark(pendingMark);
      setAuthorizedMarkSeq((value) => value + 1);
      selectMode("bible");
    }
    const pending = pendingAfterAccountRef.current;
    pendingAfterAccountRef.current = null;
    pending?.();
    void syncUserProfileToCloud(next).then((result) => {
      applySyncedProfile(result.profile);
    });
  }

  function cancelNameGate() {
    pendingMarkRef.current = null;
    setNameGateOpen(false);
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
    void syncUserProfileToCloud(next).then((result) => {
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

  const allFlashcards = useMemo(
    () => listAllFlashcards(notes, null).map(mergeCard),
    [notes, retentionTick],
  );

  function openVerseFlashcard(cardId: string) {
    if (!isShellTabEnabled("cards")) {
      const card = allFlashcards.find((item) => item.id === cardId);
      if (card) openCardChapter(card);
      return;
    }
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
    selectMode("cards");
    setCardFocusId(cardId);
    setCardFocusSeq((value) => value + 1);
  }

  function returnFromVerseFlashcard() {
    setCardReturnToBible(false);
    setCardFocusId(null);
    selectMode("bible");
  }

  const savedVerses = useMemo(() => {
    void activityTick;
    void retentionTick;
    return listAllVerseMarks();
  }, [activityTick, retentionTick]);

  const activeCardsCount = useMemo(
    () => cards.filter((card) => card.status !== "encerrado").length,
    [cards],
  );

  const [homeUnread, setHomeUnread] = useState(0);

  useEffect(() => {
    if (!isShellTabEnabled("home")) return;
    syncContextualNotifications(plans);
    setHomeUnread(countUnreadAppNotifications());
    const id = window.setInterval(() => {
      setHomeUnread(countUnreadAppNotifications());
    }, 15_000);
    return () => window.clearInterval(id);
  }, [plans, planProgressTick]);

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

  const { cmsHealth, cmsPulling, refreshCatalog } = useCmsSync({
    catalog,
    setCatalog,
    modeRef,
    activePlan,
  });

  useEffect(() => {
    if (mode !== "today" || planDay) return;
    void refreshCatalog({ force: true });
  }, [mode, planDay, refreshCatalog]);

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
    const session: UiSession = {
      home: mode === "today" ? !planDay : undefined,
      mode,
      planId: activePlan?.id,
    };
    const id = window.setTimeout(() => writeUi(session), 200);
    return () => window.clearTimeout(id);
  }, [activePlan?.id, mode, planDay]);

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
    selectMode("today");
  }

  function goHome() {
    selectMode(isShellTabEnabled("home") ? "home" : "today");
  }

  function pickPlan(plan: ReadingPlan) {
    setPlanId(plan.id);
    setPlanDay(true);
    selectMode("today");
  }

  function openPassageInBible(reference: string, opts?: { keepPlanReading?: boolean }) {
    const ref = reference.trim();
    if (!ref) return;
    if (!opts?.keepPlanReading) setPlanReading(null);
    setBibleFocusRef(ref);
    setBibleFocusSeq((value) => value + 1);
    selectMode("bible");
  }

  useEffect(() => {
    if (shareBooted.current) return;
    shareBooted.current = true;
    pendingPlanShareRef.current = consumePlanShareFromUrl();
    const ref = consumeShareRefFromUrl();
    if (ref) openPassageInBible(ref);
    // Boot-only: capture share deep-link once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const pending = pendingPlanShareRef.current;
    if (!pending || !plans.length) return;
    const needle = pending.replace(/^plan-/i, "").toLowerCase();
    const match =
      plans.find((plan) => plan.id === pending) ||
      plans.find((plan) => plan.id.replace(/^plan-/i, "").toLowerCase() === needle);
    if (!match) return;
    pendingPlanShareRef.current = null;
    pickPlan(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans]);

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
    selectMode("today");
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
      selectMode("today");
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
          selectMode("today");
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
    ensureAccountReady(() => {
      markDayRead(activePlan.id, jour);
      setPlanProgressTick((value) => value + 1);
      appendActivity(
        "plan.day_read",
        { planId: activePlan.id, jour },
        profile.id,
      );
      setActivityTick((n) => n + 1);
    });
  }

  function handleRestartPlan() {
    if (!activePlan) return;
    ensureAccountReady(() => {
      resetPlanProgress(activePlan.id);
      setPlanProgressTick((value) => value + 1);
    });
  }

  function handleFlashcardCreated(card: Flashcard) {
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
      setCatalog((current) => removeCardFromCatalog(current, cardId));
      setRetentionTick((value) => value + 1);
    }
  }

  function handleRemoveCard(card: Flashcard) {
    ensureAccountReady(() => {
      const label = card.frente?.trim() || "cette carte";
      if (!window.confirm(`Supprimer « ${label} » ?`)) return;
      setCatalog((current) => removeCardFromCatalog(current, card.id));
      setRetentionTick((value) => value + 1);
    });
  }

  function onTabKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const items = shellTabs.map((item) => item.id);
    const index = Math.max(0, items.indexOf(mode));
    const next = items[(index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length];
    selectMode(next);
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

  const homePanel = isShellTabEnabled("home") ? (
    <HomeView
      profile={profile}
      plans={plans}
      progressTick={planProgressTick}
      active={mode === "home"}
      onOpenPlan={pickPlan}
      onBrowsePlans={goGalerie}
      onOpenVerse={(reference) => openPassageInBible(reference)}
    />
  ) : null;

  const onboarded = onboardingDone || isProfileOnboarded(profile);
  const showWelcomeOnboarding =
    Boolean(firebaseUser) && !onboarded && !nameGateOpen;

  return (
    <FirebaseConfigGate>
      <div
        className={`app biblos-shell${narrow ? " is-narrow" : ""}${mode === "bible" ? " is-bible-mode" : ""}${bibleCompactTools ? " is-bible-compact-tools" : ""}`}
      >
        <a className="skip" href="#workspace">
          Aller au contenu
        </a>
        {showWelcomeOnboarding ? (
          <ProfileOnboarding
            variant="welcome"
            initialFullName={firebaseUser?.displayName?.trim() || ""}
            onComplete={finishOnboarding}
          />
        ) : null}
        {!onboarded && nameGateOpen ? (
          <ProfileOnboarding
            variant="mark"
            initialFullName={profile.preferredName || firebaseUser?.displayName || ""}
            onComplete={finishOnboarding}
            onCancel={cancelNameGate}
          />
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
            <div className="mode-tabs">
              <div
                className="mode-tabs-nav"
                role="tablist"
                aria-label="Vues"
                onKeyDown={onTabKey}
              >
                {shellTabs.map((item) => {
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
                        isShellTabEnabled("cards") &&
                        item.id === "cards" &&
                        activeCardsCount
                          ? `${item.label}, ${activeCardsCount} carte${activeCardsCount === 1 ? "" : "s"} active${activeCardsCount === 1 ? "" : "s"}`
                          : isShellTabEnabled("home") &&
                              item.id === "home" &&
                              homeUnread
                            ? `${item.label}, ${homeUnread} notification${homeUnread === 1 ? "" : "s"}`
                            : item.label
                      }
                      title={item.label}
                      tabIndex={on ? 0 : -1}
                      onClick={() => selectMode(item.id)}
                    >
                      <ModeTabIcon name={item.id} active={on} />
                      <span className="mode-tab-label">{item.label}</span>
                      {isShellTabEnabled("cards") &&
                      item.id === "cards" &&
                      activeCardsCount ? (
                        <span className="mode-tab-badge" aria-hidden="true">
                          {activeCardsCount}
                        </span>
                      ) : null}
                      {isShellTabEnabled("home") && item.id === "home" && homeUnread > 0 ? (
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
                {isShellTabEnabled("home") ? (
                <div
                  id="panel-home"
                  role="tabpanel"
                  aria-labelledby="tab-home"
                  hidden={mode !== "home"}
                  className="pane-body"
                >
                  {homeMounted ? homePanel : null}
                </div>
                ) : null}
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
                      onRefresh={() => {
                        void refreshCatalog({ force: true });
                      }}
                      refreshBusy={cmsPulling}
                      cmsHealth={cmsHealth}
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
                  {bibleMounted ? (
                  <BibleReaderView
                    initialRef="Jean 3.16"
                    focusRef={bibleFocusRef}
                    focusSeq={bibleFocusSeq}
                    active={mode === "bible"}
                    compactViewport={narrow}
                    onBack={planReading ? exitPlanReading : () => {
                      if (planDay) selectMode("today");
                      else goHome();
                    }}
                    planReading={
                      planReading && activePlan
                        ? {
                            planName: (() => {
                              const step = currentPlanStep(planReading);
                              const stage = step
                                ? stageForJour(activePlan.stages, step.jour)
                                : undefined;
                              if (stage) {
                                const title = stage.title.trim();
                                if (/^[ée]tape\s+\d+/i.test(title)) return title;
                                return title
                                  ? `Étape ${stage.id} · ${title}`
                                  : `Étape ${stage.id}`;
                              }
                              const theme = activePlan.theme?.trim() ?? "";
                              const nome = activePlan.nome?.trim() ?? "";
                              const generic = (value: string) => !value || /^plan$/i.test(value);
                              if (!generic(theme)) return theme;
                              if (!generic(nome)) return nome;
                              return theme || nome || "Plan";
                            })(),
                            planShareTitle: (() => {
                              const theme = activePlan.theme?.trim() ?? "";
                              const nome = activePlan.nome?.trim() ?? "";
                              const generic = (value: string) => !value || /^plan$/i.test(value);
                              if (!generic(theme)) return theme;
                              if (!generic(nome)) return nome;
                              return theme || nome || "Plan de lecture";
                            })(),
                            planDescription: activePlan.description ?? "",
                            planShareId: activePlan.id,
                            planMeta: (() => {
                              const dayCount = sanitizePlanDays(activePlan.days).length;
                              const stageCount = activePlan.stages?.length ?? 0;
                              const parts: string[] = [];
                              if (dayCount > 0) {
                                parts.push(`${dayCount} jour${dayCount > 1 ? "s" : ""}`);
                              }
                              if (stageCount > 0) {
                                parts.push(
                                  `${stageCount} étape${stageCount > 1 ? "s" : ""}`,
                                );
                              }
                              return parts.join(" · ");
                            })(),
                            label: currentPlanStep(planReading)?.label ?? "",
                            focusRef: currentPlanStep(planReading)?.focusRef ?? "",
                            isFirst: isFirstPlanStep(planReading),
                            isLast: isLastPlanStep(planReading),
                            stepIndex: planReading.index,
                            stepCount: planReading.steps.length,
                            verseStart: currentPlanStep(planReading)?.verseStart ?? null,
                            verseEnd: currentPlanStep(planReading)?.verseEnd ?? null,
                            onPrev: planReadingPrev,
                            onAdvance: planReadingAdvance,
                          }
                        : null
                    }
                    onFlashcardCreated={handleFlashcardCreated}
                    existingVerseCardIds={verseCardIds}
                    existingVerseCardColors={verseCardColors}
                    onUpdateVerseCardColor={handleVerseCardColor}
                    onViewFlashcard={openVerseFlashcard}
                    themePref={themePref}
                    onCycleTheme={cycleTheme}
                    requireNameToMark={!accountReady}
                    onRequestNameToMark={requestAccountForMark}
                    authorizedMarkSeq={authorizedMarkSeq}
                    authorizedMark={authorizedMark}
                    onAuthorizedMarkConsumed={() => setAuthorizedMark(null)}
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
                    compactToolsMenu={bibleCompactTools}
                  />
                  ) : null}
                </div>
                {isShellTabEnabled("cards") ? (
                <div
                  id="panel-cards"
                  role="tabpanel"
                  aria-labelledby="tab-cards"
                  hidden={mode !== "cards"}
                  className="pane-body"
                >
                  <FlashcardDeck
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
                ) : null}
                <div
                  id="panel-profile"
                  role="tabpanel"
                  aria-labelledby="tab-profile"
                  hidden={mode !== "profile"}
                  className="pane-body"
                >
                  <h2 id="profile-shell-title" className="sr-only">
                    Profil
                  </h2>
                  {profileMounted ? (
                  <ProfileView
                    profile={profile}
                    signedIn={Boolean(firebaseUser)}
                    accountReady={accountReady}
                    onRequestSignIn={() => setSignInOpen(true)}
                    active={mode === "profile"}
                    themePref={themePref}
                    onThemePrefChange={setThemePreference}
                    onProfileSave={(input) => {
                      ensureAccountReady(() => handleProfileSave(input));
                    }}
                    activityTick={activityTick}
                    savedVerses={savedVerses}
                    flashcards={allFlashcards}
                    cmsHealth={cmsHealth}
                    onSyncNow={async () => {
                      if (!accountReady) {
                        setSignInOpen(true);
                        throw new Error("Connexion requise");
                      }
                      const { pullCatalog } = await import("./catalogSync");
                      const cloud = await runUserCloudSync({
                        push: true,
                        pull: true,
                        presence: "Online",
                      });
                      if (cloud.errors.length) throw new Error(cloud.errors[0]);
                      const result = await pullCatalog(catalogRef.current);
                      if (result.ok) {
                        setCatalog(result.catalog);
                        catalogRef.current = result.catalog;
                      }
                      setPlanProgressTick((v) => v + 1);
                      setRetentionTick((v) => v + 1);
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
                    onSignOut={async () => {
                      await signOutGoogle();
                      clearFirebaseFromProfile();
                      window.location.reload();
                    }}
                  />
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </FirebaseConfigGate>
  );
}
