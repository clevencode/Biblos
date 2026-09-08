import { useEffect, useMemo, useRef, useState } from "react";
import { loadPlanProgress, progressCounts } from "../planProgress";
import type { ReadingPlan } from "../types";

type PlanGalleryProps = {
  plans: ReadingPlan[];
  selectedId?: string | null;
  embedded?: boolean;
  onPick: (plan: ReadingPlan) => void;
  onClose?: () => void;
};

const THEME_HUES = [265, 220, 190, 145, 35, 12, 330, 280, 200, 50];

function coverColor(id: string): { fill: string; ink: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  const hue = THEME_HUES[hash % THEME_HUES.length];
  return { fill: `hsl(${hue} 38% 82%)`, ink: `hsl(${hue} 28% 38%)` };
}

function snippet(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Galerie de Plan — même logique que le Caderno StudyOS, pour les thèmes. */
export function PlanGallery({
  plans,
  selectedId,
  embedded = false,
  onPick,
  onClose,
}: PlanGalleryProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const ordered = useMemo(
    () => [...plans].sort((a, b) => (b.criadoEm ?? "").localeCompare(a.criadoEm ?? "")),
    [plans],
  );
  const [activeId, setActiveId] = useState(selectedId ?? ordered[0]?.id ?? "");

  useEffect(() => {
    if (ordered.some((plan) => plan.id === activeId)) return;
    setActiveId(
      selectedId && ordered.some((plan) => plan.id === selectedId)
        ? selectedId
        : (ordered[0]?.id ?? ""),
    );
  }, [activeId, ordered, selectedId]);

  function reveal(id: string) {
    const root = gridRef.current;
    const card = document.getElementById(`plan-card-${id}`);
    if (!root || !card) return;
    const rootBox = root.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    if (cardBox.top < rootBox.top + 8) root.scrollTop -= rootBox.top - cardBox.top + 12;
    else if (cardBox.bottom > rootBox.bottom - 8) root.scrollTop += cardBox.bottom - rootBox.bottom + 12;
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!ordered.length) return;
      const typing = event.target instanceof HTMLElement && event.target.closest("input, textarea");
      if (typing) return;
      const index = Math.max(0, ordered.findIndex((plan) => plan.id === activeId));
      let next = index;
      if (event.key === "ArrowDown") next = Math.min(ordered.length - 1, index + 1);
      else if (event.key === "ArrowUp") next = Math.max(0, index - 1);
      else if (event.key === "Enter") {
        const current = ordered[index];
        if (!current) return;
        event.preventDefault();
        onPick(current);
        return;
      } else return;
      if (next === index) return;
      event.preventDefault();
      const id = ordered[next].id;
      setActiveId(id);
      reveal(id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, onPick, ordered]);

  const countLabel = `${ordered.length} plan${ordered.length === 1 ? "" : "s"}`;

  const content = (
    <>
      <header className="search-results-head">
        <div className="search-results-head-copy">
          <p className="session-kicker">Galerie</p>
          <h2 className="page-title">Galerie de Plan</h2>
          <p className="search-results-meta">{countLabel}</p>
        </div>
        {onClose ? (
          <button
            type="button"
            className="search-gallery-close"
            onClick={onClose}
            aria-label="Fermer la galerie"
          >
            ×
          </button>
        ) : null}
      </header>
      {ordered.length ? (
        <div className="search-results-scroller" ref={gridRef}>
          <section className="search-gallery-group">
            <h3>
              <i style={{ background: "var(--text)" }} />
              Thèmes
              <span>{ordered.length}</span>
            </h3>
            <div
              className={embedded ? "search-results-list" : "search-gallery-grid"}
              role="listbox"
              aria-label="Plans de lecture"
            >
              {ordered.map((plan) => {
                const current = plan.id === selectedId;
                const active = plan.id === activeId;
                const cover = coverColor(plan.id);
                const preview = snippet(plan.description ?? plan.theme ?? "");
                const { done, total } = progressCounts(plan, loadPlanProgress(plan.id));
                const themeLabel = plan.theme?.trim() || "Plan";
                if (embedded) {
                  return (
                    <button
                      key={plan.id}
                      id={`plan-card-${plan.id}`}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`search-result${current ? " is-on" : ""}${active ? " is-active" : ""}`}
                      onMouseEnter={() => setActiveId(plan.id)}
                      onClick={() => onPick(plan)}
                    >
                      <span className="search-result-cover" style={{ background: cover.fill }}>
                        <span className="search-card-icon" style={{ color: cover.ink }} aria-hidden="true">
                          {plan.nome.slice(0, 1)}
                        </span>
                      </span>
                      <span className="search-result-body">
                        <span className="search-result-title">{plan.nome}</span>
                        {preview ? <span className="search-result-snippet">{preview}</span> : null}
                        <span className="search-card-props">
                          <span className="search-chip">{themeLabel}</span>
                          {total ? (
                            <span className="search-chip">
                              {done}/{total} j
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  );
                }
                return (
                  <button
                    key={plan.id}
                    id={`plan-card-${plan.id}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`search-card${current ? " is-on" : ""}${active ? " is-active" : ""}`}
                    onMouseEnter={() => setActiveId(plan.id)}
                    onClick={() => onPick(plan)}
                  >
                    <span className="search-card-cover" style={{ background: cover.fill }}>
                      <span className="search-card-icon" style={{ color: cover.ink }} aria-hidden="true">
                        {plan.nome.slice(0, 1)}
                      </span>
                    </span>
                    <span className="search-card-body">
                      <span className="search-card-title">{plan.nome}</span>
                      {preview ? <span className="search-card-snippet">{preview}</span> : null}
                      <span className="search-card-props">
                        <span className="search-chip">{themeLabel}</span>
                        {total ? (
                          <span className="search-chip">
                            {done}/{total} j
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        <div className="search-gallery-empty">
          <p className="search-gallery-empty-title">Aucun plan</p>
          <p className="muted">Synchronise Notion pour charger la galerie de plans.</p>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="panel-resumo">{content}</div>;
  }

  return <div className="caderno-gallery">{content}</div>;
}
