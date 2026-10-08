import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
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
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const base = specifier.startsWith("@/") ? new URL("../src/"+specifier.slice(2),import.meta.url) : new URL(specifier,context.parentURL);
      for(const ext of [".ts",".tsx"]) if(existsSync(new URL(base.href+ext))) return nextResolve(base.href+ext,context);
    }
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
function render(status, canReview=true) { return renderToStaticMarkup(createElement(ReviewActions,{profileId:"test-profile",status,canReview,expectedRevision:3})); }
test("pending travel review has explicit decisions and no energy trades",()=>{
 const html=render("pending");assert.match(html,/Profil veröffentlichen/);assert.match(html,/Rückfrage an Gastgeber/);assert.doesNotMatch(html,/type="checkbox"|Öffentliche Gewerke|Trockenbau|Außenbereich|disabled/);
 const denied=render("pending",false);assert.equal((denied.match(/disabled=""/g)||[]).length,2);assert.match(denied,/Portal-Adminrechte/);
});
test("approved, draft and rejected states never offer another initial approval",()=>{
 for(const status of ['approved','draft','rejected']) {const html=render(status);assert.doesNotMatch(html,/Profil veröffentlichen|Rückfrage an Gastgeber|Gewerke speichern/);assert.match(html,/Profil/);}
});
