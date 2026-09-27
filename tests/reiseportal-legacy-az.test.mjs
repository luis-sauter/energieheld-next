import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const source = JSON.parse(read("../docs/reiseportal-legacy-az-source.json"));
const media = JSON.parse(read("../src/data/reiseportal-legacy-directory-media.json"));
const mediaAudit = JSON.parse(read("../docs/reiseportal-legacy-az-media.json"));
const allAssets = JSON.parse(read("../docs/reiseportal-legacy-az-assets.json"));
const providerMedia = JSON.parse(read("../src/data/reiseportal-legacy-provider-media.json"));
const importSql = read("../supabase/migrations/20260927110000_import_missing_public_az_providers.sql");
const packageSql = read("../supabase/migrations/20260927113000_reconcile_legacy_directory_packages.sql");
const validImage = (path) => {
  const bytes = readFileSync(path);
  const name = path.pathname.toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (name.endsWith(".png")) return bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (name.endsWith(".webp")) return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  return false;
};

test("the 63-row public A-Z source has evidenced Complete/Basic matches and exact provider media", () => {
  assert.equal(source.length, 63);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((page) => source.filter((row) => row.page === page).length),
    [10, 10, 10, 10, 10, 10, 3]);
  assert.equal(new Set(source.map((row) => row.joomla_id)).size, 63);
  assert.ok(source.every((row) => row.visible_name && row.visible_address && row.visible_phone &&
    row.old_alias && row.themes.length && row.source_url.startsWith("https://das-reiseportal.com/")));
  assert.equal(source.filter((row) => row.historical_package === "CONFIRMED_PREMIUM").length, 34);
  assert.equal(source.filter((row) => row.historical_package === "CONFIRMED_BASIC").length, 29);
  assert.deepEqual(Object.fromEntries(Object.entries(Object.groupBy(source, (row) => row.match_status))
    .map(([status, rows]) => [status, rows.length])),
  { EXISTING_MATCH: 58, SAME_PROVIDER_DUPLICATE_SOURCE: 3, MISSING_PROVIDER: 2 });
  const travel = source.filter((row) => row.travel_provider);
  assert.equal(new Set(travel.map((row) => row.current_profile_slug)).size, 58);
  assert.deepEqual(source.filter((row) => row.match_status === "SAME_PROVIDER_DUPLICATE_SOURCE")
    .map((row) => row.joomla_id).sort((a, b) => a - b), [454, 486, 502]);
  assert.deepEqual(source.filter((row) => row.match_status === "MISSING_PROVIDER")
    .map((row) => row.joomla_id).sort((a, b) => a - b), [461, 462]);
  const premiumSlugs = new Set(travel.filter((row) => row.historical_package === "CONFIRMED_PREMIUM")
    .map((row) => row.current_profile_slug));
  assert.equal(premiumSlugs.size, 31);
  assert.deepEqual(new Set(Object.keys(media)), premiumSlugs);
  assert.equal(mediaAudit.length, 31);
  for (const item of mediaAudit) {
    assert.ok(premiumSlugs.has(item.slug));
    const card = media[item.slug];
    assert.equal(card.src, item.target);
    assert.ok(card.source_image.startsWith("/images/unterkuenfte/"));
    assert.equal(item.source_url, new URL(card.source_image, "https://das-reiseportal.com").href);
    const target = new URL(`../public${item.target}`, import.meta.url);
    assert.ok(existsSync(target), item.target);
    assert.equal(createHash("sha256").update(readFileSync(target)).digest("hex"), item.sha256);
    assert.ok(validImage(target), item.target);
  }
  for (const row of travel.filter((item) => item.historical_package === "CONFIRMED_BASIC" &&
    !premiumSlugs.has(item.current_profile_slug))) assert.equal(media[row.current_profile_slug], undefined);
});

