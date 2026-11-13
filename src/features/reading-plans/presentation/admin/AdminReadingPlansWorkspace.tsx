import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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

/** Une seule modale : grille ou éditeur (jamais empilées). */
type ModalView =
  | { kind: "browse" }
  | { kind: "editor"; planId: string | null; fromBrowse: boolean };

type AdminModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  onBack?: (() => void) | null;
  children: ReactNode;
};

function AdminModal({ open, title, onClose, onBack, children }: AdminModalProps) {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const onBackRef = useRef(onBack);
  const wasOpenRef = useRef(false);

  onCloseRef.current = onClose;
  onBackRef.current = onBack;

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    const focusTimer = justOpened
      ? window.requestAnimationFrame(() => {
          const root = cardRef.current;
          if (!root) return;
          const preferred =
            root.querySelector<HTMLElement>("input:not([readonly]), textarea") ??
            root.querySelector<HTMLElement>("button:not(.sign-in-modal-close)");
          preferred?.focus();
        })
      : 0;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (onBackRef.current) onBackRef.current();
      else onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      if (focusTimer) window.cancelAnimationFrame(focusTimer);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
        className="editorial-admin-modal-card is-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="editorial-admin-modal-head">
          <div className="editorial-admin-modal-head-main">
            {onBack ? (
              <button
                type="button"
                className="profile-text-btn editorial-admin-modal-back"
                onClick={onBack}
              >
                ← Plans
              </button>
            ) : null}
            <h2 id={titleId} className="type-title">
              {title}
            </h2>
          </div>
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
  const [view, setView] = useState<ModalView | null>(null);

  const selectedId = view?.kind === "editor" ? view.planId : null;
  const selected = plans.find((p) => p.id === selectedId) ?? null;
  const activePlans = useMemo(
    () => plans.filter((plan) => plan.isPublished),
    [plans],
  );

  function openCreate() {
    setView({ kind: "editor", planId: null, fromBrowse: false });
  }

  function openBrowse() {
    setView({ kind: "browse" });
  }

  function openEditorFromBrowse(planId: string) {
    setView({ kind: "editor", planId, fromBrowse: true });
  }

  function backToBrowse() {
    setView({ kind: "browse" });
  }

  function closeModal() {
    setView(null);
  }

  function handleEditorSaved() {
    if (view?.kind === "editor" && view.fromBrowse) {
      setView({ kind: "browse" });
      return;
    }
    closeModal();
  }

  const modalOpen = view != null;
  const modalTitle =
    view?.kind === "browse"
      ? "Plans actifs"
      : view?.kind === "editor" && view.planId
        ? "Modifier le plan"
        : "Créer un plan";
  const modalBack =
    view?.kind === "editor" && view.fromBrowse ? backToBrowse : null;

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
            Identité, contenu, publication
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
              : activePlans.length === 0
                ? "Aucun plan publié"
                : `${activePlans.length} publié${activePlans.length === 1 ? "" : "s"}`}
          </span>
        </button>
      </div>

      <AdminModal
        open={modalOpen}
        title={modalTitle}
        onClose={closeModal}
        onBack={modalBack}
      >
        {view?.kind === "browse" ? (
          <>
            {showSkeleton ? <AdminPlanListSkeleton /> : null}
            {!showSkeleton && activePlans.length ? (
              <ul className="editorial-admin-plan-grid" role="list">
                {activePlans.map((plan) => (
                  <li key={plan.id}>
                    <button
                      type="button"
                      className="editorial-admin-plan-tile"
                      onClick={() => openEditorFromBrowse(plan.id)}
                    >
                      <span className="editorial-admin-plan-tile-title">
                        {plan.title}
                      </span>
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
          </>
        ) : null}

        {view?.kind === "editor" ? (
          view.planId && !selected && (hydrating || showSkeleton) ? (
            <AdminPlanListSkeleton />
          ) : view.planId && !selected ? (
            <p className="muted type-caption editorial-admin-empty" role="status">
              Plan introuvable.
            </p>
          ) : (
            <AdminPlanEditor
              key={view.planId ?? "new"}
              disabled={hydrating}
              selected={view.planId ? selected : null}
              onSaved={handleEditorSaved}
              onClear={
                view.fromBrowse
                  ? backToBrowse
                  : closeModal
              }
            />
          )
        ) : null}
      </AdminModal>
    </div>
  );
}
