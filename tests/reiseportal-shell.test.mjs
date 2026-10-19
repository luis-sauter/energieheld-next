import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith('/weidner-legal-source.json')) return { url: 'data:text/javascript,export default '+encodeURIComponent(readFileSync(new URL('../src/data/weidner-legal-source.json',import.meta.url),'utf8')), shortCircuit: true };
    if(specifier.endsWith('/admin/mediathek/actions'))return {shortCircuit:true,url:'data:text/javascript,export async function searchLibraryProfiles(){throw Error("Unexpected company lookup during public shell render")};export async function createLibraryCompany(){throw Error("Unexpected company creation")}'};
    if (specifier.endsWith("card-image-editor")) return {url:'data:text/javascript,export function CardImageEditor(){return null;}',shortCircuit:true};
    if (specifier.endsWith("profile-card-images")) return {url:'data:text/javascript,export async function loadCardEditing(){return false;}export async function withSavedCardImages(rows){return rows;}',shortCircuit:true};
    if(specifier.endsWith('/admin/werbung/actions'))return {shortCircuit:true,url:'data:text/javascript,export async function lifecycleCampaign(){throw Error("Unexpected banner lifecycle write during shell render")}'};
    if (specifier.endsWith(".module.css")) return { url: 'data:text/javascript,export default {}', shortCircuit: true };
    if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
    if (specifier === "next/navigation") return {
      url: 'data:text/javascript,export function redirect(path){throw Error("REDIRECT:"+path)};export function notFound(){throw Error("NOT_FOUND")};export function useRouter(){return {refresh(){}}};export function useSearchParams(){return globalThis.__mottoSearchParams??null}',
      shortCircuit: true,
    };
    if (specifier === "next/link" || specifier === "next/image") return {
      url: `data:text/javascript,export default ${JSON.stringify(specifier === "next/link" ? "a" : "img")}`,
      shortCircuit: true,
    };
    if (specifier.endsWith("/auth-actions")) return { url: 'data:text/javascript,export async function logout(){return {}}', shortCircuit: true };
    if (specifier.endsWith("/discovery-advertising") && !specifier.includes("components/")) return { url: 'data:text/javascript,export async function loadDiscoveryAdvertising(path){globalThis.__discoveryAdPaths?.push(path);return globalThis.__discoveryAdvertising}', shortCircuit: true };
    if (specifier.endsWith("/public-companies")) return {
      url: 'data:text/javascript,export async function loadPublicCompanyDirectory(){return globalThis.__travelDirectoryResult};export async function loadPublicCompanyProfileIndex(){return []};export async function loadPublicCompanyBySlug(slug){globalThis.__travelLookups.push(slug);return globalThis.__travelDetailResult}',
      shortCircuit: true,
    };
    if (specifier.endsWith("/public-travel-taxonomy")) return {
      url: 'data:text/javascript,export async function loadPublicTravelAssignments(){return globalThis.__travelAssignments ?? null}',
      shortCircuit: true,
    };
    if (specifier.endsWith("/supabase/public")) return {
      url: 'data:text/javascript,export function createPublicClient(){return {async rpc(name){if(name!=="public_company_import_markers")throw Error("Unexpected public RPC");return {data:[],error:null}},from(){return {select(){return this},order(){return this},async range(){return {data:globalThis.__travelPackages ?? [],error:null}}}}}}',
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
const { TravelThemeIcon } = await import("../src/components/portal/travel-theme-icon.tsx");
const { reiseportalPreview } = await import("../src/data/reiseportal-preview.ts");
const { reiseziele, mottoreisen } = await import("../src/data/reiseportal-overviews.ts");
const { destinations, travelThemes } = await import("../src/data/reiseportal-discovery.ts");
const { ReiseOverview } = await import("../src/components/portal/reise-overview.tsx");
const { DiscoveryDetail, AccommodationCard } = await import("../src/components/portal/discovery-detail.tsx");
const { ListingDetail } = await import("../src/components/portal/listing-detail.tsx");
const { filterTravelDiscovery } = await import("../src/lib/reiseportal-search.ts");
const destinationRoute = await import("../src/app/(energieheld)/reiseziele/[slug]/page.tsx");
const themeRoute = await import("../src/app/(energieheld)/mottoreisen/[slug]/page.tsx");
const { default: ThemeOverview } = await import("../src/app/(energieheld)/mottoreisen/page.tsx");
const { default: DestinationOverview } = await import("../src/app/(energieheld)/reiseziele/page.tsx");
const { PortalHeader, PortalFooter } = await import("../src/components/portal/chrome.tsx");
const { headerNavigation } = await import("../src/components/portal/navigation-data.ts");
const { portalIdentity } = await import("../src/config/portal-identity.ts");
const { accountMenuGroups } = await import("../src/components/portal/account-menu.tsx");

test("approved anniversary logo is shared by header, footer and metadata without alteration", async () => {
  const { createHash } = await import('node:crypto');
  const bytes = readFileSync(new URL('../public' + portalIdentity.logo.src, import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), 'cbb09865551e28b4ca9c69261b77eaa89389691ed141245d09326cf1f98250d3');
  for (const component of [PortalHeader, PortalFooter]) {
    const html = renderToStaticMarkup(createElement(component, { brand: reiseportal }));
    assert.ok(html.includes(portalIdentity.logo.src));
    assert.match(html, /width="1600" height="533"/);
    assert.match(html, /alt="DAS-Reiseportal.com – 15 Jahre"/);
    assert.doesNotMatch(html, /das-reiseportal-logo\.png/);
    assert.match(html, /href="\/"/);
  }
});

test("travel footer contains only brand, contact and utility links, without discovery or service columns", () => {
  const html = renderToStaticMarkup(createElement(PortalFooter, { brand: reiseportal }));
  for (const route of ['/impressum', '/datenschutz', '/login?next=/admin', '/designvorschau/unternehmensprofil']) assert.ok(html.includes('href="'+route+'"'));
  assert.doesNotMatch(html,/Entdecken|Service|Reiseziele|Mottoreisen|Für Gastgeber|Angebot anfragen|Werbung im Reiseportal|href="\/unterkuenfte-a-z"/);
  assert.ok(html.includes('href="'+portalIdentity.phoneHref+'"'));
  assert.ok(html.includes('href="mailto:'+portalIdentity.email+'"'));
  assert.doesNotMatch(html, /Flurstraße|Am Haag|81266|livin-q/);
});

test("legal pages reproduce the sanitized original WEIDNER body verbatim without claiming a legal approval", async () => {
  const sources=JSON.parse(readFileSync(new URL('../src/data/weidner-legal-source.json',import.meta.url),'utf8'));
  const hashes={impressum:'85fef99096c165ea2173c65c0de8b220f217651cb59a9766105d44bf89ab7c72',datenschutz:'8e1468ee53bdd4654a2e9cc17efcd1a82b2a72471f41466319f5bbc247e7ca6a'};
  for (const route of ['impressum', 'datenschutz']) {
    const page = await import('../src/app/(energieheld)/'+route+'/page.tsx');
    assert.equal(page.metadata.robots.index, false);
    const html = renderToStaticMarkup(createElement(page.default));
    assert.match(html, /Unveränderte Quellenübernahme/);
    assert.match(html, /Eine rechtliche Prüfung für DAS-Reiseportal.com ist damit nicht erfolgt/);
    assert.ok(html.includes(sources[route].html));
    assert.equal(sources[route].textSha256,hashes[route]);
    assert.doesNotMatch(sources[route].html,/<(?:script|style|iframe|img|form|input|button)\b|\son\w+=|\sstyle=|javascript:/i);
    assert.match(html, /href="\/impressum"/);assert.match(html, /href="\/datenschutz"/);
    assert.doesNotMatch(html, /http-equiv="refresh"/);
  }
});
const { loadReiseportalDirectory, loadReiseportalListingBySlug } =
  await import("../src/lib/reiseportal-directory.ts");
const { default: LegacyExperts } = await import("../src/app/(energieheld)/experten/page.tsx");
const { default: LegacyDetail } = await import("../src/app/(energieheld)/experten/[slug]/page.tsx");
const { default: LegacyTrades } = await import("../src/app/(energieheld)/gewerke/page.tsx");

test("Reiseportal palette uses the Release 1 corporate palette and all quicklink symbols blue", () => {
  assert.deepEqual(reiseportal.colors, { primary: "#13237F", accent: "#F7902F", surface: "#F4F4F4" });
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /--portal-primary: var\(--portal-blue\)/);
  assert.match(css, /--portal-accent: var\(--portal-orange\)/);
  assert.match(css, /\.reiseportal-shell \.button-primary,[\s\S]*?color: var\(--portal-button-text\)/);
  assert.match(css, /\.reiseportal-shell \.company-profile \.button-primary \{ color: var\(--portal-button-text\); \}/);
  assert.match(css, /\.reiseportal-shell \.company-profile \.detail-title \{ color: var\(--portal-primary-deep\); \}/);
  assert.match(css, /\.motto-intro-image \{ width: 100%; min-width: 0; min-height: 0; \}/);
  assert.match(css, /\.travel-quicklink-icon\s*\{[^}]*color: var\(--portal-primary\)/);
  for (const slug of ["wellnessangebote", "familienurlaub", "wanderurlaub", "romantik-zu-zweit", "campingurlaub", "radwandern", "urlaub-am-wasser", "golfurlaub"]) {
    const icon = renderToStaticMarkup(createElement(TravelThemeIcon, { slug }));
    assert.match(icon, /^<svg /);
    assert.match(icon, /stroke="currentColor"/);
    assert.doesNotMatch(icon, /<img|#[0-9a-f]{3,8}/i);
  }
});

test("public navigation has only the three travel entries and uses the untouched original logo", () => {
  assert.deepEqual(reiseportal.navigation, [
    { label: "Reiseziele", href: "/reiseziele" },
    { label: "Mottoreisen", href: "/mottoreisen" },
    { label: "Unterkünfte A–Z", href: "/unterkuenfte-a-z" },
  ]);
  const html = renderToStaticMarkup(createElement(PortalHeader, { brand: reiseportal }));
  assert.match(html, /src="\/brand\/das-reiseportal-15-jahre\.jpeg"/);
  assert.doesNotMatch(html, /Gewerke|Experten A–Z|energieheld\.bayern|Sanieren mit Grips/);
  assert.equal((html.match(/href="\/reiseziele"/g) ?? []).length, 2);
  assert.equal((html.match(/href="\/mottoreisen"/g) ?? []).length, 2);
  assert.equal((html.match(/href="\/unterkuenfte-a-z"/g) ?? []).length, 2);
});

test("header dropdowns derive only existing theme and destination routes from the shared discovery data", () => {
  const items = headerNavigation(reiseportal);
  const themes = items.find((item) => item.href === "/mottoreisen");
  const places = items.find((item) => item.href === "/reiseziele");
  assert.deepEqual(themes.children, travelThemes.map(({ title, slug }) =>
    ({ label: title, href: `/mottoreisen/${slug}` })));
  assert.deepEqual(places.children, destinations.map(({ title, slug }) =>
    ({ label: title, href: `/reiseziele/${slug}` })));
  assert.equal(themes.children.length, 11);
  assert.equal(places.children.length, 4);
  assert.ok(existsSync(new URL("../src/app/(energieheld)/mottoreisen/[slug]/page.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/(energieheld)/reiseziele/[slug]/page.tsx", import.meta.url)));
  const html = renderToStaticMarkup(createElement(PortalHeader, { brand: reiseportal }));
  assert.equal((html.match(/aria-haspopup="menu"/g) ?? []).length, 2);
  assert.equal((html.match(/aria-expanded="false"/g) ?? []).length, 4); // Public header has only the four navigation triggers.
  assert.match(html, /href="\/angebot-anfragen"[^>]*>Angebot anfragen<\/a>/);
  assert.match(html, /src="\/brand\/das-reiseportal-15-jahre\.jpeg"/);
});

test("account button and dropdown groups use server-provided access without permanent header links", () => {
  const header = (access) => renderToStaticMarkup(createElement(PortalHeader, { brand: reiseportal, access }));
  const footer = (access) => renderToStaticMarkup(createElement(PortalFooter, { brand: reiseportal, access }));
  const guest = header("unauthenticated");
  assert.doesNotMatch(guest, /aria-label="Kontomenü öffnen"/);
  assert.match(guest, /aria-label="Mobile Hauptnavigation"/);
  assert.equal((guest.match(/href="\/angebot-anfragen"/g) ?? []).length, 2);
  assert.match(guest, /Angebot anfragen/);
  assert.doesNotMatch(guest, /href="\/login"|href="\/firma"|href="\/admin"/);
  assert.deepEqual(accountMenuGroups("unauthenticated").account.map((link) => link.label), ["Einloggen"]);
  assert.doesNotMatch(guest, /href="\/firma"|href="\/admin"/);

  const member = header("forbidden");
  assert.doesNotMatch(member, /href="\/firma"|href="\/admin"|href="\/login"/);
  assert.deepEqual(accountMenuGroups("forbidden", true).account.map((link) => link.label), []);
  assert.deepEqual(accountMenuGroups("forbidden").administration, []);
  const admin = header("admin");
  assert.match(admin, /href="\/admin"/);
  assert.doesNotMatch(admin, /href="\/firma"|href="\/login"/);
  assert.deepEqual(accountMenuGroups("admin").administration.map((link) => link.label), ["Redaktion"]);

  assert.match(footer("unauthenticated"), /DAS-Reiseportal.com.*Neue Lieblingsorte entdecken/s);
  assert.match(footer("unauthenticated"), /Redaktion \/ Login/);
  assert.doesNotMatch(footer("forbidden"), /href="\/angebot-anfragen"/);
});

test("homepage uses the supplied MP4 as the hero background with search above it", () => {
  const source = readFileSync(new URL("../src/app/(energieheld)/page.tsx", import.meta.url), "utf8");
  const finder = readFileSync(new URL("../src/components/portal/travel-finder.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.ok(existsSync(new URL("../public/reiseportal/hero-loop.mp4", import.meta.url)));
  assert.match(source, /<HomeTravelFinder.*listings=/);
  assert.match(finder, /<section className="travel-hero"[\s\S]*?<video autoPlay muted loop playsInline preload="metadata"[\s\S]*?<source src="\/reiseportal\/hero-loop\.mp4"[\s\S]*?<h1 id="travel-hero-title">[\s\S]*?Finde deinen passenden Urlaub[\s\S]*?<\/h1>[\s\S]*?renderFinder\(finder\) : finder/);
  assert.match(css, /\.travel-hero > video\s*\{[^}]*object-fit: cover;[^}]*pointer-events: none;/);
  assert.doesNotMatch(source, /<Image src="\/reiseportal\/hero\.jpg"/);
});

test("preview contains the five sourced legacy accommodations; the demo comes from Supabase", () => {
  assert.deepEqual(reiseportalPreview.map((item) => item.name), [
    "Bayerischer Wald", "Höflehner", "Pension Sonnenhof",
    "Schafhuber", "Villner Hof",
  ]);
  assert.ok(reiseportalPreview.every((item) => item.directoryPackage === undefined));
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

test("discovery cards retain signed profile images without sending them to the Next optimizer", () => {
  for (const src of ['/reiseportal/example.webp', 'https://example.supabase.co/storage/v1/object/sign/company-media/profile.jpg?token=test']) {
    const card = AccommodationCard({ listing: { ...reiseportalPreview[0], images: [{ src, alt: 'Profile image' }] } });
    const descendants = node => Array.isArray(node) ? node.flatMap(descendants) : node && typeof node === 'object' ? [node, ...descendants(node.props?.children)] : [];
    const image = descendants(card).find(node => node.type === 'img');
    assert.equal(image.props.src, src);
    assert.equal(image.props.unoptimized, src.startsWith('https://'));
    assert.equal(image.props.loading, 'lazy');
  }
});

test("destination redesign keeps eight real server-rendered links, one H1 and nine optimized images", async () => {
  globalThis.__discoveryAdvertising = undefined;
  globalThis.__discoveryAdPaths = [];
  const html = renderToStaticMarkup(await DestinationOverview());
  assert.deepEqual(globalThis.__discoveryAdPaths, ["/reiseziele"]);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(html, /Reiseziele, die neugierig machen/);
  assert.equal((html.match(/<h3\b/g) ?? []).length, 8);
  for (const destination of destinations) assert.ok(html.includes(`href="/reiseziele/${destination.slug}"`));
  for (const region of ["Sächsische Schweiz", "Hochkönig", "Blausee", "Gitschberg Jochtal"])
    assert.ok(html.includes(`href="/suche?q=${encodeURIComponent(region)}"`));
  assert.doesNotMatch(html, /Bayerischer Wald|Salzkammergut|Wallis|Jetzt Südtirol entdecken|Freier Werbeplatz/);
  const images = [...html.matchAll(/src="(\/reiseportal\/redesign\/reiseziele\/[^\"]+)"/g)];
  assert.equal(images.length, 9);
  for (const [, src] of images) {
    const asset = readFileSync(new URL(`../public${src}`, import.meta.url));
    assert.equal(asset.subarray(8, 12).toString(), "WEBP");
    assert.ok(asset.length < 400_000, `${src} exceeds asset budget`);
  }
  assert.equal((html.match(/loading="lazy"/g) ?? []).length, 8);
  const css = readFileSync(new URL('../src/app/(energieheld)/reiseziele/reiseziele.module.css', import.meta.url), 'utf8');
  assert.match(css, /\.countryGrid[^}]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 1000px\)[\s\S]*\.countryGrid, \.regionGrid[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*\.countryGrid, \.regionGrid[^}]*minmax\(0, 1fr\)/);
  const cardCss = readFileSync(new URL('../src/components/portal/editorial-image-card.module.css', import.meta.url), 'utf8');
  assert.match(cardCss, /:focus-visible/);
  assert.match(cardCss, /prefers-reduced-motion: reduce/);
});

test('four destination pages use individual editorial intros and headings without changing their identity or image',()=>{
 assert.equal(new Set(destinations.map(entry=>entry.intro)).size,4);
 assert.equal(new Set(destinations.map(entry=>entry.stayHeading)).size,4);
 for(const entry of destinations){
  const html=renderToStaticMarkup(createElement(DiscoveryDetail,{entry,title:'Reiseziele',basePath:'/reiseziele',listings:[]}));
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert.ok(html.includes(`<h1>${entry.title}</h1>`));
  assert.ok(html.includes(entry.intro));assert.ok(html.includes(entry.stayHeading));
  assert.ok(html.includes(entry.image));assert.match(html,/href="\/reiseziele"/);
  assert.ok(entry.seoDescription.length<=170);assert.ok(entry.seoTitle.includes(entry.title));
 }
});

test("destination redesign retains real shared banner delivery and admin provider between editorial sections", async () => {
  const data = { ads: [{ id: 'existing', placement: 'sidebar_top', imageUrl: '/known-banner.jpg', headline: 'Existing banner', target_url: 'https://example.org/', banner_size: 'small' }], sidebarOrder: [] };
  globalThis.__discoveryAdvertising = data;
  try {
    const html = renderToStaticMarkup(await DestinationOverview());
    assert.ok(html.indexOf('href="/reiseziele/suedtirol-italien"') < html.indexOf('data-placement="sidebar_top"'));
    assert.ok(html.indexOf('data-placement="sidebar_top"') < html.indexOf('Orte für den nächsten Reiseplan'));
    assert.match(html, /src="\/known-banner.jpg"/);
    assert.match(html, /rel="sponsored noopener noreferrer"/);
    assert.match(html, /target="_blank"/);
    assert.doesNotMatch(html, /Banner hinzufügen|Banner bearbeiten/);
    assert.deepEqual(data.ads.map(ad => ad.placement), ['sidebar_top']);
    globalThis.__discoveryAdvertising = { ...data, options: { label: 'Reiseziele', availability: {}, banners: [], terms: [] } };
    const admin = renderToStaticMarkup(await DestinationOverview());
    assert.match(admin, /Banner hinzufügen/);
    assert.match(admin, /data-placement="top_banner"/);
    assert.match(admin, /<details data-destination-banner-management="true">/);
    assert.match(admin, /Alle Bannerplätze verwalten/);
    assert.doesNotMatch(admin, /<details[^>]*\bopen=/);
  } finally {
    globalThis.__discoveryAdvertising = undefined;
    globalThis.__discoveryAdPaths = undefined;
  }
});

test("destination overview publicly displays at most one actual creative, Premium before fixed A–L", async () => {
  const banner = (placement, name) => ({ id: name, placement, imageUrl: `/${name}.jpg`, headline: name, target_url: 'https://example.org/', banner_size: 'small' });
  const cases = [
    { ads: [banner('sidebar_bottom', 'C'), banner('sidebar_top', 'A'), banner('top_banner', 'Premium')], expected: 'Premium' },
    { ads: [banner('sidebar_bottom', 'C'), banner('sidebar_middle', 'B'), banner('sidebar_top', 'A')], expected: 'A' },
    { ads: [{ ...banner('sidebar_top', 'hidden'), suppressed: true }, banner('sidebar_middle', 'B')], expected: 'B' },
    { ads: [{ ...banner('top_banner', 'no-image'), imageUrl: null }], expected: undefined },
    { ads: [], expected: undefined },
  ];
  try {
    for (const { ads, expected } of cases) {
      const before = JSON.stringify(ads);
      globalThis.__discoveryAdvertising = { ads, sidebarOrder: [] };
      const html = renderToStaticMarkup(await DestinationOverview());
      assert.equal((html.match(/data-placement=/g) ?? []).length, expected ? 1 : 0);
      if (expected) assert.ok(html.includes(`src="/${expected}.jpg"`));
      assert.doesNotMatch(html, /Freier Werbeplatz|Banner hinzufügen|Alle Bannerplätze verwalten/);
      assert.equal(JSON.stringify(ads), before, 'presentation must not modify slots or campaign data');
    }
  } finally {
    globalThis.__discoveryAdvertising = undefined;
  }
});

test("four destinations and eleven active themes have sourced images, links and detail routes", async () => {
  globalThis.__travelDirectoryResult = { data: {
    listings: reiseportalPreview.map((listing, index) => ({ ...listing, id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, "0")}`, isPreview: false })),
    orderRows: [],
  }, error: null };
  assert.deepEqual(destinations.map((item) => item.title), [...reiseziele]);
  assert.deepEqual(travelThemes.map((item) => item.title), [...mottoreisen].filter(title => title !== "Tauchurlaub"));
  assert.equal(destinationRoute.generateStaticParams().length, 4);
  assert.equal(themeRoute.generateStaticParams().length, 11);
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
  for (const slug of ["natur-pur", "nordic-walking"]) {
    const entry = travelThemes.find((item) => item.slug === slug);
    assert.ok(entry.image?.endsWith(`/${slug}.jpg`));
    const detail = renderToStaticMarkup(createElement(DiscoveryDetail, { entry, title: "Mottoreisen", basePath: "/mottoreisen", listings: [] }));
    assert.match(detail, new RegExp(`${slug}\\.jpg`));
  }
  const overview = renderToStaticMarkup(await ThemeOverview());
  assert.match(overview, /redesign\/mottoreisen\/hero\.webp/);
  assert.match(overview, /Vielleicht geht es Ihnen aber gar nicht so sehr um ein bestimmtes Ziel/);
  await assert.rejects(destinationRoute.default({ params: Promise.resolve({ slug: "unbekannt" }) }), /NOT_FOUND/);
});

test('motto detail keeps every matching profile and campaign once in exactly five alternating rows', async()=>{
 const {MottoDetail}=await import('../src/components/portal/motto-detail.tsx');
 const listings=Array.from({length:47},(_,i)=>({...reiseportalPreview[0],id:'profile-'+i,slug:'profile-'+i,name:'Unterkunft '+i}));
 const ads=Array.from({length:9},(_,i)=>({id:'ad-'+i,placement: i===0?'top_banner':'sidebar_'+String(i+3).padStart(2,'0'),headline:'Banner '+i,imageUrl:'/existing-'+i+'.jpg',target_url:'https://example.org/'+i}));
 const html=renderToStaticMarkup(createElement(MottoDetail,{entry:travelThemes[0],listings,advertising:{ads,sidebarOrder:[],options:undefined},seed:'fixed'}));
 assert.equal((html.match(/class="accommodation-card"/g)||[]).length,47);
 assert.equal((html.match(/data-placement=/g)||[]).length,9);assert.equal((html.match(/<h1\b/g)||[]).length,1);
 for(let i=0;i<47;i++)assert.equal((html.match(new RegExp('href="/unterkuenfte/profile-'+i+'"','g'))||[]).length,1);
 assert.match(html,/motto-editorial-v2\/natur-pur.webp/);assert.match(html,/Natururlaub lebt von den kleinen Entdeckungen/);
 assert.equal((html.match(/role="region"/g)||[]).length,5);
 const rowNames=[...html.matchAll(/role="region" aria-label="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(rowNames,['Unterkünfte, Reihe 1','Banner, Reihe 1','Unterkünfte, Reihe 2','Banner, Reihe 2','Unterkünfte, Reihe 3']);
 assert.doesNotMatch(html,/motto-editorial"|Reiseziele mit passenden Gastgebern|Wo die Landschaft den Takt vorgibt/);
 assert.ok(html.indexOf('aria-label="Unterkünfte, Reihe 1"')<html.indexOf('aria-label="Banner, Reihe 1"'));
 assert.ok(html.indexOf('aria-label="Banner, Reihe 1"')<html.indexOf('aria-label="Unterkünfte, Reihe 2"'));
 assert.doesNotMatch(html,/Angebot anfragen|Automatischen Wechsel pausieren|Freier Werbeplatz/);
 await assert.rejects(themeRoute.default({params:Promise.resolve({slug:'tauchurlaub'})}),/NOT_FOUND/);
});

test("motto overview renders eleven active themes and eight accessible presentation filters", async () => {
  globalThis.__discoveryAdvertising = undefined;
  const { mottoGroups, mottoPresentation } = await import('../src/lib/motto-presentation.ts');
  assert.equal(mottoGroups.length, 8);
  assert.deepEqual(Object.keys(mottoPresentation).filter(slug => slug !== "tauchurlaub"), travelThemes.map(entry => entry.slug));
  for (const group of ['alle', ...mottoGroups.slice(1).map(item => item.id)]) {
    const html = renderToStaticMarkup(await ThemeOverview({searchParams:Promise.resolve({gruppe:group})}));
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
    assert.match(html, new RegExp(`data-active-group="${group}"`));
    assert.equal((html.match(/data-motto-group=/g) ?? []).length, 8);
    for (const entry of travelThemes) {
      assert.ok(html.includes(`href="/mottoreisen/${entry.slug}"`));
      const image = readFileSync(new URL(`../public/reiseportal/redesign/mottoreisen/${entry.slug}.webp`, import.meta.url));
      assert.ok(image.length < 400_000);
      assert.ok(mottoPresentation[entry.slug].groups.length > 0);
    }
    assert.match(html, /Beliebte Reisemotive/);
    assert.match(html, /aria-current="true"/);
    assert.match(html, /role="status"/);
    assert.doesNotMatch(html, /Freier Werbeplatz/);
  }
  const css = readFileSync(new URL('../src/app/(energieheld)/mottoreisen/mottoreisen.module.css', import.meta.url),'utf8');
  assert.match(css, /repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /max-width: 1000px[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /max-width: 600px[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
});

test("motto selection follows the current URL even when a same-page navigation retains initial props", async () => {
  const { MottoFilter } = await import('../src/components/portal/motto-filter.tsx');
  try {
    for (const group of ['aktiv', 'wasser', 'erholung', 'alle']) {
      globalThis.__mottoSearchParams = new URLSearchParams(group === 'alle' ? '' : `gruppe=${group}`);
      const html = renderToStaticMarkup(createElement(MottoFilter, { initialGroup: 'business' }));
      assert.match(html, new RegExp(`data-active-group="${group}"`));
    }
  } finally { globalThis.__mottoSearchParams = undefined; }
});

test("compact promo uses the campaign copy and editable image without changing ordinary image creatives", async () => {
  globalThis.__discoveryAdvertising = { ads: [{id:'promo',placement:'top_banner',imageUrl:'/promo.webp',headline:'Südtirol – Natur und Genuss',body_text:'Portal-eigene Reiseinspiration',target_url:'https://das-reiseportal.com/reiseziele/suedtirol-italien'}],sidebarOrder:[] };
  try {
    const html = renderToStaticMarkup(await DestinationOverview());
    assert.match(html, /Reiseinspiration/);
    assert.match(html, /Portal-eigene Reiseinspiration/);
    assert.match(html, /href="\/reiseziele\/suedtirol-italien"/);
    assert.equal((html.match(/data-placement=/g) ?? []).length, 1);
    globalThis.__discoveryAdvertising.ads[0].target_url = 'https://example.com/holiday';
    const commercial = renderToStaticMarkup(await DestinationOverview());
    assert.doesNotMatch(commercial, /Portal-eigene Reiseinspiration|Jetzt entdecken/);
    assert.match(commercial, /href="https:\/\/example.com\/holiday"/);
  } finally { globalThis.__discoveryAdvertising = undefined; }
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
  assert.deepEqual(filterTravelDiscovery([listing], "deutschland", "tauchurlaub", "paar", "hotel", "sauna"), []);
  assert.deepEqual(filterTravelDiscovery([listing], "", "tauchurlaub", "familie"), []);
  assert.deepEqual(filterTravelDiscovery([listing], "", "", "", "", "pool"), []);
  assert.deepEqual(filterTravelDiscovery([reiseportalPreview[0]], "", "", "paar"), []);
});

test("public Reiseportal uses blue hierarchy, dark body text and basalt text on brand-orange actions", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.equal(reiseportal.colors.primary, "#13237F");
  assert.equal(reiseportal.colors.accent, "#F7902F");
  assert.match(css, /\.reiseportal-shell\s*\{[^}]*--text: var\(--portal-ink\);/);
  assert.match(css, /\.reiseportal-shell :is\(a, button, input, select, summary\):focus-visible\s*\{\s*outline-color: var\(--portal-primary\);/);
  assert.match(css, /\.motto-page \.discovery-card-title span \{ color: var\(--portal-primary\); \}/);
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
    assert.deepEqual(filterTravelDiscovery(directory.database, "", "tauchurlaub").map((item) => item.id), []);
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

test('country banner expansion keeps complete creatives, excludes invalid/hidden duplicates and respects local precedence',async()=>{
 const {destinationBanners}=await import('../src/lib/destination-banners.ts');
 const local={id:'local',placement:'sidebar_top',source:'legacy',target_url:'https://www.example.org/',imageUrl:'/local.webp',headline:'Local'};
 const extra={id:'extra',placement:'sidebar_top',source:'campaign',target_url:'https://extra.example/',imageUrl:'/extra.webp',headline:'Extra'};
 const row=(ad,banner_key)=>({ad,banner_key});
 const sameLegacy={...local,id:'different-legacy',target_url:'https://example.org/'};
 const pool=[row(extra,'campaign:extra'),row({...extra,imageUrl:'/wrong-duplicate.webp'},'campaign:extra'),row(sameLegacy,'legacy:https://example.org/'),row({...extra,id:'hidden',suppressed:true},'campaign:hidden'),row({...extra,id:'invalid',target_url:'javascript:alert(1)'},'campaign:invalid'),row({...extra,id:'missing',imageUrl:''},'campaign:missing')];
 const original=JSON.stringify({local,pool});
 assert.deepEqual(destinationBanners([local],pool),[local,extra]);
 assert.equal(JSON.stringify({local,pool}),original);
 assert.deepEqual(destinationBanners([local],[]),[local]);
 assert.deepEqual(destinationBanners([{...extra,suppressed:true}],pool.filter(item=>item.ad.id!=='different-legacy')),[]);
});

test('expanded country sliders render every public creative once without duplicate fixed-slot ids or inline override collisions',async()=>{
 const {MottoDetail}=await import('../src/components/portal/motto-detail.tsx');
 const local={id:'local',placement:'sidebar_top',imageUrl:'/local.webp',target_url:'https://local.example/',headline:'Local'};
 const extras=Array.from({length:23},(_,i)=>({...local,id:'extra-'+i,imageUrl:'/extra-'+i+'.webp',target_url:'https://extra.example/'+i,headline:'Extra '+i}));
 const html=renderToStaticMarkup(createElement(MottoDetail,{entry:destinations[1],kind:'destination',listings:reiseportalPreview,seed:'expanded',advertising:{ads:[local],sliderAds:[local,...extras],sidebarOrder:[]}}));
 assert.equal((html.match(/data-placement=/g)||[]).length,24);
 assert.equal((html.match(/id="banner-sidebar_top"/g)||[]).length,1);
 for(let i=0;i<23;i++)assert.equal((html.match(new RegExp('href="https://extra.example/'+i+'"','g'))||[]).length,1);
 assert.doesNotMatch(html,/Reiseideen für Ihren Aufenthalt/);
 assert.match(html,/ziel=oesterreich/);
});

test('destination details reuse premium motto rows and end directly with country links',async()=>{
 const {MottoDetail}=await import('../src/components/portal/motto-detail.tsx');
 for(const entry of destinations){
  const html=renderToStaticMarkup(createElement(MottoDetail,{entry,kind:'destination',listings:reiseportalPreview.map(listing=>({...listing,travelTermKeys:['theme:natur-pur']})),seed:'country-test',advertising:{ads:[],sidebarOrder:[],options:undefined}}));
  assert.match(html,new RegExp('ziel='+entry.slug));assert.doesNotMatch(html,new RegExp('thema='+entry.slug));
  assert.match(html,new RegExp('destination-editorial/'+entry.slug+'.webp'));
  assert.doesNotMatch(html,/Automatischen Wechsel pausieren|commercial-columns|data-basic-contact|Reiseideen für Ihren Aufenthalt/);
  assert.equal((html.match(/class="accommodation-card"/g)||[]).length,reiseportalPreview.length);
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
 }
 const route=readFileSync(new URL('../src/app/(energieheld)/reiseziele/[slug]/page.tsx',import.meta.url),'utf8');
 assert.match(route,/loadReiseportalDestination\(entry.slug\)/);assert.match(route,/kind="destination"/);assert.doesNotMatch(route,/entry.previewSlugs|loadReiseportalFeatured|rotateProfiles/);
});
