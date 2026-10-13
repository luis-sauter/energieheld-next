import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import "./helpers/load-ts.mjs";
const { legacyCreative, presentedBanners } = await import("../src/lib/banner-presentation.ts");

test("Westerwald artwork resolves to Westerwald, including after a legacy slot is reopened", () => {
  const path = "/mottoreisen/natur-pur";
  const creative = legacyCreative("sidebar_08", "sidebar_08", path);
  assert.equal(creative.imageUrl, "/images/legacy-ads/reconciled/414.jpg");
  assert.equal(creative.headline, "Westerwald");
  assert.equal(creative.target_url, "https://www.westerwald.info/");
  const reopened = presentedBanners([], [{
    placement: "sidebar_08", size: "small", legacy_hidden: false, legacy_target_url: null,
  }], path).find(ad => ad.id === creative.id);
  assert.equal(reopened.target_url, creative.target_url);
  const hidden = presentedBanners([], [{
    placement: "sidebar_08", size: "small", legacy_hidden: true, legacy_target_url: null,
  }], path);
  assert.ok(!hidden.some(ad => ad.id === creative.id), "identity repair must not reactivate hidden artwork");
});

test("Josef artwork is named Josef on both existing pages; real Hof Maran stays separate", async () => {
  for (const [path, slot] of [
    ["/mottoreisen/wellnessangebote", "sidebar_06"],
    ["/reiseziele/suedtirol-italien", "sidebar_04"],
  ]) {
    const ad = legacyCreative(slot, slot, path);
    assert.equal(ad.imageUrl, "/images/legacy-ads/reconciled/603.jpg");
    assert.equal(ad.headline, "Josef Mountain Resort");
    assert.equal(ad.target_url, "https://www.josef.bz/de/hotel-hafling/1-0.html");
  }
  const { legacyBannerPages } = await import("../src/data/legacy-banner-pages.ts");
  const maran = Object.values(legacyBannerPages).flat().filter(ad => ad.targetUrl === "https://hofmaran.ch/");
  assert.ok(maran.length);
  assert.ok(maran.every(ad => ad.alt === "Hof Maran" && ad.imageUrl !== "/images/legacy-ads/reconciled/603.jpg"));
});

const migration = await readFile(new URL("../supabase/migrations/20261013192547_repair_legacy_banner_identity.sql", import.meta.url), "utf8");
async function fixture() {
  const db = new PGlite();
  await db.exec(`
    create table public.ad_banner_search_metadata(banner_key text primary key, legacy_name text, advertiser_key text);
    insert into public.ad_banner_search_metadata values
      ('legacy:https://westerwald.info/','Westerwald','domain:westerwald.info'),
      ('legacy:https://ostseehotel-dierhagen.de/de/home','Ostseehotel Dierhagen','domain:ostseehotel-dierhagen.de');
    create table public.ad_legacy_banner_search_sources(path text,placement text,banner_key text references public.ad_banner_search_metadata, target_url text,primary key(path,placement));
    insert into public.ad_legacy_banner_search_sources values
      ('/mottoreisen/natur-pur','sidebar_08','legacy:https://ostseehotel-dierhagen.de/de/home','https://www.ostseehotel-dierhagen.de/de/home'),
      ('/mottoreisen/natur-pur','sidebar_06','legacy:https://ostseehotel-dierhagen.de/de/home','https://www.ostseehotel-dierhagen.de/de/home'),
      ('/mottoreisen/wanderurlaub','sidebar_middle','legacy:https://westerwald.info/','https://www.westerwald.info/');
  `);
  return db;
}
test("legacy source repair changes only the proven Westerwald row and refuses replay", async () => {
  const db = await fixture();
  try {
    const before = (await db.query("select * from ad_legacy_banner_search_sources order by path,placement")).rows;
    await db.exec(migration);
    const after = (await db.query("select * from ad_legacy_banner_search_sources order by path,placement")).rows;
    assert.deepEqual(after, before.map(row => row.placement === "sidebar_08" ? {
      ...row, banner_key: "legacy:https://westerwald.info/", target_url: "https://www.westerwald.info/",
    } : row));
    await assert.rejects(db.exec(migration), /changed since audit/);
    await db.exec("rollback");
    assert.deepEqual((await db.query("select * from ad_legacy_banner_search_sources order by path,placement")).rows, after);
  } finally { await db.close(); }
});
test("legacy repair aborts without changes when the existing target or verified identity differs", async () => {
  for (const alteration of [
    "update ad_legacy_banner_search_sources set target_url='https://example.com/' where placement='sidebar_08'",
    "update ad_banner_search_metadata set advertiser_key='domain:example.com' where legacy_name='Westerwald'",
  ]) {
    const db = await fixture();
    try {
      await db.exec(alteration);
      const before = (await db.query("select * from ad_legacy_banner_search_sources order by path,placement")).rows;
      await assert.rejects(db.exec(migration), /stop banner repair/);
      await db.exec("rollback");
      assert.deepEqual((await db.query("select * from ad_legacy_banner_search_sources order by path,placement")).rows, before);
    } finally { await db.close(); }
  }
});
