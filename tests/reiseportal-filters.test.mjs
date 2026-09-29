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
const { filterTravelListings, travelFacetCount, travelFilterUrl } =
  await import("../src/lib/reiseportal-facets.ts");

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
  assert.deepEqual(options.destinations.map((item) => item.slug), ["deutschland", "oesterreich"]);
  assert.ok(!options.audiences.some((item) => item.slug === "gruppe"));
  assert.ok(!options.features.some((item) => item.slug === "wlan"));
  assert.deepEqual(availableTravelFilters([], terms).features, []);
});

test("shared finder counts each real facet against all other selected dimensions", () => {
  const empty = readTravelFilterValues({});
  assert.equal(filterTravelListings(approved, empty).length, 4);
  assert.equal(travelFacetCount(approved, empty, "destination", "deutschland"), 3);
  assert.equal(travelFacetCount(approved, empty, "destination", "oesterreich"), 1);
  assert.equal(travelFacetCount(approved, empty, "theme", "wellnessangebote"), 2);
  const germany = { ...empty, destination: "deutschland" };
  assert.equal(travelFacetCount(approved, germany, "theme", "wellnessangebote"), 1);
  assert.equal(travelFacetCount(approved, germany, "theme", "natur-pur"), 1);
  const narrowed = { ...germany, theme: "wellnessangebote", audience: "paar", accommodation: "hotel" };
  assert.equal(filterTravelListings(approved, narrowed).length, 1);
  assert.equal(travelFacetCount(approved, narrowed, "feature", "pool"), 0);
  assert.equal(travelFacetCount(approved, narrowed, "feature", "sauna"), 1);
  assert.equal(filterTravelListings(approved, { ...narrowed, query: "Alpen", location: "Berlin" }).length, 1);
  assert.equal(filterTravelListings(approved, { ...narrowed, query: "unpassend" }).length, 0);
});

test("filtered ordering keeps Premium ahead of Basic and respects sorting inside each group", () => {
  const items = approved.map((item, index) => ({ ...item, directoryPackage: index === 1 || index === 2 ? "premium" : "basic" }));
  const values = { ...readTravelFilterValues({}), sort: "name" };
  assert.deepEqual(filterTravelListings(items, values).map((item) => item.slug),
    ["city-pension", "family-hotel", "alpen-spa", "demo"]);
  assert.deepEqual(filterTravelListings(items, { ...values, destination: "deutschland" }).map((item) => item.slug),
    ["city-pension", "alpen-spa", "demo"]);
});

test("existing single-value URL parameters round-trip and reset together", () => {
  const values = readTravelFilterValues({ ziel: "deutschland", thema: "wellnessangebote", zielgruppe: "paar",
    unterkunftstyp: "hotel", besonderheit: "sauna", q: "Alpen Spa", ort: "Berlin", sort: "city" });
  const url = travelFilterUrl(values);
  assert.equal(url, "/unterkuenfte-a-z?ziel=deutschland&thema=wellnessangebote&zielgruppe=paar&unterkunftstyp=hotel&besonderheit=sauna&q=Alpen+Spa&ort=Berlin&sort=city");
  assert.deepEqual(readTravelFilterValues(Object.fromEntries(new URL(url, "https://example.test").searchParams)), values);
  assert.equal(travelFilterUrl(readTravelFilterValues({})), "/unterkuenfte-a-z");
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
