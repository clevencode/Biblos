import { useEffect, useMemo, useState } from "react";
import { YvIcon } from "./YvIcon";
import { HeaderTriggerButton } from "./HeaderTriggerButton";
import { listBibleReadingHistory } from "../activityLog";
import { loadOrCreateProfile, preferredDisplayName } from "../userProfile";
import {
  dailyVerseOpenRef,
  getDailyVerse,
  type DailyVerse,
} from "../bible/getDailyVerse";
import {
  bibleVersionDef,
  readBibleTextVersionPref,
} from "../bible/bibleVersions";
import { shareVerseDirect } from "../shareVerse";
import {
  exportPlanProgressStore,
  loadPlanProgress,
  progressCounts,
  subscribePlanProgress,
} from "../features/reading-plans/domain/planProgress";
import { useReadingPlansCatalog } from "../features/reading-plans/presentation/hooks/useReadingPlansCatalog";
import type { ReadingPlan } from "../features/reading-plans";
import { useUiLocale } from "../i18n/UiLocaleContext";
import type { ThemePref } from "../theme";
import { HomeConfigSection } from "./HomeConfigSection";

type HomeShellPanelProps = {
  active: boolean;
  activityTick: number;
  themePref: ThemePref;
  onSetTheme: (pref: "light" | "dark") => void;
  onOpenBible: (ref?: string) => void;
  onOpenPlan: () => void;
  onResumePlan: (plan: ReadingPlan) => void;
  onRequestSignIn?: () => void;
};

function greetingKey(hour: number) {
  if (hour < 12) return "home.greeting.morning" as const;
  if (hour < 18) return "home.greeting.afternoon" as const;
  return "home.greeting.evening" as const;
}

function pickActivePlan(
  plans: ReadingPlan[],
): { plan: ReadingPlan; done: number; total: number; pct: number } | null {
  const store = exportPlanProgressStore();
  const started = Object.entries(store)
    .filter(([, p]) => (p.completedJours?.length ?? 0) > 0 || p.lastJour != null)
    .sort((a, b) => {
      const aAt = a[1].startedAt || "";
      const bAt = b[1].startedAt || "";
      return bAt.localeCompare(aAt);
    });
  for (const [planId] of started) {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) continue;
    const progress = loadPlanProgress(planId);
    const { done, total } = progressCounts(plan, progress);
    if (total <= 0) continue;
    if (done >= total) continue; // terminé — chercher un autre
    const pct = Math.min(100, Math.round((done / total) * 100));
    return { plan, done, total, pct };
  }
  // Si tous terminés, montrer le plus récent terminé
  for (const [planId] of started) {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) continue;
    const progress = loadPlanProgress(planId);
    const { done, total } = progressCounts(plan, progress);
    if (total <= 0) continue;
    const pct = Math.min(100, Math.round((done / total) * 100));
    return { plan, done, total, pct };
  }
  return null;
}

