import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "next/link" || specifier === "next/image") return { url: `data:text/javascript,export function useLinkStatus(){return {pending:false}};export default ${JSON.stringify(specifier === "next/link" ? "a" : "img")}`, shortCircuit: true };
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const base = specifier.startsWith("@/")
        ? new URL("../src/" + specifier.slice(2), import.meta.url) : new URL(specifier, context.parentURL);
      for (const ext of [".ts", ".tsx"])
        if (existsSync(new URL(base.href + ext))) return next(base.href + ext, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts") || url.endsWith(".tsx")) return {
      format: "module", shortCircuit: true,
      source: transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX },
      }).outputText,
    };
    return next(url, context);
  },
});

const { TravelFinder } = await import("../src/components/portal/travel-finder.tsx");
const { availableTravelFilters, readTravelFilterValues } = await import("../src/lib/reiseportal-filter-options.ts");
const { travelSearchUrl, travelSearchReturnUrl } = await import('../src/lib/travel-search-intent.ts');
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const listing = (slug, country, terms, premium = false) => ({
  id: slug, slug, name: slug, tagline: "", description: "", businessAreas: "", services: [],
  categoryIds: [], location: { city: "Berlin", postalCode: "10115", region: "", country },
  travelTermKeys: terms, directoryPackage: premium ? "premium" : "basic", images: [],
  contact: { email: "", phone: "", website: "" }, isDemo: false, initials: "AB",
});
const listings = [
  listing("spa", "DE", ["theme:wellnessangebote", "audience:paar", "accommodation:hotel", "feature:sauna"], true),
  listing("camp", "AT", ["theme:campingurlaub", "audience:familie", "accommodation:camping"]),
];
const terms = [
  ["theme:wellnessangebote", "theme", "wellnessangebote", "Wellness"],
  ["theme:campingurlaub", "theme", "campingurlaub", "Camping"],
  ["audience:paar", "audience", "paar", "Paar"],
  ["audience:familie", "audience", "familie", "Familie"],
  ["accommodation:hotel", "accommodation", "hotel", "Hotel"],
  ["accommodation:camping", "accommodation", "camping", "Camping"],
  ["feature:sauna", "feature", "sauna", "Sauna"],
].map(([term_key, dimension, slug, label]) => ({ term_key, dimension, slug, label }));
const options = availableTravelFilters(listings, terms);
const render = (values, mode = "directory") => renderToStaticMarkup(createElement(TravelFinder,
  { mode, listings, options, values, onChange() {} }));

test("both routes use the same finder and show actual initial totals", () => {
  const home = source("src/app/(energieheld)/page.tsx");
  assert.match(home, /<HomeTravelFinder.*listings=/);
  assert.match(home, /<TravelQuicklinks className=/);
  const quicklinks=source("src/components/portal/travel-quicklinks.tsx");
  assert.equal((quicklinks.match(/travelThemes\.map/g) ?? []).length, 1);
  assert.match(quicklinks, /discoveryAudienceShortcuts\(\)/);
  assert.match(quicklinks, /href=\{discoveryShortcutHref\("theme", entry\.slug\)\}/);
  assert.match(source("src/components/portal/travel-finder.tsx"), /window\.location\.assign\(travelFilterUrl\(values\)\)/);
  assert.match(source("src/components/portal/travel-directory.tsx"), /<TravelFinder mode="directory"/);
  const html = render(readTravelFilterValues({}));
  assert.match(html, /redesign\/unterkuenfte\/hero\.webp/);
  assert.match(html, /Finden Sie passende Unterkünfte/);
  assert.doesNotMatch(html, /<video/);
  const homeHtml = render(readTravelFilterValues({}), "home");
  assert.match(homeHtml, /hero-poster\.webp/);
  assert.doesNotMatch(homeHtml, /<video|\.mp4/);
  assert.match(html, /2 Ergebnisse anzeigen/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /Jahreszeit|Zeitraum/);
});

test("selected facets retain their label, zero options stay visible and disabled, and chips can be removed", () => {
  const html = render(readTravelFilterValues({ ziel: "deutschland", thema: "wellnessangebote" }));
  assert.match(html, /1 Ergebnis anzeigen/);
  assert.match(html, /Wellnessangebote \(1\)/);
  assert.match(html, /Campingurlaub \(0\)/);
  assert.match(html, /value="campingurlaub" disabled/);
  assert.match(html, /Motto: Wellnessangebote entfernen/);
  assert.match(html, /Alle Filter zurücksetzen/);
  assert.match(render(readTravelFilterValues({ q: "unpassend" })), /Ergebnisse werden gezählt/);
});

