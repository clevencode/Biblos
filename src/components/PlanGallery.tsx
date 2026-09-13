import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { loadPlanProgress, progressCounts } from "../planProgress";
import { planCoverStyle, planTitle } from "../planTheme";
import type { ReadingPlan } from "../types";

type PlanGalleryProps = {
  plans: ReadingPlan[];
  selectedId?: string | null;
  embedded?: boolean;
  onPick: (plan: ReadingPlan) => void;
  onClose?: () => void;
};

type PlanProgressFilter = "tout" | "attente" | "cours" | "termines";

const PLAN_FILTERS: { id: PlanProgressFilter; label: string }[] = [
  { id: "tout", label: "Tout" },
  { id: "attente", label: "Attente" },
  { id: "cours", label: "En cours" },
  { id: "termines", label: "Terminé" },
];

const EMPTY_COPY: Record<PlanProgressFilter, { title: string; body: string }> = {
  tout: {
    title: "Aucun plan",
    body: "Tes plans de lecture apparaîtront ici.",
  },
  attente: {
    title: "Aucun plan en attente",
    body: "Les plans à commencer apparaîtront ici.",
  },
  cours: {
    title: "Aucun plan en cours",
    body: "Commence un plan pour le retrouver ici.",
  },
  termines: {
    title: "Aucun plan terminé",
    body: "Tes plans conclus s’afficheront ici.",
  },
};

function planBucket(plan: ReadingPlan): Exclude<PlanProgressFilter, "tout"> {
  const { done, total } = progressCounts(plan, loadPlanProgress(plan.id));
  if (total > 0 && done >= total) return "termines";
  if (done > 0) return "cours";
  return "attente";
}