test("every Joomla image reference is audited; foreign and non-travel assets never enter a profile", () => {
  assert.equal(allAssets.length, 459);
  assert.deepEqual(Object.fromEntries(Object.entries(Object.groupBy(allAssets, (item) => item.decision))
    .map(([decision, items]) => [decision, items.length])),
  { ASSIGN: 438, SKIP_FOREIGN_PROVIDER: 1, SKIP_INVALID_IMAGE: 1, SKIP_NON_TRAVEL: 19 });
  assert.equal(Object.keys(providerMedia).length, 32);
  const checked = new Set();
  for (const item of allAssets) {
    assert.ok(item.source_url.startsWith("https://das-reiseportal.com/images/"));
    if (item.decision !== "ASSIGN") {
      assert.equal(item.public_asset, null);
      continue;
    }
    assert.ok(item.profile_slug && providerMedia[item.profile_slug]);
    assert.ok(item.public_asset?.startsWith("/reiseportal/"));
    if (checked.has(item.public_asset)) continue;
    checked.add(item.public_asset);
    const target = new URL(`../public${item.public_asset}`, import.meta.url);
    assert.ok(existsSync(target), item.public_asset);
    assert.equal(createHash("sha256").update(readFileSync(target)).digest("hex"), item.sha256);
    assert.ok(validImage(target), item.public_asset);
  }
  const foreign = allAssets.find((item) => item.decision === "SKIP_FOREIGN_PROVIDER");
  assert.equal(foreign.joomla_id, 472);
  assert.match(foreign.source_url, /RU%20Blanch/);
  const invalid = allAssets.find((item) => item.decision === "SKIP_INVALID_IMAGE");
  assert.equal(invalid.joomla_id, 503);
  assert.match(invalid.source_url, /Logo_mitClaim_4c\.jpg/);
  assert.ok(Object.values(providerMedia).every((item) => item.images.every((image) => checked.has(image.src))));
  assert.ok(Object.values(providerMedia).every((item) => !item.logo || checked.has(item.logo.src)));
});

