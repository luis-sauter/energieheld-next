import test from "node:test";
import assert from "node:assert/strict";
import { sortByDirectoryOrder, moveDirectoryId, realDirectoryIds } from "../src/lib/company-directory-order.ts";
import { filterListings } from "../src/lib/listings.ts";

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
