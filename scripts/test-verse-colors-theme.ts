/**
 * Résolution de couleur de marquage selon le thème.
 * Usage: npx tsx scripts/test-verse-colors-theme.ts
 */
import assert from "node:assert/strict";
import {
  hexToHsv,
  resolveVerseMarkColor,
  themeMaxSaturation,
  themeTargetValue,
} from "../src/verseColors.ts";

const vividPink = "#d1007f";

/** Tolérance RGB↔HSV (quantification 8 bits). */
const EPS = 0.02;

{
  const dark = resolveVerseMarkColor(vividPink, "dark");
  const { s, v } = hexToHsv(dark);
  assert.ok(
    s <= themeMaxSaturation("dark") + EPS,
    `dark S ${s} should be ≤ ${themeMaxSaturation("dark")}`,
  );
  assert.ok(
    Math.abs(v - themeTargetValue("dark")) < EPS,
    `dark V ${v} should ≈ ${themeTargetValue("dark")}`,
  );
  assert.notEqual(dark.toLowerCase(), vividPink.toLowerCase());
}

{
  const light = resolveVerseMarkColor(vividPink, "light");
  const { s, v } = hexToHsv(light);
  assert.ok(s <= themeMaxSaturation("light") + EPS);
  assert.ok(Math.abs(v - themeTargetValue("light")) < EPS);
  assert.ok(
    v < hexToHsv(resolveVerseMarkColor(vividPink, "dark")).v,
    "light target V should be lower than dark",
  );
}

{
  const once = resolveVerseMarkColor(vividPink, "dark");
  const twice = resolveVerseMarkColor(once, "dark");
  assert.equal(twice, once, "resolve must be idempotent for a theme");
}

{
  const once = resolveVerseMarkColor("#2563eb", "light");
  assert.equal(resolveVerseMarkColor(once, "light"), once);
}

console.log("test-verse-colors-theme: ok");