test("A–Z keeps hero above results, updates the URL locally and has mobile layout rules", () => {
  const directory = source("src/components/portal/travel-directory.tsx");
  const css = source("src/app/globals.css");
  assert.ok(directory.indexOf("<TravelFinder") < directory.indexOf("unterkunft-ergebnisse"));
  assert.match(directory, /window\.history\.replaceState/);
  assert.match(directory, /travelSearchResults\(listings, banners, filterValues\)/);
  assert.match(directory, /DirectoryOrderEditor/);
  assert.match(css, /\.reise-finder-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(css, /\.reise-finder-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/);
});

function formIn(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'form') return node;
  for (const child of [node.props?.children].flat(Infinity)) { const form = formIn(child); if (form) return form; }
}
test('both hero forms submit portal queries despite zero local matches or directory errors', () => {
  const previousWindow = globalThis.window;
  try {
    for (const mode of ['home', 'directory']) for (const q of ['Österreich', 'Nordic Walking', 'Pension Sonnenhof', 'City Apart Dresden']) {
      const values = readTravelFilterValues({ q, ziel: 'schweiz', ort: 'Unpassender Ort' });
      let assigned;
      globalThis.window = { location: { assign(url) { assigned = url; } } };
      const form = formIn(TravelFinder({ mode, listings, options, values, onChange() {}, error: 'Unterkünfte nicht verfügbar' }));
      form.props.onSubmit({ preventDefault() {} });
      const url = new URL(assigned, 'https://das-reiseportal.com');
      assert.equal(url.pathname, '/suche'); assert.equal(url.searchParams.get('q'), q);
      assert.equal(url.searchParams.get('ziel'), 'schweiz'); assert.equal(url.searchParams.get('von'), mode);
      const html = renderToStaticMarkup(createElement(TravelFinder, { mode, listings, options, values, onChange() {}, error: 'Unterkünfte nicht verfügbar' }));
      assert.match(html, /Ergebnisse werden gezählt/); assert.doesNotMatch(html, /type="submit" disabled/);
      assert.match(html, /Gewählte Reisefilter grenzen die Suche auf Unterkünfte ein/);
    }
  } finally { globalThis.window = previousWindow; }
});
test('empty free text retains structured filter URLs and return links preserve origin and selections', () => {
  const filters = readTravelFilterValues({ ziel: 'oesterreich', thema: 'wellnessangebote', ort: 'Tirol', q: '   ' });
  assert.equal(travelSearchUrl(filters, 'home'), '/unterkuenfte-a-z?ziel=oesterreich&thema=wellnessangebote');
  const query = { ...filters, query: 'Nordic Walking' };
  assert.match(travelSearchReturnUrl(query, 'home'), /^\/\?ziel=oesterreich/);
  assert.match(travelSearchReturnUrl(query, 'directory'), /^\/unterkuenfte-a-z\?/);
  assert.match(travelSearchReturnUrl(query, 'https://foreign.invalid'), /^\/unterkuenfte-a-z\?/);
  assert.equal(new URL(travelSearchUrl({ ...query, query: 'x'.repeat(500) }, 'home'), 'https://das-reiseportal.com').searchParams.get('q').length, 160);
});
test('results remain a compact continuation and no separate header search entry survives', () => {
  const page = source('src/app/(energieheld)/suche/page.tsx');
  assert.match(page, /<SearchTravelFinder/); assert.match(page, /Zur Suche zurück/);
  assert.match(page, /origin=\{origin\}/); assert.match(page, /readTravelFilterValues/);
  assert.doesNotMatch(source('src/components/portal/chrome.tsx'), /Portalsuche öffnen|href="\/suche"/);
  assert.match(source('src/components/portal/travel-finder.tsx'), /popstate/);
});

test('structured directory submit scrolls to results and respects reduced motion', () => {
  const previousWindow=globalThis.window, previousDocument=globalThis.document;
  try {
    for(const reduced of [true,false]) {
      let scrolling;
      globalThis.window={matchMedia(){return {matches:reduced}}};
      globalThis.document={getElementById(id){assert.equal(id,'unterkunft-ergebnisse');return {scrollIntoView(options){scrolling=options}}}};
      const form=formIn(TravelFinder({mode:'directory',listings,options,values:readTravelFilterValues({}),onChange(){}}));
      form.props.onSubmit({preventDefault(){}});
      assert.deepEqual(scrolling,{behavior:reduced?'instant':'smooth'});
    }
  } finally {globalThis.window=previousWindow;globalThis.document=previousDocument;}
});

