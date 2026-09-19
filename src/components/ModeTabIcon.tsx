import type { ReactNode } from "react";
import type { CenterMode } from "../types";

type ModeTabIconProps = {
  name: CenterMode;
  active?: boolean;
};

type TabGlyph = (props: { active: boolean }) => ReactNode;

const STROKE = {
  width: 1.5,
  active: 1.75,
  cap: "round" as const,
  join: "round" as const,
};

/** Accueil — toit + base, sans porte ni cheminée. */
function IconHome({ active }: { active: boolean }) {
  const sw = active ? STROKE.active : STROKE.width;
  return (
    <>
      <path
        d="M4.75 11.25 12 5.25l7.25 6"
        fill="none"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap={STROKE.cap}
        strokeLinejoin={STROKE.join}
      />
      <path
        d="M7 10.75v7.5h10v-7.5"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.12 : undefined}
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap={STROKE.cap}
        strokeLinejoin={STROKE.join}
      />
    </>
  );
}

/** Plan — cadre + repère du jour (pas de grille). */
function IconPlan({ active }: { active: boolean }) {
  const sw = active ? STROKE.active : STROKE.width;
  return (
    <>
      <rect
        x="5.25"
        y="6.25"
        width="13.5"
        height="13"
        rx="2.25"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.12 : undefined}
        stroke="currentColor"
        strokeWidth={sw}
      />
      <path
        d="M8.5 4.75v2.75M15.5 4.75v2.75M5.25 10.25h13.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap={STROKE.cap}
      />
      <circle
        cx="12"
        cy="14.75"
        r={active ? 1.65 : 1.35}
        fill="currentColor"
        stroke="none"
      />
    </>
  );
}

/** Bible — livre ouvert, trait léger. */
function IconBible({ active }: { active: boolean }) {
  const sw = active ? STROKE.active : STROKE.width;
  return (
    <>
      <path
        d="M12 6.75c-1.85-.95-4.6-.95-6.5 0v10.5c1.9-.85 4.65-.85 6.5.15 1.85-1 4.6-1 6.5-.15V6.75c-1.9-.95-4.65-.95-6.5 0Z"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.12 : undefined}
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap={STROKE.cap}
        strokeLinejoin={STROKE.join}
      />
      <path
        d="M12 6.75v10.65"
        fill="none"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap={STROKE.cap}
      />
    </>
  );
}

/** Cartes — deux cartes décalées. */
function IconCards({ active }: { active: boolean }) {
  const sw = active ? STROKE.active : STROKE.width;
  return (
    <>
      <rect
        x="8"
        y="4.75"
        width="10.5"
        height="13.5"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth={sw}
        opacity={0.45}
      />
      <rect
        x="5.5"
        y="6.75"
        width="10.5"
        height="13.5"
        rx="2"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.12 : undefined}
        stroke="currentColor"
        strokeWidth={sw}
      />
    </>
  );
}

/** Profil — tête + épaules, silhouette ouverte. */
function IconProfile({ active }: { active: boolean }) {
  const sw = active ? STROKE.active : STROKE.width;
  return (
    <>
      <circle
        cx="12"
        cy="8.5"
        r="3.15"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.14 : undefined}
        stroke="currentColor"
        strokeWidth={sw}
      />
      <path
        d="M6.25 18.75c.35-3.1 2.85-4.6 5.75-4.6s5.4 1.5 5.75 4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap={STROKE.cap}
      />
    </>
  );
}

const ICONS: Record<CenterMode, TabGlyph> = {
  home: IconHome,
  today: IconPlan,
  bible: IconBible,
  cards: IconCards,
  profile: IconProfile,
};

/** Tab icons — traits fins custom (pas Material générique). */
export function ModeTabIcon({ name, active = false }: ModeTabIconProps) {
  const Glyph = ICONS[name];
  return (
    <svg
      className={`mode-tab-icon${active ? " is-filled" : ""}`}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <Glyph active={active} />
    </svg>
  );
}
