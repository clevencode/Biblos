/** Génère un cartão PNG de verset pour le partage (canvas). */

export type VerseShareCardInput = {
  brand?: string;
  refLabel: string;
  verseText: string;
  accentHex?: string | null;
  /** URL de partage affichée sous la marque (à la place de la référence). */
  shareUrl?: string;
  footer?: string;
};

/** Affiche un lien lisible sur le cartão (sans schéma https://). */
export function formatShareUrlForCard(url: string): string {
  return String(url || "")
    .trim()
    .replace(/^https?:\/\//i, "");
}

const W = 1080;
const H = 1350;
const PAD_X = 88;
const PAD_TOP = 96;
const PAD_BOTTOM = 88;

function normalizeHex(hex: string | null | undefined): string {
  const raw = String(hex || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[1]!;
    const g = raw[2]!;
    const b = raw[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return "#C4A574";
}

/** Accent lisible sur le fond sombre fixe du cartão (indépendant du thème app). */
function accentForDarkCard(hex: string | null | undefined): string {
  const normalized = normalizeHex(hex);
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  // Trop sombre → or par défaut ; trop clair → légèrement assombri
  if (luminance < 0.28) return "#C4A574";
  if (luminance > 0.78) {
    const darken = (c: number) => Math.max(0, Math.round(c * 0.72));
    const toHex = (c: number) => darken(c).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }
  return normalized;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = words[0]!;
  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[i]!;
    }
  }
  lines.push(current);
  return lines;
}

function truncateLines(lines: string[], maxLines: number): string[] {
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1] ?? "";
  kept[maxLines - 1] = `${last.replace(/\s+\S*$/, "").trimEnd()}…`;
  return kept;
}

async function ensureFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load("700 64px Outfit"),
      document.fonts.load("500 36px Outfit"),
      document.fonts.load("400 48px Source Serif 4"),
      document.fonts.load("italic 400 48px Source Serif 4"),
    ]);
  } catch {
    /* system fallbacks */
  }
}

export async function renderVerseShareCard(
  input: VerseShareCardInput,
): Promise<Blob> {
  await ensureFonts();

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");

  const accent = accentForDarkCard(input.accentHex);
  const brand = (input.brand || "Biblos").trim();
  const verseText = String(input.verseText || "").trim();
  const link = formatShareUrlForCard(
    input.shareUrl || input.footer || "biblo.digital",
  );

  // Fond sombre sobrio
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#141a22");
  bg.addColorStop(0.55, "#0d1117");
  bg.addColorStop(1, "#0a0d12");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Accent bar
  ctx.fillStyle = accent;
  ctx.fillRect(PAD_X, PAD_TOP, 72, 6);

  // Brand
  ctx.fillStyle = "#F5F2EB";
  ctx.font = "700 56px Outfit, Avenir Next, Segoe UI, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(brand, PAD_X, PAD_TOP + 28);

  // Lien de partage (à la place de la référence)
  const maxTextWidth = W - PAD_X * 2;
  ctx.fillStyle = accent;
  ctx.font = "600 30px Outfit, Avenir Next, Segoe UI, sans-serif";
  let linkDraw = link;
  while (linkDraw.length > 8 && ctx.measureText(linkDraw).width > maxTextWidth) {
    linkDraw = `${linkDraw.slice(0, -2)}…`;
  }
  ctx.fillText(linkDraw, PAD_X, PAD_TOP + 110);

  // Verse body
  ctx.fillStyle = "#E8E4DC";
  ctx.font = "italic 400 46px Source Serif 4, Georgia, serif";
  const lineHeight = 68;
  let lines = wrapLines(ctx, verseText, maxTextWidth);
  const maxLines = 12;
  lines = truncateLines(lines, maxLines);

  const textTop = PAD_TOP + 200;
  let y = textTop;
  for (const line of lines) {
    ctx.fillText(line, PAD_X, y);
    y += lineHeight;
  }

  // Pied : règle discrète (le lien est déjà sous la marque)
  const footerY = H - PAD_BOTTOM;
  ctx.strokeStyle = "rgba(245, 242, 235, 0.14)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD_X, footerY - 36);
  ctx.lineTo(W - PAD_X, footerY - 36);
  ctx.stroke();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Échec de l’export PNG"));
      },
      "image/png",
      0.92,
    );
  });
}
