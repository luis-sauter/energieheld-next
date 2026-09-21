import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "./helpers/load-ts.mjs";

// Render the real client component locally; Server Actions aren't executed here.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith("/admin/actions"))
      return {
        url: "data:text/javascript,export async function approveProfile(){};export async function rejectProfile(){};export async function saveCategories(){}",
        shortCircuit: true,
      };
    if (specifier.endsWith(".module.css"))
      return {
        url: "data:text/javascript,export default {}",
        shortCircuit: true,
      };
    if (specifier.startsWith("@/"))
      return nextResolve(
        new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href,
        context,
      );
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".tsx"))
      return {
        format: "module",
        shortCircuit: true,
        source: transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX },
        }).outputText,
      };
    return nextLoad(url, context);
  },
});
const { ReviewActions } =
  await import("../src/components/admin/review-actions.tsx");
const { energieheld } = await import("../src/config/energieheld.ts");
function render(status, initialCategoryIds = []) {
  return renderToStaticMarkup(
    createElement(ReviewActions, {
      profileId: "test-profile",
      status,
      initialCategoryIds,
    }),
  );
}

test("admin UI renders every canonical category and preselects previous assignments", () => {
  const html = render("pending", ["daemmung", "fassade"]);
  assert.equal(
    (html.match(/type="checkbox"/g) ?? []).length,
    energieheld.categories.length,
  );
  for (const category of energieheld.categories)
    assert.ok(html.includes(`value="${category.id}"`));
  for (const input of html.match(/<input[^>]+>/g)) {
    assert.equal(
      input.includes('checked=""'),
      /value="(?:daemmung|fassade)"/.test(input),
    );
  }
});

test("reviewed and draft profiles show specific messages and disable category changes", () => {
  for (const [status, message] of [
    ["rejected", "Für dieses Profil wurden Änderungen angefordert."],
    ["draft", "Dieses Profil wurde noch nicht zur Prüfung eingereicht."],
  ]) {
    const html = render(status, ["dach"]);
    assert.ok(html.includes(message));
    assert.match(html, /<fieldset[^>]*disabled=""/);
    for (const button of html.match(/<button[^>]+>/g))
      assert.ok(button.includes('disabled=""'));
  }
});

test("published company categories remain editable without another publication review", () => {
  const html = render("approved", ["dach"]);
  assert.match(html, /Gewerke speichern/);
  assert.doesNotMatch(html, /<fieldset[^>]*disabled/);
  assert.doesNotMatch(html, /Rückfrage erforderlich/);
});
