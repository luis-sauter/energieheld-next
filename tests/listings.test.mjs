import test from "node:test";
import assert from "node:assert/strict";
import { filterListings } from "../src/lib/listings.ts";
import { listings, travelListing } from "../src/data/listings.ts";

const empty = { query: "", category: "", location: "", service: "", sort: "" };

test("combines search, category, location and service", () => {
  const found = filterListings(listings, {
    ...empty,
    query: "  MÜLLER  ",
    category: "heizung",
    location: "munchen",
    service: "Wärmepumpen",
  });
  assert.deepEqual(
    found.map((l) => l.slug),
    ["mueller-haustechnik"],
  );
});

test("postal codes work as location filters", () => {
  assert.deepEqual(
    filterListings(listings, { ...empty, location: "82319" }).map(
      (l) => l.slug,
    ),
    ["sonnenwerk-oberland"],
  );
});

test("incompatible and unknown filters produce an empty state", () => {
  assert.equal(
    filterListings(listings, {
      ...empty,
      category: "dach",
      location: "Augsburg",
    }).length,
    0,
  );
  assert.equal(
    filterListings(listings, { ...empty, category: "does-not-exist" }).length,
    0,
  );
});

test("reset returns every listing without changing the original array", () => {
  const before = listings.map((l) => l.slug);
  const sorted = filterListings(listings, { ...empty, sort: "name" });
  assert.equal(sorted[0].name, "Dachraum München");
  assert.deepEqual(
    listings.map((l) => l.slug),
    before,
  );
  assert.equal(filterListings(listings, empty).length, 8);
});

test("multiple query terms must all match", () => {
  assert.equal(
    filterListings(listings, { ...empty, query: "Müller Wärmepumpen" }).length,
    1,
  );
  assert.equal(
    filterListings(listings, { ...empty, query: "Müller Dachausbau" }).length,
    0,
  );
});

test("the same filtering function accepts a travel listing", () => {
  assert.deepEqual(
    filterListings([travelListing], {
      ...empty,
      category: "hotel",
      location: "Garmisch",
      query: "Bergblick",
    }),
    [travelListing],
  );
});
