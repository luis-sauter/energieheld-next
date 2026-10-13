import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';import {registerHooks} from 'node:module';
import {transpileModule,ModuleKind,JsxEmit} from 'typescript';import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
globalThis.previewFixture={id:'6cd02ae2-75ab-4273-8cd8-fc62da38b2db',slug:'unternehmen-6cd02ae2-75ab-4273-8cd8-fc62da38b2db',name:'Hofgut Hafnerleiten',tagline:'Vorhandener Untertitel',description:'Erster vorhandener Absatz.\n\nZweiter vollständiger Absatz.',businessAreas:'Weitere gespeicherte Informationen.',travelTermKeys:['audience:paar','theme:natur-pur'],location:{street:'Brunndobl 16',city:'Bad Birnbach',postalCode:'84364',region:'Bayern',country:'Deutschland'},images:[{id:'554e4fe8-bf9d-48fe-b6a9-c8a791393c8a',src:'/fire.jpg',alt:'Kamin'},{src:'/pond.jpg',alt:'Bootshaus'}],logo:{src:'/logo.jpg',alt:'Unternehmenslogo'},contact:{phone:'+49 8563 91511',email:'post@hofgut.info',website:'https://www.hofgut.info/'},isDemo:false,isPreview:false};
registerHooks({resolve(s,c,next){
 if(s==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};
 if(s.endsWith('.css'))return {url:'data:text/javascript,export default {}',shortCircuit:true};
 if(s==='next/link')return {url:'data:text/javascript,'+encodeURIComponent('import {createElement} from "react";export default function Link({prefetch,...p}){return createElement("a",p)}'),shortCircuit:true};
 if(s==='next/image')return {url:'data:text/javascript,'+encodeURIComponent('import {createElement} from "react";export default function Image({fill,unoptimized,priority,...p}){return createElement("img",p)}'),shortCircuit:true};
 if(s==='next/navigation')return {url:'data:text/javascript,export function notFound(){throw Error("NOT_FOUND")}',shortCircuit:true};
 if(s==='@/components/leads/inquiry-dialog')return {url:'data:text/javascript,'+encodeURIComponent('import {createElement} from "react";export function InquiryDialog({profileId}){return createElement("button",{"data-contact-profile":profileId},"Kontakt aufnehmen")}'),shortCircuit:true};
 if(s==='@/lib/accommodation-page')return {url:'data:text/javascript,export async function loadAccommodationPage(slug){globalThis.previewSlug=slug;return {data:globalThis.previewFixture,error:null}}',shortCircuit:true};
 if(s==='@/lib/supabase/public')return {url:'data:text/javascript,export function createPublicClient(){return {from(){return {select(){return {eq(){return {order:async()=>({data:[],error:null})}}}}}},storage:{from(){return {createSignedUrls:async()=>({data:[],error:null})}}}}}',shortCircuit:true};
 if(s==='react'&&c.parentURL?.startsWith('data:'))return next(s,{...c,parentURL:import.meta.url});
 if(s.startsWith('@/')||s.startsWith('.')){const b=s.startsWith('@/')?new URL('../src/'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of ['.ts','.tsx'])if(existsSync(new URL(b.href+ext)))return next(b.href+ext,c)}return next(s,c);
},load(u,c,next){if(/\.tsx?$/.test(u))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(u),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText};return next(u,c)}});
const {ProfileDesignPreview}=await import('../src/components/portal/profile-design-preview.tsx');
const {metadata}=await import('../src/app/(energieheld)/designvorschau/unternehmensprofil/page.tsx');
const {sitemapEntries}=await import('../src/lib/seo.ts');
test('isolated preview preserves real text/media and exposes gallery, contact, Maps and existing motto links',()=>{
 const before=JSON.stringify(globalThis.previewFixture),html=renderToStaticMarkup(createElement(ProfileDesignPreview,{listing:globalThis.previewFixture}));
 for(const value of ['Hofgut Hafnerleiten','Vorhandener Untertitel','Erster vorhandener Absatz.','Zweiter vollständiger Absatz.','Weitere gespeicherte Informationen.','Brunndobl 16'])assert.ok(html.includes(value));
 assert.match(html,/Nächstes Bild|N&#228;chstes Bild/);assert.match(html,/Bilderauswahl/);assert.match(html,/data-contact-profile="6cd02ae2/);assert.match(html,/mailto:post@hofgut.info/);assert.match(html,/tel:\+49856391511/);
 assert.match(html,/https:\/\/www.google.com\/maps\?/);assert.match(html,/In Google Maps öffnen/);assert.match(html,/href="\/mottoreisen\/natur-pur"/);assert.match(html,/href="\/mottoreisen\/romantik-zu-zweit"/);
 assert.doesNotMatch(html,/InlineProfileEditor|Bearbeitungsmodus|Banner bearbeiten/);assert.equal(JSON.stringify(globalThis.previewFixture),before);
});
test('preview is noindex, absent from sitemap and visible only through an explicitly non-prefetched footer link',()=>{
 assert.equal(metadata.robots.index,false);
 const sitemap=sitemapEntries([globalThis.previewFixture],{indexable:true,canonicalOrigin:'https://das-reiseportal.com',siteName:'DAS Reiseportal'});
 assert.ok(sitemap.every(row=>!row.url.includes('designvorschau')));
 const chrome=readFileSync(new URL('../src/components/portal/chrome.tsx',import.meta.url),'utf8');assert.match(chrome,/Profil-Designvorschau/);assert.match(chrome,/href="\/designvorschau\/unternehmensprofil" prefetch=\{false\}/);
 const route=readFileSync(new URL('../src/app/(energieheld)/designvorschau/unternehmensprofil/page.tsx',import.meta.url),'utf8');assert.doesNotMatch(route,/save|update\(|insert\(|delete\(|checkAdmin|user_metadata/);assert.match(route,/loadAccommodationPage\('unternehmen-6cd02/);
});

test('existing CMS text and original gallery pairing are rendered without changing blocks or stored description',()=>{
 const blocks=[{id:'heading',profile_id:globalThis.previewFixture.id,type:'heading',slot:'about_heading',sort_order:0,content:{text:'Bestehende redaktionelle Überschrift'}},{id:'extra',profile_id:globalThis.previewFixture.id,type:'text',slot:null,sort_order:1,content:{text:'Vollständiger zusätzlicher CMS-Abschnitt.'}}];
 const before=JSON.stringify({blocks,listing:globalThis.previewFixture});
 const html=renderToStaticMarkup(createElement(ProfileDesignPreview,{listing:globalThis.previewFixture,blocks}));
 assert.match(html,/Bestehende redaktionelle Überschrift/);assert.match(html,/Vollständiger zusätzlicher CMS-Abschnitt/);assert.match(html,/Zweiter vollständiger Absatz/);assert.match(html,/src="\/pond.jpg"/);
 assert.equal(JSON.stringify({blocks,listing:globalThis.previewFixture}),before);
});
