import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const source = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
registerHooks({
  resolve(s, c, next) {
    if (s.endsWith(".module.css"))
      return {
        url: "data:text/javascript,export default {}",
        shortCircuit: true,
      };
    if (s === "server-only")
      return { url: "data:text/javascript,export {}", shortCircuit: true };
    if (s === "next/headers")
      throw Error("The public data layer must never read session cookies");
    if (s.endsWith("/supabase/server"))
      return { url: 'data:text/javascript,export async function createClient(){return {auth:{getUser:async()=>({data:{user:null},error:null})}}}', shortCircuit: true };
    if (s === "next/cache")
      return { url: 'data:text/javascript,export function revalidatePath(){}', shortCircuit: true };
    if (s === "next/navigation")
      return {
        url: 'data:text/javascript,export function notFound(){throw Error("NOT_FOUND")};export function redirect(path){throw Error("REDIRECT:"+path)};export const permanentRedirect=redirect;export function useRouter(){return {refresh(){}}}',
        shortCircuit: true,
      };
    if (s === "next/link" || s === "next/image")
      return {
        url: `data:text/javascript,export default ${JSON.stringify(s === "next/link" ? "a" : "img")}`,
        shortCircuit: true,
      };
    if (s.startsWith("@/") || s.startsWith(".")) {
      const base = s.startsWith("@/")
        ? new URL("../src/" + s.slice(2), import.meta.url)
        : new URL(s, c.parentURL);
      for (const ext of [".ts", ".tsx"])
        if (existsSync(new URL(base.href + ext)))
          return next(base.href + ext, c);
    }
    return next(s, c);
  },
  load(url, c, next) {
    if (url.endsWith(".tsx"))
      return {
        format: "module",
        shortCircuit: true,
        source: transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX },
        }).outputText,
      };
    return next(url, c);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://public-test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
const { loadPublicCompanies, loadPublicCompanyBySlug, PUBLIC_COMPANIES_ERROR } =
  await import("../src/lib/public-companies.ts");
const { createPublicClient } = await import("../src/lib/supabase/public.ts");
const { filterListings } = await import("../src/lib/listings.ts");
const { ListingDetail } =
  await import("../src/components/portal/listing-detail.tsx");
const { DirectoryPage } =
  await import("../src/components/portal/directory-page.tsx");
const { default: Detail, generateMetadata: detailMetadata } =
  await import("../src/app/(energieheld)/unterkuenfte/[slug]/page.tsx");
const { default: TradePage } =
  await import("../src/app/(energieheld)/gewerke/[slug]/page.tsx");
const { default: LegacyDetail } =
  await import("../src/app/(energieheld)/experten/[slug]/page.tsx");
const { default: HomePage } =
  await import("../src/app/(energieheld)/page.tsx");
const { reiseportalPreview } = await import("../src/data/reiseportal-preview.ts");
const { importedJoomlaMedia } = await import("../src/data/reiseportal-import-media.ts");
const { withLegacyImages } = await import("../src/lib/reiseportal-directory.ts");
const { energieheld } = await import("../src/config/energieheld.ts");
const { listings: demos } = await import("../src/data/listings.ts");
const { combinePortalCompanies, loadPortalCompanies, loadPortalCompanyBySlug } =
  await import("../src/lib/portal-companies.ts");
