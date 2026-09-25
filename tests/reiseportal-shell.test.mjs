import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
    if (specifier === "next/navigation") return {
      url: 'data:text/javascript,export function redirect(path){throw Error("REDIRECT:"+path)}',
      shortCircuit: true,
    };
    if (specifier === "next/link" || specifier === "next/image") return {
      url: `data:text/javascript,export default ${JSON.stringify(specifier === "next/link" ? "a" : "img")}`,
      shortCircuit: true,
    };
    if (specifier.endsWith("/public-companies")) return {
      url: 'data:text/javascript,export async function loadPublicCompanyDirectory(){return globalThis.__travelDirectoryResult};export async function loadPublicCompanyBySlug(slug){globalThis.__travelLookups.push(slug);return globalThis.__travelDetailResult}',
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
const { PortalHeader } = await import("../src/components/portal/chrome.tsx");
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

test("preview contains exactly the five live accommodations and one neutral labelled demo", () => {
  assert.deepEqual(reiseportalPreview.map((item) => item.name), [
    "Bayerischer Wald", "Höflehner", "Pension Sonnenhof",
    "Schafhuber", "Villner Hof", "Demo GmbH",
  ]);
  assert.deepEqual(reiseportalPreview.map((item) => item.directoryPackage), [
    "premium", "premium", "premium", "premium", "basic", "basic",
  ]);
  assert.ok(reiseportalPreview.every((item) =>
    item.isPreview && item.images.length === 0 && item.categoryIds.length === 0 && !item.logo));
  assert.equal(reiseportalPreview.at(-1).slug, "demo-gmbh");
  assert.equal(reiseportalPreview.at(-1).demoLabel, "Demo/Testprofil");
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

test("travel loader excludes approved energy profiles without mutating the source", async () => {
  const neutral = { ...reiseportalPreview[0], id: "real-travel", slug: "reise-unterkunft", isPreview: false };
  const oldTest = { ...neutral, id: "energy-test", slug: "energieheld-demo-gmbh-c3351d59", name: "Energieheld Demo GmbH" };
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
  assert.deepEqual(result.preview.map((item) => item.name), reiseportalPreview.map((item) => item.name));
  assert.deepEqual(result.hiddenOrderKeys, ["profile:energy-test", "profile:category-energy", "profile:energy-copy"]);
  assert.equal((await loadReiseportalListingBySlug("demo-gmbh")).data.name, "Demo GmbH");
  assert.equal(globalThis.__travelLookups.length, 0);
  assert.equal((await loadReiseportalListingBySlug(oldTest.slug)).data, null);
  assert.equal(globalThis.__travelLookups.length, 0);
  assert.equal((await loadReiseportalListingBySlug(energyCopy.slug)).data, null);
});

test("old public energy routes redirect to travel or home", async () => {
  assert.throws(() => LegacyExperts(), /REDIRECT:\/unterkuenfte-a-z/);
  await assert.rejects(
    LegacyDetail({ params: Promise.resolve({ slug: "demo-gmbh" }) }),
    /REDIRECT:\/unterkuenfte\/demo-gmbh/,
  );
  assert.throws(() => LegacyTrades(), /REDIRECT:\//);
});
