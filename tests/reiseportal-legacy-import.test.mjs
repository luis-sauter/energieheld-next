import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8").replace(/^\uFEFF/, ""));
const inventory = read("../docs/reiseportal-legacy-inventory.json");
const safe = inventory.filter((row) => row.import_status === "SAFE_IMPORT");
const migrations = [1, 2, 3, 4].map((number) =>
  readFileSync(new URL(`../supabase/migrations/2026092619000${number}_import_verified_reiseportal_batch_0${number}.sql`, import.meta.url), "utf8"));
const regionFix = readFileSync(new URL("../supabase/migrations/20260926190005_fix_verified_reiseportal_regions.sql", import.meta.url), "utf8");
const countryFix = readFileSync(new URL("../supabase/migrations/20260927090000_correct_kemmeriboden_country.sql", import.meta.url), "utf8");

test("Joomla inventory is exhaustive and only imports sourced, distinct published providers", () => {
  assert.equal(inventory.length, 67);
  const counts = Object.groupBy(inventory, (row) => row.import_status);
  assert.deepEqual(Object.fromEntries(Object.entries(counts).map(([key, rows]) => [key, rows.length])), {
    POSSIBLE_DUPLICATE: 7, SAFE_IMPORT: 45, ALREADY_IMPORTED: 10,
    NOT_A_TRAVEL_PROVIDER: 4, INSUFFICIENT_DATA: 1,
  });
  assert.equal(new Set(safe.map((row) => row.planned_slug)).size, safe.length);
  assert.ok(safe.every((row) => row.published && row.name && row.address && row.phone && row.city && row.description));
  assert.ok(safe.every((row) => !row.feature_terms.length));
  assert.ok(safe.every((row) => row.source && row.name && row.source_slug));
  const kemmeriboden = safe.find((row) => row.joomla_id === 472);
  assert.equal(kemmeriboden.country, "IT");
  assert.ok(kemmeriboden.source_tags.includes("Schweiz"));
  assert.equal(kemmeriboden.city, "Schangnau");
  assert.match(kemmeriboden.phone, /^\+41/);
  for (const ids of [[507, 454, 508], [503, 502], [486, 464], [475, 450]]) {
    assert.ok(ids.some((id) => inventory.some((row) => row.joomla_id === id && row.import_status !== "SAFE_IMPORT")));
  }
  const media = read("../src/data/reiseportal-legacy-import-media.json");
  for (const [slug, entry] of Object.entries(media)) {
    const row = safe.find((item) => item.planned_slug === slug);
    assert.ok(row);
    for (const image of [entry.logo, ...entry.images].filter(Boolean)) {
      assert.ok(image.src.startsWith(`/reiseportal/unterkuenfte/${slug}/`));
      assert.ok(existsSync(new URL(`../public${image.src}`, import.meta.url)), image.src);
    }
  }
  assert.equal(Object.values(media).reduce((count, entry) => count + entry.images.length + Number(!!entry.logo), 0), 47);
});

test("four additive SQL batches insert only 45 approved ownerless providers and are idempotent", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE companies(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_user_id uuid,
        legal_name text NOT NULL, contact_email text);
      CREATE TABLE company_profiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid REFERENCES companies(id),
        slug text UNIQUE NOT NULL, display_name text NOT NULL, description text, business_areas text,
        street text, postal_code text, city text, region text DEFAULT 'Bayern', country text, phone text, public_email text,
        website text, status text NOT NULL, approved_at timestamptz);
      CREATE TABLE travel_terms(term_key text PRIMARY KEY);
      CREATE TABLE company_profile_travel_terms(profile_id uuid REFERENCES company_profiles(id),
        term_key text REFERENCES travel_terms(term_key), PRIMARY KEY(profile_id,term_key));
    `);
    const terms = new Set(safe.flatMap((row) => [
      ...row.theme_terms, ...row.audience_terms, ...row.accommodation_terms, ...row.feature_terms,
    ]));
    for (const term of terms) await db.query("INSERT INTO travel_terms VALUES ($1)", [term]);
    await db.exec(`INSERT INTO companies(legal_name) VALUES ('Demo GmbH');
      INSERT INTO company_profiles(company_id,slug,display_name,status)
        SELECT id,'demo-gmbh','Demo GmbH','approved' FROM companies WHERE legal_name='Demo GmbH';`);
    for (const migration of migrations) await db.exec(migration);
    assert.equal((await db.query("SELECT count(*)::int n FROM company_profiles WHERE region='Bayern'")).rows[0].n, 46);
    await db.exec(regionFix);
    await db.exec(countryFix);
    const rows = (await db.query(`SELECT p.slug,p.display_name,p.status,c.owner_user_id,p.description,p.website,p.public_email,p.region,p.country
      FROM company_profiles p JOIN companies c ON c.id=p.company_id ORDER BY p.slug`)).rows;
    assert.equal(rows.length, 46);
    assert.equal((await db.query("SELECT count(*)::int n FROM companies")).rows[0].n, 46);
    assert.equal(new Set(rows.map((row) => row.slug)).size, 46);
    assert.ok(rows.filter((row) => row.slug !== "demo-gmbh").every((row) =>
      row.status === "approved" && row.owner_user_id === null && !!row.description));
    assert.equal(rows.find((row) => row.slug === "demo-gmbh").display_name, "Demo GmbH");
    assert.equal(rows.find((row) => row.slug === "demo-gmbh").region, "Bayern");
    assert.ok(rows.find((row) => row.slug === "sub-aqua-tauchreisen").public_email === null);
    for (const row of safe) {
      const actual = rows.find((item) => item.slug === row.planned_slug);
      assert.equal(actual?.display_name, row.name);
      assert.equal(actual.website, row.homepage);
      assert.equal(actual.public_email, row.email);
      assert.equal(actual.region, row.region);
      assert.equal(actual.country, row.joomla_id === 472 ? "Schweiz" :
        { DE: "Deutschland", AT: "Österreich", IT: "Italien", CH: "Schweiz" }[row.country]);
      const assigned = (await db.query(`SELECT term_key FROM company_profile_travel_terms x
        JOIN company_profiles p ON p.id=x.profile_id WHERE p.slug=$1 ORDER BY term_key`, [row.planned_slug])).rows
        .map((item) => item.term_key);
      assert.deepEqual(assigned, [...row.theme_terms, ...row.audience_terms,
        ...row.accommodation_terms, ...row.feature_terms].sort());
    }
    const initialTerms = (await db.query("SELECT count(*)::int n FROM company_profile_travel_terms")).rows[0].n;
    assert.equal(initialTerms, safe.reduce((count, row) => count + row.theme_terms.length +
      row.audience_terms.length + row.accommodation_terms.length, 0));
    for (const migration of migrations) await db.exec(migration);
    await db.exec(regionFix);
    await db.exec(countryFix);
    assert.equal((await db.query("SELECT count(*)::int n FROM companies")).rows[0].n, 46);
    assert.equal((await db.query("SELECT count(*)::int n FROM company_profiles")).rows[0].n, 46);
    assert.equal((await db.query("SELECT count(*)::int n FROM company_profile_travel_terms")).rows[0].n, initialTerms);
  } finally {
    await db.close();
  }
});
