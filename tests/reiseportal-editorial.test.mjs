import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { travelThemes } from "../src/data/reiseportal-discovery.ts";
import { importedJoomlaMedia } from "../src/data/reiseportal-import-media.ts";

const asset = (path) => new URL(`../public${path}`, import.meta.url);

test("all twelve published Joomla theme banners are present as real JPEGs", () => {
  assert.equal(travelThemes.length, 12);
  assert.equal(new Set(travelThemes.map((theme) => theme.image)).size, 12);
  assert.equal(new Set(travelThemes.map((theme) => theme.intro)).size, 12);
  for (const theme of travelThemes) {
    assert.ok(theme.image?.endsWith(".jpg"), theme.slug);
    const bytes = readFileSync(asset(theme.image));
    assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff], theme.slug);
  }
  assert.ok(existsSync(asset("/reiseportal/mottoreisen-intro.jpg")));
});

test("selected Joomla provider media refer only to existing local originals", () => {
  const originalProviders = [
    "anni-romantikhaeuschen", "golfhotel-andreus", "hotel-zur-post",
    "wirodive-tauchreisen", "wirthshof",
  ];
  for (const slug of originalProviders) assert.ok(importedJoomlaMedia[slug]?.logo, slug);
  assert.equal(Object.keys(importedJoomlaMedia).length, 24);
  for (const [slug, media] of Object.entries(importedJoomlaMedia)) {
    for (const image of [media.logo, ...media.images].filter(Boolean))
      assert.ok(existsSync(asset(image.src)), `${slug}: ${image.src}`);
  }
});

test("the video remains the hero medium and the still image is only a reduced-motion fallback", () => {
  const home = readFileSync(new URL("../src/app/(energieheld)/page.tsx", import.meta.url), "utf8");
  const finder = readFileSync(new URL("../src/components/portal/travel-finder.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(home, /<HomeTravelFinder/);
  assert.match(finder, /<video autoPlay muted loop playsInline preload="metadata"/);
  assert.doesNotMatch(home, /hero\.jpg|poster=/);
  assert.match(css, /\.travel-hero\s*\{[^}]*hero\.jpg/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.travel-hero > video \{ display: none; \}/);
});
