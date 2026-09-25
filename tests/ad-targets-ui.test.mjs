import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
registerHooks({
  resolve(s, c, next) {
    if (s === "next/headers")
      return {
        url: 'data:text/javascript,export async function headers(){throw Error("Headers not expected during render")}',
        shortCircuit: true,
      };
    if (s === "server-only" || s === "next/cache")
      return {
        url: "data:text/javascript,export function revalidatePath(){}",
        shortCircuit: true,
      };
    if (s === "next/navigation")
      return {
        url: 'data:text/javascript,export function redirect(path){throw Error("REDIRECT:"+path)};export function notFound(){throw Error("NOT_FOUND")};export function useRouter(){return {refresh(){}}}',
        shortCircuit: true,
      };
    if (s.endsWith("/supabase/server"))
      return {
        url: "data:text/javascript,export async function createClient(){return globalThis.__profileTestClient}",
        shortCircuit: true,
      };
    if (s.endsWith(".module.css"))
      return {
        url: "data:text/javascript,export default new Proxy({}, {get: (_, name) => String(name)})",
        shortCircuit: true,
      };
    if (s === "next/link" || s === "next/image")
      return {
        url: `data:text/javascript,export default ${JSON.stringify(s === "next/link" ? "a" : "img")}`,
        shortCircuit: true,
      };
    if (s.startsWith("@/") || s.startsWith(".")) {
      const u = s.startsWith("@/")
        ? new URL("../src/" + s.slice(2), import.meta.url)
        : new URL(s, c.parentURL);
      for (const ext of [".ts", ".tsx"])
        if (existsSync(new URL(u.href + ext))) return next(u.href + ext, c);
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

const { CampaignForm, AdminCampaignForm } = await import(
  "../src/components/advertising/campaign-form.tsx"
);
const { CampaignFacts, CampaignSlot } = await import(
  "../src/components/advertising/campaign-view.tsx"
);
const { AdvertisingRail } = await import("../src/components/advertising/advertising-rail.tsx");
const { sidebarCreative } = await import("../src/lib/advertising-rail.ts");
const { defaultSidebarOrder } = await import("../src/lib/sidebar-order.ts");
const { SidebarOrderSlots } = await import("../src/components/admin/sidebar-order-editor.tsx");
const campaign = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  profile_id: "own",
  internal_name: "Herbstkampagne",
  placement: "top_banner",
  targets: [
    { target_type: "experts_directory", category_id: null },
    { target_type: "trade", category_id: "solar" },
    { target_type: "trade", category_id: "elektro" },
  ],
  requested_start_date: "2030-10-01",
  requested_end_date: "2030-10-15",
  approved_start_date: null,
  approved_end_date: null,
  headline: "Energie vom eigenen Dach",
  body_text: "Planung und Umsetzung in Ihrer Region",
  target_url: "https://example.org",
  image_path: null,
  imageUrl: "/images/solar.jpg",
  status: "draft",
  admin_note: null,
  companyName: "Beispielbetrieb",
  created_at: "",
  updated_at: "",
  submitted_at: null,
  reviewed_at: null,
};
const render = (Component, props) =>
  renderToStaticMarkup(createElement(Component, props));
test("campaign form offers homepage, directory and official trade checkboxes", () => {
  const html = render(CampaignForm, {
    campaign,
    categoryIds: ["solar", "elektro", "dach"],
  });
  assert.match(html, /Werbung anzeigen auf:/);
  assert.match(html, /Ihre Gewerke:/);
  const inputs = html.match(/<input[^>]*type="checkbox"[^>]*>/g);
  assert.equal(inputs.length, 5);
  for (const target of ["experts_directory", "trade:solar", "trade:elektro"])
    assert.ok(
      inputs.some(
        (input) =>
          input.includes('value="' + target + '"') &&
          input.includes('checked=""'),
      ),
    );
  assert.ok(
    inputs.some(
      (input) =>
        input.includes('value="trade:dach"') && !input.includes('checked=""'),
    ),
  );
  assert.ok(inputs.some((input) => input.includes('value="homepage"')));
  assert.match(html, /Startseite/);
  assert.doesNotMatch(
    html,
    /value="trade:heizung"|name="scope_type"|name="category_id"|Alle Gewerkeseiten/,
  );
  const noTrades = render(CampaignForm, {
    campaign: { ...campaign, targets: [campaign.targets[0]] },
    categoryIds: [],
  });
  assert.equal((noTrades.match(/type="checkbox"/g) || []).length, 2);
  assert.match(noTrades, /noch keine offiziellen Gewerke/);
  const removed = render(CampaignForm, { campaign, categoryIds: ["solar"] });
  assert.doesNotMatch(removed, /value="trade:elektro"/);
  assert.match(removed, /ohne aktuelle Firmenzuordnung/);
});
test("admin review exposes every target and explains removed assignments", () => {
  const html = render(CampaignFacts, {
    campaign: {
      ...campaign,
      status: "pending",
      unavailableTargets: ["elektro"],
    },
  });
  for (const label of [
    "Experten A–Z",
    "Photovoltaik",
    "Smart Home &amp; Elektro",
    "Premium-Banner oben",
    "2030-10-01",
    "2030-10-15",
  ])
    assert.ok(html.includes(label), label);
  assert.match(html, /nicht zugeordnet/);
  const form = render(AdminCampaignForm, {
    campaign: { ...campaign, status: "pending" },
  });
  assert.match(form, /value="approve"/);
  assert.match(form, /value="reject"/);
  assert.match(
    render(AdminCampaignForm, { campaign: { ...campaign, status: "paused" } }),
    /value="resume"/,
  );
});
test("top and sidebar image creatives are linked banners without public text cards or cropping", () => {
  const preview = render(CampaignSlot, {
    placement: "top_banner",
    ad: campaign,
    preview: true,
  });
  for (const placement of ["top_banner", "sidebar_top"]) {
    const publicAd = render(CampaignSlot, { placement, ad: { ...campaign, placement } });
    assert.match(publicAd, new RegExp(`data-placement="${placement}"`));
    assert.match(publicAd, /href="https:\/\/example.org\/"/);
    assert.match(publicAd, /images\/solar.jpg/);
    assert.match(publicAd, /rel="sponsored noopener noreferrer"/);
    assert.doesNotMatch(publicAd, /<strong>|<p>|Mehr erfahren|sendBeacon|trackEvent/);
  }
  assert.match(preview, /images\/solar.jpg/);
  assert.doesNotMatch(preview, /<strong>|Mehr erfahren/);
  assert.doesNotMatch(preview, /href="https:\/\/example.org\/"/);
  const textFallback = render(CampaignSlot, { placement: "sidebar_top", ad: { ...campaign, imageUrl: null }, preview: true });
  assert.match(textFallback, /Energie vom eigenen Dach|Mehr erfahren/);
  const empty = render(CampaignSlot, { placement: "sidebar_middle" });
  assert.match(empty, /Freier Werbeplatz|Werbemöglichkeiten entdecken/);
  const css = readFileSync(new URL("../src/components/advertising/advertising.module.css", import.meta.url), "utf8");
  assert.match(css, /\.imageCreative img\s*\{[^}]*width:\s*100%;[^}]*height:\s*auto;[^}]*object-fit:\s*contain;/);
  assert.doesNotMatch(css, /object-fit:\s*cover|max-height:\s*220px/);
});

test("signed creative images have no fixed dimensions for portrait, square or wide uploads", () => {
  for (const shape of ["portrait", "square", "wide", "very-wide"]) {
    const imageUrl = `https://signed.example/${shape}.png?token=private`;
    for (const placement of ["top_banner", "sidebar_top"]) {
      for (const preview of [false, true]) {
        const html = render(CampaignSlot, {
          placement,
          ad: { ...campaign, placement, imageUrl },
          preview,
        });
        const image = html.match(/<img\b[^>]*>/)?.[0];
        assert.ok(image, `${shape} ${placement} ${preview ? "preview" : "public"}`);
        assert.match(image, new RegExp(`src="https://signed\\.example/${shape}\\.png\\?token=private"`));
        assert.doesNotMatch(image, /\s(?:width|height|srcset|sizes|style)=/i);
        assert.doesNotMatch(html, /<strong>|Mehr erfahren/);
        if (!preview) {
          assert.match(html, /target="_blank"/);
          assert.match(html, /rel="sponsored noopener noreferrer"/);
        }
      }
    }
  }
});

test("public rail prefers active campaigns, fills only mapped slots, and has one label and CTA", () => {
  const live = { ...campaign, placement: "sidebar_top", imageUrl: "https://signed.example/live.jpg?token=private" };
  assert.equal(sidebarCreative("sidebar_top", [live]), live);
  assert.match(sidebarCreative("sidebar_middle", [])?.imageUrl ?? "", /legacy-ads\/haus-salzburg\.jpg/);
  assert.equal(sidebarCreative("sidebar_12", []), undefined);
  const html = render(AdvertisingRail, { slots: [...defaultSidebarOrder], ads: [live] });
  assert.match(html, /signed\.example\/live\.jpg\?token=private/);
  assert.doesNotMatch(html, /legacy-ads\/city-apart-square\.jpg/);
  assert.equal((html.match(/<section\b/g) ?? []).length, 10);
  assert.equal((html.match(/class="advertising-rail-label"/g) ?? []).length, 1);
  assert.equal((html.match(/Hier könnte Ihre Anzeige stehen/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Freier Werbeplatz|<strong>|Mehr erfahren/);
  assert.match(html, /rel="sponsored noopener noreferrer"/);
  assert.match(html, /target="_blank"/);
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.advertising-rail-creatives img\s*\{[^}]*width:\s*100%;[^}]*height:\s*auto;[^}]*object-fit:\s*contain;/);
});

