import { useMemo } from "react";
import { YvIcon } from "./YvIcon";
import { listBibleReadingHistory } from "../activityLog";
import { loadOrCreateProfile } from "../userProfile";

type HomeShellPanelProps = {
  active: boolean;
  activityTick: number;
  onOpenBible: (ref?: string) => void;
  onOpenPlan: () => void;
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

export function HomeShellPanel({
  active,
  activityTick,
  onOpenBible,
  onOpenPlan,
}: HomeShellPanelProps) {
  const profile = loadOrCreateProfile();
  const recent = useMemo(() => {
    void activityTick;
    return listBibleReadingHistory(profile.id, 1)[0] ?? null;
  }, [activityTick, profile.id]);

  const resumeLabel =
    recent && typeof recent.meta?.label === "string" && recent.meta.label.trim()
      ? String(recent.meta.label)
      : recent?.meta?.usfm
        ? String(recent.meta.usfm)
        : "Jean 3.16";

  const resumeRef =
    recent?.meta?.usfm && typeof recent.meta.usfm === "string"
      ? recent.meta.usfm.replace(/\./g, " ")
      : undefined;

  return (
    <div
      id="panel-home"
      role="tabpanel"
      aria-labelledby="tab-home"
      hidden={!active}
      className="pane-body home-view"
    >
      <header className="home-head">
        <div className="home-head-copy">
          <p className="home-greeting type-caption">{greeting()}</p>
          <h1 className="home-name type-headline">Biblos</h1>
        </div>
      </header>

      <section className="home-section" aria-labelledby="home-resume-title">
        <div className="home-section-head">
          <h2 id="home-resume-title" className="home-section-title type-eyebrow">
            Reprendre
          </h2>
        </div>
        <button
          type="button"
          className="home-verse-card"
          onClick={() => onOpenBible(resumeRef)}
        >
          <p className="home-verse-text type-body">
            {recent ? "Continuer votre lecture" : "Commencer dans la Bible"}
          </p>
          <p className="home-verse-ref type-label">{resumeLabel}</p>
        </button>
      </section>

      <section className="home-section" aria-labelledby="home-plan-teaser">
        <div className="home-section-head">
          <h2 id="home-plan-teaser" className="home-section-title type-eyebrow">
            Plans de lecture
          </h2>
          <button type="button" className="home-section-link type-label" onClick={onOpenPlan}>
            Voir
          </button>
        </div>
        <div className="home-empty">
          <p>Choisissez un parcours guidé dans l’onglet Plan.</p>
          <button type="button" className="home-empty-cta type-label" onClick={onOpenPlan}>
            <YvIcon name="menu_book" opsz={20} className="yv-icon" aria-hidden />
            Parcourir les plans
          </button>
        </div>
      </section>
    </div>
  );
}
