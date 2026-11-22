import { useCallback, useEffect, useRef, useState } from "react";
import { BibleReaderView } from "./components/BibleReaderView";
import { AppShellNav } from "./components/AppShellNav";
import { ProfileSettingsPanel } from "./components/profile/ProfileSettingsPanel";
import {
  PlanDiscoverPanel,
  flattenPlanSteps,
  resumeStepIndex,
  bootReadingPlansFirestore,
} from "./features/reading-plans";
import type { ReadingPlan } from "./features/reading-plans";
import { loadPublishedPlansCache } from "./features/reading-plans/data/readingPlansLocalCache";
import { usePlanReadingSession } from "./features/reading-plans/presentation/hooks/usePlanReadingSession";
import { useShellBackHandler } from "./hooks/useShellBackHandler";
import {
  ACTIVITY_UI_ENABLED,
  recordBibleRead,
  appendActivity,
} from "./activityLog";
import {
  consumePlanShareFromUrl,
  consumeShareRefFromUrl,
} from "./shareVerse";
import {
  isOverFreeMarkQuota,
  setVerseMarks,
  subscribeVerseMarksRevision,
} from "./verseMarks";
import {
  completeOnboarding,
  isClevencodeAdminEmail,
  isProfileOnboarded,
  loadOrCreateProfile,
} from "./userProfile";
import {
  ProfileOnboarding,
  SignInModal,
  useConsumerAuth,
} from "./features/consumer-auth";
import { AdminReadingPlansWorkspace } from "./features/reading-plans/presentation/admin/AdminReadingPlansWorkspace";
import { useUiLocale } from "./i18n/UiLocaleContext";
import { useNarrow } from "./layout";
import { BIBLE_COMPACT_TOOLS_MENU } from "./bible/bibleChromeLayout";
import {
  applyTheme,
  loadThemePref,
  saveThemePref,
  watchSystemTheme,
  type ThemePref,
} from "./theme";
import { syncNativeChrome } from "./nativeChrome";
import { loadShellTab, saveShellTab, type ShellTab } from "./shellNav";
import type { BibleTextVersionId } from "./bible/bibleVersions";
import type {
  ProfileOverlayRequest,
  ProfileReadingChrome,
} from "./bible/profileReadingChrome";
import {
  languageForVersion,
  versionBadgeFor,
} from "./bible/readingScope";
import { EditorialAdminApp } from "./features/editorial-auth/presentation/EditorialAdminApp";
import {
  applyPendingSwUpdate,
  subscribeSwUpdate,
} from "./swUpdateManager";
import { InstallBanner } from "./components/InstallBanner";
import { useApkUpdate } from "./hooks/useApkUpdate";
import { usePwaInstall } from "./hooks/usePwaInstall";
import { useAppReadiness } from "./context/AppReadinessContext";

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

