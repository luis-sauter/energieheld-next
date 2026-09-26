import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const admin = "33333333-3333-4333-8333-333333333333";
const outsider = "22222222-2222-4222-8222-222222222222";
const slugs = [
  "bayerischer-wald", "hoeflehner", "pension-sonnenhof", "schafhuber", "villner-hof",
  "wirodive-tauchreisen", "wirthshof", "anni-romantikhaeuschen", "hotel-zur-post", "golfhotel-andreus",
];
const expected = new Map([
  ["bayerischer-wald", ["natur-pur", "nordic-walking", "wanderurlaub"]],
  ["hoeflehner", ["nordic-walking", "wanderurlaub", "familienurlaub", "wellnessangebote"]],
  ["pension-sonnenhof", ["nordic-walking", "radwandern"]],
  ["schafhuber", ["nordic-walking", "wanderurlaub"]],
  ["villner-hof", ["natur-pur", "nordic-walking", "radwandern", "wanderurlaub"]],
  ["wirodive-tauchreisen", ["tauchurlaub"]],
  ["wirthshof", ["urlaub-am-wasser", "campingurlaub"]],
  ["anni-romantikhaeuschen", ["romantik-zu-zweit", "wanderurlaub"]],
  ["hotel-zur-post", ["geschaeftsreisen"]],
  ["golfhotel-andreus", ["golfurlaub", "wellnessangebote"]],
]);
const articleIds = new Map([
  ["bayerischer-wald", 443], ["hoeflehner", 464], ["pension-sonnenhof", 470],
  ["schafhuber", 465], ["villner-hof", 480], ["wirodive-tauchreisen", 458],
  ["wirthshof", 468], ["anni-romantikhaeuschen", 450], ["hotel-zur-post", 457],
  ["golfhotel-andreus", 452],
]);
const joomlaNames = new Map([
  ["natur-pur", "Natur pur"], ["nordic-walking", "Nordic Walking"],
  ["radwandern", "Radwandern"], ["wanderurlaub", "Wanderurlaub"],
  ["familienurlaub", "Familienurlaub"], ["golfurlaub", "Golfurlaub"],
  ["tauchurlaub", "Tauchurlaub"], ["urlaub-am-wasser", "Urlaub am Wasser"],
  ["campingurlaub", "Campingurlaub"], ["romantik-zu-zweit", "Romantik zu zweit"],
  ["wellnessangebote", "Wellnessangebote"], ["geschaeftsreisen", "Geschäftsreisen"],
]);

