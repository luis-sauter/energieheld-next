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

const { CampaignForm, AdminCampaignForm, addRequestScope, availableRequestScopes, addPortalArea, revealAddedPortalArea, removeRequestScope, removePortalArea, changePortalArea, requestScopeIds, slotAvailabilityText } = await import(
  "../src/components/advertising/campaign-form.tsx"
);
const { portalAdSections } = await import("../src/lib/ad-target-areas.ts");
const { validateAdValues, adTargetFormValue } = await import("../src/lib/ad-values.ts");
const { CampaignFacts, CampaignSlot } = await import(
  "../src/components/advertising/campaign-view.tsx"
);
const { AdvertisingRail } = await import("../src/components/advertising/advertising-rail.tsx");
const { sidebarCreative } = await import("../src/lib/advertising-rail.ts");
const { presentedBanners } = await import("../src/lib/banner-presentation.ts");
const { defaultSidebarOrder } = await import("../src/lib/sidebar-order.ts");
const { SidebarOrderSlots } = await import("../src/components/admin/sidebar-order-editor.tsx");
const { InlineBannerContext } = await import("../src/components/advertising/inline-banner-context.tsx");
const { InlineBannerDialog } = await import('../src/components/advertising/inline-banner-editor.tsx');
const { BannerSearchFields } = await import('../src/components/advertising/banner-search-fields.tsx');

test('existing inline add/edit dialogs include the same public metadata on every supported banner page, including shared creatives',()=>{
 const metadata={name:'City Apart Dresden',postal_code:'',city:'',term_keys:['theme:wellnessangebote']};
 const terms=[{term_key:'theme:wellnessangebote',dimension:'theme',label:'Wellness'}];
 for(const label of ['Startseite','Unterkünfte A–Z',...portalAdSections.flatMap(section=>section.areas.map(area=>area.label))]){
   for(const banner of [undefined,{id:'existing',placement:'sidebar_top',source:'campaign',shared:true,metadata,target_url:'https://example.org/',imageUrl:'/image.png'}]){
     const html=renderToStaticMarkup(createElement(InlineBannerDialog,{options:{label,availability:{},banners:[],terms},selected:{placement:'sidebar_top',banner},onClose(){},onSaved(){},onChanged(){},onRemoved(){},onMetadataSaved(){}}));
     for(const name of ['Name / Bezeichnung','PLZ','Ort','Kategorien'])assert.ok(html.includes(name));
     assert.match(html,/name="banner_terms"[^>]*value="theme:wellnessangebote"/);
     assert.doesNotMatch(html,/disabled=""[^>]*>Banner speichern/);
     if(banner) assert.match(html,/value="City Apart Dresden"/);
   }
 }
 const admin=renderToStaticMarkup(createElement(CampaignForm,{campaign,categoryIds:[],admin:true,bannerMetadata:metadata,bannerTerms:terms}));
 assert.match(admin,/Name \/ Bezeichnung/);assert.match(admin,/name="banner_city"/);assert.match(admin,/name="banner_postal_code"/);
 const owner=renderToStaticMarkup(createElement(CampaignForm,{campaign,categoryIds:[]}));assert.doesNotMatch(owner,/name="banner_city"|name="banner_terms"/);
});
test('category controls preserve normalized multiple assignments rather than booking targets',()=>{
 const value={name:'Banner',city:'',postal_code:'',term_keys:['theme:wellnessangebote','audience:familie']};
 const html=renderToStaticMarkup(createElement(BannerSearchFields,{value,terms:[{term_key:'theme:wellnessangebote',dimension:'theme',label:'Wellness'},{term_key:'audience:familie',dimension:'audience',label:'Familie'}],onChange(){}}));
 assert.equal((html.match(/checked=""/g)||[]).length,2);assert.doesNotMatch(html,/name="targets"/);
 let changed;const element=BannerSearchFields({value,terms:[{term_key:'theme:wellnessangebote',dimension:'theme',label:'Wellness'}],onChange(next){changed=next;}});
 function inputs(node){if(!node)return [];if(Array.isArray(node))return node.flatMap(inputs);return node.type==='input'?[node]:inputs(node.props?.children);}
 inputs(element).find(node=>node.props.name==='banner_terms').props.onChange({target:{checked:false}});
 assert.deepEqual(changed.term_keys,['audience:familie']);assert.deepEqual(value.term_keys,['theme:wellnessangebote','audience:familie']);
});

