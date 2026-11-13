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
import {
  isOverFreeMarkQuota,
  setVerseMarks,
  subscribeVerseMarksRevision,
} from "./verseMarks";
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
import { useUiLocale } from "./i18n/UiLocaleContext";
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
import type { BibleTextVersionId } from "./bible/bibleVersions";
import {
  languageForVersion,
  versionBadgeFor,
} from "./bible/readingScope";
import { EditorialAdminApp } from "./features/editorial-auth/presentation/EditorialAdminApp";
import {
  applyPendingSwUpdate,
  subscribeSwUpdate,
} from "./swUpdateManager";
import {
  isFirstInstallPackReady,
  runFirstInstallPack,
  type FirstInstallProgress,
} from "./offline/firstInstallPack";

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

function openHistoryPassage(
  ref: BibleHistorySelect,
  open: (passage: string, versionId?: BibleTextVersionId) => void,
) {
  open(historyToFocusRef(ref), ref.versionId);
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
  const { t } = useUiLocale();
  const {
    profile,
    refreshProfile,
    isAuthenticated,
    session,
  } = useConsumerAuth();
  const [tab, setTab] = useState<ShellTab>(() => loadShellTab());
  const [bibleMounted, setBibleMounted] = useState(() => loadShellTab() === "bible");
  const [navHidden, setNavHidden] = useState(false);
  const [themePref, setThemePref] = useState<ThemePref>(() => loadThemePref());
  const [bibleFocusRef, setBibleFocusRef] = useState<string | null>(null);
  const [bibleFocusVersion, setBibleFocusVersion] =
    useState<BibleTextVersionId | null>(null);
  const [bibleFocusSeq, setBibleFocusSeq] = useState(0);
  const [activityTick, setActivityTick] = useState(0);
  const [workspacePlan, setWorkspacePlan] = useState<ReadingPlan | null>(null);
  const [workspaceJour, setWorkspaceJour] = useState<number | undefined>();
  const [workspaceResumeSeq, setWorkspaceResumeSeq] = useState(0);
  const [offlineToast, setOfflineToast] = useState(false);
  const [markSavedToast, setMarkSavedToast] = useState(false);
  const [swUpdatePending, setSwUpdatePending] = useState(false);
  const [firstInstallNeeded, setFirstInstallNeeded] = useState(false);
  const [firstInstallBusy, setFirstInstallBusy] = useState(false);
  const [firstInstallProgress, setFirstInstallProgress] =
    useState<FirstInstallProgress | null>(null);
  const [firstInstallError, setFirstInstallError] = useState<string | null>(
    null,
  );
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInVariant, setSignInVariant] = useState<"upgrade" | "soft_gate">(
    "upgrade",
  );
  const [showWelcomeOnboarding, setShowWelcomeOnboarding] = useState(false);
  const [authorizedMarkSeq, setAuthorizedMarkSeq] = useState(0);
  const [authorizedMark, setAuthorizedMark] = useState<MarkPayload | null>(null);
  const [markQuotaHit, setMarkQuotaHit] = useState(() => isOverFreeMarkQuota());
  const pendingMarkRef = useRef<MarkPayload | null>(null);
  const offlineToastSeen = useRef(false);
  const shareBooted = useRef(false);
  const welcomeShownRef = useRef(false);

  /** Soft gate: após cota, guest precisa de conta — nunca durante boot auth. */
  const authReady = session.status !== "initializing";
  const requireAccountToMark =
    authReady && !isAuthenticated && markQuotaHit;

  const bibleMode = tab === "bible";
  const bibleCompactTools = BIBLE_COMPACT_TOOLS_MENU && narrow && bibleMode;

  useEffect(() => subscribeSwUpdate(setSwUpdatePending), []);

  useEffect(() => {
    let cancelled = false;
    void isFirstInstallPackReady().then((ready) => {
      if (!cancelled) setFirstInstallNeeded(!ready);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function handleFirstInstall() {
    if (firstInstallBusy) return;
    setFirstInstallBusy(true);
    setFirstInstallError(null);
    try {
      await runFirstInstallPack((p) => setFirstInstallProgress(p));
      setFirstInstallNeeded(false);
      setFirstInstallProgress(null);
    } catch {
      setFirstInstallError(t("install.error"));
    } finally {
      setFirstInstallBusy(false);
    }
  }

  function firstInstallMeta(): string {
    if (firstInstallError) return firstInstallError;
    const p = firstInstallProgress;
    if (!p || p.phase === "done") return t("install.bannerLead");
    if (p.phase === "plans") return t("install.phase.plans");
    if (p.phase === "s21") {
      return t("install.phase.s21", { done: p.done, total: p.total });
    }
    if (p.phase === "ht98") {
      return t("install.phase.ht98", { done: p.done, total: p.total });
    }
    if (p.phase === "tske") {
      return t("install.phase.tske", { done: p.done, total: p.total });
    }
    return t("install.bannerLead");
  }

  const selectTab = useCallback((next: ShellTab) => {
    setTab(next);
  }, []);

  const openBible = useCallback(
    (ref?: string, versionId?: BibleTextVersionId) => {
      if (ref) {
        setBibleFocusRef(ref);
        setBibleFocusVersion(versionId ?? null);
        setBibleFocusSeq((n) => n + 1);
      }
      setTab("bible");
    },
    [],
  );

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

  const setTheme = useCallback(
    (pref: "light" | "dark") => {
      setThemePref(pref);
      saveThemePref(pref);
      appendActivity("theme.change", { pref }, profile.id);
      setActivityTick((n) => n + 1);
    },
    [profile.id],
  );

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
    setSignInVariant("soft_gate");
    setSignInOpen(true);
  }

  function finishOnboarding(input: {
    firstName: string;
    lastName: string;
    preferredName: string;
  }) {
    completeOnboarding(input);
    refreshProfile();
    setShowWelcomeOnboarding(false);
  }

  function handleSignInClose() {
    setSignInOpen(false);
    // « Plus tard » après cote : ne pas appliquer la marque
    if (!isAuthenticated) {
      pendingMarkRef.current = null;
    }
  }

  function handleSignedIn() {
    const pendingMark = pendingMarkRef.current;
    pendingMarkRef.current = null;
    if (pendingMark) {
      authorizeMark(pendingMark);
      setMarkSavedToast(true);
      window.setTimeout(() => setMarkSavedToast(false), 3200);
    }
    setMarkQuotaHit(false);
    refreshProfile();
    const latest = loadOrCreateProfile();
    /* Só pede nome se ainda não houver nenhum (ex. Google sem displayName). */
    if (!isProfileOnboarded(latest) && !welcomeShownRef.current) {
      welcomeShownRef.current = true;
      setShowWelcomeOnboarding(true);
    }
  }

  useEffect(() => {
    return subscribeVerseMarksRevision(() => {
      setMarkQuotaHit(isOverFreeMarkQuota());
      setActivityTick((n) => n + 1);
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const pendingMark = pendingMarkRef.current;
    if (!pendingMark) return;
    pendingMarkRef.current = null;
    authorizeMark(pendingMark);
    setMarkQuotaHit(false);
  }, [isAuthenticated]);

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
          initialFullName={profile.preferredName || ""}
          onComplete={finishOnboarding}
          onCancel={() => setShowWelcomeOnboarding(false)}
        />
      ) : null}
      <SignInModal
        open={signInOpen}
        variant={signInVariant}
        onClose={handleSignInClose}
        onSignedIn={handleSignedIn}
      />
      {offlineToast ? (
        <div className="offline-toast" role="status" aria-live="polite">
          <p>{t("toast.offline")}</p>
          <button
            type="button"
            className="offline-toast-dismiss"
            aria-label={t("common.close")}
            onClick={() => setOfflineToast(false)}
          >
            ×
          </button>
        </div>
      ) : null}
      {markSavedToast ? (
        <div className="offline-toast" role="status" aria-live="polite">
          <p>{t("toast.markSaved")}</p>
          <button
            type="button"
            className="offline-toast-dismiss"
            aria-label={t("common.close")}
            onClick={() => setMarkSavedToast(false)}
          >
            ×
          </button>
        </div>
      ) : null}
      {firstInstallNeeded && !bibleMode ? (
        <div className="sw-update-banner" role="status" aria-live="polite">
          <div className="sw-update-banner-copy">
            <p className="sw-update-banner-title">{t("install.bannerTitle")}</p>
            <p className="sw-update-banner-meta">{firstInstallMeta()}</p>
          </div>
          <button
            type="button"
            className="sw-update-banner-cta"
            disabled={firstInstallBusy}
            onClick={() => void handleFirstInstall()}
          >
            {firstInstallBusy ? t("install.bannerBusy") : t("install.bannerCta")}
          </button>
        </div>
      ) : null}
      {swUpdatePending && !firstInstallNeeded && !bibleMode ? (
        <div className="sw-update-banner" role="status" aria-live="polite">
          <div className="sw-update-banner-copy">
            <p className="sw-update-banner-title">{t("swUpdate.title")}</p>
            <p className="sw-update-banner-meta">{t("swUpdate.lead")}</p>
          </div>
          <button
            type="button"
            className="sw-update-banner-cta"
            onClick={() => void applyPendingSwUpdate()}
          >
            {t("swUpdate.cta")}
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
                  onResumePlan={(plan) => {
                    openPlanWorkspace(plan);
                    selectTab("today");
                  }}
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
                  onMarkRead={() => {
                    setActivityTick((n) => n + 1);
                  }}
                  onRestartPlan={() => {
                    setActivityTick((n) => n + 1);
                  }}
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
                      focusVersionId={bibleFocusVersion}
                      focusSeq={bibleFocusSeq}
                      active={bibleMode}
                      compactViewport={narrow}
                      themePref={themePref}
                      onCycleTheme={cycleTheme}
                      planReading={bibleMode ? planReading : null}
                      onBack={planReading ? returnFromPlanReading : undefined}
                      requireAccountToMark={requireAccountToMark}
                      onRequestAccountToMark={requestAccountForMark}
                      authorizedMarkSeq={authorizedMarkSeq}
                      authorizedMark={authorizedMark}
                      onAuthorizedMarkConsumed={() => setAuthorizedMark(null)}
                      onVerseMarked={handleVerseMarked}
                      onBibleRead={(payload) => {
                        const versionId = payload.versionId ?? "s21";
                        const logged = recordBibleRead({
                          ...payload,
                          versionId,
                          language:
                            payload.language || languageForVersion(versionId),
                          versionBadge:
                            payload.versionBadge || versionBadgeFor(versionId),
                          localizedBookName: payload.localizedBookName,
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
                  onSetTheme={setTheme}
                  onOpenPassage={(ref) => openHistoryPassage(ref, openBible)}
                  onHistoryChange={() => setActivityTick((n) => n + 1)}
                  onRequestSignIn={() => {
                    setSignInVariant("upgrade");
                    setSignInOpen(true);
                  }}
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
