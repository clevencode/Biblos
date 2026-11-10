import { useState } from "react";
import { AdminPlanListSkeleton } from "./AdminPlanListSkeleton";
import { AdminPlanEditor } from "./AdminPlanEditor";
import { useAdminReadingPlans } from "./hooks/useAdminReadingPlans";

type AdminReadingPlansWorkspaceProps = {
  onExit: () => void;
  userEmail: string | null;
  onSignOut: () => Promise<void>;
};

export function AdminReadingPlansWorkspace({
  onExit,
  userEmail,
  onSignOut,
}: AdminReadingPlansWorkspaceProps) {
  const { plans, fromCache, hydrating, error, showSkeleton } = useAdminReadingPlans(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = plans.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="editorial-admin-app plan-discover">
      <header className="plan-discover-head">
        <div className="profile-head-copy">
          <h1 className="plan-discover-title">Plans · Firestore</h1>
          <p className="plan-discover-meta">
            {hydrating
              ? "Synchronisation…"
              : fromCache
                ? "Cache local · mise à jour en arrière-plan"
                : "Temps réel cloud"}
            {userEmail ? ` · ${userEmail}` : ""}
          </p>
        </div>
        <div className="editorial-admin-head-actions">
          <button type="button" className="profile-text-btn" onClick={() => void onSignOut()}>
            Déconnexion
          </button>
          <button type="button" className="profile-text-btn" onClick={onExit}>
            ← Application
          </button>
        </div>
      </header>

      {error ? (
        <p className="editorial-admin-error editorial-admin-banner" role="alert">
          {error}
        </p>
      ) : null}

      <div className="editorial-admin-split">
        <aside className="editorial-admin-list" aria-label="Liste des plans">
          {showSkeleton ? <AdminPlanListSkeleton /> : null}
          {!showSkeleton && plans.length ? (
            <ul className="editorial-admin-plan-stack" role="list">
              {plans.map((plan) => (
                <li key={plan.id}>
                  <button
                    type="button"
                    className={`profile-row-btn${
                      selectedId === plan.id ? " is-on" : ""
                    }`}
                    onClick={() => setSelectedId(plan.id)}
                  >
                    <span className="profile-row-body">
                      <span className="profile-row-label">{plan.title}</span>
                      <span className="profile-row-value muted">
                        {plan.isPublished ? "Publié" : "Brouillon"} · {plan.totalDays} j
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {!showSkeleton && !plans.length ? (
            <p className="muted type-caption editorial-admin-empty">Aucun plan dans Firestore.</p>
          ) : null}
        </aside>

        <div className="editorial-admin-detail">
          <AdminPlanEditor
            disabled={hydrating}
            selected={selected}
            onSaved={() => setSelectedId(null)}
            onClear={() => setSelectedId(null)}
          />
        </div>
      </div>
    </div>
  );
}
