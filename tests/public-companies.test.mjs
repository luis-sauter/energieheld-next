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
    if (s === "next/headers" || s.endsWith("/supabase/server"))
      throw Error("Public pages must never read session cookies");
    if (s === "next/navigation")
      return {
        url: 'data:text/javascript,export function notFound(){throw Error("NOT_FOUND")}',
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
  await import("../src/app/(energieheld)/experten/[slug]/page.tsx");
const { default: TradePage } =
  await import("../src/app/(energieheld)/gewerke/[slug]/page.tsx");
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
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
function api(rows = [row], failure = false) {
  const requests = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(input),
      headers = new Headers(init?.headers);
    requests.push({ url, headers });
    if (url.pathname === "/auth/v1/user")
      return new Response(
        JSON.stringify({
          id: "signed-in-user",
          aud: "authenticated",
          role: "authenticated",
        }),
        { headers: { "content-type": "application/json" } },
      );
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
test("missing profile and unknown trade are not found", async () => {
  api([]);
  await assert.rejects(
    Detail({ params: Promise.resolve({ slug: "missing" }) }),
    /NOT_FOUND/,
  );
  await assert.rejects(
    TradePage({
      params: Promise.resolve({ slug: "unknown" }),
      searchParams: Promise.resolve({}),
    }),
    /NOT_FOUND/,
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
    /class="listing-row"|Noch kein passender Treffer|private database error/,
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
    "src/app/(energieheld)/experten/page.tsx",
    "src/app/(energieheld)/gewerke/[slug]/page.tsx",
    "src/app/(energieheld)/experten/[slug]/page.tsx",
  ]) {
    const text = source(path);
    assert.doesNotMatch(
      text,
      /data\/listings|generateStaticParams|dynamicParams/,
    );
    assert.match(text, /force-dynamic/);
  }
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
  const cards = html.match(/<article class="listing-row"[\s\S]*?<\/article>/g);
  assert.equal(cards.length, demos.length + 1);
  for (const card of cards) {
    if (card.includes("Test Firma"))
      assert.doesNotMatch(card, /Beispielprofil/);
    else assert.match(card, /class="badge">Beispielprofil/);
  }
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
  api([{ ...row, slug: demos[0].slug }]);
  const detail = await loadPortalCompanyBySlug(demos[0].slug);
  assert.equal(detail.data.name, row.display_name);
  assert.equal(detail.data.isDemo, false);
  const html = renderToStaticMarkup(
    await Detail({ params: Promise.resolve({ slug: demos[0].slug }) }),
  );
  assert.doesNotMatch(html, /Beispielprofil/);
});

test("all known demo slugs open labelled detail pages with disabled fictional contacts", async () => {
  api([]);
  for (const demo of demos) {
    const result = await loadPortalCompanyBySlug(demo.slug);
    assert.equal(result.data, demo);
    assert.equal(result.data.isDemo, true);
    const html = renderToStaticMarkup(
      await Detail({ params: Promise.resolve({ slug: demo.slug }) }),
    );
    assert.ok(html.includes(demo.name.replaceAll("&", "&amp;")));
    assert.match(html, /Beispielprofil/);
    assert.match(html, /Kontaktdaten sind fiktiv/);
    assert.match(html, /<button[^>]*disabled/);
    assert.doesNotMatch(html, /href="mailto:|Website besuchen/);
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

test("public directory displays signed logo and detail displays sorted real gallery", async () => {
  api([
    {
      ...row,
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
    await DirectoryPage({ searchParams: Promise.resolve({ q: "Test Firma" }) }),
  );
  assert.match(directory, /alt="Logo von Test Firma"/);
  const detail = renderToStaticMarkup(
    await Detail({ params: Promise.resolve({ slug: row.slug }) }),
  );
  assert.match(detail, /alt="Unser Team"/);
  assert.match(detail, /Unternehmensbild/);
  assert.doesNotMatch(detail, /Symbolbild/);
});

test("directory retains initials and no image element inside real logo without uploaded logo", async () => {
  api();
  const html = renderToStaticMarkup(
    await DirectoryPage({ searchParams: Promise.resolve({ q: "Test Firma" }) }),
  );
  assert.match(html, /<div class="row-logo"[^>]*>TF<\/div>/);
});

test("demo details keep local symbol galleries after media integration", async () => {
  api([]);
  const html = renderToStaticMarkup(
    await Detail({ params: Promise.resolve({ slug: demos[0].slug }) }),
  );
  assert.match(html, /src="\/images\//);
  assert.match(html, /Symbolbild/);
  assert.match(html, /Beispielprofil/);
});

test("real approved profile has an inquiry dialog even without public email; demos remain disabled", async () => {
  api();
  const real = renderToStaticMarkup(
    await Detail({ params: Promise.resolve({ slug: row.slug }) }),
  );
  assert.match(real, /<dialog/);
  assert.match(real, /name="consent"/);
  assert.match(real, /name="website"/);
  assert.match(real, /Anfrage senden/);
  api([]);
  const demo = renderToStaticMarkup(
    await Detail({ params: Promise.resolve({ slug: demos[0].slug }) }),
  );
  assert.doesNotMatch(demo, /<dialog|Anfrage senden/);
  assert.match(demo, /disabled=""/);
});
