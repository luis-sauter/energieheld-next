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
  assert.deepEqual(Object.keys(importedJoomlaMedia).sort(), [
    "anni-romantikhaeuschen", "golfhotel-andreus", "hotel-zur-post",
    "wirodive-tauchreisen", "wirthshof",
  ]);
  for (const [slug, media] of Object.entries(importedJoomlaMedia)) {
    assert.ok(media.logo, slug);
    for (const image of [media.logo, ...media.images])
      assert.ok(existsSync(asset(image.src)), `${slug}: ${image.src}`);
  }
});

test("the obsolete hero image is not a video poster or CSS fallback", () => {
  const home = readFileSync(new URL("../src/app/(energieheld)/page.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(home, /<video autoPlay muted loop playsInline preload="metadata"/);
  assert.doesNotMatch(home, /hero\.jpg|poster=/);
  assert.doesNotMatch(css, /hero\.jpg/);
});
