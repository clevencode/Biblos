/** Génère un cartão PNG de verset pour le partage (canvas). */

export type VerseShareCardInput = {
  brand?: string;
  refLabel: string;
  verseText: string;
  accentHex?: string | null;
  footer?: string;
};

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
      document.fonts.load("400 48px Libre Baskerville"),
      document.fonts.load("italic 400 48px Libre Baskerville"),
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

  const accent = normalizeHex(input.accentHex);
  const brand = (input.brand || "Biblos").trim();
  const refLabel = String(input.refLabel || "").trim().toUpperCase();
  const verseText = String(input.verseText || "").trim();
  const footer = (input.footer || "biblo.digital").trim();

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

  // Reference
  ctx.fillStyle = accent;
  ctx.font = "600 34px Outfit, Avenir Next, Segoe UI, sans-serif";
  ctx.fillText(refLabel, PAD_X, PAD_TOP + 110);

  // Verse body
  const maxTextWidth = W - PAD_X * 2;
  ctx.fillStyle = "#E8E4DC";
  ctx.font = "italic 400 46px Libre Baskerville, Georgia, serif";
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

  // Footer rule + site
  const footerY = H - PAD_BOTTOM;
  ctx.strokeStyle = "rgba(245, 242, 235, 0.14)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD_X, footerY - 36);
  ctx.lineTo(W - PAD_X, footerY - 36);
  ctx.stroke();

  ctx.fillStyle = "rgba(245, 242, 235, 0.55)";
  ctx.font = "500 28px Outfit, Avenir Next, Segoe UI, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(footer, PAD_X, footerY);

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
