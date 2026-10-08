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
        url: "data:text/javascript,export async function approveTravelProfile(){};export async function rejectTravelProfile(){}",
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

const { ReviewActions } = await import("../src/components/admin/review-actions.tsx");
function render(status, canReview=true) { return renderToStaticMarkup(createElement(ReviewActions,{profileId:"test-profile",status,canReview})); }
test("pending travel review has explicit decisions and no energy trades",()=>{
 const html=render("pending");assert.match(html,/Firma erstmalig freischalten/);assert.match(html,/Rückfrage erforderlich/);assert.doesNotMatch(html,/type="checkbox"|Öffentliche Gewerke|Trockenbau|Außenbereich|disabled/);
 const denied=render("pending",false);assert.equal((denied.match(/disabled=""/g)||[]).length,2);assert.match(denied,/gesonderte Freigabeberechtigung/);
});
test("approved, draft and rejected states never offer another initial approval",()=>{
 for(const status of ['approved','draft','rejected']) {const html=render(status);assert.doesNotMatch(html,/Firma erstmalig freischalten|Rückfrage erforderlich|Gewerke speichern/);assert.match(html,/Profil/);}
});
