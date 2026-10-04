import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

registerHooks({
  resolve(specifier, context, next) {
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
 assert.match(html,/<video/);assert.match(html,/controls/);assert.match(html,/playsInline/i);assert.match(html,/preload="metadata"/);assert.match(html,/poster="\/existing-photo.webp"/);
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
