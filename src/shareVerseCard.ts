/** Génère un cartão PNG de verset pour le partage (canvas). */

export type VerseShareCardInput = {
  brand?: string;
  refLabel: string;
  verseText: string;
  accentHex?: string | null;
  /** Lien verset sur l’image (pied) ; corps = texte seul. Copie = ref + verset + lien. */
  shareUrl?: string;
  footer?: string;
};

export type PlanShareCardInput = {
  brand?: string;
  /** Titre du plan (thème). */
  title: string;
  /** Intro / Devotional (texte brut). */
  description?: string;
  /** Ex. « 40 jours » / « 4 étapes ». */
  meta?: string;
  accentHex?: string | null;
  shareUrl?: string;
};

/** Affiche un lien lisible sur le cartão (sans schéma https://). */
export function formatShareUrlForCard(url: string): string {
  return String(url || "")
    .trim()
    .replace(/^https?:\/\//i, "");
}

/** Retire markdown / HTML léger pour le canvas. */
export function plainShareText(raw: string): string {
  return String(raw || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\*\*|__/g, "")
    .replace(/\*|_|~~|`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const VERSE_SHARE_CARD_WIDTH = 1080;

const W = VERSE_SHARE_CARD_WIDTH;
const H_PLAN = 1350;
const PAD_X = 88;
const PAD_TOP = 88;
const PAD_BOTTOM = 72;
const GAP_AFTER_BRAND = 36;
const GAP_REF_BODY = 32;
const GAP_BODY_FOOTER = 44;
const FOOTER_RULE_OFFSET = 28;

const VERSE_FONT_PX = 44;
const VERSE_LINE_HEIGHT = 66;
const REF_FONT_PX = 32;
const REF_LINE_HEIGHT = 42;
const BRAND_FONT_PX = 52;
const LINK_FONT_PX = 26;
const LINK_LINE_HEIGHT = 36;
const PARA_GAP = 22;
/** Limite pratique navigateur / PNG (hauteur totale du canvas). */
const MAX_CARD_HEIGHT = 16_000;

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

/** Paragraphes conservés (`\n`) ; chaque bloc est renvoyé à la largeur utile. */
function wrapParagraphs(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const normalized = plainShareText(text);
  if (!normalized) return [];
  const chunks = normalized.split("\n");
  const lines: string[] = [];
  for (const chunkRaw of chunks) {
    const chunk = chunkRaw.trim();
    if (!chunk) continue;
    if (lines.length) lines.push("");
    lines.push(...wrapLines(ctx, chunk, maxWidth));
  }
  return lines.length ? lines : wrapLines(ctx, normalized, maxWidth);
}

function blockHeight(lines: string[], lineHeight: number, paraGap = PARA_GAP): number {
  let h = 0;
  for (const line of lines) {
    h += line === "" ? paraGap : lineHeight;
  }
  return h;
}

function fillDarkCardBackground(
  ctx: CanvasRenderingContext2D,
  height: number,
): void {
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#141a22");
  bg.addColorStop(0.55, "#0d1117");
  bg.addColorStop(1, "#0a0d12");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, height);
}

async function ensureVerseCardFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load(`700 ${BRAND_FONT_PX}px Outfit`),
      document.fonts.load(`600 ${REF_FONT_PX}px Outfit`),
      document.fonts.load(`400 ${LINK_FONT_PX}px Outfit`),
      document.fonts.load(`italic 400 ${VERSE_FONT_PX}px Source Serif 4`),
    ]);
  } catch {
    /* system fallbacks */
  }
}

async function ensurePlanCardFonts(): Promise<void> {
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

function measureVerseCardHeight(
  refLines: string[],
  verseLines: string[],
  linkLines: string[],
): number {
  const afterBrand = PAD_TOP + 34 + BRAND_FONT_PX + GAP_AFTER_BRAND;
  const refBlock = refLines.length ? blockHeight(refLines, REF_LINE_HEIGHT) : 0;
  const bodyBlock = blockHeight(verseLines, VERSE_LINE_HEIGHT);
  const linkBlock = linkLines.length ? blockHeight(linkLines, LINK_LINE_HEIGHT, 0) : 0;
  const bottom =
    afterBrand +
    refBlock +
    (refLines.length ? GAP_REF_BODY : 0) +
    bodyBlock +
    GAP_BODY_FOOTER +
    FOOTER_RULE_OFFSET +
    (linkLines.length ? linkBlock : 0) +
    PAD_BOTTOM;
  return Math.min(MAX_CARD_HEIGHT, Math.ceil(bottom));
}

function drawWrappedBlock(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  paraGap = PARA_GAP,
): number {
  let cursorY = y;
  for (const line of lines) {
    if (line === "") {
      cursorY += paraGap;
      continue;
    }
    ctx.fillText(line, x, cursorY);
    cursorY += lineHeight;
  }
  return cursorY;
}

export async function renderVerseShareCard(
  input: VerseShareCardInput,
): Promise<Blob> {
  await ensureVerseCardFonts();

  const accent = accentForDarkCard(input.accentHex);
  const brand = (input.brand || "Biblos").trim();
  const refLabel = String(input.refLabel || "").trim().toUpperCase();
  const verseText = String(input.verseText || "").trim();
  const linkDraw = formatShareUrlForCard(String(input.shareUrl || "").trim());
  const maxTextWidth = W - PAD_X * 2;

  const measureCanvas = document.createElement("canvas");
  measureCanvas.width = W;
  measureCanvas.height = 10;
  const measureCtx = measureCanvas.getContext("2d");
  if (!measureCtx) throw new Error("Canvas indisponible");

  measureCtx.font = `italic 400 ${VERSE_FONT_PX}px Source Serif 4, Georgia, serif`;
  const verseLines = wrapParagraphs(measureCtx, verseText, maxTextWidth);

  measureCtx.font = `600 ${REF_FONT_PX}px Outfit, Avenir Next, Segoe UI, sans-serif`;
  const refLines = refLabel ? wrapLines(measureCtx, refLabel, maxTextWidth) : [];

  measureCtx.font = `400 ${LINK_FONT_PX}px Outfit, Avenir Next, Segoe UI, sans-serif`;
  const linkLines = linkDraw ? wrapLines(measureCtx, linkDraw, maxTextWidth) : [];

  const H = measureVerseCardHeight(refLines, verseLines, linkLines);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");

  fillDarkCardBackground(ctx, H);

  ctx.textBaseline = "top";

  ctx.fillStyle = accent;
  ctx.fillRect(PAD_X, PAD_TOP, 72, 6);

  ctx.fillStyle = "#F5F2EB";
  ctx.font = `700 ${BRAND_FONT_PX}px Outfit, Avenir Next, Segoe UI, sans-serif`;
  ctx.fillText(brand, PAD_X, PAD_TOP + 34);

  let y = PAD_TOP + 34 + BRAND_FONT_PX + GAP_AFTER_BRAND;

  if (refLines.length) {
    ctx.fillStyle = accent;
    ctx.font = `600 ${REF_FONT_PX}px Outfit, Avenir Next, Segoe UI, sans-serif`;
    y = drawWrappedBlock(ctx, refLines, PAD_X, y, REF_LINE_HEIGHT, 0);
    y += GAP_REF_BODY;
  }

  ctx.fillStyle = "#E8E4DC";
  ctx.font = `italic 400 ${VERSE_FONT_PX}px Source Serif 4, Georgia, serif`;
  y = drawWrappedBlock(ctx, verseLines, PAD_X, y, VERSE_LINE_HEIGHT);

  const ruleY = y + GAP_BODY_FOOTER;
  ctx.strokeStyle = "rgba(245, 242, 235, 0.14)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD_X, ruleY);
  ctx.lineTo(W - PAD_X, ruleY);
  ctx.stroke();

  if (linkLines.length) {
    ctx.fillStyle = "rgba(245, 242, 235, 0.52)";
    ctx.font = `400 ${LINK_FONT_PX}px Outfit, Avenir Next, Segoe UI, sans-serif`;
    drawWrappedBlock(ctx, linkLines, PAD_X, ruleY + FOOTER_RULE_OFFSET, LINK_LINE_HEIGHT, 0);
  }

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

/** Cartão PNG pour partager un plan de lecture (pas un verset). */
export async function renderPlanShareCard(
  input: PlanShareCardInput,
): Promise<Blob> {
  await ensurePlanCardFonts();

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H_PLAN;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");

  const accent = accentForDarkCard(input.accentHex);
  const brand = (input.brand || "Biblos").trim();
  const title = plainShareText(input.title || "Plan de lecture");
  const description = plainShareText(input.description || "");
  const meta = plainShareText(input.meta || "");

  fillDarkCardBackground(ctx, H_PLAN);

  ctx.fillStyle = accent;
  ctx.fillRect(PAD_X, PAD_TOP, 72, 6);

  ctx.fillStyle = "#F5F2EB";
  ctx.font = "700 56px Outfit, Avenir Next, Segoe UI, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(brand, PAD_X, PAD_TOP + 28);

  const maxTextWidth = W - PAD_X * 2;

  ctx.fillStyle = accent;
  ctx.font = "600 28px Outfit, Avenir Next, Segoe UI, sans-serif";
  ctx.fillText("PLAN DE LECTURE", PAD_X, PAD_TOP + 110);

  ctx.fillStyle = "#F5F2EB";
  ctx.font = "700 52px Outfit, Avenir Next, Segoe UI, sans-serif";
  let titleLines = wrapLines(ctx, title, maxTextWidth);
  titleLines = truncateLines(titleLines, 3);
  let y = PAD_TOP + 160;
  for (const line of titleLines) {
    ctx.fillText(line, PAD_X, y);
    y += 62;
  }

  if (meta) {
    y += 12;
    ctx.fillStyle = "rgba(245, 242, 235, 0.58)";
    ctx.font = "500 28px Outfit, Avenir Next, Segoe UI, sans-serif";
    ctx.fillText(meta, PAD_X, y);
    y += 48;
  }

  if (description) {
    y += 16;
    ctx.fillStyle = "#E8E4DC";
    ctx.font = "italic 400 40px Source Serif 4, Georgia, serif";
    const bodyMax = Math.max(4, Math.floor((H_PLAN - PAD_BOTTOM - 80 - y) / 58));
    let bodyLines = wrapLines(ctx, description, maxTextWidth);
    bodyLines = truncateLines(bodyLines, Math.min(10, bodyMax));
    for (const line of bodyLines) {
      ctx.fillText(line, PAD_X, y);
      y += 58;
    }
  }

  const footerY = H_PLAN - PAD_BOTTOM;
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
