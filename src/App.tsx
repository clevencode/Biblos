import { useCallback, useEffect, useRef, useState } from "react";
import { BibleReaderView } from "./components/BibleReaderView";
import { AppShellNav } from "./components/AppShellNav";
import { HomeShellPanel } from "./components/HomeShellPanel";
import {
  PlanDiscoverPanel,
  flattenPlanSteps,
  resumeStepIndex,
} from "./features/reading-plans";
import type { ReadingPlan } from "./features/reading-plans";
import { usePlanReadingSession } from "./features/reading-plans/presentation/hooks/usePlanReadingSession";
import type { PlanFlowReturn } from "./features/reading-plans/presentation/PlanWorkspacePanel";
import { ProfileShellPanel } from "./components/ProfileShellPanel";
import { recordBibleRead, appendActivity } from "./activityLog";
import { consumeShareRefFromUrl } from "./shareVerse";
import { setVerseMarks } from "./verseMarks";
import {
  completeOnboarding,
  isProfileOnboarded,
  loadOrCreateProfile,
} from "./userProfile";
import {
  ProfileOnboarding,
  SignInModal,
  useConsumerAuth,
} from "./features/consumer-auth";
import { useNarrow } from "./layout";
import { BIBLE_COMPACT_TOOLS_MENU } from "./bible/bibleChromeLayout";
import {
  applyTheme,
  loadThemePref,
  nextThemePref,
  saveThemePref,
  watchSystemTheme,
  type ThemePref,
} from "./theme";
import { syncNativeChrome } from "./nativeChrome";
import { loadShellTab, saveShellTab, type ShellTab } from "./shellNav";
import type { BibleHistorySelect } from "./components/BibleHistorySheet";
import { EditorialAdminApp } from "./features/editorial-auth/presentation/EditorialAdminApp";
import {
  applyPendingSwUpdate,
  subscribeSwUpdate,
} from "./swUpdateManager";

type MarkPayload = {
  color: string;
  verses: number[];
  bookId: string;
  chapterId: string;
  bookTitle: string;
};

