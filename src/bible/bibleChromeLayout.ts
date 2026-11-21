/** Hamburger compact à droite (outils Bible) en lecture mobile — la tab bar reste visible. */
export const BIBLE_COMPACT_TOOLS_MENU =
  String(import.meta.env.VITE_BIBLE_UNIFIED_NAV ?? "1").trim() !== "0";
