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
const { default: Detail } =
  await import("../src/app/(energieheld)/experten/[slug]/page.tsx");
const { default: TradePage } =
  await import("../src/app/(energieheld)/gewerke/[slug]/page.tsx");
const { energieheld } = await import("../src/config/energieheld.ts");
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
  logo_url: null,
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
    /Beispielprofil|Noch kein passender Treffer|private database error/,
  );
});
test("empty directory and real directory have distinct UI without service filter or demo listings", async () => {
  api([]);
  let html = renderToStaticMarkup(
    await DirectoryPage({ searchParams: Promise.resolve({}) }),
  );
  assert.match(html, /Noch kein passender Treffer/);
  assert.doesNotMatch(html, /Beispielbetriebe|name="leistung"/);
  api();
  html = renderToStaticMarkup(
    await DirectoryPage({ searchParams: Promise.resolve({}) }),
  );
  assert.match(html, /Test Firma/);
  assert.match(html, /Öffentlich freigegebene/);
  assert.doesNotMatch(html, /Beispielprofil|Fiktive Einträge/);
});
test("pagination loads all approved profiles", async () => {
  api(Array.from({ length: 501 }, (_, i) => ({ ...row, id: String(i) })));
  assert.equal((await loadPublicCompanies()).data.length, 501);
});
test("owner and admin sessions on other clients cannot enter anonymous requests", async () => {
  const requests = api();
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
test("public route source paths contain no mock imports and use dynamic rendering", () => {
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
