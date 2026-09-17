import { useEffect, useMemo, useState } from "react";
import { YvIcon } from "./YvIcon";
import {
  countUnreadAppNotifications,
  syncContextualNotifications,
} from "../appNotifications";
import {
  isPlanComplete,
  loadPlanProgress,
  progressCounts,
  type PlanProgress,
} from "../planProgress";
import { planCoverStyle, planTitle } from "../planTheme";
import type { ReadingPlan } from "../types";
import { preferredDisplayName, type UserProfile } from "../userProfile";
import { fetchPassage } from "../youversion/client";
import { getVerseOfDay } from "../verseOfDay";
import { NotificationsView } from "./NotificationsView";

type HomeViewProps = {
  profile: UserProfile;
  plans: ReadingPlan[];
  progressTick?: number;
  onOpenPlan: (plan: ReadingPlan) => void;
  onBrowsePlans: () => void;
  onOpenVerse: (reference: string) => void;
};

type InProgressItem = {
  plan: ReadingPlan;
  progress: PlanProgress;
  done: number;
  total: number;
};

function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "Bonjour";
  if (hour >= 12 && hour < 18) return "Bon après-midi";
  return "Bonsoir";
}

function listInProgress(plans: ReadingPlan[]): InProgressItem[] {
  const items: InProgressItem[] = [];
  for (const plan of plans) {
    const progress = loadPlanProgress(plan.id);
    if (!progress) continue;
    if (isPlanComplete(plan, progress)) continue;
    const { done, total } = progressCounts(plan, progress);
    // Aligné sur Plan « En cours » : au moins un jour terminé.
    if (!total || done <= 0) continue;
    items.push({ plan, progress, done, total });
  }
  return items.sort((a, b) => b.progress.startDate.localeCompare(a.progress.startDate));
}

export function HomeView({
  profile,
  plans,
  progressTick = 0,
  onOpenPlan,
  onBrowsePlans,
  onOpenVerse,
}: HomeViewProps) {
  const name = preferredDisplayName(profile);
  const greeting = greetingForHour(new Date().getHours());
  const verseMeta = useMemo(() => getVerseOfDay(), []);
  const [verseText, setVerseText] = useState(verseMeta.fallback);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unread, setUnread] = useState(0);

  const inProgress = useMemo(() => {
    void progressTick;
    return listInProgress(plans);
  }, [plans, progressTick]);

  useEffect(() => {
    syncContextualNotifications(plans);
    setUnread(countUnreadAppNotifications());
  }, [plans, progressTick, showNotifications]);

  useEffect(() => {
    let cancelled = false;
    void fetchPassage(verseMeta.reference).then((result) => {
      if (cancelled || !result.ok || !result.passage) return;
      const verses = result.passage.verses;
      const text =
        verses?.map((v) => v.text.trim()).filter(Boolean).join(" ") ||
        result.passage.content?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (text) setVerseText(text);
    });
    return () => {
      cancelled = true;
    };
  }, [verseMeta.reference]);

  if (showNotifications) {
    return (
      <NotificationsView
        plans={plans}
        onBack={() => setShowNotifications(false)}
      />
    );
  }

  const hasUnread = unread > 0;

  return (
    <div className="home-view">
      <header className="home-head">
        <div className="home-head-copy">
          <p className="home-greeting type-caption">{greeting}</p>
          <h1 className="home-name type-headline">{name}</h1>
        </div>
        <button
          type="button"
          className={`home-notif-btn${hasUnread ? " is-on" : ""}`}
          aria-label={
            hasUnread
              ? `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}`
              : "Notifications"
          }
          title="Notifications"
          onClick={() => setShowNotifications(true)}
        >
          <YvIcon
            name={hasUnread ? "notifications_active" : "notifications"}
            filled={hasUnread}
            className="home-notif-icon"
          />
          {hasUnread ? (
            <span className="home-notif-badge" aria-hidden>
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </header>

      <section className="home-section" aria-labelledby="home-plans-title">
        <div className="home-section-head">
          <h2 id="home-plans-title" className="home-section-title type-eyebrow">
            {inProgress.length === 0
              ? "Plan pour toi"
              : inProgress.length === 1
                ? "Plan en cours"
                : "Plans en cours"}
          </h2>
          <button type="button" className="home-section-link type-label" onClick={onBrowsePlans}>
            Voir tout
          </button>
        </div>
        {inProgress.length ? (
          <ul className="home-plan-list">
            {inProgress.map(({ plan, done, total }) => {
              const pct = total ? Math.round((done / total) * 100) : 0;
              const title = planTitle(plan);
              const day = Math.min(done + 1, total);
              return (
                <li key={plan.id}>
                  <button
                    type="button"
                    className="plan-card"
                    onClick={() => onOpenPlan(plan)}
                  >
                    <span
                      className="plan-card-swatch"
                      style={planCoverStyle(plan.id)}
                      aria-hidden="true"
                    >
                      <span className="plan-card-mark">{title.charAt(0)}</span>
                    </span>
                    <span className="plan-card-body">
                      <span className="plan-card-title">{title}</span>
                      <span className="plan-card-meta">
                        Jour {day} · {done}/{total}
                      </span>
                      <span className="plan-card-progress" aria-hidden="true">
                        <span className="plan-card-progress-track">
                          <span className="plan-card-progress-fill" style={{ width: `${pct}%` }} />
                        </span>
                      </span>
                    </span>
                    <span className="plan-card-cta">
                      Continuer
                      <span aria-hidden="true">›</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="home-empty">
            <p className="muted">Aucun plan commencé pour le moment.</p>
            <button type="button" className="home-empty-cta type-label" onClick={onBrowsePlans}>
              Choisir un plan
            </button>
          </div>
        )}
      </section>

      <section className="home-section" aria-labelledby="home-verse-title">
        <h2 id="home-verse-title" className="home-section-title type-eyebrow">
          Verset du jour
        </h2>
        <button
          type="button"
          className="home-verse-card"
          onClick={() => onOpenVerse(verseMeta.reference)}
        >
          <p className="home-verse-text type-body">{verseText}</p>
          <p className="home-verse-ref type-label">{verseMeta.reference}</p>
        </button>
      </section>
    </div>
  );
}
