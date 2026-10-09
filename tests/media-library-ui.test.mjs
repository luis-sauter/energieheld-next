import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {transpileModule,ModuleKind,JsxEmit} from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
registerHooks({resolve(s,c,n){
 if(s==='next/image')return {url:'data:text/javascript,export default "img"',shortCircuit:true};
 if(s==='next/navigation')return {url:'data:text/javascript,export function useRouter(){return {refresh(){}}}',shortCircuit:true};
 if(s.endsWith('.module.css'))return {url:'data:text/javascript,export default {}',shortCircuit:true};
 if(s.endsWith('/admin/mediathek/actions'))return {url:'data:text/javascript,export const applyLibraryAsset=async()=>({}),archiveLibraryAsset=applyLibraryAsset,deleteLibraryAsset=applyLibraryAsset,libraryProfiles=applyLibraryAsset,searchLibraryProfiles=applyLibraryAsset,loadLibrary=applyLibraryAsset,updateLibraryAsset=applyLibraryAsset,uploadLibrary=applyLibraryAsset',shortCircuit:true};
 if(s.startsWith('@/')||s.startsWith('.')){const url=s.startsWith('@/')?new URL('../src/'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of ['.ts','.tsx'])if(existsSync(new URL(url.href+ext)))return n(url.href+ext,c);}
 return n(s,c);
},load(url,c,n){if(url.endsWith('.tsx'))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText};return n(url,c);}});
const {MediaLibraryBrowser}=await import('../src/components/admin/media-library-browser.tsx');
const {MediaLibraryProvider}=await import('../src/components/admin/media-library-context.tsx');
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('central and contextual view render one shared accessible browser with upload/search/filter/pagination',()=>{
 for(const props of [{},{initialProfileId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',target:{profileId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',kind:'gallery',capacity:3},onClose(){}}]){
 const html=renderToStaticMarkup(createElement(MediaLibraryBrowser,props));
 for(const text of ['Mediathek','Bilder in dieser Auswahl suchen','Bilder hochladen','Unternehmen','Alle Bildtypen','Nicht verwendete Medien','Werbebanner','Bilder werden geladen','Mediathek-Seiten'])assert.ok(html.includes(text));
 assert.match(html,/type="file"[^>]*multiple/);assert.doesNotMatch(html,/type="submit"/);assert.doesNotMatch(html,/Bilder oder Unternehmen suchen|Ich habe die Nutzungsrechte/);
 if(props.target){assert.match(html,/3 Bildplätze verfügbar/);assert.match(html,/Ausgewählte Bilder verwenden/);assert.match(html,/Abbrechen/);}
 }
});
test('provider keeps editor children, adds a closed native dialog and mounts heavy browser only when opened',()=>{
 const html=renderToStaticMarkup(createElement(MediaLibraryProvider,{profileId:'profile'},createElement('input',{defaultValue:'Nicht gespeicherter Text'})));
 assert.match(html,/Nicht gespeicherter Text/);assert.match(html,/<dialog/);assert.doesNotMatch(html,/<dialog[^>]*open|Bilder hochladen/);
 const s=source('src/components/admin/media-library-context.tsx');assert.match(s,/initialProfileId={profileId}/);assert.ok(s.includes('returnFocus.current?.focus()'));assert.ok(s.includes('if (!applied.current) await target?.onCancel'));
});
test('all existing image entry points carry context, preserving crop tools and owner file workflow',()=>{
 for(const file of ['use-inline-admin-media.tsx','inline-image-grid-editor.tsx','paired-image-editor.tsx','inline-content-editor.tsx','admin-media-editor.tsx'])assert.match(source('src/components/admin/'+file),/library.open/);
 const contact=source('src/components/auth/contact-image-editor.tsx');assert.match(contact,/library.open/);assert.match(contact,/type="file"/);
 const grid=source('src/components/admin/inline-image-grid-editor.tsx');assert.match(grid,/InlineImageCropEditor/);assert.match(grid,/replacementId/);assert.match(grid,/history.clear/);
 const browser=source('src/components/admin/media-library-browser.tsx');assert.match(browser,/uploadPreparedAdminMedia/);assert.match(browser,/loading="lazy"/);
 const css=source('src/components/admin/media-library.module.css');assert.match(css,/max-width:600px/);assert.ok(css.includes('repeat(2,minmax(0,1fr))'));assert.match(css,/focus-visible/);
});
