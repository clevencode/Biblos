/**
 * Ícone oficial Biblos = coolicons Book (fill/round) branco em #0D1117.
 * Gera favicon/PWA + mipmaps Android + splash.
 *
 * Uso: node scripts/generate-app-icons.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const INK = "#0D1117";
const PAPER = "#FFFFFF";

/** Path coolicons Book fill/round (viewBox 0 0 24 24). */
const BOOK_FILL_D =
  "M4 19V7C4 4.239 6.239 2 9 2H15C17.761 2 20 4.239 20 7V15C20 16.298 19.162 17.451 17.928 17.854C17.513 20.248 15.43 21.998 13 22H7C5.343 22 4 20.657 4 19ZM7 18C6.448 18 6 18.448 6 19C6 19.552 6.448 20 7 20H13C14.271 20 15.406 19.199 15.83 18Z";

function bookSvg({
  size,
  padRatio = 0.22,
  fill = PAPER,
  background = null,
}) {
  const vb = 24;
  const pad = vb * padRatio;
  const inner = vb - pad * 2;
  const scale = inner / vb;
  const tx = pad;
  const ty = pad;
  const bg =
    background != null
      ? `<rect width="${vb}" height="${vb}" fill="${background}"/>`
      : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${vb} ${vb}" fill="none">
${bg}
  <g transform="translate(${tx} ${ty}) scale(${scale})">
    <path d="${BOOK_FILL_D}" fill="${fill}"/>
  </g>
</svg>`;
}

async function pngFromSvg(svg, size) {
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
}

async function writePng(filePath, buf) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buf);
  console.log("wrote", path.relative(root, filePath));
}

async function main() {
  const publicDir = path.join(root, "public");
  const resDir = path.join(root, "android", "app", "src", "main", "res");

  // Master SVG (web favicon)
  const faviconSvg = bookSvg({ size: 512, padRatio: 0.2, background: INK });
  await writeFile(path.join(publicDir, "favicon.svg"), faviconSvg);
  console.log("wrote public/favicon.svg");

  const webSolid = bookSvg({ size: 512, padRatio: 0.2, background: INK });
  await writePng(path.join(publicDir, "favicon.png"), await pngFromSvg(webSolid, 48));
  await writePng(path.join(publicDir, "icon-192.png"), await pngFromSvg(webSolid, 192));
  await writePng(path.join(publicDir, "icon-512.png"), await pngFromSvg(webSolid, 512));
  await writePng(
    path.join(publicDir, "apple-touch-icon.png"),
    await pngFromSvg(webSolid, 180),
  );

  // Android adaptive foreground (transparent) + legacy full icons
  const densities = [
    { name: "mdpi", launcher: 48, foreground: 108 },
    { name: "hdpi", launcher: 72, foreground: 162 },
    { name: "xhdpi", launcher: 96, foreground: 216 },
    { name: "xxhdpi", launcher: 144, foreground: 324 },
    { name: "xxxhdpi", launcher: 192, foreground: 432 },
  ];

  for (const d of densities) {
    const dir = path.join(resDir, `mipmap-${d.name}`);
    const fgSvg = bookSvg({
      size: d.foreground,
      padRatio: 0.28,
      fill: PAPER,
      background: null,
    });
    const solidSvg = bookSvg({
      size: d.launcher,
      padRatio: 0.22,
      fill: PAPER,
      background: INK,
    });
    await writePng(
      path.join(dir, "ic_launcher_foreground.png"),
      await pngFromSvg(fgSvg, d.foreground),
    );
    const launcher = await pngFromSvg(solidSvg, d.launcher);
    await writePng(path.join(dir, "ic_launcher.png"), launcher);
    await writePng(path.join(dir, "ic_launcher_round.png"), launcher);
  }

  // Splash PNGs — BookFill centrado em #0D1117
  const splashTargets = [
    { dir: "drawable", w: 480, h: 800 },
    { dir: "drawable-port-mdpi", w: 320, h: 480 },
    { dir: "drawable-port-hdpi", w: 480, h: 800 },
    { dir: "drawable-port-xhdpi", w: 720, h: 1280 },
    { dir: "drawable-port-xxhdpi", w: 1080, h: 1920 },
    { dir: "drawable-port-xxxhdpi", w: 1440, h: 2560 },
    { dir: "drawable-land-mdpi", w: 480, h: 320 },
    { dir: "drawable-land-hdpi", w: 800, h: 480 },
    { dir: "drawable-land-xhdpi", w: 1280, h: 720 },
    { dir: "drawable-land-xxhdpi", w: 1920, h: 1080 },
    { dir: "drawable-land-xxxhdpi", w: 2560, h: 1440 },
  ];

  for (const t of splashTargets) {
    const glyph = Math.round(Math.min(t.w, t.h) * 0.28);
    const iconSvg = bookSvg({
      size: glyph,
      padRatio: 0.08,
      fill: PAPER,
      background: null,
    });
    const iconBuf = await sharp(Buffer.from(iconSvg))
      .resize(glyph, glyph)
      .png()
      .toBuffer();
    const left = Math.round((t.w - glyph) / 2);
    const top = Math.round((t.h - glyph) / 2);
    const buf = await sharp({
      create: {
        width: t.w,
        height: t.h,
        channels: 3,
        background: INK,
      },
    })
      .composite([{ input: iconBuf, left, top }])
      .png()
      .toBuffer();
    await writePng(path.join(resDir, t.dir, "splash.png"), buf);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
