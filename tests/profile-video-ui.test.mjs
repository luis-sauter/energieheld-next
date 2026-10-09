import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith(".module.css")) return { url: `data:text/javascript,export default {}`, shortCircuit: true };
    if (specifier === "next/link" || specifier === "next/image") return { url: `data:text/javascript,export default ${JSON.stringify(specifier === "next/link" ? "a" : "img")}`, shortCircuit: true };
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

const {ProfileHeaderMedia}=await import('../src/components/portal/profile-header-media.tsx');
const {companyProfileListing}=await import('../src/lib/company-presentation.ts');
const {signCompanyMedia}=await import('../src/lib/company-media.ts');
test('profile video renders in the existing media surface without autoplay, gallery remains the fallback',()=>{
 const gallery=createElement('div',null,'Existing gallery');
 const plain=renderToStaticMarkup(createElement(ProfileHeaderMedia,{name:'Demo',gallery}));
 assert.equal(plain,'<div>Existing gallery</div>');
 const html=renderToStaticMarkup(createElement(ProfileHeaderMedia,{name:'Demo',gallery,video:{src:'https://signed.example/video',poster:'/existing-photo.webp'}}));
 assert.match(html,/<video/);assert.doesNotMatch(html,/controls/);assert.match(html,/Video von Demo abspielen/);assert.match(html,/playsInline/i);assert.match(html,/preload="metadata"/);assert.match(html,/poster="\/existing-photo.webp"/);
 assert.doesNotMatch(html,/autoPlay|autoplay|Existing gallery/);
});
test('listing mapping uses first existing image as poster and list signing never requests video',async()=>{
 const profile={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slug:'demo',display_name:'Demo',company_profile_categories:[],video_path:'profiles/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/video/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.mp4'};
 const mapped=companyProfileListing(profile,{images:[{src:'/gallery.webp',alt:'Gallery'}],video:{src:'https://signed.example/video'}});
 assert.equal(mapped.video.poster,'/gallery.webp');
 const calls=[]; const client={storage:{from(bucket){calls.push(bucket);return{createSignedUrl:async()=>({data:{signedUrl:'https://signed.example/video'},error:null})}}}};
 assert.deepEqual(await signCompanyMedia(client,profile),{images:[]});assert.equal(calls.length,0);
 assert.equal((await signCompanyMedia(client,profile,true)).video.src,'https://signed.example/video');assert.deepEqual(calls,['company-profile-videos']);
});

const {ListingDetail}=await import('../src/components/portal/listing-detail.tsx');
const listing={id:'demo',slug:'demo',name:'Demo',initials:'D',tagline:'',description:'',categoryIds:[],services:[],isDemo:false,location:{street:'Straße 1',city:'Berlin',postalCode:'10115',region:'',country:'Deutschland'},contact:{email:'',phone:'',website:''},images:[{src:'/gallery.webp',alt:'Unterkunft'}]};
test('public profile with hosted or external video retains independent gallery below Maps',()=>{
 for(const video of [{src:'/video.mp4',poster:'/gallery.webp'},{src:'https://vimeo.com/12345',external:true,poster:'/gallery.webp'}]){
  const html=renderToStaticMarkup(createElement(ListingDetail,{listing:{...listing,video},categories:[],showMap:true,presentation:'company'}));
  assert.ok(html.indexOf('aria-label="Standort"')<html.indexOf('aria-label="Bildergalerie"'));
  assert.match(html,/alt="Unterkunft"/);assert.match(html,/Video von Demo abspielen/);
  assert.equal((html.match(/aria-label="Bildergalerie"/g)||[]).length,1);
 }
});
test('editing keeps separate video and gallery tools, including empty-gallery add action',()=>{
 const html=renderToStaticMarkup(createElement(ListingDetail,{listing:{...listing,video:{src:'/video.mp4'},images:[]},categories:[],showMap:true,videoEditor:createElement('button',null,'Video ersetzen'),galleryEditor:createElement('button',null,'Bild hinzufügen')}));
 assert.ok(html.indexOf('Video ersetzen')<html.indexOf('aria-label="Standort"'));
 assert.ok(html.indexOf('Bild hinzufügen')>html.indexOf('aria-label="Standort"'));
 assert.equal((html.match(/Bild hinzufügen/g)||[]).length,1);
});
test('no-video and no-image combinations retain existing header gallery or empty state',()=>{
 const html=renderToStaticMarkup(createElement(ListingDetail,{listing,categories:[]}));assert.match(html,/alt="Unterkunft"/);assert.doesNotMatch(html,/aria-label="Bildergalerie"/);
 const empty=renderToStaticMarkup(createElement(ListingDetail,{listing:{...listing,images:[]},categories:[]}));assert.match(empty,/Noch keine Profilbilder vorhanden/);
 const videoOnly=renderToStaticMarkup(createElement(ListingDetail,{listing:{...listing,images:[],video:{src:'/video.mp4'}},categories:[]}));assert.match(videoOnly,/Video von Demo abspielen/);assert.doesNotMatch(videoOnly,/aria-label="Bildergalerie"/);
});
