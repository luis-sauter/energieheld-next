import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync,readFileSync} from 'node:fs';
import {transpileModule,ModuleKind,JsxEmit} from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
registerHooks({resolve(s,c,next){
 const stub=code=>({url:'data:text/javascript,'+encodeURIComponent(code),shortCircuit:true});
 if(s.endsWith('.module.css'))return stub('export default {}');
 if(s==='next/navigation')return stub('export const useRouter=()=>({refresh(){}});');
 if(s==='next/image'||s==='next/link')return stub('export default '+JSON.stringify(s==='next/image'?'img':'a'));
 if(s.includes('/admin/mediathek/actions'))return stub('export const initializeLibraryGallery=async()=>({});export const removeLibraryVideo=async()=>({});');
 if(s==='./media-library-context')return stub('export const useMediaLibrary=()=>null;');
 if(s==='@/lib/supabase/client')return stub('export const createClient=()=>({});');
 if(s.startsWith('@/')||s.startsWith('.')){const url=s.startsWith('@/')?new URL('../src/'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of ['.ts','.tsx'])if(existsSync(new URL(url.href+ext)))return next(url.href+ext,c);}
 return next(s,c);
},load(url,c,next){if(/\.tsx?$/.test(url))return{format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText};return next(url,c);}});
const {SearchAdCard}=await import('../src/components/advertising/search-ad-card.tsx');
const {useInlineAdminMedia}=await import('../src/components/admin/use-inline-admin-media.tsx');
const banner={banner_key:'ad',advertiser_key:'company',ad:{headline:'Test',placement:'sidebar_top',target_url:'https://advertiser.example/',imageUrl:'/original.jpg',image_width:350,image_height:120}};
test('search banner disclosure follows the unchanged creative, no public top-left label or edit button',()=>{const html=renderToStaticMarkup(createElement(SearchAdCard,{banner}));assert.ok(html.indexOf('Gesponserter Treffer · Anzeige')>html.indexOf('src="/original.jpg"'));assert.match(html,/rel="sponsored noopener noreferrer"/);assert.match(html,/href="https:\/\/advertiser.example\/"/);assert.doesNotMatch(html,/Banner bearbeiten/);assert.equal(html.includes(">Anzeige</span>"),false);assert.match(html,/Angebot anfragen/);assert.equal((html.match(/Gesponserter Treffer · Anzeige/g)||[]).length,1);});
test('admin search cards retain their existing edit action',()=>{const html=renderToStaticMarkup(createElement(SearchAdCard,{banner,onEdit(){}}));assert.match(html,/Banner bearbeiten: Test/);assert.match(html,/Gesponserter Treffer · Anzeige/);});
function Gallery({count=17,canonical=false,video=false}){const images=Array.from({length:count},(_,i)=>({id:'image-'+i,src:'/original-'+i+'.jpg',alt:'Original '+i}));const editor=useInlineAdminMedia({saveAction:async()=>({}),media:{images:canonical?images:[],...(video?{video:{src:'/own.mp4'}}:{})},rows:canonical?images.map(i=>({id:i.id,storage_path:i.src,alt_text:i.alt,sort_order:0})):[],profileName:'Unterkunft',initials:'U',profileId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',legacyImages:canonical?[]:images});return createElement('div',null,editor.galleryEditor);}
test('all 33 legacy images remain selectable in editor without pretending they are canonical rows',()=>{const html=renderToStaticMarkup(createElement(Gallery,{count:33}));assert.equal((html.match(/aria-label="Bild \d+: Original/g)||[]).length,33);assert.match(html,/Bestehende Galerie übernehmen und bearbeiten/);assert.doesNotMatch(html,/Noch keine Bilder vorhanden|Bild löschen|Bild ersetzen/);assert.match(html,/loading="lazy"/);});
test('canonical galleries retain image editing and addition without a legacy adoption action',()=>{const html=renderToStaticMarkup(createElement(Gallery,{count:6,canonical:true}));assert.match(html,/Bild ersetzen/);assert.match(html,/Bild löschen/);assert.match(html,/Bild hinzufügen/);assert.doesNotMatch(html,/Galerie übernehmen/);});
test('empty canonical editor still offers normal gallery addition',()=>{const html=renderToStaticMarkup(createElement(Gallery,{count:0,canonical:true}));assert.match(html,/Galeriebild hinzufügen/);assert.doesNotMatch(html,/Galerie übernehmen/);});
