import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts"))
    return next(new URL(specifier + ".ts", context.parentURL).href, context);
  return next(specifier, context);
} });
const { contentBlockRows, contentColumn } = await import("../src/lib/content-block-rows.ts");
const { adjacentImageLayout } = await import("../src/lib/adjacent-image-layout.ts");

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const block = (id, type, width, offset) => ({ id, type, config: {
  width_percent: width, offset_percent: offset, spacing_top: "normal", spacing_bottom: "normal",
} });

test("text and image columns share a row on either side, with heading above text", () => {
  const heading = block("h", "heading", 50, 0);
  const textBlock = block("t", "text", 50, 0);
  const image = block("i", "image_grid", 50, 50);
  assert.deepEqual(contentBlockRows([heading, textBlock, image]), [{ left: [heading, textBlock], right: [image] }]);
  const imageLeft = block("l", "image_grid", 25, 0);
  const headingRight = block("r", "heading", 75, 25);
  const textRight = block("rt", "text", 75, 25);
  assert.deepEqual(contentBlockRows([imageLeft, headingRight, textRight]), [
    { left: [imageLeft], right: [headingRight, textRight] },
  ]);
  assert.equal(contentColumn(image), "51 / span 50");
  assert.equal(contentColumn(headingRight), "26 / span 75");
  assert.equal(contentBlockRows([block("full", "text", 100, 0), image]).length, 2);
});

test("image beside text supports both sides and all three width ratios", () => {
  for (const share of [25, 50, 75]) for (const side of ["left", "right"]) {
    const layout = adjacentImageLayout(side, share);
    assert.equal(layout.imageWidth + layout.textWidth, 100);
    const text = block("text", "text", layout.textWidth, layout.textOffset);
    const image = block("image", "image_grid", layout.imageWidth, layout.imageOffset);
    const row = contentBlockRows(side === "left" ? [image, text] : [text, image]);
    assert.equal(row.length, 1);
    assert.deepEqual(row[0].left, side === "left" ? [image] : [text]);
    assert.deepEqual(row[0].right, side === "left" ? [text] : [image]);
  }
  assert.equal(adjacentImageLayout("above", 50), null);
  assert.equal(adjacentImageLayout("left", 30), null);
});

test("editor text follows live section alignment and paired columns stack on mobile", () => {
  const editor = source("src/components/admin/inline-block-layout.tsx");
  const css = source("src/components/admin/inline-profile.module.css");
  const rowCss = source("src/components/portal/profile-content-blocks.module.css");
  assert.match(editor, /textAlign: block\.type === "image_grid" \? undefined : previewTextAlign/);
  assert.match(css, /\.layoutBlock \.blockForm input, \.layoutBlock \.blockForm textarea[^}]*text-align: inherit/);
  assert.match(rowCss, /@media \(max-width: 640px\)[\s\S]*\.contentColumn \{ grid-column: 1 \/ -1 !important/);
  const profileCss = source("src/components/portal/company-profile.css");
  assert.match(profileCss, /\.profile-head-grid \{ display: grid; grid-template-columns: minmax\(0, 2\.5fr\) minmax\(280px, 1fr\);[^}]*align-items: stretch/);
  assert.match(profileCss, /@media \(max-width: 820px\)[\s\S]*\.profile-head-grid \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(profileCss, /\.profile-head-grid > \* \{ min-width: 0/);
  assert.match(profileCss, /\.profile-location \.location-map \{ min-height: clamp\(240px, 25vw, 340px\)/);
  assert.match(profileCss, /\.profile-location > div:last-child \{ padding: 12px 18px/);
  assert.match(source("src/components/admin/inline-profile.module.css"), /\.adjacentPreview \{[^}]*grid-template-columns: repeat\(100, minmax\(0, 1fr\)\)/);
  assert.match(source("src/components/admin/inline-profile.module.css"), /@media \(max-width: 640px\)[\s\S]*\.adjacentPreviewText, \.adjacentPreviewImage \{ grid-column: 1 \/ -1 !important/);
  assert.match(profileCss, /\.profile-header-media \.gallery-main \{[^}]*aspect-ratio: 2\.2/);
  assert.match(profileCss, /\.contact-card \{[^}]*height: 100%/);
  assert.match(profileCss, /\.contact-logo \{ width: 88px; height: 88px; aspect-ratio: 1/);
});

test("country save has only the missing column privilege, preserving existing RLS", () => {
  const migration = source("supabase/migrations/20260928160000_grant_profile_country_edit.sql");
  assert.match(migration, /GRANT UPDATE \(country\) ON public\.company_profiles TO authenticated/);
  assert.doesNotMatch(migration, /CREATE POLICY|ALTER POLICY|TO anon|GRANT UPDATE ON/);
});

test("one wrapper exposes layout, visibility and confirmed deletion for every editorial block", () => {
  const wrapper = source("src/components/admin/inline-block-layout.tsx");
  const editor = source("src/components/admin/inline-content-editor.tsx");
  const actions = source("src/lib/admin-profile-content.ts");
  assert.match(wrapper, /\[25, 50, 75, 100\]/);
  assert.match(wrapper, /Blockposition/);
  assert.match(wrapper, /Textausrichtung/);
  assert.match(wrapper, /Abstand/);
  assert.match(wrapper, /Block nach oben verschieben/);
  assert.match(wrapper, /Block nach unten verschieben/);
  assert.match(wrapper, /section-duplicate/);
  assert.match(wrapper, /block-toggle/);
  assert.match(wrapper, /window\.confirm\("Diesen Abschnitt wirklich löschen\? Der Inhalt wird dauerhaft entfernt\."\)/);
  assert.match(wrapper, /styles\.destructiveAction/);
  assert.match(editor, /Bild daneben hinzufügen/);
  assert.match(editor, /pair-delete/);
  assert.match(actions, /checkInlineProfileTarget/);
  assert.match(actions, /findEditorialPair/);
});

test("profile head stays wide and shallow across desktop and mobile breakpoints", () => {
  const css = source("src/components/portal/company-profile.css");
  for (const viewport of [1440, 1280, 1024]) {
    const usable = Math.min(viewport, 1240) - 40;
    const media = Math.max(0, usable - 20 - 280);
    const right = Math.max(280, (usable - 20) / 3.5);
    assert.ok(media > right, `${viewport}px desktop media should be wider`);
  }
  assert.match(css, /\.profile-head-grid \{[^}]*align-items: stretch/);
  assert.match(css, /\.profile-header-media \.gallery-main \{[^}]*aspect-ratio: 2\.2/);
  assert.match(css, /\.gallery-main img \{[^}]*object-fit: cover/);
  assert.match(css, /\.profile-location \.location-map \{ min-height: clamp\(240px, 25vw, 340px\)/);
  for (const viewport of [768, 390, 360]) assert.ok(viewport <= 820);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.profile-head-grid \{ grid-template-columns: minmax\(0, 1fr\)/);
});