/** Galerie de plans — liste compacte (filtre + lignes). */
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

  const filterCounts = useMemo(() => {
    const counts: Record<PlanProgressFilter, number> = {
      tout: 0,
      attente: 0,
      cours: 0,
      termines: 0,
    };
    for (const plan of ordered) {
      counts.tout += 1;
      counts[planBucket(plan)] += 1;
    }
    return counts;
  }, [ordered]);

  const [filter, setFilter] = useState<PlanProgressFilter>("tout");
  const tabsRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () =>
      filter === "tout"
        ? ordered
        : ordered.filter((plan) => planBucket(plan) === filter),
    [ordered, filter],
  );

  useEffect(() => {
    const active = tabsRef.current?.querySelector<HTMLElement>(
      `.flash-deck-tab[aria-selected="true"]`,
    );
    active?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [filter]);

  function selectFilter(next: PlanProgressFilter, focus = false) {
    setFilter(next);
    if (!focus) return;
    requestAnimationFrame(() => {
      document.getElementById(`plan-gallery-tab-${next}`)?.focus();
    });
  }

  function onTabListKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const index = PLAN_FILTERS.findIndex((item) => item.id === filter);
    if (index < 0) return;
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (index + 1) % PLAN_FILTERS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (index - 1 + PLAN_FILTERS.length) % PLAN_FILTERS.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = PLAN_FILTERS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    selectFilter(PLAN_FILTERS[next]!.id, true);
  }

  const [activeId, setActiveId] = useState(selectedId ?? filtered[0]?.id ?? "");

  useEffect(() => {
    if (filtered.some((plan) => plan.id === activeId)) return;
    setActiveId(
      selectedId && filtered.some((plan) => plan.id === selectedId)
        ? selectedId
        : (filtered[0]?.id ?? ""),
    );
  }, [activeId, filtered, selectedId]);

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
      if (!filtered.length) return;
      const typing = event.target instanceof HTMLElement && event.target.closest("input, textarea");
      if (typing) return;
      const index = Math.max(0, filtered.findIndex((plan) => plan.id === activeId));
      let next = index;
      if (event.key === "ArrowDown") next = Math.min(filtered.length - 1, index + 1);
      else if (event.key === "ArrowUp") next = Math.max(0, index - 1);
      else if (event.key === "Enter") {
        const current = filtered[index];
        if (!current) return;
        event.preventDefault();
        onPick(current);
        return;
      } else return;
      if (next === index) return;
      event.preventDefault();
      const id = filtered[next]!.id;
      setActiveId(id);
      reveal(id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, filtered, onPick]);

  const empty = EMPTY_COPY[filter];

  const content = (
    <>
      <header className="plan-discover-head">
        <div
          ref={tabsRef}
          className="flash-deck-tabs plan-discover-tabs"
          role="tablist"
          aria-label="Filtrer les plans par progression"
          onKeyDown={onTabListKeyDown}
        >
          {PLAN_FILTERS.map((item) => {
            const count = filterCounts[item.id];
            const selected = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`plan-gallery-tab-${item.id}`}
                className={`flash-deck-tab${selected ? " is-on" : ""}${count === 0 ? " is-empty" : ""}`}
                aria-selected={selected}
                aria-controls="plan-gallery-list"
                tabIndex={selected ? 0 : -1}
                onClick={() => selectFilter(item.id)}
                aria-label={`${item.label}, ${count} plan${count === 1 ? "" : "s"}`}
              >
                <span className="flash-deck-tab-label">{item.label}</span>
                <span className="flash-deck-tab-count" aria-hidden>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        {onClose ? (
          <button
            type="button"
            className="plan-discover-close"
            onClick={onClose}
            aria-label="Fermer les plans"
          >
            ×
          </button>
        ) : null}
      </header>
      {filtered.length ? (
        <div className="plan-discover-scroller" ref={gridRef}>
          <div
            id="plan-gallery-list"
            className={`plan-discover-grid${embedded ? " is-stack" : ""}`}
            role="listbox"
            aria-label={PLAN_FILTERS.find((item) => item.id === filter)?.label ?? "Plans"}
          >
            {filtered.map((plan) => {
              const current = plan.id === selectedId;
              const active = plan.id === activeId;
              const title = planTitle(plan);
              const { done, total } = progressCounts(plan, loadPlanProgress(plan.id));
              const started = done > 0;
              const complete = total > 0 && done >= total;
              const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
              const action = complete ? "Terminé" : started ? "Continuer" : "Commencer";
              const metaParts = [
                total ? `${total} jour${total === 1 ? "" : "s"}` : null,
                started && !complete ? `${done}/${total}` : null,
                complete ? "Terminé" : null,
              ].filter(Boolean);
              return (
                <button
                  key={plan.id}
                  id={`plan-card-${plan.id}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`plan-card${current ? " is-on" : ""}${active ? " is-active" : ""}`}
                  onMouseEnter={() => setActiveId(plan.id)}
                  onFocus={() => setActiveId(plan.id)}
                  onClick={() => onPick(plan)}
                >
                  <span className="plan-card-swatch" style={planCoverStyle(plan.id)} aria-hidden="true">
                    <span className="plan-card-mark">{title.charAt(0)}</span>
                  </span>
                  <span className="plan-card-body">
                    <span className="plan-card-title">{title}</span>
                    {metaParts.length ? (
                      <span className="plan-card-meta">{metaParts.join(" · ")}</span>
                    ) : null}
                    {total && started ? (
                      <span className="plan-card-progress" aria-hidden="true">
                        <span className="plan-card-progress-track">
                          <span className="plan-card-progress-fill" style={{ width: `${pct}%` }} />
                        </span>
                      </span>
                    ) : null}
                  </span>
                  <span className="plan-card-cta">
                    {action}
                    <span aria-hidden="true">›</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="plan-discover-empty">
          <p className="plan-discover-empty-title">{empty.title}</p>
          <p className="muted">{empty.body}</p>
        </div>
      )}
    </>
  );

  return <div className={`plan-discover${embedded ? " is-embedded" : ""}`}>{content}</div>;
}