const row = {
  id: "profile-1",
  status: "approved",
  slug: "test-firma",
  display_name: "Test Firma",
  tagline: "Sanierung",
  description: null,
  business_areas: "WDVS, Fassadensanierung",
  postal_code: "80331",
  city: "München",
  region: "Bayern",
  country: "Deutschland",
  phone: null,
  public_email: null,
  website: null,
  logo_path: null,
  company_profile_images: [],
  company_profile_categories: [
    { category_id: "daemmung" },
    { category_id: "fassade" },
  ],
};
const travelRow = {
  ...row,
  tagline: "Unterkunft in der Region",
  business_areas: "Übernachtung",
  company_profile_categories: [],
};
const legacyRows = reiseportalPreview.map((listing, index) => ({
  ...travelRow,
  id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, "0")}`,
  slug: listing.slug,
  display_name: listing.name,
  tagline: listing.tagline,
  description: listing.description,
  business_areas: null,
  street: listing.location.street,
  postal_code: listing.location.postalCode,
  city: listing.location.city,
  region: listing.location.region,
  country: listing.location.country,
  phone: listing.contact.phone,
  public_email: listing.contact.email,
  website: listing.contact.website,
  company_profile_images: [],
}));
const demoRow = {
  ...travelRow,
  id: "31ae7d1e-26a7-4161-8d14-f5ee4735f5d4",
  slug: "energieheld-demo-gmbh-c3351d59",
  display_name: "Energieheld Demo GmbH",
  tagline: "Photovoltaik",
  description: "Modernisierung und Elektrotechnik",
  business_areas: "Gebäudetechnik",
  street: "Musterstraße 12",
  public_email: "kontakt@energieheld.bayern",
  website: "https://energieheld.bayern",
  logo_path: "profiles/31ae7d1e-26a7-4161-8d14-f5ee4735f5d4/logo.jpg",
  company_profile_images: [
    { id: "demo-image-1", storage_path: "profiles/31ae7d1e-26a7-4161-8d14-f5ee4735f5d4/one.jpg", alt_text: "Photovoltaik", sort_order: 0 },
    { id: "demo-image-2", storage_path: "profiles/31ae7d1e-26a7-4161-8d14-f5ee4735f5d4/two.jpg", alt_text: "Elektrotechnik", sort_order: 1 },
    { id: "demo-image-3", storage_path: "profiles/31ae7d1e-26a7-4161-8d14-f5ee4735f5d4/three.jpg", alt_text: "Modernisierung", sort_order: 2 },
  ],
};
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
function api(rows = [row], failure = false, ads = [], orderRows = rows.filter((item) => item.status === "approved").map((item, sort_order) => ({ profile_id: item.id, sort_order })), sidebarRows = null) {
  const requests = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(input),
      headers = new Headers(init?.headers);
    requests.push({ url, headers });
    if (url.pathname === "/rest/v1/rpc/get_active_ad_campaigns") {
      assert.equal(headers.get("authorization"), "Bearer sb_publishable_test");
      assert.equal(headers.get("cookie"), null);
      requests.at(-1).body = JSON.parse(init.body);
      return new Response(JSON.stringify(ads), {
        headers: { "content-type": "application/json" },
      });
    }
    if (url.pathname === "/storage/v1/object/sign/ad-media") {
      assert.equal(headers.get("authorization"), "Bearer sb_publishable_test");
      assert.equal(headers.get("cookie"), null);
      const body = JSON.parse(init.body);
      assert.equal(body.expiresIn, 300);
      return new Response(
        JSON.stringify(
          body.paths.map((path) => ({
            path,
            error: null,
            signedURL: "/object/sign/ad-media/" + path + "?token=temporary",
          })),
        ),
        { headers: { "content-type": "application/json" } },
      );
    }
    if (url.pathname === "/auth/v1/user")
      return new Response(
        JSON.stringify({
          id: "signed-in-user",
          aud: "authenticated",
          role: "authenticated",
        }),
        { headers: { "content-type": "application/json" } },
      );
    if (url.pathname === "/rest/v1/profile_content_blocks") {
      assert.equal(headers.get("authorization"), "Bearer sb_publishable_test");
      assert.equal(headers.get("cookie"), null);
      return new Response("[]", { headers: { "content-type": "application/json" } });
    }
    if (url.pathname === "/storage/v1/object/sign/company-media") {
      assert.equal(headers.get("authorization"), "Bearer sb_publishable_test");
      assert.equal(headers.get("cookie"), null);
      const body = JSON.parse(init.body);
      assert.equal(body.expiresIn, 3600);
      return new Response(
        JSON.stringify(
          body.paths.map((path) => ({
            path,
            error: null,
            signedURL:
              "/object/sign/company-media/" + path + "?token=temporary",
          })),
        ),
        { headers: { "content-type": "application/json" } },
      );
    }
    if (url.pathname === "/rest/v1/company_directory_order") {
      assert.equal(headers.get("authorization"), "Bearer sb_publishable_test");
      assert.equal(headers.get("cookie"), null);
      if (orderRows?.legacy && url.searchParams.get("select")?.includes("item_key"))
        return new Response(JSON.stringify({ code: "42703", message: "column does not exist" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      if (orderRows === null)
        return new Response(JSON.stringify({ code: "PGRST205", message: "table not deployed" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      const offset = Number(url.searchParams.get("offset") || 0);
      const limit = Number(url.searchParams.get("limit") || 500);
      return new Response(JSON.stringify((orderRows?.legacy ? orderRows.rows : orderRows).slice(offset, offset + limit)), {
        headers: { "content-type": "application/json" },
      });
    }
    if (url.pathname === "/rest/v1/ad_sidebar_slot_order") {
      assert.equal(headers.get("authorization"), "Bearer sb_publishable_test");
      assert.equal(headers.get("cookie"), null);
      if (sidebarRows) return new Response(JSON.stringify(sidebarRows), {
        headers: { "content-type": "application/json" },
      });
      return new Response(JSON.stringify({ code: "PGRST205", message: "table not deployed" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.pathname === "/rest/v1/travel_terms" ||
        url.pathname === "/rest/v1/company_profile_travel_terms") {
      assert.equal(headers.get("authorization"), "Bearer sb_publishable_test");
      assert.equal(headers.get("cookie"), null);
      return new Response(JSON.stringify({ code: "PGRST205", message: "travel taxonomy not deployed" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    assert.equal(url.pathname, "/rest/v1/company_profiles");
    assert.equal(url.searchParams.get("status"), "eq.approved");
    assert.equal(headers.get("apikey"), "sb_publishable_test");
    assert.equal(headers.get("authorization"), "Bearer sb_publishable_test");
    assert.equal(headers.get("cookie"), null);
    if (failure)
      return new Response(
        JSON.stringify({ message: "private database error", code: "42501" }),
        { status: 403 },
      );
    let data = rows.filter((r) => r.status === "approved");
    const slug = url.searchParams.get("slug");
    if (slug) data = data.filter((r) => "eq." + r.slug === slug);
    const offset = Number(url.searchParams.get("offset") || 0),
      limit = Number(url.searchParams.get("limit") || 500);
    return new Response(JSON.stringify(data.slice(offset, offset + limit)), {
      headers: { "content-type": "application/json" },
    });
  };
  return requests;
}
const filters = {
  query: "",
  category: "",
  location: "",
  service: "",
  sort: "",
};

test("public loader applies manual order before demos and keeps the directory available before migration deployment", async () => {
  const rows = [
    { ...row, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", slug: "alpha", display_name: "Alpha" },
    { ...row, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", slug: "beta", display_name: "Beta" },
    { ...row, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", slug: "charlie", display_name: "Charlie" },
  ];
  api(rows, false, [], [{ profile_id: rows[1].id, sort_order: 0 }, { profile_id: rows[0].id, sort_order: 1 }]);
  assert.deepEqual((await loadPublicCompanies()).data.map((item) => item.name), ["Beta", "Alpha", "Charlie"]);
  const combined = (await loadPortalCompanies()).data;
  assert.deepEqual(combined.slice(0, 3).map((item) => item.name), ["Beta", "Alpha", "Charlie"]);
  assert.deepEqual(combined.slice(3).map((item) => item.id), demos.filter((item) => item.isDemo).map((item) => item.id));
  api(rows, false, [], null);
  assert.deepEqual((await loadPublicCompanies()).data.map((item) => item.name), ["Alpha", "Beta", "Charlie"]);
  api(rows, false, [], { legacy: true, rows: [{ profile_id: rows[1].id, sort_order: 0 }, { profile_id: rows[0].id, sort_order: 1 }] });
  assert.deepEqual((await loadPortalCompanies()).data.slice(0, 3).map((item) => item.name), ["Beta", "Alpha", "Charlie"]);
});

test("real and demo profiles interleave after merge, while sidebar order applies globally without moving top banner", async () => {
  const real = { ...row, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", slug: "actual", display_name: "Actual Firma" };
  const order = [
    { profile_id: null, demo_slug: demos[1].slug, item_key: `demo:${demos[1].slug}`, sort_order: 0 },
    { profile_id: real.id, demo_slug: null, item_key: `profile:${real.id}`, sort_order: 1 },
    ...demos.filter((demo) => demo.isDemo && demo.slug !== demos[1].slug).map((demo, i) => ({ profile_id: null, demo_slug: demo.slug, item_key: `demo:${demo.slug}`, sort_order: i + 2 })),
  ];
  const sidebar = [
    { slot: "sidebar_bottom", sort_order: 0 },
    { slot: "sidebar_top", sort_order: 1 },
    { slot: "sidebar_middle", sort_order: 2 },
    ...Array.from({ length: 9 }, (_, i) => ({ slot: `sidebar_${String(i + 4).padStart(2, "0")}`, sort_order: i + 3 })),
  ];
  api([real], false, [], order, sidebar);
  assert.deepEqual((await loadPortalCompanies()).data.slice(0, 3).map((item) => item.slug), [demos[1].slug, real.slug, demos[0].slug]);
  api([real], false, [], order, sidebar);
  const html = renderToStaticMarkup(await DirectoryPage({ searchParams: Promise.resolve({}) }));
  assert.ok(html.indexOf(demos[1].name) < html.indexOf("Actual Firma"));
  const placements = [...html.matchAll(/data-placement="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(placements.slice(0, 4), ["top_banner", "sidebar_bottom", "sidebar_top", "sidebar_middle"]);
  api([real], false, [], order, sidebar);
  assert.throws(
    () => TradePage({ params: Promise.resolve({ slug: "daemmung" }), searchParams: Promise.resolve({}) }),
    /REDIRECT:\//,
  );
  api([real], false, [], order, sidebar);
  const travel = renderToStaticMarkup(await DirectoryPage({ mode: "travel", searchParams: Promise.resolve({}) }));
  assert.deepEqual([...travel.matchAll(/data-placement="([^"]+)"/g)].map((match) => match[1]).slice(0, 4), placements.slice(0, 4));
});

test("public loader retries its existing columns when anon has no street grant", async () => {
  api([travelRow]);
  const fetchWithData = globalThis.fetch;
  let denied = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input);
    if (url.pathname === "/rest/v1/company_profiles" && url.searchParams.get("select")?.includes("street")) {
      denied++;
      return new Response(JSON.stringify({ code: "42501", message: "permission denied" }), {
        status: 403, headers: { "content-type": "application/json" },
      });
    }
    return fetchWithData(input, init);
  };
  const directory = await loadPublicCompanies();
  assert.equal(directory.error, null);
  assert.equal(directory.data[0].location.street, "");
  const detail = await loadPublicCompanyBySlug(travelRow.slug);
  assert.equal(detail.error, null);
  assert.equal(detail.data.location.street, "");
  assert.equal(denied, 2);
});

test("homepage shows real travel cards beside the shared long rail and queries only homepage ads", async () => {
  const basic = { ...row, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", slug: "basic-home", display_name: "Basic Home", package_type: "basic" };
  const premium = { ...row, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", slug: "premium-home", display_name: "Premium Home", package_type: "premium" };
  const requests = api([premium, basic, legacyRows[0]], false, [], [
    { profile_id: basic.id, sort_order: 0 },
    { profile_id: premium.id, sort_order: 1 },
  ]);
  const html = renderToStaticMarkup(await HomePage());
  assert.match(html, /Bayerischer Wald/);
  assert.match(html, /Finde deinen passenden Urlaub/);
  assert.match(html, /Reise finden/);
  assert.match(html, /hero-loop\.mp4/);
  assert.doesNotMatch(html, /poster=|hero\.jpg/);
  assert.match(html, /name="sort"/);
  assert.equal((html.match(/href="\/mottoreisen\/[^\"]+"/g) ?? []).length, 12);
  assert.match(html, /Ausgewählte Unterkünfte/);
  assert.doesNotMatch(html, /Demo GmbH/);
  assert.match(html, /href="\/unterkuenfte\/bayerischer-wald"/);
  assert.doesNotMatch(html, /Basic Home|Premium Home/);
  assert.equal((html.match(/data-placement="sidebar_/g) ?? []).length, 10);
  assert.equal((html.match(/>Anzeige<\/p>/g) ?? []).length, 1);
  const adRequest = requests.find(({ url }) => url.pathname === "/rest/v1/rpc/get_active_ad_campaigns");
  assert.ok(adRequest);
  assert.equal(adRequest.body.p_scope_type, "homepage");
});

test("selected Joomla media are presentation fallbacks and uploaded media remain canonical", () => {
  const media = importedJoomlaMedia.wirthshof;
  const listing = {
    ...reiseportalPreview[0], slug: "wirthshof", logo: undefined, images: [],
  };
  const fallback = withLegacyImages(listing);
  assert.deepEqual(fallback.logo, media.logo);
  assert.deepEqual(fallback.images, media.images);
  const uploaded = { src: "https://example.test/signed-image", alt: "Redaktioneller Upload" };
  const updated = withLegacyImages({ ...listing, logo: uploaded, images: [uploaded] });
  assert.deepEqual(updated.logo, uploaded);
  assert.deepEqual(updated.images, [uploaded]);
});

test("public accommodations directory shows five stored legacy profiles once and one sanitized live demo", async () => {
  api([...legacyRows, row, demoRow]);
  const html = renderToStaticMarkup(
    await DirectoryPage({ mode: "travel", searchParams: Promise.resolve({}) }),
  );
  for (const name of ["Bayerischer Wald", "Höflehner", "Pension Sonnenhof", "Schafhuber", "Villner Hof", "Demo GmbH"])
    assert.match(html, new RegExp(name));
  for (const name of ["Bayerischer Wald", "Höflehner", "Pension Sonnenhof", "Schafhuber", "Villner Hof"])
    assert.equal((html.match(new RegExp(`>${name}<`, "g")) ?? []).length, 1);
  assert.match(html, /Demo\/Testprofil/);
  assert.match(html, /advertising-rail/);
  assert.doesNotMatch(html, /Test Firma|Müller Haustechnik|Energieheld Demo GmbH|Gewerke|Fachbetriebe/);
});

test("travel search submits supported destination and theme filters to the real directory", async () => {
  api([...legacyRows, demoRow]);
  const html = renderToStaticMarkup(await DirectoryPage({ mode: "travel", searchParams: Promise.resolve({
    ziel: "oesterreich", thema: "wanderurlaub",
  }) }));
  assert.match(html, /name="ziel"/);
  assert.match(html, /name="thema"/);
  assert.match(html, /2 Unterkünfte/);
  assert.match(html, /Höflehner|Schafhuber/);
  assert.doesNotMatch(html, /Demo GmbH|Pension Sonnenhof|Villner Hof|Energieheld Demo GmbH/);
});

test("admin sees both inline order entries and the compact sidebar rail", async () => {
  api([row]);
  const html = renderToStaticMarkup(await DirectoryPage({
    searchParams: Promise.resolve({}),
    canReorder: true,
    saveOrder: async () => ({ success: "ok" }),
    saveSidebarOrder: async () => ({ success: "ok" }),
  }));
  assert.match(html, /Firmenreihenfolge bearbeiten/);
  assert.match(html, /Banner-Reihenfolge bearbeiten/);
  assert.equal((html.match(/Freier Werbeplatz/g) ?? []).length, 1);
  assert.equal((html.match(/data-sidebar-slot=/g) ?? []).length, 10);
  assert.match(html, /Beispielprofil/);
  assert.doesNotMatch(html, /Banner-Bearbeitung aktiv|Firma .* nach oben/);
  api([row]);
  const filtered = renderToStaticMarkup(await DirectoryPage({
    searchParams: Promise.resolve({ q: "Test" }),
    canReorder: true,
    saveOrder: async () => ({ success: "ok" }),
    saveSidebarOrder: async () => ({ success: "ok" }),
  }));
  assert.doesNotMatch(filtered, /Firmenreihenfolge bearbeiten|Banner-Reihenfolge bearbeiten/);
});
test("public ads use one anonymous RPC and one signing batch; real cards are labelled without demo ads", async () => {
  const { loadPublicAds } = await import("../src/lib/public-ads.ts");
  const ads = [
    "top_banner",
    "sidebar_top",
    "sidebar_middle",
    "sidebar_bottom",
  ].map((placement, i) => ({
    id: `ad-${i}`,
    placement,
    headline: `Aktive Anzeige ${i}`,
    body_text: "Angebot",
    target_url: "https://advertiser.example.org",
    image_path: `campaigns/ad-${i}/creative/test.png`,
  }));
  const requests = api([row], false, ads);
  const loaded = await loadPublicAds("solar");
  assert.equal(loaded.length, 4);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0].body, {
    p_scope_type: "trade",
    p_category_id: "solar",
  });
  for (const request of requests) {
    assert.equal(request.headers.get("cookie"), null);
    assert.equal(
      request.headers.get("authorization"),
      "Bearer sb_publishable_test",
    );
  }
  const directoryRequests = api([row], false, ads);
  const html = renderToStaticMarkup(
    await DirectoryPage({ searchParams: Promise.resolve({}) }),
  );
  assert.equal(
    directoryRequests.filter((r) =>
      r.url.pathname.endsWith("get_active_ad_campaigns"),
    ).length,
    1,
  );
  assert.match(html, /Aktive Anzeige 0/);
  assert.match(html, /Aktive Anzeige 3/);
  assert.match(html, /rel="sponsored noopener noreferrer"/);
  assert.doesNotMatch(html, /Demobanner|Demo ansehen/);
  assert.deepEqual(directoryRequests.find((r) => r.body)?.body, {
    p_scope_type: "experts_directory",
    p_category_id: null,
  });
  api([row]);
  const empty = renderToStaticMarkup(
    await DirectoryPage({ searchParams: Promise.resolve({}) }),
  );
  assert.match(empty, /Freier Werbeplatz/);
  assert.doesNotMatch(empty, /Demobanner/);
});
for (const status of ["approved", "draft", "pending", "rejected"])
  test(`public list and detail visibility: ${status}`, async () => {
    api([{ ...row, status }]);
    assert.equal(
      (await loadPublicCompanies()).data.length,
      status === "approved" ? 1 : 0,
    );
    const found = await loadPublicCompanyBySlug(row.slug);
    assert.equal(Boolean(found.data), status === "approved");
    if (status !== "approved")
      await assert.rejects(
        Detail({ params: Promise.resolve({ slug: row.slug }) }),
        /NOT_FOUND/,
      );
  });
test("missing profile is not found and legacy trade routes redirect", async () => {
  api([]);
  await assert.rejects(
    Detail({ params: Promise.resolve({ slug: "missing" }) }),
    /NOT_FOUND/,
  );
  assert.throws(
    () => TradePage({
      params: Promise.resolve({ slug: "unknown" }),
      searchParams: Promise.resolve({}),
    }),
    /REDIRECT:\//,
  );
});
test("real mapping preserves free text, categories and absent fields without inventing services/images", async () => {
  api();
  const [item] = (await loadPublicCompanies()).data;
  assert.equal(item.businessAreas, row.business_areas);
  assert.deepEqual(item.categoryIds, ["daemmung", "fassade"]);
  assert.deepEqual(item.services, []);
  assert.deepEqual(item.images, []);
  assert.equal(item.isDemo, false);
  const html = renderToStaticMarkup(
    createElement(ListingDetail, {
      listing: item,
      categories: energieheld.categories,
    }),
  );
  assert.match(html, /WDVS, Fassadensanierung/);
  assert.match(html, /Branchen &amp; Tätigkeitsbereiche/);
  assert.match(html, /Fassade/);
  assert.match(html, /Dämmung/);
  assert.doesNotMatch(
    html,
    /Beispielprofil|Beispiellogo|Leistungen im Überblick|mailto:|Website besuchen|<img|<dt>Telefon/,
  );
});
test("safe contacts and empty location render without empty links or dangling commas", async () => {
  api([
    {
      ...row,
      city: null,
      postal_code: null,
      region: null,
      country: null,
      website: "javascript:alert(1)",
    },
  ]);
  const item = (await loadPublicCompanies()).data[0];
  let html = renderToStaticMarkup(
    createElement(ListingDetail, { listing: item, categories: [] }),
  );
  assert.doesNotMatch(html, /javascript:|class="location"|mailto:/);
  item.contact = {
    phone: "123",
    email: "firma@example.org",
    website: "https://example.org",
  };
  html = renderToStaticMarkup(
    createElement(ListingDetail, { listing: item, categories: [] }),
  );
  assert.match(html, /mailto:firma@example.org/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /123/);
});
test("category, free text, name, city, postal and region filters and sorting use real values", async () => {
  api([
    row,
    {
      ...row,
      id: "profile-2",
      slug: "a",
      display_name: "Alpha",
      city: "Augsburg",
      postal_code: "86150",
      business_areas: "Holz",
      tagline: "Dachbau",
      company_profile_categories: [{ category_id: "dach" }],
    },
  ]);
  const items = (await loadPublicCompanies()).data;
  for (const category of ["daemmung", "fassade"])
    assert.deepEqual(
      filterListings(items, { ...filters, category }).map((x) => x.id),
      ["profile-1"],
    );
  assert.equal(
    filterListings(items, { ...filters, category: "solar" }).length,
    0,
  );
  for (const query of ["Test", "Sanierung", "WDVS", "Fassadensanierung"])
    assert.equal(
      filterListings(items, { ...filters, query })[0].id,
      "profile-1",
    );
  for (const location of ["München", "80331"])
    assert.equal(
      filterListings(items, { ...filters, location })[0].id,
      "profile-1",
    );
  assert.equal(
    filterListings(items, { ...filters, location: "Bayern" }).length,
    2,
  );
  for (const sort of ["name", "city"])
    assert.equal(
      filterListings(items, { ...filters, sort })[0].id,
      "profile-2",
    );
});
test("database errors produce neutral error, never mocks or empty-success", async () => {
  api([], true);
  assert.deepEqual(await loadPublicCompanies(), {
    data: null,
    error: PUBLIC_COMPANIES_ERROR,
  });
  assert.deepEqual(await loadPublicCompanyBySlug("test"), {
    data: null,
    error: PUBLIC_COMPANIES_ERROR,
  });
  const html = renderToStaticMarkup(
    await DirectoryPage({ searchParams: Promise.resolve({}) }),
  );
  assert.ok(html.includes(PUBLIC_COMPANIES_ERROR));
  assert.doesNotMatch(
    html,
    /class="listing-row listing-row--|Noch kein passender Treffer|private database error/,
  );
});
test("empty filtered directory and combined directory have distinct UI without service filter", async () => {
  api([]);
  let html = renderToStaticMarkup(
    await DirectoryPage({
      searchParams: Promise.resolve({ q: "kein-treffer-xyz" }),
    }),
  );
  assert.match(html, /Noch kein passender Treffer/);
  assert.doesNotMatch(html, /Beispielbetriebe|name="leistung"/);
  api();
  html = renderToStaticMarkup(
    await DirectoryPage({ searchParams: Promise.resolve({}) }),
  );
  assert.match(html, /Test Firma/);
  assert.match(html, /Unternehmensprofile und gekennzeichnete Beispielprofile/);
  assert.doesNotMatch(html, /Fiktive Einträge/);
});
test("pagination loads all approved profiles", async () => {
  api(Array.from({ length: 501 }, (_, i) => ({ ...row, id: String(i) })));
  assert.equal((await loadPublicCompanies()).data.length, 501);
});
test("owner and admin sessions on other clients cannot enter anonymous requests", async () => {
  const requests = api([
    { ...row, logo_path: "profiles/profile-1/logo/test.png" },
  ]);
  for (const role of ["owner", "admin"]) {
    const other = createPublicClient();
    const payload = Buffer.from(
      JSON.stringify({ sub: role, exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString("base64url");
    const signedIn = await other.auth.setSession({
      access_token: `eyJhbGciOiJub25lIn0.${payload}.c2ln`,
      refresh_token: "session-token",
    });
    assert.equal(signedIn.error, null);
    assert.ok((await other.auth.getSession()).data.session);
    await loadPublicCompanies();
    await loadPublicCompanyBySlug(row.slug);
  }
  assert.ok(requests.length >= 4);
  const text = source("src/lib/supabase/public.ts");
  assert.match(text, /import "server-only"/);
  for (const opt of [
    "persistSession",
    "autoRefreshToken",
    "detectSessionInUrl",
  ])
    assert.match(text, new RegExp(opt + ": false"));
  assert.doesNotMatch(
    text,
    /next\/headers|supabase\/server|SERVICE_ROLE|SECRET_KEY/,
  );
});
test("public routes remain dynamic and Supabase data layer stays separate from presentation examples", () => {
  for (const path of [
    "src/app/(energieheld)/unterkuenfte-a-z/page.tsx",
    "src/app/(energieheld)/unterkuenfte/[slug]/page.tsx",
  ]) {
    const text = source(path);
    assert.doesNotMatch(
      text,
      /data\/listings|generateStaticParams|dynamicParams/,
    );
    assert.match(text, /force-dynamic/);
  }
  assert.match(source("src/app/(energieheld)/experten/page.tsx"), /redirect\("\/unterkuenfte-a-z"\)/);
  assert.match(source("src/app/(energieheld)/gewerke/page.tsx"), /redirect\("\/"\)/);
  for (const path of [
    "src/components/portal/directory-page.tsx",
    "src/lib/public-companies.ts",
  ])
    assert.doesNotMatch(source(path), /data\/listings|supabase\/server/);
});

test("combined directory shows real and demo profiles, with badges only on demos", async () => {
  api();
  const result = await loadPortalCompanies();
  assert.equal(result.error, null);
  assert.equal(result.data.length, demos.length + 1);
  assert.equal(result.data[0].isDemo, false);
  assert.ok(result.data.slice(1).every((item) => item.isDemo));
  const html = renderToStaticMarkup(
    await DirectoryPage({ searchParams: Promise.resolve({}) }),
  );
  const cards = html.match(/<article class="listing-row listing-row--(?:basic|premium)"[\s\S]*?<\/article>/g);
  assert.equal(cards.length, demos.length + 1);
  for (const card of cards) {
    if (card.includes("Test Firma"))
      assert.doesNotMatch(card, /Beispielprofil/);
    else assert.match(card, /class="badge row-demo">Beispielprofil/);
  }
});

test("filtered trade directory retains Premium and Basic presentation", async () => {
  api();
  const html = renderToStaticMarkup(await DirectoryPage({
    searchParams: Promise.resolve({}),
    trade: { id: "heizung", name: "Heizung", icon: "heat", image: "heizung", description: "Heiztechnik" },
  }));
  assert.match(html, /Müller Haustechnik/);
  assert.match(html, /listing-row--premium/);
  assert.match(html, /Wärmezeit Bayern/);
  assert.match(html, /listing-row--basic/);
  assert.doesNotMatch(html, /Klarblick Energieberatung/);
});

test("combined category and location filtering and sorting include both sources", async () => {
  api([{ ...row, company_profile_categories: [{ category_id: "heizung" }] }]);
  const items = (await loadPortalCompanies()).data;
  for (const filtersToUse of [
    { category: "heizung" },
    { location: "München" },
    { location: "80331" },
  ]) {
    const result = filterListings(items, { ...filters, ...filtersToUse });
    assert.ok(result.some((item) => !item.isDemo));
    assert.ok(result.some((item) => item.isDemo));
  }
  for (const category of energieheld.categories) {
    const result = filterListings(items, { ...filters, category: category.id });
    assert.ok(result.every((item) => item.categoryIds.includes(category.id)));
  }
  for (const [sort, value] of [
    ["name", (item) => item.name],
    ["city", (item) => item.location.city],
  ]) {
    const result = filterListings(items, { ...filters, sort });
    assert.deepEqual(
      result.map(value),
      items.map(value).sort((a, b) => a.localeCompare(b, "de")),
    );
  }
  assert.equal(
    filterListings(items, { ...filters, query: "Müller" })[0].slug,
    "mueller-haustechnik",
  );
});

test("real profiles win ID and slug collisions without duplicate cards", async () => {
  api();
  const real = (await loadPublicCompanies()).data[0];
  for (const collision of [{ id: demos[0].id }, { slug: demos[0].slug }]) {
    const winner = { ...real, ...collision };
    const combined = combinePortalCompanies([winner]);
    assert.equal(combined.length, demos.length);
    assert.equal(combined[0], winner);
    assert.ok(!combined.includes(demos[0]));
  }
  const collisionRow = { ...row, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", slug: demos[0].slug };
  api([collisionRow], false, [], [
    { profile_id: collisionRow.id, demo_slug: null, item_key: `profile:${collisionRow.id}`, sort_order: 0 },
    ...demos.map((demo, i) => ({ profile_id: null, demo_slug: demo.slug, item_key: `demo:${demo.slug}`, sort_order: i + 1 })),
  ]);
  const collisionResult = await loadPortalCompanies();
  assert.equal(collisionResult.data.some((item) => item.isDemo && item.slug === demos[0].slug), false);
  assert.deepEqual(collisionResult.hiddenDemoKeys, [`demo:${demos[0].slug}`]);
  api([{ ...row, slug: demos[0].slug }]);
  const detail = await loadPortalCompanyBySlug(demos[0].slug);
  assert.equal(detail.data.name, row.display_name);
  assert.equal(detail.data.isDemo, false);
  await assert.rejects(
    Detail({ params: Promise.resolve({ slug: demos[0].slug }) }),
    /NOT_FOUND/,
  );
  await assert.rejects(
    LegacyDetail({ params: Promise.resolve({ slug: demos[0].slug }) }),
    /REDIRECT:\/unterkuenfte\//,
  );
});

test("old energy demo slugs cannot open on the public travel route", async () => {
  api([]);
  for (const demo of demos) {
    const result = await loadPortalCompanyBySlug(demo.slug);
    assert.equal(result.data, demo);
    assert.equal(result.data.isDemo, true);
    await assert.rejects(
      Detail({ params: Promise.resolve({ slug: demo.slug }) }),
      /NOT_FOUND/,
    );
  }
});

test("database errors never expose demos in directory, detail or metadata", async () => {
  api([], true);
  assert.equal((await loadPortalCompanies()).data, null);
  for (const demo of demos) {
    assert.deepEqual(await loadPortalCompanyBySlug(demo.slug), {
      data: null,
      error: PUBLIC_COMPANIES_ERROR,
    });
    const html = renderToStaticMarkup(
      await Detail({ params: Promise.resolve({ slug: demo.slug }) }),
    );
    assert.ok(html.includes(PUBLIC_COMPANIES_ERROR));
    assert.ok(!html.includes(demo.name));
    assert.deepEqual(
      await detailMetadata({ params: Promise.resolve({ slug: demo.slug }) }),
      { title: "Unternehmensprofil" },
    );
  }
});

test("real Basic directory keeps signed logo off the row while detail displays sorted gallery", async () => {
  api([
    {
      ...travelRow,
      logo_path: "profiles/profile-1/logo/test.png",
      company_profile_images: [
        {
          id: "second",
          storage_path: "profiles/profile-1/gallery/second.png",
          sort_order: 1,
          alt_text: null,
        },
        {
          id: "first",
          storage_path: "profiles/profile-1/gallery/first.png",
          sort_order: 0,
          alt_text: "Unser Team",
        },
      ],
    },
  ]);
  const result = await loadPublicCompanyBySlug(row.slug);
  assert.equal(result.error, null);
  assert.deepEqual(
    result.data.images.map((i) => i.alt),
    ["Unser Team", "Unternehmensbild von Test Firma"],
  );
  assert.match(result.data.logo.src, /token=temporary/);
  const directory = renderToStaticMarkup(
    await DirectoryPage({ mode: "travel", searchParams: Promise.resolve({ q: "Test Firma" }) }),
  );
  assert.match(directory, /listing-row--basic/);
  assert.doesNotMatch(directory, /row-logo|alt="Logo von Test Firma"/);
  const detail = renderToStaticMarkup(
    await Detail({ params: Promise.resolve({ slug: row.slug }) }),
  );
  assert.match(detail, /alt="Unser Team"/);
  assert.match(detail, /Unternehmensbild/);
  assert.doesNotMatch(detail, /Symbolbild/);
});

test("real Basic directory uses a compact row without a logo block", async () => {
  api();
  const html = renderToStaticMarkup(
    await DirectoryPage({ searchParams: Promise.resolve({ q: "Test Firma" }) }),
  );
  assert.match(html, /listing-row--basic/);
  assert.doesNotMatch(html, /row-logo/);
});

test("live demo detail uses its actual media and address without energy-sector copy", async () => {
  api([demoRow]);
  const html = renderToStaticMarkup(
    await Detail({ params: Promise.resolve({ slug: "demo-gmbh" }) }),
  );
  assert.match(html, /Demo GmbH/);
  assert.match(html, /Demo\/Testprofil/);
  assert.match(html, /profiles\/31ae7d1e-26a7-4161-8d14-f5ee4735f5d4\/logo\.jpg/);
  assert.match(html, /Bild 1 von Demo GmbH/);
  assert.match(html, /Google Maps – Adresse: Musterstraße 12/);
  assert.doesNotMatch(html, /Energieheld Demo GmbH|Photovoltaik|Elektrotechnik|Energiesysteme|Gebäudetechnik|Modernisierung|energieheld\.bayern|Symbolbild/);
});

test("old Höflehner URL redirects to the ASCII slug", async () => {
  await assert.rejects(Detail({ params: Promise.resolve({ slug: "höflehner" }) }), /REDIRECT:\/unterkuenfte\/hoeflehner/);
});

test("real approved profile has an inquiry dialog even without public email; demos remain disabled", async () => {
  api([travelRow]);
  const real = renderToStaticMarkup(
    await Detail({ params: Promise.resolve({ slug: row.slug }) }),
  );
  assert.match(real, /<dialog/);
  assert.match(real, /name="consent"/);
  assert.match(real, /name="website"/);
  assert.match(real, /Anfrage senden/);
  api([demoRow]);
  const demo = renderToStaticMarkup(
    await Detail({ params: Promise.resolve({ slug: "demo-gmbh" }) }),
  );
  assert.doesNotMatch(demo, /<dialog|Anfrage senden/);
  assert.match(demo, /disabled=""/);
});

test("quality data stays in the public query while travel UI avoids the energy-branded seal", async () => {
  const verified = {
    status: "verified",
    verified_at: "2026-09-17T12:00:00Z",
    public_note: "Persönlich bekannt",
  };
  const rows = [
    {
      ...travelRow,
      id: "b",
      slug: "zulu",
      display_name: "Zulu",
      company_quality_reviews: verified,
    },
    {
      ...travelRow,
      id: "a",
      slug: "alpha",
      display_name: "Alpha",
      company_quality_reviews: null,
    },
  ];
  const requests = api(rows);
  const loaded = await loadPublicCompanies();
  assert.equal(requests.length, 2);
  assert.match(
    requests[0].url.searchParams.get("select"),
    /company_quality_reviews\(status,verified_at,public_note\)/,
  );
  assert.doesNotMatch(
    requests[0].url.searchParams.get("select"),
    /verified_by/,
  );
  assert.equal(loaded.data[0].verification.status, "verified");
  assert.equal(loaded.data[1].verification, undefined);
  assert.deepEqual(
    filterListings(loaded.data, { ...filters, sort: "name" }).map(
      (x) => x.name,
    ),
    ["Alpha", "Zulu"],
  );
  api(rows);
  const directory = renderToStaticMarkup(
    await DirectoryPage({ mode: "travel", searchParams: Promise.resolve({}) }),
  );
  assert.equal(
    (directory.match(/Persönlich verifiziert – Bedeutung anzeigen/g) ?? [])
      .length,
    0,
  );
  api(rows);
  const detail = renderToStaticMarkup(
    await Detail({ params: Promise.resolve({ slug: "zulu" }) }),
  );
  assert.doesNotMatch(detail, /Persönlich verifiziert|Energieheld/);
  api(rows);
  const unverified = renderToStaticMarkup(
    await Detail({ params: Promise.resolve({ slug: "alpha" }) }),
  );
  assert.doesNotMatch(unverified, /Persönlich verifiziert/);
  assert.throws(
    () => TradePage({ params: Promise.resolve({ slug: "daemmung" }), searchParams: Promise.resolve({}) }),
    /REDIRECT:\//,
  );
  const demo = { ...demos[0], verification: verified };
  const demoHtml = renderToStaticMarkup(
    createElement(ListingDetail, {
      listing: demo,
      categories: energieheld.categories,
      presentation: "company",
    }),
  );
  assert.doesNotMatch(demoHtml, /Persönlich verifiziert/);
});

test("private pending/rejected requests never produce public badges or request details", async () => {
  for (const status of ["pending", "rejected", "approved"]) {
    const requests = api([
      {
        ...travelRow,
        company_quality_reviews: null,
        company_quality_requests: {
          status,
          requested_at: "2026-09-17T12:00:00Z",
        },
      },
    ]);
    const html = renderToStaticMarkup(
      await DirectoryPage({
        mode: "travel",
        searchParams: Promise.resolve({ q: "Test Firma" }),
      }),
    );
    assert.doesNotMatch(
      html,
      /Persönlich verifiziert|Verifizierung angefragt|Verifizierungsanfrage/,
    );
    assert.ok(
      requests.every(
        (r) =>
          !r.url.searchParams
            .get("select")
            ?.includes("company_quality_requests"),
      ),
    );
    const detail = renderToStaticMarkup(
      await Detail({ params: Promise.resolve({ slug: row.slug }) }),
    );
    assert.doesNotMatch(
      detail,
      /Persönlich verifiziert|Verifizierung angefragt|Verifizierungsanfrage/,
    );
  }
});
