import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8").replace(/^\uFEFF/, ""));
const inventory = read("../docs/reiseportal-legacy-inventory.json");
const articles = read("../.legacy-reiseportal/raw/articles.json").data;
const banners = read("../.legacy-reiseportal/normalized/banner-inventory.json");
const migration = readFileSync(new URL("../supabase/migrations/20260926230848_import_verified_buechele.sql", import.meta.url), "utf8");

test("all seven former possible duplicates have a sourced, non-import decision", () => {
  const former = inventory.filter((row) => row.import_status === "POSSIBLE_DUPLICATE");
  assert.deepEqual(former.map((row) => row.joomla_id).sort((a, b) => a - b),
    [454, 475, 486, 502, 503, 507, 508]);
  assert.ok(former.every((row) => row.review?.previous_classification === "POSSIBLE_DUPLICATE" &&
    row.review.classification === "CONFIRMED_DUPLICATE" &&
    row.review.evidence.length >= 2 && row.review.import_decision !== "IMPORT_APPROVED"));
});

test("Joomla 455 has a published article and four matching provider banner destinations", () => {
  const article = articles.find((item) => Number(item.id) === 455)?.attributes;
  const row = inventory.find((item) => item.joomla_id === 455);
  assert.equal(article?.state, 1);
  assert.equal(article.title, "Ferienbauernhof Büchele");
  assert.equal(article["zip-bd"], "79875");
  assert.equal(article["phone-bd"], "+49 7672/2274");
  assert.equal(article.text?.trim() ?? "", "");
  assert.equal(row.review.previous_classification, "INSUFFICIENT_DATA");
  assert.equal(row.review.classification, "SAFE_IMPORT");
  assert.equal(row.review.cloud_slug, "ferienbauernhof-buechele");
  assert.equal(row.review.cloud_migration_version, "20260927071244");
  assert.equal(row.review.import_decision, "IMPORTED");
  const providerBanners = banners.filter((item) => [353, 354, 397, 398].includes(Number(item.LegacyId)));
  assert.equal(providerBanners.length, 4);
  assert.ok(providerBanners.every((item) => Number(item.Published) === 1 &&
    item.Name === row.name && item.TargetUrl === "https://www.ferienbauernhof-buechele.de/"));
});

test("the additive Büchele import preserves existing profiles and is idempotent", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE public.companies(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id uuid, legal_name text NOT NULL, contact_email text);
      CREATE TABLE public.company_profiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id), slug text UNIQUE NOT NULL,
        display_name text NOT NULL, description text, business_areas text, street text,
        postal_code text, city text, region text DEFAULT 'Bayern', country text NOT NULL,
        phone text, public_email text, website text, logo_path text, status text NOT NULL,
        approved_at timestamptz);
      CREATE TABLE public.travel_terms(term_key text PRIMARY KEY);
      CREATE TABLE public.company_profile_travel_terms(profile_id uuid REFERENCES public.company_profiles(id),
        term_key text REFERENCES public.travel_terms(term_key), PRIMARY KEY(profile_id,term_key));
      INSERT INTO public.companies(legal_name) VALUES ('Demo GmbH');
      INSERT INTO public.company_profiles(company_id,slug,display_name,country,status)
        SELECT id,'demo-gmbh','Demo GmbH','Deutschland','approved' FROM public.companies
        WHERE legal_name='Demo GmbH';
    `);
    const terms = ["theme:natur-pur", "theme:nordic-walking", "theme:radwandern",
      "theme:wanderurlaub", "theme:familienurlaub", "audience:familie"];
    for (const term of terms) await db.query("INSERT INTO public.travel_terms VALUES ($1)", [term]);
    const demoBefore = (await db.query("SELECT * FROM public.company_profiles WHERE slug='demo-gmbh'")).rows[0];

    await db.exec(migration);
    const profile = (await db.query(`SELECT p.*,c.owner_user_id,c.legal_name,c.contact_email
      FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id
      WHERE p.slug='ferienbauernhof-buechele'`)).rows[0];
    assert.equal(profile.display_name, "Ferienbauernhof Büchele");
    assert.equal(profile.status, "approved");
    assert.equal(profile.owner_user_id, null);
    assert.equal(profile.website, "https://www.ferienbauernhof-buechele.de/");
    assert.equal(profile.region, null);
    assert.equal(profile.description, null);
    assert.equal(profile.public_email, null);
    assert.equal(profile.contact_email, null);
    assert.equal(profile.logo_path, null);
    assert.deepEqual((await db.query(`SELECT term_key FROM public.company_profile_travel_terms
      WHERE profile_id=$1 ORDER BY term_key`, [profile.id])).rows.map((item) => item.term_key), terms.sort());
    assert.deepEqual((await db.query("SELECT * FROM public.company_profiles WHERE slug='demo-gmbh'")).rows[0], demoBefore);

    await db.exec(migration);
    assert.equal((await db.query("SELECT count(*)::int n FROM public.companies")).rows[0].n, 2);
    assert.equal((await db.query("SELECT count(*)::int n FROM public.company_profiles")).rows[0].n, 2);
    assert.equal((await db.query("SELECT count(*)::int n FROM public.company_profile_travel_terms")).rows[0].n, 6);
  } finally {
    await db.close();
  }
});
