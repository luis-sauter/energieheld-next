import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith(".module.css")) return { url: 'data:text/javascript,export default {}', shortCircuit: true };
    if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
    if (specifier === "next/navigation") return {
      url: 'data:text/javascript,export function redirect(path){throw Error("REDIRECT:"+path)};export function notFound(){throw Error("NOT_FOUND")}',
      shortCircuit: true,
    };
    if (specifier === "next/link" || specifier === "next/image") return {
      url: `data:text/javascript,export default ${JSON.stringify(specifier === "next/link" ? "a" : "img")}`,
      shortCircuit: true,
    };
    if (specifier.endsWith("/auth-actions")) return { url: 'data:text/javascript,export async function logout(){return {}}', shortCircuit: true };
    if (specifier.endsWith("/public-companies")) return {
      url: 'data:text/javascript,export async function loadPublicCompanyDirectory(){return globalThis.__travelDirectoryResult};export async function loadPublicCompanyBySlug(slug){globalThis.__travelLookups.push(slug);return globalThis.__travelDetailResult}',
      shortCircuit: true,
    };
    if (specifier.endsWith("/public-travel-taxonomy")) return {
      url: 'data:text/javascript,export async function loadPublicTravelAssignments(){return globalThis.__travelAssignments ?? null}',
      shortCircuit: true,
    };
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const base = specifier.startsWith("@/")
        ? new URL("../src/" + specifier.slice(2), import.meta.url)
        : new URL(specifier, context.parentURL);
      for (const ext of [".ts", ".tsx"])
        if (existsSync(new URL(base.href + ext))) return next(base.href + ext, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".tsx")) return {
      format: "module",
      shortCircuit: true,
      source: transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX },
      }).outputText,
    };
    return next(url, context);
  },
});

const { reiseportal } = await import("../src/config/reiseportal.ts");
const { reiseportalPreview } = await import("../src/data/reiseportal-preview.ts");
const { reiseziele, mottoreisen } = await import("../src/data/reiseportal-overviews.ts");
const { destinations, travelThemes } = await import("../src/data/reiseportal-discovery.ts");
const { ReiseOverview } = await import("../src/components/portal/reise-overview.tsx");
const { DiscoveryDetail } = await import("../src/components/portal/discovery-detail.tsx");
const { ListingDetail } = await import("../src/components/portal/listing-detail.tsx");
const { filterTravelDiscovery } = await import("../src/lib/reiseportal-search.ts");
const destinationRoute = await import("../src/app/(energieheld)/reiseziele/[slug]/page.tsx");
const themeRoute = await import("../src/app/(energieheld)/mottoreisen/[slug]/page.tsx");
const { default: ThemeOverview } = await import("../src/app/(energieheld)/mottoreisen/page.tsx");
const { PortalHeader, PortalFooter } = await import("../src/components/portal/chrome.tsx");
const { accountMenuGroups } = await import("../src/components/portal/account-menu.tsx");
const { loadReiseportalDirectory, loadReiseportalListingBySlug } =
  await import("../src/lib/reiseportal-directory.ts");
const { default: LegacyExperts } = await import("../src/app/(energieheld)/experten/page.tsx");
const { default: LegacyDetail } = await import("../src/app/(energieheld)/experten/[slug]/page.tsx");
const { default: LegacyTrades } = await import("../src/app/(energieheld)/gewerke/page.tsx");

test("public navigation has only the three travel entries and uses the untouched original logo", () => {
  assert.deepEqual(reiseportal.navigation, [
    { label: "Reiseziele", href: "/reiseziele" },
    { label: "Mottoreisen", href: "/mottoreisen" },
    { label: "Unterkünfte A–Z", href: "/unterkuenfte-a-z" },
  ]);
  const html = renderToStaticMarkup(createElement(PortalHeader, { brand: reiseportal }));
  assert.match(html, /src="\/brand\/das-reiseportal-logo\.png"/);
  assert.doesNotMatch(html, /Gewerke|Experten A–Z|energieheld\.bayern|Sanieren mit Grips/);
  assert.equal((html.match(/href="\/reiseziele"/g) ?? []).length, 2);
  assert.equal((html.match(/href="\/mottoreisen"/g) ?? []).length, 2);
  assert.equal((html.match(/href="\/unterkuenfte-a-z"/g) ?? []).length, 2);
});