test("additive migrations import two missing providers once and protect the 31/27 package mapping", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid; $$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
      CREATE TABLE public.portal_admins(user_id uuid PRIMARY KEY);
      ALTER TABLE public.portal_admins ENABLE ROW LEVEL SECURITY;
      GRANT SELECT(user_id) ON public.portal_admins TO authenticated;
      CREATE POLICY admin_self ON public.portal_admins FOR SELECT TO authenticated USING (user_id=auth.uid());
      CREATE TABLE public.companies(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id uuid, legal_name text NOT NULL, contact_email text);
      CREATE TABLE public.company_profiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),slug text UNIQUE NOT NULL,
        display_name text NOT NULL,description text,business_areas text,street text,
        postal_code text,city text,country text,phone text,public_email text,
        website text,status text NOT NULL,approved_at timestamptz);
      ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
      GRANT SELECT(id,status) ON public.company_profiles TO anon,authenticated;
      CREATE POLICY approved_read ON public.company_profiles FOR SELECT TO anon,authenticated
        USING (status='approved');
      CREATE POLICY admin_read ON public.company_profiles FOR SELECT TO authenticated
        USING (EXISTS(SELECT 1 FROM public.portal_admins a WHERE a.user_id=auth.uid()));
      CREATE TABLE public.travel_terms(term_key text PRIMARY KEY);
      CREATE TABLE public.company_profile_travel_terms(profile_id uuid REFERENCES public.company_profiles(id),
        term_key text REFERENCES public.travel_terms(term_key),PRIMARY KEY(profile_id,term_key));
    `);
    for (const term of ["theme:natur-pur", "theme:nordic-walking", "theme:radwandern",
      "theme:wanderurlaub", "theme:familienurlaub"])
      await db.query("INSERT INTO public.travel_terms VALUES ($1)", [term]);
    const slugs = [...new Set(source.filter((row) => row.travel_provider)
      .map((row) => row.current_profile_slug))].filter((slug) =>
      !["appartementhaus-salzburg", "hotel-salzburger-hof"].includes(slug));
    assert.equal(slugs.length, 56);
    for (const slug of ["demo-gmbh", ...slugs]) {
      await db.query(`WITH c AS (INSERT INTO public.companies(legal_name) VALUES ($1) RETURNING id)
        INSERT INTO public.company_profiles(company_id,slug,display_name,status)
        SELECT id,$1,$1,'approved' FROM c`, [slug]);
    }
    const before = (await db.query("SELECT md5(string_agg(to_jsonb(p)::text,'|' ORDER BY p.id)) AS hash FROM public.company_profiles p")).rows[0].hash;
    await db.exec(importSql);
    const imported = (await db.query(`SELECT p.slug,p.status,p.description,p.public_email,p.website,c.owner_user_id
      FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id
      WHERE p.slug IN ('appartementhaus-salzburg','hotel-salzburger-hof') ORDER BY p.slug`)).rows;
    assert.equal(imported.length, 2);
    assert.ok(imported.every((row) => row.status === "approved" && row.owner_user_id === null &&
      row.description && row.public_email && row.website));
    assert.equal((await db.query("SELECT count(*)::int n FROM public.company_profile_travel_terms")).rows[0].n, 6);
    const after = (await db.query(`SELECT md5(string_agg(to_jsonb(p)::text,'|' ORDER BY p.id)) AS hash
      FROM public.company_profiles p WHERE p.slug NOT IN ('appartementhaus-salzburg','hotel-salzburger-hof')`)).rows[0].hash;
    assert.equal(after, before);
    await assert.rejects(db.exec(importSql), /already exists/);
    await db.exec(packageSql);
    const stats = (await db.query(`SELECT package,count(*)::int n FROM public.company_profile_directory_packages
      GROUP BY package ORDER BY package`)).rows;
    assert.deepEqual(stats, [{ package: "basic", n: 27 }, { package: "premium", n: 31 }]);
    const packages = (await db.query(`SELECT p.slug,d.package,d.legacy_joomla_article_id
      FROM public.company_profile_directory_packages d JOIN public.company_profiles p ON p.id=d.profile_id`)).rows;
    assert.equal(new Set(packages.map((row) => row.slug)).size, 58);
    assert.equal(packages.find((row) => row.slug === "appartementhaus-salzburg").package, "premium");
    assert.equal(packages.find((row) => row.slug === "hotel-salzburger-hof").package, "premium");
    assert.equal(packages.find((row) => row.slug === "villner-hof").package, "basic");
    assert.equal(packages.find((row) => row.slug === "hoeflehner").legacy_joomla_article_id, 464);
    assert.equal(packages.find((row) => row.slug === "demo-gmbh"), undefined);
    assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE oid='public.company_profile_directory_packages'::regclass`)).rows[0].relrowsecurity, true);
    for (const role of ["anon", "authenticated"])
      assert.equal((await db.query(`SELECT has_column_privilege($1,'public.company_profile_directory_packages','package','SELECT') allowed`, [role])).rows[0].allowed, true);
    assert.equal((await db.query("SELECT has_column_privilege('anon','public.company_profile_directory_packages','package','UPDATE') allowed")).rows[0].allowed, false);
    assert.equal((await db.query("SELECT has_column_privilege('authenticated','public.company_profile_directory_packages','package','UPDATE') allowed")).rows[0].allowed, true);

    const admin = "33333333-3333-4333-8333-333333333333";
    const outsider = "44444444-4444-4444-8444-444444444444";
    await db.query("INSERT INTO public.portal_admins VALUES ($1)", [admin]);
    await db.query(`WITH c AS (INSERT INTO public.companies(legal_name) VALUES ('Pending') RETURNING id)
      INSERT INTO public.company_profiles(company_id,slug,display_name,status)
      SELECT id,'pending-profile','Pending','pending' FROM c`);
    await db.exec(`INSERT INTO public.company_profile_directory_packages(profile_id,package)
      SELECT id,'basic' FROM public.company_profiles WHERE slug='pending-profile'`);
    await db.exec("BEGIN");
    await db.exec("SET LOCAL ROLE anon");
    assert.equal((await db.query("SELECT count(*)::int n FROM public.company_profile_directory_packages")).rows[0].n, 58);
    await assert.rejects(db.exec("UPDATE public.company_profile_directory_packages SET package='premium'"));
    await db.exec("ROLLBACK");
    await db.exec("BEGIN");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [outsider]);
    await db.exec("SET LOCAL ROLE authenticated");
    assert.equal((await db.query("SELECT count(*)::int n FROM public.company_profile_directory_packages")).rows[0].n, 58);
    assert.equal((await db.query("UPDATE public.company_profile_directory_packages SET package='basic' WHERE legacy_joomla_article_id=452")).affectedRows, 0);
    await db.exec("ROLLBACK");
    await db.exec("BEGIN");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [admin]);
    await db.exec("SET LOCAL ROLE authenticated");
    assert.equal((await db.query("SELECT count(*)::int n FROM public.company_profile_directory_packages")).rows[0].n, 59);
    assert.equal((await db.query("UPDATE public.company_profile_directory_packages SET package='basic' WHERE legacy_joomla_article_id=452")).affectedRows, 1);
    await db.exec("ROLLBACK");
  } finally {
    await db.close();
  }
});
