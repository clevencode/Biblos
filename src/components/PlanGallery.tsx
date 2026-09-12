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

const THEME_HUES = [18, 32, 205, 228, 265, 340, 152, 188];

function coverStyle(id: string): { background: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  const hue = THEME_HUES[hash % THEME_HUES.length];
  const hue2 = (hue + 28) % 360;
  return {
    background: [
      `radial-gradient(120% 90% at 8% 0%, hsl(${hue} 42% 46% / 0.9) 0%, transparent 52%)`,
      `radial-gradient(80% 70% at 100% 110%, hsl(${hue2} 38% 22%) 0%, transparent 55%)`,
      `linear-gradient(165deg, hsl(${hue} 28% 14%), hsl(${hue} 36% 28%))`,
    ].join(", "),
  };
}

function planTitle(plan: ReadingPlan): string {
  const theme = plan.theme?.trim() ?? "";
  const nome = plan.nome?.trim() ?? "";
  const generic = (value: string) => !value || /^plan$/i.test(value);
  if (!generic(theme)) return theme;
  if (!generic(nome)) return nome;
  return theme || nome || "Plan";
}

function snippet(raw: string, title: string): string {
  const foldedTitle = title.toLowerCase();
  const paragraphs = raw
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/<[^>]+>/g, " ")
        .replace(/[*_`#]+/g, "")
        .replace(/^\d+\.\s+/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((line) => {
      if (!line || line.length < 36) return false;
      if (line.toLowerCase() === foldedTitle) return false;
      if (/^(grande synthèse|introduction|conséquence|conclusion)\b/i.test(line)) return false;
      return true;
    });
  const prose =
    paragraphs.find((line) => /[.!?]/.test(line)) ?? paragraphs[0] ?? "";
  if (!prose) return "";
  return prose.length > 108 ? `${prose.slice(0, 106).trim()}…` : prose;
}

/** Galerie de plans — cartões Discover (capa + durée + progrès). */
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
      <header className="plan-discover-head">
        <div>
          <h2 className="plan-discover-title">Plans</h2>
          <p className="plan-discover-meta">{countLabel}</p>
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
      {ordered.length ? (
        <div className="plan-discover-scroller" ref={gridRef}>
          <div
            className={`plan-discover-grid${embedded ? " is-stack" : ""}`}
            role="listbox"
            aria-label="Plans de lecture"
          >
            {ordered.map((plan) => {
              const current = plan.id === selectedId;
              const active = plan.id === activeId;
              const title = planTitle(plan);
              const preview = snippet(plan.description ?? "", title);
              const { done, total } = progressCounts(plan, loadPlanProgress(plan.id));
              const started = done > 0;
              const complete = total > 0 && done >= total;
              const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
              const action = complete ? "Terminé" : started ? "Continuer" : "Commencer";
              return (
                <button
                  key={plan.id}
                  id={`plan-card-${plan.id}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`plan-tile${current ? " is-on" : ""}`}
                  onMouseEnter={() => setActiveId(plan.id)}
                  onFocus={() => setActiveId(plan.id)}
                  onClick={() => onPick(plan)}
                >
                  <span className="plan-tile-art" style={coverStyle(plan.id)}>
                    <span className="plan-tile-mark" aria-hidden="true">
                      {title.charAt(0)}
                    </span>
                    {total ? <span className="plan-tile-days">{total} jours</span> : null}
                    <span className="plan-tile-name">{title}</span>
                    {preview ? <span className="plan-tile-blurb">{preview}</span> : null}
                    {total && started ? (
                      <span className="plan-tile-progress" aria-hidden="true">
                        <span className="plan-tile-progress-track">
                          <span className="plan-tile-progress-fill" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="plan-tile-progress-label">
                          {complete ? "Terminé" : `${done}/${total}`}
                        </span>
                      </span>
                    ) : null}
                  </span>
                  <span className="plan-tile-cta">
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
          <p className="plan-discover-empty-title">Aucun plan</p>
          <p className="muted">Tes plans apparaîtront ici dès qu’ils seront disponibles.</p>
        </div>
      )}
    </>
  );

  return <div className={`plan-discover${embedded ? " is-embedded" : ""}`}>{content}</div>;
}