test("account button and dropdown groups use server-provided access without permanent header links", () => {
  const header = (access) => renderToStaticMarkup(createElement(PortalHeader, { brand: reiseportal, access }));
  const footer = (access) => renderToStaticMarkup(createElement(PortalFooter, { brand: reiseportal, access }));
  const guest = header("unauthenticated");
  assert.match(guest, /aria-label="Kontomenü öffnen"/);
  assert.match(guest, /aria-label="Mobile Hauptnavigation"/);
  assert.equal((guest.match(/href="\/registrieren"/g) ?? []).length, 2);
  assert.match(guest, /Unterkunft eintragen/);
  assert.doesNotMatch(guest, /href="\/login"|href="\/firma"|href="\/admin"/);
  assert.deepEqual(accountMenuGroups("unauthenticated").account.map((link) => link.label), ["Einloggen"]);
  assert.doesNotMatch(guest, /href="\/firma"|href="\/admin"/);

  const member = header("forbidden");
  assert.doesNotMatch(member, /href="\/firma"|href="\/admin"|href="\/login"/);
  assert.deepEqual(accountMenuGroups("forbidden").account.map((link) => link.label), ["Firmenbereich", "Profil bearbeiten", "Anfragen", "Werbung", "Statistiken"]);
  assert.deepEqual(accountMenuGroups("forbidden").administration, []);
  const admin = header("admin");
  assert.doesNotMatch(admin, /href="\/firma"|href="\/admin"|href="\/login"/);
  assert.deepEqual(accountMenuGroups("admin").administration.map((link) => link.label), ["Adminbereich", "Firmen verwalten", "Werbung verwalten"]);

  assert.match(footer("unauthenticated"), /DAS Reiseportal.*Neue Lieblingsorte entdecken/s);
  assert.doesNotMatch(footer("unauthenticated"), /<a\b|<nav\b/);
  assert.doesNotMatch(footer("forbidden"), /<a\b|<nav\b/);
});