function isEditorialAdminRoute(): boolean {
  const hash = window.location.hash.replace(/^#/, "");
  return hash === "admin" || hash.startsWith("admin/");
}

function historyToFocusRef(ref: BibleHistorySelect): string {
  if (ref.verse != null) {
    return `${ref.bookId} ${ref.chapterId}.${ref.verse}`;
  }
  return `${ref.bookId} ${ref.chapterId}`;
}

export function App() {
  const [editorialAdmin, setEditorialAdmin] = useState(() => isEditorialAdminRoute());
  useEffect(() => {
    const onHash = () => setEditorialAdmin(isEditorialAdminRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (editorialAdmin) {
    return (
      <EditorialAdminApp
        onExit={() => {
          window.location.hash = "";
          setEditorialAdmin(false);
        }}
      />
    );
  }

  return <BiblosConsumerApp />;
}

function BiblosConsumerApp() {
  const narrow = useNarrow();
  const {
    user: firebaseUser,
    profile,
    refreshProfile,
  } = useConsumerAuth();
  const [tab, setTab] = useState<ShellTab>(() => loadShellTab());
  const [bibleMounted, setBibleMounted] = useState(() => loadShellTab() === "bible");
  const [navHidden, setNavHidden] = useState(false);
  const [themePref, setThemePref] = useState<ThemePref>(() => loadThemePref());
  const [bibleFocusRef, setBibleFocusRef] = useState<string | null>(null);
  const [bibleFocusSeq, setBibleFocusSeq] = useState(0);
  const [activityTick, setActivityTick] = useState(0);
  const [workspacePlan, setWorkspacePlan] = useState<ReadingPlan | null>(null);
  const [workspaceJour, setWorkspaceJour] = useState<number | undefined>();
  const [workspaceResumeSeq, setWorkspaceResumeSeq] = useState(0);
  const [offlineToast, setOfflineToast] = useState(false);
  const [swUpdatePending, setSwUpdatePending] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [nameGateOpen, setNameGateOpen] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(() =>
    isProfileOnboarded(loadOrCreateProfile()),
  );
  const [authorizedMarkSeq, setAuthorizedMarkSeq] = useState(0);
  const [authorizedMark, setAuthorizedMark] = useState<MarkPayload | null>(null);
  const pendingMarkRef = useRef<MarkPayload | null>(null);
  const pendingAfterAccountRef = useRef<(() => void) | null>(null);
  const offlineToastSeen = useRef(false);
  const shareBooted = useRef(false);

  const onboarded = isProfileOnboarded(profile) || onboardingDone;
  const accountReady = Boolean(firebaseUser) && onboarded;
  const showWelcomeOnboarding = Boolean(firebaseUser) && !onboarded && !nameGateOpen;

  const bibleMode = tab === "bible";
  const bibleCompactTools = BIBLE_COMPACT_TOOLS_MENU && narrow && bibleMode;

  useEffect(() => subscribeSwUpdate(setSwUpdatePending), []);

  useEffect(() => {
    if (tab === "bible") setBibleMounted(true);
    saveShellTab(tab);
  }, [tab]);

  useEffect(() => {
    applyTheme(themePref);
    const stop = watchSystemTheme(() => applyTheme(themePref));
    return stop;
  }, [themePref]);

  useEffect(() => {
    void syncNativeChrome(applyTheme(themePref));
  }, [themePref]);

  useEffect(() => {
    if (shareBooted.current) return;
    shareBooted.current = true;
    const ref = consumeShareRefFromUrl();
    if (ref) {
      setTab("bible");
      setBibleFocusRef(ref);
      setBibleFocusSeq((n) => n + 1);
    }
  }, []);

  useEffect(() => {
    function onOffline() {
      if (offlineToastSeen.current) return;
      offlineToastSeen.current = true;
      setOfflineToast(true);
      window.setTimeout(() => setOfflineToast(false), 4200);
    }
    window.addEventListener("offline", onOffline);
    return () => window.removeEventListener("offline", onOffline);
  }, []);

  useEffect(() => {
    if (!bibleMode) setNavHidden(false);
  }, [bibleMode]);

  const selectTab = useCallback((next: ShellTab) => {
    setTab(next);
  }, []);

  const openBible = useCallback((ref?: string) => {
    if (ref) {
      setBibleFocusRef(ref);
      setBibleFocusSeq((n) => n + 1);
    }
    setTab("bible");
  }, []);

  const { openPlanAtJour, planReading, clearPlan } = usePlanReadingSession({
    onNavigate: (ref) => openBible(ref),
  });

  const openPlanWorkspace = useCallback((plan: ReadingPlan) => {
    const flat = flattenPlanSteps(plan);
    const idx = resumeStepIndex(plan);
    setWorkspacePlan(plan);
    setWorkspaceJour(flat[idx]?.jour ?? flat[0]?.jour);
  }, []);

  const leavePlanWorkspace = useCallback(() => {
    setWorkspacePlan(null);
    setWorkspaceJour(undefined);
  }, []);

  const returnFromPlanReading = useCallback(() => {
    const jour = clearPlan();
    if (typeof jour === "number") setWorkspaceJour(jour);
    setTab("today");
    setWorkspaceResumeSeq((n) => n + 1);
  }, [clearPlan]);

  const startPlanReadingFromWorkspace = useCallback(
    (jour: number, _passage: string, _opts?: { returnTo?: PlanFlowReturn }) => {
      if (!workspacePlan) return;
      openPlanAtJour(workspacePlan, jour);
      setTab("bible");
    },
    [openPlanAtJour, workspacePlan],
  );

  const cycleTheme = useCallback(() => {
    const next = nextThemePref(themePref);
    setThemePref(next);
    saveThemePref(next);
    appendActivity("theme.change", { pref: next }, profile.id);
    setActivityTick((n) => n + 1);
  }, [profile.id, themePref]);

  function handleVerseMarked(payload: {
    color: string | null;
    verses: number[];
    bookId: string;
    chapterId: string;
    bookTitle: string;
  }) {
    const { color, verses, bookId, chapterId } = payload;
    if (!verses.length) return;
    setVerseMarks(bookId, chapterId, verses, color);
    if (color) {
      appendActivity(
        "verse.mark",
        { color, verseCount: verses.length },
        profile.id,
      );
      setActivityTick((n) => n + 1);
    }
  }

  function authorizeMark(payload: MarkPayload) {
    setAuthorizedMark(payload);
    setAuthorizedMarkSeq((value) => value + 1);
    setTab("bible");
  }

  function requestAccountForMark(payload: MarkPayload) {
    pendingMarkRef.current = payload;
    if (!firebaseUser) {
      setSignInOpen(true);
      return;
    }
    if (!isProfileOnboarded(profile)) {
      setNameGateOpen(true);
      return;
    }
    authorizeMark(payload);
  }

  function finishOnboarding(input: {
    firstName: string;
    lastName: string;
    preferredName: string;
  }) {
    completeOnboarding(input);
    refreshProfile();
    setOnboardingDone(true);
    setNameGateOpen(false);
    const pendingMark = pendingMarkRef.current;
    pendingMarkRef.current = null;
    if (pendingMark) {
      authorizeMark(pendingMark);
    }
    const pending = pendingAfterAccountRef.current;
    pendingAfterAccountRef.current = null;
    pending?.();
  }

  function cancelNameGate() {
    setNameGateOpen(false);
    pendingMarkRef.current = null;
  }

  useEffect(() => {
    if (!firebaseUser) {
      setOnboardingDone(false);
      return;
    }
    setOnboardingDone(isProfileOnboarded(loadOrCreateProfile()));
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser || !isProfileOnboarded(profile)) return;
    const pendingMark = pendingMarkRef.current;
    pendingMarkRef.current = null;
    if (pendingMark) {
      authorizeMark(pendingMark);
    }
    const pending = pendingAfterAccountRef.current;
    pendingAfterAccountRef.current = null;
    pending?.();
  }, [firebaseUser, profile]);

  return (
    <div
      className={`app biblos-shell skeleton-theme${
        narrow ? " is-narrow" : ""
      }${bibleMode ? " is-bible-mode" : ""}${bibleCompactTools ? " is-bible-compact-tools" : ""}`}
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
          initialFullName={
            profile.preferredName || firebaseUser?.displayName || ""
          }
          onComplete={finishOnboarding}
          onCancel={cancelNameGate}
        />
      ) : null}
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
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
      {swUpdatePending && !bibleMode ? (
        <div className="offline-toast sw-update-toast" role="status" aria-live="polite">
          <p>Nouvelle version disponible</p>
          <button
            type="button"
            className="offline-toast-dismiss"
            onClick={() => void applyPendingSwUpdate()}
          >
            Mettre à jour
          </button>
        </div>
      ) : null}

      <main id="workspace" className={`workspace${narrow ? " is-mobile-vista" : ""}`}>
        <div className="note-shell">
          <div className="note-shell-main">
            <section className="graph-pane" aria-label="Contenu">
              <div className="graph-pane-body">
                <HomeShellPanel
                  active={tab === "home"}
                  activityTick={activityTick}
                  onOpenBible={(ref) => openBible(ref)}
                  onOpenPlan={() => selectTab("today")}
                />
                <PlanDiscoverPanel
                  active={tab === "today"}
                  workspacePlan={workspacePlan}
                  workspaceJour={workspaceJour}
                  workspaceResumeSeq={workspaceResumeSeq}
                  onOpenBible={() => selectTab("bible")}
                  onSelectPlan={openPlanWorkspace}
                  onLeaveWorkspace={leavePlanWorkspace}
                  onStartPlanReading={startPlanReadingFromWorkspace}
                />
                <div
                  id="panel-bible"
                  role="tabpanel"
                  aria-labelledby="tab-bible"
                  hidden={!bibleMode}
                  className="pane-body"
                >
                  {bibleMounted ? (
                    <BibleReaderView
                      initialRef="Jean 3.16"
                      focusRef={bibleFocusRef}
                      focusSeq={bibleFocusSeq}
                      active={bibleMode}
                      compactViewport={narrow}
                      themePref={themePref}
                      onCycleTheme={cycleTheme}
                      planReading={bibleMode ? planReading : null}
                      onBack={planReading ? returnFromPlanReading : undefined}
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
                      onReadingHistoryChange={() => setActivityTick((n) => n + 1)}
                      onReadingChromeChange={narrow ? setNavHidden : undefined}
                      compactToolsMenu={bibleCompactTools}
                    />
                  ) : null}
                </div>
                <ProfileShellPanel
                  active={tab === "profile"}
                  activityTick={activityTick}
                  themePref={themePref}
                  onCycleTheme={cycleTheme}
                  onOpenPassage={(ref) => openBible(historyToFocusRef(ref))}
                  onHistoryChange={() => setActivityTick((n) => n + 1)}
                  onRequestSignIn={() => setSignInOpen(true)}
                />
              </div>
            </section>
            <AppShellNav
              active={tab}
              onSelect={selectTab}
              immersiveHidden={bibleMode && navHidden}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
