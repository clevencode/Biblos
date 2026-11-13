import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { YvIcon } from "../../../../components/YvIcon";
import { AdminPlanListSkeleton } from "./AdminPlanListSkeleton";
import { AdminPlanEditor } from "./AdminPlanEditor";
import { useAdminReadingPlans } from "./hooks/useAdminReadingPlans";

type AdminReadingPlansWorkspaceProps = {
  userEmail: string | null;
  /** Full-page #admin: sair + déconnexion. Embebido no perfil: omitir. */
  embedded?: boolean;
  onExit?: () => void;
  onSignOut?: () => Promise<void>;
};

type AdminModalKind = "create" | "browse" | "edit";

type AdminModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
};

function AdminModal({ open, title, onClose, children, wide }: AdminModalProps) {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.requestAnimationFrame(() => {
      cardRef.current?.querySelector<HTMLElement>("button, input, textarea")?.focus();
    });
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="editorial-admin-modal"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        className={`editorial-admin-modal-card${wide ? " is-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="editorial-admin-modal-head">
          <h2 id={titleId} className="type-title">
            {title}
          </h2>
          <button
            type="button"
            className="sign-in-modal-close"
            aria-label="Fermer"
            onClick={onClose}
          >
            <YvIcon name="close" className="sign-in-modal-close-icon" />
          </button>
        </header>
        <div className="editorial-admin-modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function AdminReadingPlansWorkspace({
  userEmail,
  embedded = false,
  onExit,
  onSignOut,
}: AdminReadingPlansWorkspaceProps) {
  const { plans, fromCache, hydrating, error, showSkeleton } = useAdminReadingPlans(true);
  const [modal, setModal] = useState<AdminModalKind | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = plans.find((p) => p.id === selectedId) ?? null;
  const activePlans = useMemo(
    () => plans.filter((plan) => plan.isPublished),
    [plans],
  );

  function openCreate() {
    setSelectedId(null);
    setModal("create");
  }

  function openBrowse() {
    setModal("browse");
  }

  function openEdit(planId: string) {
    setSelectedId(planId);
    setModal("edit");
  }

  function closeModal() {
    setModal(null);
    setSelectedId(null);
  }

  return (
    <div
      className={`editorial-admin-app plan-discover${embedded ? " is-embedded" : ""}`}
    >
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
        {!embedded && onExit && onSignOut ? (
          <div className="editorial-admin-head-actions">
            <button
              type="button"
              className="profile-text-btn"
              onClick={() => void onSignOut()}
            >
              Déconnexion
            </button>
            <button type="button" className="profile-text-btn" onClick={onExit}>
              ← Application
            </button>
          </div>
        ) : null}
      </header>

      {error ? (
        <p className="editorial-admin-error editorial-admin-banner" role="alert">
          {error}
        </p>
      ) : null}

      <div className="editorial-admin-hub" role="group" aria-label="Actions plans">
        <button
          type="button"
          className="editorial-admin-hub-btn"
          disabled={hydrating}
          onClick={openCreate}
        >
          <span className="editorial-admin-hub-btn-label">Créer un plan</span>
          <span className="editorial-admin-hub-btn-meta muted">
            Nouveau document Firestore
          </span>
        </button>
        <button
          type="button"
          className="editorial-admin-hub-btn"
          disabled={hydrating}
          onClick={openBrowse}
        >
          <span className="editorial-admin-hub-btn-label">Voir les plans</span>
          <span className="editorial-admin-hub-btn-meta muted">
            {showSkeleton
              ? "Chargement…"
              : `${activePlans.length} plan${activePlans.length === 1 ? "" : "s"} actif${activePlans.length === 1 ? "" : "s"}`}
          </span>
        </button>
      </div>

      <AdminModal
        open={modal === "create" || modal === "edit"}
        title={modal === "edit" ? "Modifier le plan" : "Créer un plan"}
        onClose={closeModal}
        wide
      >
        <AdminPlanEditor
          disabled={hydrating}
          selected={modal === "edit" ? selected : null}
          variant={modal === "create" ? "wizard" : "flat"}
          onSaved={closeModal}
          onClear={() => {
            setSelectedId(null);
            setModal("create");
          }}
        />
      </AdminModal>

      <AdminModal
        open={modal === "browse"}
        title="Plans actifs"
        onClose={closeModal}
        wide
      >
        {showSkeleton ? <AdminPlanListSkeleton /> : null}
        {!showSkeleton && activePlans.length ? (
          <ul className="editorial-admin-plan-grid" role="list">
            {activePlans.map((plan) => (
              <li key={plan.id}>
                <button
                  type="button"
                  className="editorial-admin-plan-tile"
                  onClick={() => openEdit(plan.id)}
                >
                  <span className="editorial-admin-plan-tile-title">{plan.title}</span>
                  <span className="editorial-admin-plan-tile-meta muted">
                    Publié · {plan.totalDays} j · {plan.etapes.length} étape
                    {plan.etapes.length === 1 ? "" : "s"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {!showSkeleton && !activePlans.length ? (
          <p className="muted type-caption editorial-admin-empty">
            Aucun plan publié pour le moment.
          </p>
        ) : null}
      </AdminModal>
    </div>
  );
}
