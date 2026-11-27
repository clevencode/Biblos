/**
 * TESTE — tema "Tinted Glassmorphism" no chrome do leitor (topbar, barra
 * inferior, botões flutuantes). Desligado por omissão: sem a flag, o app
 * fica exactamente como está.
 *
 * Ligar (persiste em localStorage até desligar):
 *   ?glass=amber | sapphire | emerald   → liga com essa cor
 *   ?glass=off                          → desliga
 *
 * CSS: `html[data-ui-glass="<cor>"]` define `--accent-rgb`; as regras do
 * vidro só existem sob `html[data-ui-glass]` (ver index.css).
 */
const PARAM = "glass";
const STORE_KEY = "biblos.uiGlass";
const DATA = "uiGlass";

export const GLASS_ACCENTS = ["amber", "sapphire", "emerald"] as const;
export type GlassAccent = (typeof GLASS_ACCENTS)[number];

function isGlassAccent(value: unknown): value is GlassAccent {
  return GLASS_ACCENTS.includes(value as GlassAccent);
}

function readStored(): GlassAccent | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return isGlassAccent(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeStored(value: GlassAccent | null): void {
  try {
    if (value) localStorage.setItem(STORE_KEY, value);
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* private mode / quota */
  }
}

export function setGlassTheme(accent: GlassAccent | null): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (accent) root.dataset[DATA] = accent;
  else delete root.dataset[DATA];
  writeStored(accent);
}

export function bootGlassTheme(): void {
  if (typeof document === "undefined") return;
  const fromUrl = new URLSearchParams(location.search)
    .get(PARAM)
    ?.trim()
    .toLowerCase();
  if (fromUrl === "off" || fromUrl === "0") {
    setGlassTheme(null);
    return;
  }
  if (isGlassAccent(fromUrl)) {
    setGlassTheme(fromUrl);
    return;
  }
  const stored = readStored();
  if (stored) document.documentElement.dataset[DATA] = stored;
}
