import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const srcPath = "C:/Users/Clevy/Downloads/logo.svg";
const svg = fs.readFileSync(srcPath);
const brand = "#0D1117";

fs.mkdirSync(path.join(root, "brand"), { recursive: true });
fs.copyFileSync(srcPath, path.join(root, "brand", "logo-official.svg"));
fs.copyFileSync(srcPath, path.join(root, "public", "favicon.svg"));
fs.writeFileSync(path.join(root, "brand", "logo-icon.svg"), svg);

const publicDir = path.join(root, "public");
await sharp(svg).resize(512, 512).png().toFile(path.join(publicDir, "icon-512.png"));
await sharp(svg).resize(192, 192).png().toFile(path.join(publicDir, "icon-192.png"));
await sharp(svg).resize(64, 64).png().toFile(path.join(publicDir, "favicon.png"));

const res = path.join(root, "android/app/src/main/res");

const launcher = {
  mdpi: { icon: 48, fg: 108 },
  hdpi: { icon: 72, fg: 162 },
  xhdpi: { icon: 96, fg: 216 },
  xxhdpi: { icon: 144, fg: 324 },
  xxxhdpi: { icon: 192, fg: 432 },
};

for (const [density, sizes] of Object.entries(launcher)) {
  const dir = path.join(res, `mipmap-${density}`);
  fs.mkdirSync(dir, { recursive: true });
  const icon = await sharp(svg).resize(sizes.icon, sizes.icon).png().toBuffer();
  await fs.promises.writeFile(path.join(dir, "ic_launcher.png"), icon);
  await fs.promises.writeFile(path.join(dir, "ic_launcher_round.png"), icon);
  await sharp(svg)
    .resize(sizes.fg, sizes.fg)
    .png()
    .toFile(path.join(dir, "ic_launcher_foreground.png"));
}

async function makeSplash(w, h, logoSize) {
  const logo = await sharp(svg).resize(logoSize, logoSize).png().toBuffer();
  return sharp({
    create: { width: w, height: h, channels: 3, background: brand },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toBuffer();
}

const splashes = [
  ["drawable", 480, 800, 220],
  ["drawable-port-mdpi", 320, 480, 160],
  ["drawable-port-hdpi", 480, 800, 220],
  ["drawable-port-xhdpi", 720, 1280, 320],
  ["drawable-port-xxhdpi", 960, 1600, 420],
  ["drawable-port-xxxhdpi", 1280, 1920, 520],
  ["drawable-land-mdpi", 480, 320, 140],
  ["drawable-land-hdpi", 800, 480, 200],
  ["drawable-land-xhdpi", 1280, 720, 280],
  ["drawable-land-xxhdpi", 1600, 960, 360],
  ["drawable-land-xxxhdpi", 1920, 1280, 440],
];

for (const [folder, w, h, logoSize] of splashes) {
  const dir = path.join(res, folder);
  fs.mkdirSync(dir, { recursive: true });
  const buf = await makeSplash(w, h, logoSize);
  await fs.promises.writeFile(path.join(dir, "splash.png"), buf);
}

fs.writeFileSync(
  path.join(res, "values/ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${brand}</color>
</resources>
`,
);

fs.writeFileSync(
  path.join(res, "drawable/ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportHeight="108"
    android:viewportWidth="108">
    <path
        android:fillColor="${brand}"
        android:pathData="M0,0h108v108h-108z" />
</vector>
`,
);

console.log("OK: logo applied to PWA icons + Android splash/launcher");