test("fixed positions A–L survive reversed rail input and C-to-A content previews on desktop/mobile markup", () => {
  const sources=[defaultSidebarOrder[2],defaultSidebarOrder[0],defaultSidebarOrder[1],...defaultSidebarOrder.slice(3)];
  const html=renderToStaticMarkup(createElement(SidebarOrderSlots,{
    ads:presentedBanners([],[]),slots:sources,editing:true,busy:false,dragged:null,target:null,
    onPointerDown(){},onPointerMove(){},onPointerUp(){},onMove(){},
  }));
  const identities=[...html.matchAll(/data-sidebar-slot="([^"]+)"/g)].map(x=>x[1]);
  assert.deepEqual(identities,[...defaultSidebarOrder]);
  const first=html.slice(0,html.indexOf('data-sidebar-slot="sidebar_middle"'));
  assert.match(first,/Banner A/); assert.match(first,/ferienanlage-nationalpark/); assert.doesNotMatch(first,/Banner C/);
  const rail=renderToStaticMarkup(createElement(AdvertisingRail,{ads:presentedBanners([],[]),slots:[...defaultSidebarOrder].reverse()}));
  assert.ok(rail.indexOf('data-placement="sidebar_top"')<rail.indexOf('data-placement="sidebar_bottom"'));
});
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
test("request starts compact, adds each area once, and removes only its placements", () => {
  const blank = render(CampaignForm, { campaign: { ...campaign, status: "draft", internal_name: "", headline: "", target_url: "" }, categoryIds: [] });
  assert.match(blank, /Werbebereich hinzufügen/);
  assert.doesNotMatch(blank, /class="scopeGroup"|type="checkbox"/);
  const one = addRequestScope([], "homepage");
  const two = addRequestScope(one, "experts_directory");
  assert.deepEqual(addRequestScope(two, "homepage"), two);
  const targets = [
    { target_type: "homepage", category_id: null, placement: "top_banner" },
    { target_type: "experts_directory", category_id: null, placement: "sidebar_top" },
    { target_type: "experts_directory", category_id: null, placement: "sidebar_middle" },
  ];
  assert.deepEqual(requestScopeIds(targets), two);
  assert.deepEqual(requestScopeIds(targets, true), []);
  assert.deepEqual(removeRequestScope(targets, "homepage"), targets.slice(1));
  assert.deepEqual(removeRequestScope(targets, "experts_directory"), targets.slice(0, 1));
  assert.equal(slotAvailabilityText(undefined, false, false, ""), "Verfügbar");
  assert.equal(slotAvailabilityText("Belegt", false, false, ""), "Belegt");
  assert.equal(slotAvailabilityText("Angefragt", false, false, ""), "Angefragt");
  assert.equal(slotAvailabilityText(undefined, true, false, ""), "Ausgewählt · Verfügbar");
  assert.match(blank, /aria-expanded="false"/);
  const css = readFileSync(new URL("../src/components/advertising/advertising.module.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*?\.requestForm \.placements\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.requestForm \.placement\s*\{[^}]*min-height:\s*60px/);
});
test("portal picker derives real subpages and edits one nested target without affecting its siblings", () => {
  assert.equal(portalAdSections.find((section) => section.id === "mottoreisen").areas.length, 13);
  assert.equal(portalAdSections.find((section) => section.id === "reiseziele").areas.length, 5);
  const targets = [
    { target_type: "homepage", category_id: null, placement: "top_banner" },
    { target_type: "portal_area", category_id: null, target_key: "mottoreisen/wellnessangebote", placement: "top_banner" },
    { target_type: "portal_area", category_id: null, target_key: "mottoreisen/wanderurlaub", placement: "sidebar_middle" },
    { target_type: "portal_area", category_id: null, target_key: "reiseziele/deutschland", placement: "sidebar_top" },
  ];
  assert.deepEqual(requestScopeIds(targets), ["homepage", "mottoreisen", "reiseziele"]);
  assert.deepEqual(removePortalArea(targets, "mottoreisen/wellnessangebote"), [targets[0], targets[2], targets[3]]);
  assert.deepEqual(removeRequestScope(targets, "mottoreisen"), [targets[0], targets[3]]);
  assert.deepEqual(changePortalArea(targets, "mottoreisen/wellnessangebote", "mottoreisen/nordic-walking"),
    [targets[0], { ...targets[1], target_key: "mottoreisen/nordic-walking" }, targets[2], targets[3]]);
  const html = render(CampaignForm, { campaign: { ...campaign, targets }, categoryIds: [] });
  assert.match(html, /Mottoreisen|Reiseziele|Wellnessangebote|Wanderurlaub|Deutschland/);
  assert.match(html, /Wo innerhalb dieses Bereichs möchten Sie werben\?/);
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 52);
  assert.equal((html.match(/checked=""/g) ?? []).length, 4);
  assert.match(html, /Mottoreisen · Wellnessangebote entfernen/);
  assert.doesNotMatch(html, />portal_area:|>theme:|>destination:/);
  const admin = render(CampaignForm, { campaign: { ...campaign, targets }, categoryIds: [], admin: true });
  assert.match(admin, /Mottoreisen|Reiseziele|Wellnessangebote|Deutschland/);
  const facts = render(CampaignFacts, { campaign: { ...campaign, targets } });
  assert.match(facts, /Mottoreisen · Wellnessangebote · Premium-Banner oben/);
  assert.match(facts, /Reiseziele · Deutschland · Banner A/);
  assert.doesNotMatch(facts, /portal_area:|mottoreisen\/wellnessangebote/);
});
test("outer picker keeps themes and destinations available until every concrete area is used", () => {
  const scopes = ["homepage", "experts_directory", "mottoreisen", "reiseziele"];
  let areas = addPortalArea([], "mottoreisen/natur-pur");
  areas = addPortalArea(areas, "mottoreisen/wellnessangebote");
  areas = addPortalArea(areas, "mottoreisen/wanderurlaub");
  areas = addPortalArea(areas, "reiseziele/deutschland");
  areas = addPortalArea(areas, "reiseziele/oesterreich");
  assert.equal(areas.length, 5);
  assert.deepEqual(availableRequestScopes(scopes, areas).map((scope) => scope.id), ["mottoreisen", "reiseziele"]);
  assert.deepEqual(addRequestScope(scopes, "mottoreisen"), scopes, "one shared outer group, several area cards");
  assert.strictEqual(addPortalArea(areas, "mottoreisen/natur-pur"), areas, "duplicate card is refused");
  assert.strictEqual(addPortalArea(areas, "mottoreisen/erfunden"), areas);
  const allThemes = portalAdSections.find((section) => section.id === "mottoreisen").areas.map((area) => area.key);
  const allDestinations = portalAdSections.find((section) => section.id === "reiseziele").areas.map((area) => area.key);
  assert.deepEqual(availableRequestScopes(scopes, [...allThemes, ...allDestinations]), []);
  const removed = allThemes.filter((key) => key !== "mottoreisen/natur-pur");
  assert.deepEqual(availableRequestScopes(scopes, [...removed, ...allDestinations]).map((scope) => scope.id), ["mottoreisen"]);
  assert.deepEqual(addPortalArea(removed, "mottoreisen/natur-pur"), [...removed, "mottoreisen/natur-pur"]);
  assert.deepEqual(availableRequestScopes([], []).map((scope) => scope.id), scopes);
});
test("new area is revealed at its beginning and focused without a second scroll, respecting reduced motion", () => {
  for (const reducedMotion of [false, true]) {
    const calls = [];
    const card = {
      querySelector(selector) {
        assert.equal(selector, "select");
        return { focus: (options) => calls.push(["focus", options]) };
      },
      scrollIntoView: (options) => calls.push(["scroll", options]),
    };
    revealAddedPortalArea(card, reducedMotion);
    assert.deepEqual(calls, [
      ["focus", { preventScroll: true }],
      ["scroll", { behavior: reducedMotion ? "instant" : "smooth", block: "start" }],
    ]);
  }
  for (const admin of [false, true]) {
    const targets = ["mottoreisen/natur-pur", "mottoreisen/radwandern", "reiseziele/deutschland", "reiseziele/oesterreich"]
      .map((target_key) => ({ target_type: "portal_area", category_id: null, target_key, placement: "top_banner" }));
    const html = render(CampaignForm, { campaign: { ...campaign, targets }, categoryIds: [], admin });
    assert.equal((html.match(/class="areaCard"[^>]*role="group"/g) ?? []).length, 4);
    assert.match(html, /aria-label="Mottoreisen · Radwandern"/);
    assert.match(html, /aria-label="Reiseziele · Österreich"/);
  }
});
test("multiple theme and destination cards restore exact saved slots for owner and admin", () => {
  const keys = ["mottoreisen/natur-pur", "mottoreisen/wellnessangebote", "mottoreisen/wanderurlaub", "reiseziele/deutschland", "reiseziele/oesterreich"];
  const targets = keys.map((target_key, index) => ({ target_type: "portal_area", category_id: null, target_key,
    placement: index % 2 ? "sidebar_top" : "top_banner" }));
  targets.push({ ...targets[0], placement: "sidebar_middle" });
  const form = new FormData();
  for (const key of ["internal_name", "headline", "target_url", "requested_start_date", "requested_end_date", "placement"])
    form.set(key, campaign[key]);
  for (const target of targets) form.append("targets", adTargetFormValue(target));
  const saved = validateAdValues(form);
  assert.equal(saved.error, undefined);
  assert.deepEqual(saved.data.targets, targets);
  for (const admin of [false, true]) {
    const html = render(CampaignForm, { campaign: { ...campaign, ...saved.data }, categoryIds: [], admin });
    assert.equal((html.match(/class="scopeGroup"/g) ?? []).length, 2);
    assert.equal((html.match(/class="areaCard"/g) ?? []).length, 5);
    const checked = (html.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? []).filter((input) => input.includes('checked=""'));
    assert.equal(checked.length, targets.length);
    for (const target of targets) assert.ok(checked.some((input) => input.includes(`value="${adTargetFormValue(target)}"`)));
    assert.match(html, /aria-label="Mottoreisen: Rubrik oder Unterrubrik hinzufügen"/);
  }
  const changed = changePortalArea(targets, keys[0], "mottoreisen/golfurlaub");
  assert.deepEqual(changed.filter((target) => target.target_key === "mottoreisen/golfurlaub").map((target) => target.placement), ["top_banner", "sidebar_middle"]);
  assert.deepEqual(changed.filter((target) => target.target_key !== "mottoreisen/golfurlaub"), targets.slice(1, -1));
  assert.deepEqual(removePortalArea(targets, keys[0]), targets.slice(1, -1));
});
test("campaign form loads saved page/slot pairs without a cross product", () => {
  const html = render(CampaignForm, {
    campaign: { ...campaign, targets: [
      { target_type: "homepage", category_id: null, placement: "top_banner" },
      { target_type: "experts_directory", category_id: null, placement: "sidebar_top" },
      { target_type: "experts_directory", category_id: null, placement: "sidebar_middle" },
    ] },
    categoryIds: ["solar", "elektro", "dach"],
  });
  assert.match(html, /Wo möchten Sie werben/);
  const inputs = html.match(/<input[^>]*type="checkbox"[^>]*>/g);
  assert.equal(inputs.length, 26);
  for (const pair of ["homepage|top_banner", "experts_directory|sidebar_top", "experts_directory|sidebar_middle"])
    assert.ok(inputs.some((input) => input.includes(`value="${pair}"`) && input.includes('checked=""')));
  assert.equal(inputs.filter((input) => input.includes('checked=""')).length, 3);
  assert.match(html, /Startseite/);
  assert.match(html, /Unterkünfte A–Z/);
  assert.match(html, /Startseite entfernen|Unterkünfte A–Z entfernen/);
  assert.match(html, /Ansprechpartner|Telefonnummer|E-Mail-Adresse|Ziel-URL|Gewünschter Start|Gewünschtes Ende/);
  assert.match(html, /Haben Sie bereits ein Bannerbild\?|unterstützen Sie gerne bei der Erstellung/);
  assert.match(html, /Hinweise oder Wünsche|name="body_text"/);
  assert.match(html, /name="headline"[^>]*type="hidden"|type="hidden"[^>]*name="headline"/);
  assert.doesNotMatch(html, /Anzeigenvorschau|Ihre Überschrift|Mehr erfahren|Überschrift für interne Vorschau/);
  assert.match(html, /name="image"/);
  assert.doesNotMatch(html.match(/<input[^>]*name="image"[^>]*>/)?.[0] ?? "", /required/);
  assert.doesNotMatch(
    html,
    /type="radio"|value="trade:heizung"|name="scope_type"|name="category_id"|Alle Gewerkeseiten/,
  );
  const noTrades = render(CampaignForm, {
    campaign: { ...campaign, targets: [campaign.targets[0]] },
    categoryIds: [],
  });
  assert.equal((noTrades.match(/type="checkbox"/g) || []).length, 13);
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
    "Unterkünfte A–Z",
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
  const edit = render(CampaignForm, { campaign: { ...campaign, status: "approved", approved_start_date: "2030-10-02", approved_end_date: "2030-10-14" }, categoryIds: [], admin: true });
  assert.match(edit, /Banner speichern/);
  assert.match(edit, /Name \/ Bezeichnung/);
  assert.doesNotMatch(edit, /Anzeigenvorschau/);
  assert.match(edit, /Ausspielung ab/);
  assert.match(edit, /value="2030-10-02"/);
  assert.match(edit, /value="2030-10-14"/);
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
  assert.equal(sidebarCreative("sidebar_middle", []), undefined);
  assert.equal(sidebarCreative("sidebar_12", []), undefined);
  const html = render(AdvertisingRail, { slots: [...defaultSidebarOrder], ads: [live] });
  assert.match(html, /signed\.example\/live\.jpg\?token=private/);
  assert.doesNotMatch(html, /legacy-ads\/city-apart-square\.jpg/);
  assert.equal((html.match(/<section\b/g) ?? []).length, 1);
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
    ads: presentedBanners([],[]), slots: [...defaultSidebarOrder], editing: true, busy: false,
    dragged: null, target: null,
    onPointerDown() {}, onPointerMove() {}, onPointerUp() {}, onMove() {},
  });
  assert.equal((html.match(/data-sidebar-slot=/g) ?? []).length, 12);
  assert.match(html, /Banner A nach oben"[^>]*disabled/);
  assert.match(html, /Banner L nach unten"[^>]*disabled/);
  assert.match(html, /Banner F verschieben/);
  assert.equal((html.match(/Noch kein Banner/g) ?? []).length, 2);
});

test("homepage keeps the shared ad rail and uses sourced accommodation cards", () => {
  const source = readFileSync(new URL("../src/app/(energieheld)/page.tsx", import.meta.url), "utf8");
  assert.match(source, /loadPublicAds\(undefined, "homepage"\)/);
  assert.match(source, /loadPublicSidebarOrder\(\)/);
  assert.match(source, /<AccommodationCard/);
  assert.match(source, /loadReiseportalDirectory\(\)/);
  assert.match(source, /featuredStays\.flatMap/);
  assert.match(source, /<CampaignSlot placement="top_banner"/);
  assert.match(source, /<AdvertisingRail slots=\{sidebarOrder\} ads=\{ads\}/);
  assert.doesNotMatch(source, /Demo GmbH|<ListingRow/);
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
    campaign: { ...campaign, targets: [
      { target_type: "homepage", category_id: null, placement: "top_banner" },
      { target_type: "experts_directory", category_id: null, placement: "sidebar_top" },
      { target_type: "experts_directory", category_id: null, placement: "sidebar_middle" },
    ] },
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

test("legacy trade routes redirect without rendering their category pages", async () => {
  const { default: TradePage } = await import(
    "../src/app/(energieheld)/gewerke/[slug]/page.tsx"
  );
  for (const slug of ["solar", "heizung", "invalid"]) {
    assert.throws(
      () => TradePage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) }),
      /REDIRECT:\//,
    );
  }
});