export function HomeShellPanel({
  active,
  activityTick,
  themePref,
  onSetTheme,
  onOpenBible,
  onOpenPlan,
  onResumePlan,
  onRequestSignIn,
}: HomeShellPanelProps) {
  const { t } = useUiLocale();
  const profile = loadOrCreateProfile();
  const catalog = useReadingPlansCatalog(active);
  const [planTick, setPlanTick] = useState(0);
  const [daily, setDaily] = useState<DailyVerse | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const versionTitle = bibleVersionDef(readBibleTextVersionPref()).title;

  const recent = useMemo(() => {
    void activityTick;
    return listBibleReadingHistory(profile.id, 1)[0] ?? null;
  }, [activityTick, profile.id]);

  const resumeLabel =
    recent && typeof recent.meta?.label === "string" && recent.meta.label.trim()
      ? String(recent.meta.label)
      : recent?.meta?.usfm
        ? String(recent.meta.usfm).replace(/\./g, " ")
        : "Jean 3.16";

  const resumeRef =
    recent?.meta?.usfm && typeof recent.meta.usfm === "string"
      ? String(recent.meta.usfm).replace(/\./g, " ")
      : "JHN 3.16";

  const activePlan = useMemo(() => {
    void planTick;
    void activityTick;
    return pickActivePlan(catalog.plans);
  }, [catalog.plans, planTick, activityTick]);

  useEffect(() => subscribePlanProgress(() => setPlanTick((n) => n + 1)), []);

  useEffect(() => {
    if (!active) setMenuOpen(false);
  }, [active]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void getDailyVerse().then((verse) => {
      if (!cancelled) setDaily(verse);
    });
    return () => {
      cancelled = true;
    };
  }, [active, activityTick]);

  async function handleShareDaily() {
    if (!daily || shareBusy) return;
    setShareBusy(true);
    try {
      await shareVerseDirect({
        refLabel: daily.refLabel,
        verseText: daily.text,
        usfm: daily.usfm,
      });
    } catch {
      /* ignore */
    } finally {
      setShareBusy(false);
    }
  }

  return (
    <div
      id="panel-home"
      role="tabpanel"
      aria-labelledby="tab-home"
      hidden={!active}
      className={`pane-body home-view${menuOpen ? " is-menu-open" : ""}`}
    >
      <header className="shell-page-head home-head">
        <div className="shell-page-head-copy">
          <h1 className="type-headline">
            {menuOpen ? t("profile.settings") : t("shell.home")}
          </h1>
          {!menuOpen ? (
            <p className="muted type-caption">
              {t(greetingKey(new Date().getHours()))},{" "}
              {preferredDisplayName(profile) || "Biblos"}
            </p>
          ) : null}
        </div>
        <div className="home-head-actions">
          <HeaderTriggerButton
            open={menuOpen}
            shape="circle"
            idleIcon="menu"
            ariaLabel={
              menuOpen ? t("common.close") : t("profile.settings")
            }
            ariaHaspopup="dialog"
            className={`home-menu-btn${menuOpen ? " is-on" : ""}`}
            onClick={() => setMenuOpen((open) => !open)}
          />
        </div>
      </header>

      {menuOpen ? (
        <div
          className="home-menu-panel"
          role="dialog"
          aria-modal="false"
          aria-label={t("profile.settings")}
        >
          <HomeConfigSection
            active={active && menuOpen}
            activityTick={activityTick}
            themePref={themePref}
            onSetTheme={onSetTheme}
            onRequestSignIn={onRequestSignIn}
          />
        </div>
      ) : (
        <>
          <section className="home-section" aria-labelledby="home-resume-title">
            <div className="home-card home-card-row">
              <YvIcon name="menu_book" className="home-resume-icon" opsz={24} />
              <div className="home-card-main">
                <p id="home-resume-title" className="home-card-eyebrow">
                  {t("home.resumePlan")}
                </p>
                <p className="home-card-title">{resumeLabel}</p>
                <p className="home-card-meta">{versionTitle}</p>
              </div>
              <button
                type="button"
                className="home-pill"
                onClick={() => onOpenBible(resumeRef)}
              >
                {t("home.read")}
              </button>
            </div>
          </section>

          <section className="home-section" aria-labelledby="home-daily-title">
            <div className="home-card">
              <p id="home-daily-title" className="home-card-eyebrow">
                {t("home.dailyVerse")}
              </p>
              <p className="home-daily-text">
                {daily?.text ?? t("common.loading")}
              </p>
              <div className="home-daily-foot">
                <p className="home-daily-ref">
                  {daily ? `— ${daily.refLabel}` : "—"}
                </p>
                <div className="home-daily-actions">
                  <button
                    type="button"
                    className="home-icon-btn"
                    aria-label={t("home.share")}
                    disabled={!daily || shareBusy}
                    onClick={() => void handleShareDaily()}
                  >
                    <YvIcon name="ios_share" opsz={20} />
                  </button>
                  <button
                    type="button"
                    className="home-icon-btn"
                    aria-label={t("home.openBible")}
                    disabled={!daily}
                    onClick={() =>
                      daily && onOpenBible(dailyVerseOpenRef(daily.usfm))
                    }
                  >
                    <YvIcon name="menu_book" opsz={20} />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="home-section" aria-labelledby="home-plans-title">
            <div className="home-section-head">
              <h2 id="home-plans-title" className="home-section-title">
                {t("home.plans")}
              </h2>
              <button
                type="button"
                className="home-section-link"
                onClick={onOpenPlan}
              >
                {t("home.seeAll")}
              </button>
            </div>

            {activePlan ? (
              <div className="home-card">
                <div className="home-card-row">
                  <div className="home-card-main">
                    <p className="home-card-title">{activePlan.plan.title}</p>
                    <p className="home-card-meta">
                      {t("home.days", {
                        done: activePlan.done,
                        total: activePlan.total,
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="home-pill is-compact"
                    onClick={() => onResumePlan(activePlan.plan)}
                  >
                    {t("home.resumePlan")}
                  </button>
                </div>
                <div className="home-progress">
                  <div className="home-progress-track" aria-hidden="true">
                    <div
                      className="home-progress-fill"
                      style={{ width: `${activePlan.pct}%` }}
                    />
                  </div>
                  <span className="home-progress-pct">{activePlan.pct}%</span>
                </div>
              </div>
            ) : (
              <div className="home-empty">
                <p>{t("home.plansEmpty")}</p>
                <button
                  type="button"
                  className="home-pill is-accent home-empty-cta"
                  onClick={onOpenPlan}
                >
                  {t("home.browsePlans")}
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
