import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { transpileModule, ModuleKind } from "typescript";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const base = specifier.startsWith("@/")
        ? new URL("../src/" + specifier.slice(2), import.meta.url)
        : new URL(specifier, context.parentURL);
      for (const ext of [".ts", ".tsx"])
        if (existsSync(new URL(base.href + ext))) return next(base.href + ext, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return {
      format: "module", shortCircuit: true,
      source: transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ModuleKind.ESNext },
      }).outputText,
    };
    return next(url, context);
  },
});

const { availableTravelFilters, activeTravelFilterLabels, readTravelFilterValues } =
  await import("../src/lib/reiseportal-filter-options.ts");
const { filterTravelDiscovery } = await import("../src/lib/reiseportal-search.ts");
const { filterListings } = await import("../src/lib/listings.ts");

const listing = (slug, name, city, country, termKeys) => ({
  id: slug, slug, name, tagline: "", description: "", businessAreas: "", services: [],
  categoryIds: [], location: { city, postalCode: "10115", region: "", country },
  travelTermKeys: termKeys,
});
const approved = [
  listing("alpen-spa", "Alpen Spa", "Berlin", "DE", [
    "theme:wellnessangebote", "audience:paar", "accommodation:hotel", "feature:sauna",
  ]),
  listing("family-hotel", "Family Hotel", "Wien", "AT", [
    "theme:wellnessangebote", "audience:familie", "accommodation:hotel", "feature:pool",
  ]),
  listing("city-pension", "City Pension", "Hamburg", "DE", [
    "theme:natur-pur", "audience:paar", "accommodation:pension", "feature:sauna",
  ]),
  listing("demo", "Demo GmbH", "Berlin", "DE", []),
];
const terms = [
  ["theme:wellnessangebote", "theme", "wellnessangebote", "Wellness"],
  ["theme:natur-pur", "theme", "natur-pur", "Natur"],
  ["audience:paar", "audience", "paar", "Paar"],
  ["audience:familie", "audience", "familie", "Familie"],
  ["audience:gruppe", "audience", "gruppe", "Gruppe"],
  ["accommodation:hotel", "accommodation", "hotel", "Hotel"],
  ["accommodation:pension", "accommodation", "pension", "Pension"],
  ["feature:sauna", "feature", "sauna", "Sauna"],
  ["feature:pool", "feature", "pool", "Pool"],
  ["feature:wlan", "feature", "wlan", "WLAN"],
].map(([term_key, dimension, slug, label]) => ({ term_key, dimension, slug, label }));

test("public filter options need an assigned approved listing and use editorial labels", () => {
  const options = availableTravelFilters(approved, terms);
  assert.deepEqual(options.themes, [
    { slug: "natur-pur", label: "Natur pur" },
    { slug: "wellnessangebote", label: "Wellnessangebote" },
  ]);
  assert.deepEqual(options.audiences.map((item) => item.slug), ["paar", "familie"]);
  assert.deepEqual(options.accommodations.map((item) => item.slug), ["hotel", "pension"]);
  assert.deepEqual(options.features.map((item) => item.label), ["Sauna", "Pool"]);
  assert.ok(!options.audiences.some((item) => item.slug === "gruppe"));
  assert.ok(!options.features.some((item) => item.slug === "wlan"));
  assert.deepEqual(availableTravelFilters([], terms).features, []);
});

test("every taxonomy dimension filters alone and combinations intersect with q, ort and ziel", () => {
  const slugs = (items) => items.map((item) => item.slug);
  assert.deepEqual(slugs(filterTravelDiscovery(approved, "", "wellnessangebote")), ["alpen-spa", "family-hotel"]);
  assert.deepEqual(slugs(filterTravelDiscovery(approved, "", "", "paar")), ["alpen-spa", "city-pension"]);
  assert.deepEqual(slugs(filterTravelDiscovery(approved, "", "", "", "hotel")), ["alpen-spa", "family-hotel"]);
  assert.deepEqual(slugs(filterTravelDiscovery(approved, "", "", "", "", "sauna")), ["alpen-spa", "city-pension"]);
  const matching = (query = "", location = "", destination = "deutschland") =>
    filterTravelDiscovery(filterListings(approved, {
      query, category: "", location, service: "", sort: "",
    }), destination, "wellnessangebote", "paar", "hotel", "sauna");
  assert.deepEqual(slugs(matching()), ["alpen-spa"]);
  assert.deepEqual(slugs(matching("Spa")), ["alpen-spa"]);
  assert.deepEqual(slugs(matching("", "Berlin")), ["alpen-spa"]);
  assert.deepEqual(slugs(matching("", "", "oesterreich")), []);
  assert.deepEqual(slugs(matching("unpassend")), []);
  assert.equal(matching().length, 1);
});

test("a copied URL restores values and human labels; reset removes all filters", () => {
  const params = Object.fromEntries(new URLSearchParams(
    "ziel=deutschland&thema=wellnessangebote&zielgruppe=paar&unterkunftstyp=hotel&besonderheit=sauna&q=Spa&ort=Berlin",
  ));
  const values = readTravelFilterValues(params);
  assert.deepEqual(values, {
    destination: "deutschland", theme: "wellnessangebote", audience: "paar",
    accommodation: "hotel", feature: "sauna", query: "Spa", location: "Berlin", sort: "",
  });
  const labels = activeTravelFilterLabels(values, availableTravelFilters(approved, terms));
  assert.deepEqual(labels, ["Reiseziel: Deutschland", "Reiseart: Wellnessangebote",
    "Mit wem: Paar", "Unterkunft: Hotel", "Besonderheit: Sauna", "Suche: Spa", "Ort/PLZ: Berlin"]);
  assert.ok(labels.every((label) => !/theme:|audience:|feature:|accommodation:/.test(label)));
  assert.deepEqual(readTravelFilterValues({}), {
    destination: "", theme: "", audience: "", accommodation: "", feature: "",
    query: "", location: "", sort: "",
  });
  assert.deepEqual(activeTravelFilterLabels(readTravelFilterValues({}), availableTravelFilters(approved, terms)), []);
  assert.deepEqual(readTravelFilterValues({ thema: ["natur-pur", "wellnessangebote"] }).theme, "");
});
