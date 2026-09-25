import test from "node:test";
import assert from "node:assert/strict";
import { sortByDirectoryOrder, moveDirectoryId, realDirectoryIds, directoryItemKey } from "../src/lib/company-directory-order.ts";
import { filterListings } from "../src/lib/listings.ts";
import { listings, travelListing } from "../src/data/listings.ts";
import { readFileSync } from "node:fs";

const profiles = [
  { id: "c", name: "Cäsar", tagline: "Solar", description: "", businessAreas: "Solar", services: [], categoryIds: ["solar"], location: { city: "Berlin", postalCode: "10115", region: "Berlin" } },
  { id: "a", name: "Alpha", tagline: "Dach", description: "", businessAreas: "Dach", services: [], categoryIds: ["dach"], location: { city: "Zürich", postalCode: "8000", region: "Zürich" } },
  { id: "b", name: "Beta", tagline: "Solar", description: "", businessAreas: "Solar", services: [], categoryIds: ["solar"], location: { city: "Augsburg", postalCode: "86150", region: "Bayern" } },
  { id: "e", name: "Echo", tagline: "Dach", description: "", businessAreas: "Dach", services: [], categoryIds: ["dach"], location: { city: "Berlin", postalCode: "10115", region: "Berlin" } },
  { id: "d", name: "Delta", tagline: "Solar", description: "", businessAreas: "Solar", services: [], categoryIds: ["solar"], location: { city: "Augsburg", postalCode: "86150", region: "Bayern" } },
];
const ids = (rows) => rows.map((row) => row.id);
const filters = { query: "", category: "", location: "", service: "", sort: "" };

test("explicit positions precede unordered profiles; equal positions and fallback use IDs", () => {
  const ordered = sortByDirectoryOrder(profiles, [
    { profile_id: "b", sort_order: 0 },
    { profile_id: "a", sort_order: 0 },
    { profile_id: "c", sort_order: 2 },
  ]);
  assert.deepEqual(ids(ordered), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(ids(profiles), ["c", "a", "b", "e", "d"]);
});

test("query, category and location preserve manual order; explicit sorts override it", () => {
  const ordered = sortByDirectoryOrder(profiles, [
    { profile_id: "d", sort_order: 0 },
    { profile_id: "c", sort_order: 1 },
    { profile_id: "e", sort_order: 2 },
    { profile_id: "b", sort_order: 3 },
    { profile_id: "a", sort_order: 4 },
  ]);
  assert.deepEqual(ids(ordered), ["d", "c", "e", "b", "a"]);
  assert.deepEqual(ids(filterListings(ordered, { ...filters, query: "solar" })), ["d", "c", "b"]);
  assert.deepEqual(ids(filterListings(ordered, { ...filters, category: "dach" })), ["e", "a"]);
  assert.deepEqual(ids(filterListings(ordered, { ...filters, location: "berlin" })), ["c", "e"]);
  assert.deepEqual(ids(filterListings(ordered, { ...filters, sort: "name" })), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(ids(filterListings(ordered, { ...filters, sort: "city" })), ["d", "b", "c", "e", "a"]);
});

test("arrow and pointer preview move locally without changing the source array", () => {
  const source = ["a", "b", "c"];
  assert.deepEqual(moveDirectoryId(source, 1, 0), ["b", "a", "c"]);
  assert.deepEqual(moveDirectoryId(source, 1, 2), ["a", "c", "b"]);
  assert.deepEqual(moveDirectoryId(source, 0, 2), ["b", "c", "a"]);
  assert.deepEqual(source, ["a", "b", "c"]);
  assert.equal(moveDirectoryId(source, 0, -1), source);
});

test("only real profile IDs become the reorder payload", () => {
  assert.deepEqual(realDirectoryIds([
    { id: "real-a", isDemo: false },
    { id: "example", isDemo: true },
    { id: "real-b", isDemo: false },
  ]), ["real-a", "real-b"]);
});

test("migration demo seed matches exactly the static directory examples, excluding travelListing", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260925103400_directory_demo_and_sidebar_order.sql", import.meta.url), "utf8");
  const seed = migration.match(/WITH demo\(slug, position\) AS \(VALUES([\s\S]*?)\)\s*INSERT INTO public\.company_directory_order/);
  assert.ok(seed);
  const slugs = [...seed[1].matchAll(/\('([a-z0-9-]+)',\s*\d+\)/g)].map((match) => match[1]);
  assert.deepEqual(slugs, listings.map((listing) => listing.slug));
  assert.equal(slugs.includes(travelListing.slug), false);
});

test("real and demo keys interleave; new approved real without a row follows known items", () => {
  const real = { ...profiles[0], id: "real-id", slug: "real-slug", isDemo: false };
  const newReal = { ...profiles[1], id: "new-real", slug: "new-slug", isDemo: false };
  const examples = listings.slice(0, 2);
  assert.equal(directoryItemKey(real), "profile:real-id");
  assert.equal(directoryItemKey(examples[0]), `demo:${examples[0].slug}`);
  const order = [
    { profile_id: null, demo_slug: examples[1].slug, item_key: `demo:${examples[1].slug}`, sort_order: 0 },
    { profile_id: real.id, demo_slug: null, item_key: "profile:real-id", sort_order: 1 },
    { profile_id: null, demo_slug: examples[0].slug, item_key: `demo:${examples[0].slug}`, sort_order: 2 },
  ];
  assert.deepEqual(sortByDirectoryOrder([real, newReal, ...examples], order).map(directoryItemKey), [
    `demo:${examples[1].slug}`, "profile:real-id", `demo:${examples[0].slug}`, "profile:new-real",
  ]);
});