test("travel taxonomy seeds only sourced themes and enforces approved-only public RLS", async () => {
  const db = new PGlite();
  try {
    const articles = JSON.parse((await readFile(new URL("../.legacy-reiseportal/raw/articles.json", import.meta.url), "utf8"))
      .replace(/^\uFEFF/, "")).data;
    for (const [slug, id] of articleIds) {
      const article = articles.find((entry) => entry.attributes.id === id);
      assert.ok(article, `Joomla article ${id} exists`);
      assert.deepEqual(Object.keys(article.attributes["category-bd"]).sort(),
        expected.get(slug).map((theme) => joomlaNames.get(theme)).sort());
    }
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
      CREATE TABLE public.portal_admins(user_id uuid PRIMARY KEY);
      CREATE TABLE public.company_profiles(id uuid PRIMARY KEY, slug text UNIQUE, status text NOT NULL);
      ALTER TABLE public.portal_admins ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
      GRANT SELECT ON public.portal_admins TO authenticated;
      GRANT SELECT ON public.company_profiles TO anon, authenticated;
      CREATE POLICY admins_self ON public.portal_admins FOR SELECT TO authenticated USING(user_id=auth.uid());
      CREATE POLICY profiles_public ON public.company_profiles FOR SELECT TO anon,authenticated USING(status='approved');
      CREATE POLICY profiles_admin ON public.company_profiles FOR SELECT TO authenticated USING(
        EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()));
    `);
    await db.query("INSERT INTO portal_admins VALUES ($1)", [admin]);
    for (const [index, slug] of [...slugs, "demo-gmbh", "hidden-profile"].entries()) {
      const id = `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, "0")}`;
      await db.query("INSERT INTO company_profiles VALUES ($1,$2,$3)",
        [id, slug, slug === "hidden-profile" ? "draft" : "approved"]);
    }
    await db.exec(await readFile(new URL("../supabase/migrations/20260926160000_reiseportal_travel_taxonomy.sql", import.meta.url), "utf8"));

    const seeded = await db.query(`SELECT p.slug,t.slug AS theme FROM company_profile_travel_terms x
      JOIN company_profiles p ON p.id=x.profile_id JOIN travel_terms t ON t.term_key=x.term_key ORDER BY p.slug,t.slug`);
    assert.equal(seeded.rows.length, 23);
    for (const [slug, themes] of expected) {
      assert.deepEqual(seeded.rows.filter((row) => row.slug === slug).map((row) => row.theme).sort(), themes.slice().sort());
    }
    assert.ok(seeded.rows.every((row) => expected.has(row.slug)));
    assert.equal((await db.query("SELECT count(*)::int n FROM travel_terms WHERE dimension='feature'")).rows[0].n, 0);

    await db.exec("BEGIN");
    await db.exec("SET LOCAL ROLE anon");
    const publicRows = await db.query("SELECT profile_id,term_key FROM company_profile_travel_terms");
    assert.equal(publicRows.rows.length, 23);
    assert.equal((await db.query("SELECT count(*)::int n FROM travel_terms")).rows[0].n, 12);
    await assert.rejects(db.query("INSERT INTO company_profile_travel_terms VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-000000000012','theme:natur-pur')"));
    await db.exec("ROLLBACK");

    await db.exec("BEGIN");
    await db.query("INSERT INTO travel_terms VALUES ('feature:sauna','feature','sauna','Sauna')");
    await db.query("INSERT INTO company_profile_travel_terms VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-000000000012','feature:sauna')");
    await db.exec("SET LOCAL ROLE anon");
    assert.equal((await db.query("SELECT count(*)::int n FROM company_profile_travel_terms WHERE term_key='feature:sauna'")).rows[0].n, 0);
    assert.equal((await db.query("SELECT count(*)::int n FROM travel_terms WHERE term_key='feature:sauna'")).rows[0].n, 0);
    await db.exec("ROLLBACK");

    await db.exec("BEGIN");
    await db.query("INSERT INTO company_profile_travel_terms VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-000000000012','theme:natur-pur')");
    await db.exec("SET LOCAL ROLE anon");
    assert.equal((await db.query("SELECT count(*)::int n FROM company_profile_travel_terms")).rows[0].n, 23);
    await db.exec("ROLLBACK");

    await db.exec("BEGIN");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [outsider]);
    await db.exec("SET LOCAL ROLE authenticated");
    assert.equal((await db.query("SELECT count(*)::int n FROM company_profile_travel_terms")).rows[0].n, 23);
    await db.query("DELETE FROM company_profile_travel_terms WHERE term_key='theme:tauchurlaub'");
    assert.equal((await db.query("SELECT count(*)::int n FROM company_profile_travel_terms")).rows[0].n, 23);
    await assert.rejects(db.query("INSERT INTO company_profile_travel_terms VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-000000000011','theme:natur-pur')"));
    await db.exec("ROLLBACK");

    await db.exec("BEGIN");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [admin]);
    await db.exec("SET LOCAL ROLE authenticated");
    await db.query("INSERT INTO company_profile_travel_terms VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-000000000012','theme:natur-pur')");
    assert.equal((await db.query("SELECT count(*)::int n FROM company_profile_travel_terms")).rows[0].n, 24);
    assert.equal((await db.query("SELECT count(*)::int n FROM travel_terms")).rows[0].n, 20);
    await db.query("DELETE FROM company_profile_travel_terms WHERE profile_id='aaaaaaaa-aaaa-4aaa-8aaa-000000000012'");
    assert.equal((await db.query("SELECT count(*)::int n FROM company_profile_travel_terms")).rows[0].n, 23);
    await db.exec("ROLLBACK");
  } finally {
    await db.close();
  }
});
