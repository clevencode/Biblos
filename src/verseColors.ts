/** Surligneurs style YouVersion — défaut bleu. */
export type VerseColor = {
  id: string;
  hex: string;
  label: string;
};

export const VERSE_COLORS: readonly VerseColor[] = [
  { id: "blue", hex: "#2563eb", label: "Bleu" },
  { id: "yellow", hex: "#e8b923", label: "Jaune" },
  { id: "green", hex: "#22a06b", label: "Vert" },
  { id: "orange", hex: "#e56910", label: "Orange" },
  { id: "pink", hex: "#e65caa", label: "Rose" },
  { id: "purple", hex: "#8270db", label: "Violet" },
] as const;

export const DEFAULT_VERSE_COLOR = VERSE_COLORS[0]!.hex;

export function normalizeVerseColor(value: string | null | undefined): string {
  const hex = String(value || "").trim().toLowerCase();
  const match = VERSE_COLORS.find((c) => c.hex.toLowerCase() === hex || c.id === hex);
  return match?.hex ?? DEFAULT_VERSE_COLOR;
}