test('result-route finder retains all context fields and submits with the original source', () => {
  const values = readTravelFilterValues({ q: 'City Apart', ziel: 'deutschland', thema: 'wellnessangebote', zielgruppe: 'paar', unterkunftstyp: 'hotel', besonderheit: 'sauna', ort: 'Berlin', sort: 'name' });
  const html = render(values, 'search');
  assert.equal((html.match(/role="search"/g) ?? []).length, 1);
  for (const label of ['Wohin?', 'Motto', 'Mit wem?', 'Unterkunft', 'Suchbegriff']) assert.ok(html.includes(label));
  for (const selected of ['deutschland', 'wellnessangebote', 'paar', 'hotel']) assert.ok(html.includes(`value="${selected}" selected`));
  assert.match(html,/value="City Apart"/); assert.doesNotMatch(html,/name="ort"/);
  const previous = globalThis.window;
  try {
    let url; globalThis.window = { location: { assign(value) { url=value; } } };
    const submit = current => formIn(TravelFinder({mode:'search',origin:'home',listings,options,values:current,onChange(){}})).props.onSubmit({preventDefault(){}});
    submit(values); assert.equal(url,travelSearchUrl(values,'home'));
    submit({...values,query:'',destination:'',theme:'',audience:'',accommodation:'',feature:'',location:''});
    assert.match(url,/^\/unterkuenfte-a-z\?sort=name$/);
  } finally { globalThis.window=previous; }
});


for (const mode of ["home", "directory", "search"]) test(mode + " finder omits features even with assigned terms and ignores old feature URLs", () => {
  const values = readTravelFilterValues({ besonderheit: "unknown" });
  const html = render(values, mode);
  assert.doesNotMatch(html, /Besonderheit|name="besonderheit"/);
  assert.equal((html.match(/<select /g) ?? []).length, 4);
  assert.match(html, /2 Ergebnisse anzeigen/);
  assert.doesNotMatch(html, /type="submit" disabled/);
  assert.match(html, /Familie|Mit Kindern/);
  const url = travelSearchUrl({ ...values, query: "Nordic Walking", feature: "sauna" }, "home");
  assert.equal(url, "/suche?q=Nordic+Walking&von=home");
  assert.equal(travelSearchReturnUrl({ ...values, feature: "sauna" }, "home"), "/");
});


test('completed search places its full result total on the button and removes the separate count row',()=>{
 for(const [total,label] of [[0,'0 Ergebnisse anzeigen'],[1,'1 Ergebnis anzeigen'],[8,'8 Ergebnisse anzeigen'],[127,'127 Ergebnisse anzeigen']]){
  const values=readTravelFilterValues({q:'Wellness',ziel:'oesterreich'});
  const html=renderToStaticMarkup(createElement(TravelFinder,{mode:'search',listings,options,values,onChange(){},completedSearch:{values,total}}));
  assert.ok(html.includes(label));assert.match(html,/aria-live="polite"/);assert.doesNotMatch(html,/reise-finder-summary|Unterkünfte gefunden/);
 }
});
test('editing or resetting a completed query/filter never leaves a stale result count, and failures are not zero matches',()=>{
 const completed=readTravelFilterValues({q:'Pension Sonnenhof',ziel:'oesterreich'});
 const renderCase=(values,error)=>renderToStaticMarkup(createElement(TravelFinder,{mode:'search',listings,options,values,onChange(){},completedSearch:{values:completed,total:127,error}}));
 for(const values of [readTravelFilterValues({q:'Pool',ziel:'oesterreich'}),readTravelFilterValues({q:'Pension Sonnenhof',ziel:'deutschland'})]){
  const html=renderCase(values);assert.doesNotMatch(html,/127 Ergebnisse anzeigen/);assert.match(html,/Ergebnisse werden gezählt/);
 }
 assert.match(renderCase(readTravelFilterValues({})),/2 Ergebnisse anzeigen/);
 const failed=renderCase(completed,'Die Live-Trefferzahl ist gerade nicht verfügbar.');assert.match(failed,/Live-Trefferzahl ist gerade nicht verfügbar/);assert.doesNotMatch(failed,/127 Ergebnisse anzeigen|0 Ergebnisse anzeigen/);
 for(const mode of ['home','directory'])assert.doesNotMatch(render(readTravelFilterValues({q:'Wellness'}),mode),/\d+ Unterkünfte gefunden/);
});

