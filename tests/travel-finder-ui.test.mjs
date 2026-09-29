import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "next/navigation") return { url: 'data:text/javascript,export function useRouter(){return {push(){}}}', shortCircuit: true };
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const base = specifier.startsWith("@/")
        ? new URL("../src/" + specifier.slice(2), import.meta.url) : new URL(specifier, context.parentURL);
      for (const ext of [".ts", ".tsx"])
        if (existsSync(new URL(base.href + ext))) return next(base.href + ext, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts") || url.endsWith(".tsx")) return {
      format: "module", shortCircuit: true,
      source: transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX },
      }).outputText,
    };
    return next(url, context);
  },
});

const { TravelFinder } = await import("../src/components/portal/travel-finder.tsx");
const { availableTravelFilters, readTravelFilterValues } = await import("../src/lib/reiseportal-filter-options.ts");
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const listing = (slug, country, terms, premium = false) => ({
  id: slug, slug, name: slug, tagline: "", description: "", businessAreas: "", services: [],
  categoryIds: [], location: { city: "Berlin", postalCode: "10115", region: "", country },
  travelTermKeys: terms, directoryPackage: premium ? "premium" : "basic", images: [],
  contact: { email: "", phone: "", website: "" }, isDemo: false, initials: "AB",
});
const listings = [
  listing("spa", "DE", ["theme:wellnessangebote", "audience:paar", "accommodation:hotel", "feature:sauna"], true),
  listing("camp", "AT", ["theme:campingurlaub", "audience:familie", "accommodation:camping"]),
];
const terms = [
  ["theme:wellnessangebote", "theme", "wellnessangebote", "Wellness"],
  ["theme:campingurlaub", "theme", "campingurlaub", "Camping"],
  ["audience:paar", "audience", "paar", "Paar"],
  ["audience:familie", "audience", "familie", "Familie"],
  ["accommodation:hotel", "accommodation", "hotel", "Hotel"],
  ["accommodation:camping", "accommodation", "camping", "Camping"],
  ["feature:sauna", "feature", "sauna", "Sauna"],
].map(([term_key, dimension, slug, label]) => ({ term_key, dimension, slug, label }));
const options = availableTravelFilters(listings, terms);
const render = (values, mode = "directory") => renderToStaticMarkup(createElement(TravelFinder,
  { mode, listings, options, values, onChange() {} }));

test("both routes use the same video finder and show actual initial totals", () => {
  const home = source("src/app/(energieheld)/page.tsx");
  assert.match(home, /<HomeTravelFinder listings=/);
  assert.match(home, /searchableThemes\.has\(entry\.slug\)/);
  assert.match(home, /href=\{`\/unterkuenfte-a-z\?thema=\$\{entry\.slug\}`\}/);
  assert.match(source("src/components/portal/travel-directory.tsx"), /<TravelFinder mode="directory"/);
  const html = render(readTravelFilterValues({}));
  assert.match(html, /hero-loop\.mp4/);
  assert.match(html, /Finde deinen passenden Urlaub/);
  assert.match(html, /2 Unterkünfte anzeigen/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /Jahreszeit|Zeitraum/);
});

test("selected facets retain their label, zero options stay visible and disabled, and chips can be removed", () => {
  const html = render(readTravelFilterValues({ ziel: "deutschland", thema: "wellnessangebote" }));
  assert.match(html, /1 Unterkunft anzeigen/);
  assert.match(html, /Wellnessangebote \(1\)/);
  assert.match(html, /Campingurlaub \(0\)/);
  assert.match(html, /value="campingurlaub" disabled/);
  assert.match(html, /Reiseart: Wellnessangebote entfernen/);
  assert.match(html, /Alle Filter zurücksetzen/);
  assert.match(render(readTravelFilterValues({ q: "unpassend" })), /Keine passenden Unterkünfte/);
});

test("A–Z keeps hero above results, updates the URL locally and has mobile layout rules", () => {
  const directory = source("src/components/portal/travel-directory.tsx");
  const css = source("src/app/globals.css");
  assert.ok(directory.indexOf("<TravelFinder") < directory.indexOf("unterkunft-ergebnisse"));
  assert.match(directory, /window\.history\.replaceState/);
  assert.match(directory, /filterTravelListings\(listings, values\)/);
  assert.match(directory, /DirectoryOrderEditor/);
  assert.match(css, /\.reise-finder-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(css, /\.reise-finder-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/);
});
