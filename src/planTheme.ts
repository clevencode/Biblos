import type { ReadingPlan } from "./types";

const THEME_HUES = [18, 32, 205, 228, 265, 340, 152, 188];

export function planTitle(plan: ReadingPlan): string {
  const theme = plan.theme?.trim() ?? "";
  const nome = plan.nome?.trim() ?? "";
  const generic = (value: string) => !value || /^plan$/i.test(value);
  if (!generic(theme)) return theme;
  if (!generic(nome)) return nome;
  return theme || nome || "Plan";
}

export function planCoverStyle(id: string): { background: string } {
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