for(const mode of ['home','directory','search'])test(mode+' finder removes the separate location field and ignores legacy location filters',()=>{const values=readTravelFilterValues({q:'München',ort:'nonmatching'});assert.equal(values.location,'');const html=render(values,mode);assert.doesNotMatch(html,/name="ort"|Ort oder Postleitzahl/);assert.match(html,/value="München"/);assert.doesNotMatch(travelSearchUrl({...values,location:'stale'},'home'),/ort=/);});

test('structured page total is taken from the page response rather than rendered cards or stale facet facts',()=>{const html=renderToStaticMarkup(createElement(TravelFinder,{mode:'directory',listings:listings.slice(0,1),options,values:readTravelFilterValues({}),onChange(){},profileTotal:127}));assert.match(html,/127 Ergebnisse anzeigen/);assert.match(html,/127 Ergebnisse anzeigen/);});

for (const mode of ['home', 'directory', 'search']) test(mode + ' distinguishes draft, submitted and completed query chips without inventing a count', () => {
  const values = readTravelFilterValues({q:'pension',ziel:'oesterreich'});
  const html = extra => renderToStaticMarkup(createElement(TravelFinder,{mode,listings,options,values,onChange(){},...extra}));
  assert.match(html({}),/Eingabe: pension/); assert.doesNotMatch(html({}),/Suche: pension|\d+ Unterkünfte gefunden/);
  const pending=html({searchPending:true}); assert.match(pending,/Suche läuft/); assert.match(pending,/aria-busy="true"/); assert.match(pending,/Suche: pension/); assert.doesNotMatch(pending,/Ergebnisse werden gezählt|\d+ Unterkünfte gefunden/);
  const completed=html({completedSearch:{values,total:51}}); assert.match(completed,/51 Ergebnisse anzeigen/); assert.match(completed,/Suche: pension/); assert.doesNotMatch(completed,/Eingabe: pension|Ergebnisse werden gezählt/);
  const changed=html({completedSearch:{values:{...values,query:'Wellness'},total:51}}); assert.match(changed,/Eingabe: pension/); assert.doesNotMatch(changed,/51 Ergebnisse anzeigen|Suche: pension/);
});

test('submission marks pending once before navigation, while duplicate pending submissions are ignored',()=>{
 const previous=globalThis.window;const calls=[];
 try {globalThis.window={location:{assign(){calls.push('navigate')}}};const props={mode:'home',listings,options,values:readTravelFilterValues({q:'pension'}),onChange(){},onSearchStart(){calls.push('pending')}};
 formIn(TravelFinder(props)).props.onSubmit({preventDefault(){}});assert.deepEqual(calls,['pending','navigate']);
 formIn(TravelFinder({...props,searchPending:true})).props.onSubmit({preventDefault(){}});assert.deepEqual(calls,['pending','navigate']);
 }finally{globalThis.window=previous;}
});

test('live preview displays counts/loading/error while keeping the full search available',()=>{
 const values=readTravelFilterValues({q:'B'});const html=extra=>renderToStaticMarkup(createElement(TravelFinder,{mode:'home',listings,options,values,onChange(){},...extra}));
 assert.match(html({liveCount:{key:'q=B',status:'ready',total:51}}),/51 Ergebnisse anzeigen/);assert.doesNotMatch(html({liveCount:{key:'q=B',status:'ready',total:51}}),/Ergebnisse werden gezählt/);
 const loading=html({liveCount:{key:'q=B',status:'loading'}});assert.match(loading,/Ergebnisse werden gezählt/);assert.doesNotMatch(loading,/type="submit" disabled/);
 const failed=html({liveCount:{key:'q=B',status:'error'}});assert.match(failed,/Suche bleibt möglich/);assert.doesNotMatch(failed,/0 Ergebnisse anzeigen|type="submit" disabled/);
 assert.match(html({liveCount:{key:'q=B',status:'ready',total:0}}),/0 Ergebnisse anzeigen/);
});

test('a narrowed result-type page can fetch the all-results button count without seeding a wrong subtype total',()=>{
 const values=readTravelFilterValues({q:'Wellness'});const html=renderToStaticMarkup(createElement(TravelFinder,{mode:'search',listings,options,values,onChange(){},completedSearch:{values},liveCount:{key:'q=Wellness',status:'ready',total:87}}));assert.match(html,/87 Ergebnisse anzeigen/);assert.doesNotMatch(html,/reise-finder-summary|Unterkünfte gefunden/);
});