test("homepage uses the supplied MP4 as the hero background with search above it", () => {
  const source = readFileSync(new URL("../src/app/(energieheld)/page.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.ok(existsSync(new URL("../public/reiseportal/hero-loop.mp4", import.meta.url)));
  assert.match(source, /<section className="travel-hero"[\s\S]*?<video autoPlay muted loop playsInline preload="metadata"[\s\S]*?<source src="\/reiseportal\/hero-loop\.mp4"[\s\S]*?<h1 id="travel-hero-title">Finde deinen passenden Urlaub<\/h1>[\s\S]*?<form className="travel-search"/);
  assert.match(css, /\.travel-hero > video\s*\{[^}]*object-fit: cover;[^}]*pointer-events: none;/);
  assert.doesNotMatch(source, /<Image src="\/reiseportal\/hero\.jpg"/);
});

test("preview contains the five sourced legacy accommodations; the demo comes from Supabase", () => {
  assert.deepEqual(reiseportalPreview.map((item) => item.name), [
    "Bayerischer Wald", "Höflehner", "Pension Sonnenhof",
    "Schafhuber", "Villner Hof",
  ]);
  assert.deepEqual(reiseportalPreview.map((item) => item.directoryPackage), [
    "premium", "premium", "premium", "premium", "basic",
  ]);
  assert.ok(reiseportalPreview.every((item) =>
    item.isPreview && item.categoryIds.length === 0 && !item.logo));
  assert.ok(reiseportalPreview.slice(0, 4).every((item) => item.images.length > 0));
  assert.equal(reiseportalPreview.at(-1).images.length, 0); // No Villner Hof original exists in the export.
  assert.equal(reiseportalPreview[1].slug, "hoeflehner");
  assert.doesNotMatch(reiseportalPreview.map((item) => item.name + item.tagline).join(" "), /Energieheld|Müller Haustechnik|Sonnenwerk Oberland/);
});

test("destination and motto overviews use only the current visible legacy groups", () => {
  assert.deepEqual([...reiseziele], ["Deutschland", "Österreich", "Schweiz", "Südtirol/Italien"]);
  assert.deepEqual([...mottoreisen], [
    "Natur pur", "Nordic Walking", "Radwandern", "Wanderurlaub",
    "Familienurlaub", "Golfurlaub", "Tauchurlaub", "Urlaub am Wasser",
    "Campingurlaub", "Romantik zu zweit", "Wellnessangebote", "Geschäftsreisen",
  ]);
});

test("four destinations and twelve themes have sourced images, links and detail routes", async () => {
  globalThis.__travelDirectoryResult = { data: {
    listings: reiseportalPreview.map((listing, index) => ({ ...listing, id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, "0")}`, isPreview: false })),
    orderRows: [],
  }, error: null };
  assert.deepEqual(destinations.map((item) => item.title), [...reiseziele]);
  assert.deepEqual(travelThemes.map((item) => item.title), [...mottoreisen]);
  assert.equal(destinationRoute.generateStaticParams().length, 4);
  assert.equal(themeRoute.generateStaticParams().length, 12);
  for (const [entries, basePath, title] of [[destinations, "/reiseziele", "Reiseziele"], [travelThemes, "/mottoreisen", "Mottoreisen"]]) {
    const html = renderToStaticMarkup(createElement(ReiseOverview, { title, intro: "Intro", entries, basePath }));
    assert.equal((html.match(/class="discovery-card"/g) ?? []).length, entries.length);
    for (const entry of entries) {
      assert.match(html, new RegExp(`href="${basePath}/${entry.slug}"`));
      if (entry.image) {
        assert.match(html, new RegExp(entry.image.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        assert.ok(existsSync(new URL(`../public${entry.image}`, import.meta.url)));
      } else {
        assert.match(html, /discovery-card-image-fallback/);
      }
    }
  }
  const destination = renderToStaticMarkup(await destinationRoute.default({ params: Promise.resolve({ slug: "oesterreich" }) }));
  assert.match(destination, /Höflehner|Schafhuber/);
  const theme = renderToStaticMarkup(createElement(DiscoveryDetail, { entry: travelThemes[0], title: "Mottoreisen", basePath: "/mottoreisen", listings: reiseportalPreview.slice(0, 1) }));
  assert.match(theme, /Bayerischer Wald/);
  for (const slug of ["tauchurlaub", "nordic-walking"]) {
    const entry = travelThemes.find((item) => item.slug === slug);
    assert.ok(entry.image?.endsWith(`/${slug}.jpg`));
    const detail = renderToStaticMarkup(createElement(DiscoveryDetail, { entry, title: "Mottoreisen", basePath: "/mottoreisen", listings: [] }));
    assert.match(detail, new RegExp(`${slug}\\.jpg`));
  }
  const overview = renderToStaticMarkup(createElement(ThemeOverview));
  assert.match(overview, /mottoreisen-intro\.jpg/);
  assert.match(overview, /Vielleicht geht es Ihnen aber gar nicht so sehr um ein bestimmtes Ziel/);
  await assert.rejects(destinationRoute.default({ params: Promise.resolve({ slug: "unbekannt" }) }), /NOT_FOUND/);
});

test("travel search filters destinations and only source-tagged preview themes", () => {
  assert.deepEqual(filterTravelDiscovery(reiseportalPreview, "oesterreich", "wanderurlaub").map((item) => item.slug), ["hoeflehner", "schafhuber"]);
  assert.deepEqual(filterTravelDiscovery(reiseportalPreview, "suedtirol-italien", "radwandern").map((item) => item.slug), ["pension-sonnenhof", "villner-hof"]);
  assert.deepEqual(filterTravelDiscovery(reiseportalPreview, "schweiz", "").map((item) => item.slug), []);
  assert.deepEqual(filterTravelDiscovery(reiseportalPreview, "", "golfurlaub"), []);
});

test("database travel terms take precedence over fallback slugs and combine all structured filters", () => {
  const listing = { ...reiseportalPreview[0], travelTermKeys: [
    "theme:tauchurlaub", "audience:paar", "accommodation:hotel", "feature:sauna",
  ] };
  assert.deepEqual(filterTravelDiscovery([listing], "", "natur-pur"), []);
  assert.deepEqual(filterTravelDiscovery([listing], "deutschland", "tauchurlaub", "paar", "hotel", "sauna"), [listing]);
  assert.deepEqual(filterTravelDiscovery([listing], "", "tauchurlaub", "familie"), []);
  assert.deepEqual(filterTravelDiscovery([listing], "", "", "", "", "pool"), []);
  assert.deepEqual(filterTravelDiscovery([reiseportalPreview[0]], "", "", "paar"), []);
});

test("public Reiseportal primary is turquoise while CTA and body text keep separate roles", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.equal(reiseportal.colors.primary, "#29B6E0");
  assert.equal(reiseportal.colors.accent, "#C3421C");
  assert.match(css, /\.reiseportal-shell\s*\{[^}]*--text: #26363d;/);
  assert.match(css, /\.reiseportal-shell :is\(a, button, input, select, summary\):focus-visible\s*\{\s*outline-color: #087a99;/);
  assert.match(css, /\.motto-page \.discovery-card-title span \{ color: var\(--brand-primary\); \}/);
  assert.doesNotMatch(css.slice(css.indexOf(".reiseportal-shell")), /#5d040a|rgba\(93, 4, 10/i);
});

test("legacy previews with addresses render the existing Google map and provider gallery", () => {
  for (const listing of reiseportalPreview) {
    const html = renderToStaticMarkup(createElement(ListingDetail, { listing, categories: [], showMap: true, showVerification: false }));
    assert.match(html, /google\.com\/maps/);
    assert.match(html, /Google Maps – Adresse:/);
    if (listing.images.length) assert.match(html, /class="gallery"/);
  }
});

test("travel loader excludes approved energy profiles without mutating the source", async () => {
  const neutral = { ...reiseportalPreview[0], id: "real-travel", slug: "reise-unterkunft", isPreview: false };
  const oldTest = { ...neutral, id: "31ae7d1e-26a7-4161-8d14-f5ee4735f5d4", slug: "energieheld-demo-gmbh-c3351d59", name: "Energieheld Demo GmbH", tagline: "Photovoltaik", description: "Modernisierung", businessAreas: "Elektrotechnik", images: [{ src: "/signed/one", alt: "Photovoltaik" }], logo: { src: "/signed/logo", alt: "Energieheld Demo GmbH" } };
  const categorized = { ...neutral, id: "category-energy", slug: "heizung", categoryIds: ["heizung"] };
  const energyCopy = { ...neutral, id: "energy-copy", slug: "solar", tagline: "Photovoltaik" };
  globalThis.__travelDirectoryResult = {
    data: {
      listings: [neutral, oldTest, categorized, energyCopy],
      orderRows: [neutral, oldTest, categorized, energyCopy].map((item, sort_order) => ({
        item_key: `profile:${item.id}`, profile_id: item.id, sort_order,
      })),
    },
    error: null,
  };
  globalThis.__travelLookups = [];
  globalThis.__travelDetailResult = { data: oldTest, error: null };
  const result = await loadReiseportalDirectory();
  assert.deepEqual(result.database.map((item) => item.slug), ["reise-unterkunft"]);
  assert.deepEqual(result.preview.map((item) => item.name), ["Demo GmbH"]);
  assert.deepEqual(result.hiddenOrderKeys, [`profile:${oldTest.id}`, "profile:category-energy", "profile:energy-copy"]);
  const demo = (await loadReiseportalListingBySlug("demo-gmbh")).data;
  assert.equal(demo.name, "Demo GmbH");
  assert.equal(demo.images.length, 1);
  assert.doesNotMatch([demo.name, demo.tagline, demo.description, demo.businessAreas, demo.logo.alt, demo.images[0].alt].join(" "), /Energieheld|Photovoltaik|Modernisierung|Elektrotechnik/);
  assert.deepEqual(globalThis.__travelLookups, [oldTest.slug]);
  assert.equal((await loadReiseportalListingBySlug(oldTest.slug)).data, null);
  assert.equal(globalThis.__travelLookups.length, 1);
  assert.equal((await loadReiseportalListingBySlug(energyCopy.slug)).data, null);
  globalThis.__travelDetailResult = { data: { ...oldTest, id: "wrong-id" }, error: null };
  assert.equal((await loadReiseportalListingBySlug("demo-gmbh")).data, null);
});

test("travel loader attaches only profile-specific database assignments", async () => {
  const first = { ...reiseportalPreview[0], id: "profile-one", isPreview: false };
  const second = { ...reiseportalPreview[1], id: "profile-two", isPreview: false };
  globalThis.__travelDirectoryResult = {
    data: { listings: [first, second], orderRows: [] }, error: null,
  };
  globalThis.__travelAssignments = new Map([
    [first.id, ["theme:tauchurlaub", "audience:paar"]],
  ]);
  try {
    const directory = await loadReiseportalDirectory();
    assert.deepEqual(directory.database.map((item) => item.travelTermKeys),
      [["theme:tauchurlaub", "audience:paar"], []]);
    assert.deepEqual(filterTravelDiscovery(directory.database, "", "tauchurlaub").map((item) => item.id), [first.id]);
    assert.deepEqual(filterTravelDiscovery(directory.database, "", "natur-pur"), []);
  } finally {
    globalThis.__travelAssignments = null;
  }
});

test("old public energy routes redirect to travel or home", async () => {
  assert.throws(() => LegacyExperts(), /REDIRECT:\/unterkuenfte-a-z/);
  await assert.rejects(
    LegacyDetail({ params: Promise.resolve({ slug: "demo-gmbh" }) }),
    /REDIRECT:\/unterkuenfte\/demo-gmbh/,
  );
  assert.throws(() => LegacyTrades(), /REDIRECT:\//);
});