test("inline banner controls are absent for public visitors and present at all admin placements", () => {
  const visitor = renderToStaticMarkup(createElement(CampaignSlot, { placement: "top_banner", ad: campaign }));
  assert.doesNotMatch(visitor, /Banner hinzufügen|Banner bearbeiten/);
  const value = { overrides: {}, open() {} };
  const admin = renderToStaticMarkup(createElement(InlineBannerContext.Provider, { value },
    createElement(AdvertisingRail, { ads: presentedBanners([],[]), slots: [...defaultSidebarOrder] })));
  assert.equal((admin.match(/Banner hinzufügen/g) ?? []).length, 2, "only K and L are empty; ten visible legacy banners are occupied");
  assert.equal((admin.match(/Banner bearbeiten/g) ?? []).length, 10);
  for (const slot of defaultSidebarOrder) assert.match(admin, new RegExp(`data-placement="${slot}"`));
  const existing = renderToStaticMarkup(createElement(InlineBannerContext.Provider, { value },
    createElement(CampaignSlot, { placement: "top_banner", ad: { ...campaign, image_path: "campaigns/existing/creative/image.png" } })));
  assert.match(existing, /Banner bearbeiten/);
  assert.match(existing, /Premium-Banner oben/);
});

test("saved inline creative immediately overrides its exact placement without changing sibling slots", () => {
  const updated = { ...campaign, id: "updated", placement: "sidebar_middle", target_url: "https://example.org/saved", imageUrl: "/saved-square.png" };
  const value = { overrides: { sidebar_middle: updated, top_banner: null }, open() {} };
  const html = renderToStaticMarkup(createElement(InlineBannerContext.Provider, { value },
    createElement("div", null,
      createElement(CampaignSlot, { placement: "top_banner", ad: campaign }),
      createElement(CampaignSlot, { placement: "sidebar_middle" }),
      createElement(CampaignSlot, { placement: "sidebar_top", ad: { ...campaign, imageUrl: "/unchanged.png" } }))));
  assert.match(html, /href="https:\/\/example.org\/saved"/);
  assert.match(html, /src="\/saved-square.png"/);
  assert.match(html, /src="\/unchanged.png"/);
  assert.doesNotMatch(html, /width="1200"|height="600"/);
  assert.match(html, /rel="sponsored noopener noreferrer" target="_blank"/);
});

test("removed or temporarily imageless banners are invisible publicly while previews retain text fallback", () => {
  for (const ad of [{ ...campaign, imageUrl: undefined, suppressed: true }, { ...campaign, imageUrl: undefined, image_path: null, suppressed: true }]) {
    assert.equal(renderToStaticMarkup(createElement(CampaignSlot,{ placement: "top_banner", ad })), "");
  }
  const preview=renderToStaticMarkup(createElement(CampaignSlot,{ placement: "top_banner", preview: true,
    ad: { ...campaign,imageUrl:undefined,headline:"Textvorschau" } }));
  assert.match(preview,/Textvorschau/);
});