test("admin reorder view renders twelve controls with dynamic first and last bounds", () => {
  const html = render(SidebarOrderSlots, {
    ads: [], slots: [...defaultSidebarOrder], editing: true, busy: false,
    dragged: null, target: null,
    onPointerDown() {}, onPointerMove() {}, onPointerUp() {}, onMove() {},
  });
  assert.equal((html.match(/data-sidebar-slot=/g) ?? []).length, 12);
  assert.match(html, /Banner A nach oben"[^>]*disabled/);
  assert.match(html, /Banner L nach unten"[^>]*disabled/);
  assert.match(html, /Banner F verschieben/);
  assert.equal((html.match(/Noch kein Banner/g) ?? []).length, 2);
});

test("homepage reuses ordered portal rows and the shared rail", () => {
  const source = readFileSync(new URL("../src/app/(energieheld)/page.tsx", import.meta.url), "utf8");
  assert.match(source, /loadPortalCompanies\(\)/);
  assert.match(source, /loadPublicAds\(undefined, "homepage"\)/);
  assert.match(source, /loadPublicSidebarOrder\(\)/);
  assert.match(source, /companies\.data\?\.map\(\(listing\)/);
  assert.match(source, /<ListingRow/);
  assert.match(source, /<AdvertisingRail slots=\{sidebarOrder\} ads=\{ads\}/);
  assert.doesNotMatch(source, /listings\.slice|directoryPackage === "premium"/);
});
// Optional local, static visual fixture. Never writes to the application or DB.
if (process.env.AD_TARGET_PREVIEW_FILE) {
  const css =
    readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8") +
    readFileSync(
      new URL(
        "../src/components/advertising/advertising.module.css",
        import.meta.url,
      ),
      "utf8",
    );
  const content = render(CampaignForm, {
    campaign,
    categoryIds: ["solar", "elektro", "dach"],
  });
  writeFileSync(
    process.env.AD_TARGET_PREVIEW_FILE,
    '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Werbung – lokale Testdaten</title><style>' +
      css +
      '</style></head><body><main class="container page"><h1>Werbekampagne bearbeiten</h1>' +
      content +
      "<hr><h2>Admin-Vorschau</h2>" +
      render(CampaignFacts, { campaign }) +
      render(CampaignSlot, {
        placement: "top_banner",
        ad: campaign,
        preview: true,
      }) +
      "</main></body></html>",
  );
}

test("every official category available as an ad target resolves to a directory page", async () => {
  const { energieheld } = await import("../src/config/energieheld.ts");
  const { default: TradePage, generateMetadata } = await import(
    "../src/app/(energieheld)/gewerke/[slug]/page.tsx"
  );
  for (const category of energieheld.categories) {
    const params = Promise.resolve({ slug: category.id });
    const page = await TradePage({ params, searchParams: Promise.resolve({}) });
    assert.equal(page.props.trade.id, category.id);
    assert.equal((await generateMetadata({ params })).title, category.name);
  }
  await assert.rejects(
    () =>
      TradePage({
        params: Promise.resolve({ slug: "invalid" }),
        searchParams: Promise.resolve({}),
      }),
    /NOT_FOUND/,
  );
});