export function App() {
  const { markShellReady, setCatalogHydrating, setCatalogLocalReady } =
    useAppReadiness();
  const [editorialAdmin, setEditorialAdmin] = useState(() => isEditorialAdminRoute());
  useEffect(() => {
    const onHash = () => setEditorialAdmin(isEditorialAdminRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!editorialAdmin) return;
    markShellReady();
    setCatalogHydrating(false);
    setCatalogLocalReady(true);
  }, [
    editorialAdmin,
    markShellReady,
    setCatalogHydrating,
    setCatalogLocalReady,
  ]);

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
  const { markShellReady } = useAppReadiness();
  const pwaInstall = usePwaInstall();
  const apkUpdate = useApkUpdate();
  const {
    profile,
    refreshProfile,
    isAuthenticated,
    session,
    user,
  } = useConsumerAuth();
  const showAdminNav =
    isAuthenticated && isClevencodeAdminEmail(user?.email);
  const [tab, setTab] = useState<ShellTab>(() => loadShellTab());
  const [bibleMounted, setBibleMounted] = useState(() => loadShellTab() === "bible");
  const [navHidden, setNavHidden] = useState(false);
  const [themePref, setThemePref] = useState<ThemePref>(() => loadThemePref());
  const [bibleFocusRef, setBibleFocusRef] = useState<string | null>(null);
  const [bibleFocusVersion, setBibleFocusVersion] =
    useState<BibleTextVersionId | null>(null);
  const [bibleFocusSeq, setBibleFocusSeq] = useState(0);
  const [activityTick, setActivityTick] = useState(0);
  /** Conta / préférences — painel aberto a partir da navbar. */
  const [accountOpen, setAccountOpen] = useState(false);
  /** Admin editorial — destino do pill (gated). */
  const [adminOpen, setAdminOpen] = useState(false);
  const [openOverlayRequest, setOpenOverlayRequest] =
    useState<ProfileOverlayRequest | null>(null);
  const [profileReadingChrome, setProfileReadingChrome] =
    useState<ProfileReadingChrome | null>(null);
  const [workspacePlan, setWorkspacePlan] = useState<ReadingPlan | null>(null);
  const [workspaceJour, setWorkspaceJour] = useState<number | undefined>();
  const [workspaceResumeSeq, setWorkspaceResumeSeq] = useState(0);
  const [offlineToast, setOfflineToast] = useState(false);
  const [markSavedToast, setMarkSavedToast] = useState(false);
  const [swUpdatePending, setSwUpdatePending] = useState(false);
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
  const pendingPlanShareId = useRef<string | null>(null);
  const welcomeShownRef = useRef(false);

  /** Soft gate: após cota, guest precisa de conta — nunca durante boot auth. */
  const authReady = session.status !== "initializing";
  const requireAccountToMark =
    authReady && !isAuthenticated && markQuotaHit;

  const bibleMode = tab === "bible";
  const bibleCompactTools = BIBLE_COMPACT_TOOLS_MENU && narrow && bibleMode;

  useEffect(() => subscribeSwUpdate(setSwUpdatePending), []);

  useEffect(() => {
    markShellReady();
  }, [markShellReady]);

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
    const planId = consumePlanShareFromUrl();
    if (planId) {
      pendingPlanShareId.current = planId;
    }
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

  const openBible = useCallback(
    (ref?: string, versionId?: BibleTextVersionId) => {
      setAccountOpen(false);
      setAdminOpen(false);
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
    setTab("plan");
    setWorkspaceResumeSeq((n) => n + 1);
  }, [clearPlan]);

  const selectTab = useCallback(
    (next: ShellTab) => {
      setAccountOpen(false);
      setAdminOpen(false);
      if (next === "plan" && planReading) {
        const jour = clearPlan();
        if (typeof jour === "number") setWorkspaceJour(jour);
        setWorkspaceResumeSeq((n) => n + 1);
      }
      setTab(next);
    },
    [planReading, clearPlan],
  );

  const toggleAccount = useCallback(() => {
    setAdminOpen(false);
    setAccountOpen((open) => !open);
  }, []);

  const toggleAdmin = useCallback(() => {
    setAccountOpen(false);
    setAdminOpen((open) => !open);
  }, []);

  const graphPaneBodyRef = useRef<HTMLDivElement>(null);

  /** Micro: fade/slide da tela ao escolher um destino no menu radial. */
  const bumpShellEnter = useCallback(() => {
    const el = graphPaneBodyRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.classList.remove("is-shell-enter");
    void el.offsetWidth;
    el.classList.add("is-shell-enter");
    const clear = () => el.classList.remove("is-shell-enter");
    el.addEventListener("animationend", clear, { once: true });
  }, []);

  useEffect(() => {
    if (!showAdminNav) setAdminOpen(false);
  }, [showAdminNav]);

  useEffect(() => {
    const id = pendingPlanShareId.current;
    if (!id) return;

    function applyPlan(plan: ReadingPlan | undefined) {
      if (!plan) return false;
      pendingPlanShareId.current = null;
      openPlanWorkspace(plan);
      setAccountOpen(false);
      setAdminOpen(false);
      setTab("plan");
      return true;
    }

    const cached = loadPublishedPlansCache()?.plans.find((p) => p.id === id);
    if (applyPlan(cached)) return;

    let cancelled = false;
    void (async () => {
      await bootReadingPlansFirestore();
      if (cancelled) return;
      const again = loadPublishedPlansCache()?.plans.find((p) => p.id === id);
      if (!applyPlan(again)) {
        pendingPlanShareId.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openPlanWorkspace]);

  useShellBackHandler({
    accountOpen,
    onCloseAccount: () => setAccountOpen(false),
    adminOpen,
    onCloseAdmin: () => setAdminOpen(false),
    hasPlanReading: Boolean(planReading),
    onReturnFromPlanReading: returnFromPlanReading,
    hasWorkspacePlan: Boolean(workspacePlan),
    onLeaveWorkspace: leavePlanWorkspace,
  });

  const startPlanReadingFromWorkspace = useCallback(
    (jour: number, passage?: string) => {
      if (!workspacePlan) return;
      setAccountOpen(false);
      setAdminOpen(false);
      openPlanAtJour(workspacePlan, jour, passage);
      setTab("bible");
    },
    [openPlanAtJour, workspacePlan],
  );

  const requestProfileOverlay = useCallback(
    (request: ProfileOverlayRequest) => {
      setAccountOpen(false);
      setAdminOpen(false);
      setTab("bible");
      setOpenOverlayRequest(request);
    },
    [],
  );

  const setTheme = useCallback(
    (pref: ThemePref) => {
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
      className={`app biblos-shell${
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
      {swUpdatePending && !bibleMode ? (
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
      {!swUpdatePending && apkUpdate.available && !bibleMode ? (
        <div className="sw-update-banner" role="status" aria-live="polite">
          <div className="sw-update-banner-copy">
            <p className="sw-update-banner-title">{t("swUpdate.title")}</p>
            <p className="sw-update-banner-meta">{t("swUpdate.lead")}</p>
          </div>
          <button
            type="button"
            className="sw-update-banner-cta"
            disabled={apkUpdate.busy}
            onClick={() => void apkUpdate.update()}
          >
            {apkUpdate.busy ? t("pwaInstall.busy") : t("swUpdate.cta")}
          </button>
          <button
            type="button"
            className="sw-update-banner-dismiss"
            aria-label={t("auth.later")}
            disabled={apkUpdate.busy}
            onClick={apkUpdate.dismiss}
          >
            ×
          </button>
        </div>
      ) : null}
      {!swUpdatePending && !apkUpdate.available && !bibleMode ? (
        <InstallBanner install={pwaInstall} />
      ) : null}

      <main id="workspace" className={`workspace${narrow ? " is-mobile-vista" : ""}`}>
        <div className="note-shell">
          <div className="note-shell-main">
            <section className="graph-pane" aria-label={t("shell.nav")}>
              <div ref={graphPaneBodyRef} className="graph-pane-body">
                {accountOpen ? (
                  <div
                    id="panel-account"
                    role="region"
                    aria-labelledby="shell-label-account"
                    className="pane-body account-shell-panel"
                  >
                    <ProfileSettingsPanel
                      active={accountOpen}
                      activityTick={activityTick}
                      themePref={themePref}
                      onSetTheme={setTheme}
                      readingChrome={profileReadingChrome}
                      onOpenHistory={
                        ACTIVITY_UI_ENABLED
                          ? () => requestProfileOverlay("history")
                          : undefined
                      }
                      onOpenMarks={() => requestProfileOverlay("marks")}
                      onRequestSignIn={() => {
                        setSignInVariant("upgrade");
                        setSignInOpen(true);
                      }}
                    />
                  </div>
                ) : null}
                {adminOpen ? (
                  <div
                    id="panel-admin"
                    role="region"
                    aria-labelledby="shell-label-admin"
                    className="pane-body account-shell-panel admin-shell-panel"
                  >
                    <AdminReadingPlansWorkspace
                      embedded
                      userEmail={user?.email ?? null}
                    />
                  </div>
                ) : null}
                <PlanDiscoverPanel
                  active={tab === "plan" && !accountOpen && !adminOpen}
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
                  role="region"
                  aria-labelledby="shell-label-bible"
                  hidden={!bibleMode || accountOpen || adminOpen}
                  className="pane-body"
                >
                  {bibleMounted ? (
                    <BibleReaderView
                      initialRef="Jean 3.16"
                      focusRef={bibleFocusRef}
                      focusVersionId={bibleFocusVersion}
                      focusSeq={bibleFocusSeq}
                      active={bibleMode && !accountOpen && !adminOpen}
                      compactViewport={narrow}
                      planReading={
                        bibleMode && !accountOpen && !adminOpen
                          ? planReading
                          : null
                      }
                      onBack={
                        planReading ? returnFromPlanReading : undefined
                      }
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
                      openOverlayRequest={openOverlayRequest}
                      onOpenOverlayRequestConsumed={() =>
                        setOpenOverlayRequest(null)
                      }
                      onReturnToProfile={() => {
                        setAdminOpen(false);
                        setAccountOpen(true);
                      }}
                      onProfileReadingChromeChange={setProfileReadingChrome}
                    />
                  ) : null}
                </div>
              </div>
            </section>
          </div>
          {/* Fora de .note-shell-main: scrim/radial não empilham dentro do main */}
          <AppShellNav
            active={tab}
            onSelect={selectTab}
            immersiveHidden={
              bibleMode && !accountOpen && !adminOpen && navHidden
            }
            accountOpen={accountOpen}
            onToggleAccount={toggleAccount}
            adminOpen={adminOpen}
            showAdmin={showAdminNav}
            onToggleAdmin={toggleAdmin}
            onOpenScreen={bumpShellEnter}
          />
        </div>
      </main>
    </div>
  );
}
