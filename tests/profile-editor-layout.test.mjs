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

test("editor text follows live section alignment and paired columns stack on mobile", () => {
  const editor = source("src/components/admin/inline-block-layout.tsx");
  const css = source("src/components/admin/inline-profile.module.css");
  const rowCss = source("src/components/portal/profile-content-blocks.module.css");
  assert.match(editor, /textAlign: block\.type === "image_grid" \? undefined : previewTextAlign/);
  assert.match(css, /\.layoutBlock \.blockForm input, \.layoutBlock \.blockForm textarea[^}]*text-align: inherit/);
  assert.match(rowCss, /@media \(max-width: 640px\)[\s\S]*\.contentColumn \{ grid-column: 1 \/ -1 !important/);
  const profileCss = source("src/components/portal/company-profile.css");
  assert.match(profileCss, /\.profile-head-grid \{ display: grid; grid-template-columns: minmax\(0, 1\.6fr\) minmax\(300px, 1fr\)/);
  assert.match(profileCss, /\.profile-header-media \.gallery-main \{ aspect-ratio: 1/);
  assert.match(profileCss, /\.contact-logo \{ width: 120px; height: 120px; aspect-ratio: 1/);
});

test("country save has only the missing column privilege, preserving existing RLS", () => {
  const migration = source("supabase/migrations/20260928160000_grant_profile_country_edit.sql");
  assert.match(migration, /GRANT UPDATE \(country\) ON public\.company_profiles TO authenticated/);
  assert.doesNotMatch(migration, /CREATE POLICY|ALTER POLICY|TO anon|GRANT UPDATE ON/);
});
