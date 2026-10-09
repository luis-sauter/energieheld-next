import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks,createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {existsSync,readFileSync} from 'node:fs';
import {transpileModule,ModuleKind,JsxEmit} from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const reactUrl=pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
let hookState=[],hookCursor=0;
globalThis.__editorPresentationHooks={state(initial){const i=hookCursor++;if(!(i in hookState))hookState[i]=typeof initial==='function'?initial():initial;return[hookState[i],value=>{hookState[i]=typeof value==='function'?value(hookState[i]):value}];},ref(initial){const i=hookCursor++;if(!(i in hookState))hookState[i]={current:initial};return hookState[i];}};
registerHooks({resolve(s,c,next){
 if(s==='react'&&c.parentURL?.endsWith('/inline-content-editor.tsx'))return{url:'data:text/javascript,'+encodeURIComponent(`export const useState=v=>globalThis.__editorPresentationHooks.state(v),useRef=v=>globalThis.__editorPresentationHooks.ref(v),useEffect=()=>{};`),shortCircuit:true};
 if(s.endsWith('/media-library-context')&&c.parentURL?.endsWith('/inline-content-editor.tsx'))return{url:'data:text/javascript,export function useMediaLibrary(){return null}',shortCircuit:true};
 if(s==='next/navigation')return{url:'data:text/javascript,export function useRouter(){return {refresh(){}}}',shortCircuit:true};
 if(s.endsWith('/inline-editor-history'))return{url:'data:text/javascript,export function useInlineEditorHistory(){return {busy:false,clear(){},record(){}}}',shortCircuit:true};
 if(s==='next/image')return{url:'data:text/javascript,'+encodeURIComponent(`import {createElement} from ${JSON.stringify(reactUrl)};export default function Image({fill,unoptimized,...props}){return createElement('img',props)}`),shortCircuit:true};
 if(s.endsWith('.module.css'))return{url:'data:text/javascript,export default new Proxy({}, {get:(_,key)=>key})',shortCircuit:true};
 if(s.startsWith('@/')||s.startsWith('.')){const base=s.startsWith('@/')?new URL('../src/'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of ['.ts','.tsx'])if(existsSync(new URL(base.href+ext)))return next(base.href+ext,c);}return next(s,c);
},load(url,c,next){if(/\.tsx?$/.test(url))return{shortCircuit:true,format:'module',source:transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText};return next(url,c);}});
const {ProfileContentBlocks,ProfileEditorialContent}=await import('../src/components/portal/profile-content-blocks.tsx');
const image={id:'photo',src:'/real-image.webp',alt_text:'Berge',caption:'Blick ins Tal',focus_x:30,focus_y:70,zoom:1.5};
const block=(id,type,width,offset,text='')=>({id,type,config:{width_percent:width,offset_percent:offset,columns:1,aspect_ratio:1.5,text_align:'left'},content:{text},images:type==='image_grid'?[image]:undefined});
for(const side of ['left','right'])for(const share of [25,50,75])test(`public pair ${side} ${share}/${100-share}: one heading/body column and stored crop/caption`,()=>{
 const textOffset=side==='left'?share:0,imageOffset=side==='left'?0:100-share;
 const heading=block('heading','heading',100-share,textOffset,'Überschrift'),text=block('text','text',100-share,textOffset,'Beschreibung'),img=block('image','image_grid',share,imageOffset);
 const blocks=side==='left'?[img,heading,text]:[heading,text,img];const before=JSON.stringify(blocks);
 const html=renderToStaticMarkup(createElement(ProfileContentBlocks,{blocks}));
 assert.match(html,new RegExp(`data-image-side="${side}"`));
 assert.ok(html.includes(`minmax(0, ${side==='left'?share:100-share}fr) minmax(0, ${side==='left'?100-share:share}fr)`));
 assert.match(html,/<div class="editorialText"[^>]*>[\s\S]*<h2>Überschrift<\/h2>[\s\S]*<p>Beschreibung<\/p>/);
 assert.match(html,/Blick ins Tal/);assert.match(html,/object-position:30% 70%/);assert.match(html,/scale\(1.5\)/);
 assert.equal(JSON.stringify(blocks),before);assert.equal((html.match(/data-text-image/g)||[]).length,1);
 assert.equal(html.indexOf('editorialImage')<html.indexOf('editorialText'),side==='left');
});
test('field-bound sections share the pair renderer, independent heading/body alignment and four real images',()=>{
 const img=block('image','image_grid',50,50);img.config.columns=2;img.images=Array.from({length:4},(_,i)=>({...image,id:'photo'+i}));
 for(const kind of ['about','business']){
 const item={key:'section:'+kind,kind,heading:'Abschnitt',headingAlign:'right',bodyAlign:'center',layout:{width_percent:50,offset_percent:0,text_align:'left'},imageBlock:img,pairLayout:{width_percent:75,offset_percent:25}};
 const html=renderToStaticMarkup(createElement(ProfileEditorialContent,{items:[item],listing:{description:'Beschreibung',businessAreas:'Bereiche'}}));
 assert.match(html,/data-text-image="true"/);assert.match(html,/<h2 style="text-align:right"/);assert.match(html,/<p style="text-align:center/);assert.equal((html.match(/<figure/g)||[]).length,4);
 }
});
test('editor uses the same surface, compact inline input and modal instead of expanded image tools',()=>{
 const source=readFileSync(new URL('../src/components/admin/inline-content-editor.tsx',import.meta.url),'utf8');
 assert.equal((source.match(/<TextImageSection/g)||[]).length,2);assert.doesNotMatch(source,/pairedImageTools|rowStyles/);
 assert.match(source,/setPairPreview\(\{ textId, imageId, side, share \}\)/);assert.match(source,/history\.record\(\{ kind: "text"/);
 const modal=readFileSync(new URL('../src/components/admin/paired-image-editor.tsx',import.meta.url),'utf8');
 assert.match(modal,/<BlockImageGrid block=\{block\}/);assert.match(modal,/<dialog/);assert.match(modal,/showModal\(\)/);assert.match(modal,/onCancel/);assert.match(modal,/trigger\.current\?\.focus/);assert.match(modal,/InlineImageGridEditor block=\{block\} saveAction=\{saveImage\} onBusyChange=\{onBusyChange\}/);
 const css=readFileSync(new URL('../src/components/portal/profile-content-blocks.module.css',import.meta.url),'utf8');assert.match(css,/editorialPair \{ display: grid; align-items: center; gap: clamp/);assert.match(css,/@media \(max-width: 640px\) \{\s*\.editorialPair \{ grid-template-columns: minmax\(0, 1fr\) !important/);
});
const {InlineContentEditor}=await import('../src/components/admin/inline-content-editor.tsx');
function nodes(node){if(!node)return[];if(Array.isArray(node))return node.flatMap(nodes);if(typeof node!=='object')return[];return[node,...nodes(node.props?.children),...nodes(node.props?.pairToolbar)];}
test('executed editor changes both sides and all ratios before saving finishes',async()=>{
 hookState=[];
 const blocks=[block('heading','heading',50,0,'Heading'),block('text','text',50,0,'Body'),block('image','image_grid',50,50)];
 const calls=[];let resolveSave;
 const props={blocks,items:blocks.map(block=>({kind:'block',key:block.id,block})),listing:{id:'profile'},renderSpecial:()=>null,editing:true,available:true,imagesAvailable:true,
 saveAction:form=>{calls.push(Object.fromEntries(form));return new Promise(resolve=>resolveSave=resolve)},saveImage:async()=>({success:'saved'})};
 const render=()=>{hookCursor=0;return InlineContentEditor(props)};
 for(const side of ['left','right'])for(const share of [25,50,75]){
 let tree=render();const sideButton=nodes(tree).find(n=>n.type==='button'&&n.props.children?.[0]==='Bild '&&n.props.children?.[1]===(side==='left'?'links':'rechts'));
 sideButton.props.onClick();tree=render();assert.match(renderToStaticMarkup(tree),new RegExp(`data-image-side="${side}"`));resolveSave({success:'saved'});await new Promise(resolve=>setImmediate(resolve));
 tree=render();const ratioButton=nodes(tree).find(n=>n.type==='button'&&n.props.children?.[0]===share&&n.props.children?.[1]===' % Bild / ');
 ratioButton.props.onClick();tree=render();const html=renderToStaticMarkup(tree);
 assert.ok(html.includes(`minmax(0, ${side==='left'?share:100-share}fr) minmax(0, ${side==='left'?100-share:share}fr)`));
 assert.match(html,/>Heading<\/textarea>/);assert.match(html,/>Body<\/textarea>/);
 resolveSave({success:'saved'});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.at(-1).intent,'pair-layout');assert.equal(calls.at(-1).text_block_id,'text');assert.equal(calls.at(-1).image_block_id,'image');
 }
});

test('paired portrait frames are bounded without mutating media, standalone frames remain intact',()=>{
 for(const share of [25,50,75]){
  const text=block('text','text',100-share,0,'Short body'),img=block('image','image_grid',share,100-share);
  img.config.aspect_ratio=0.6;const before=JSON.stringify(img);
  const pair=renderToStaticMarkup(createElement(ProfileContentBlocks,{blocks:[text,img]}));
  assert.match(pair,new RegExp('aspect-ratio:'+(share===75?'2':'1.5')));
  assert.match(pair,/src="\/real-image.webp"/);assert.match(pair,/object-fit:cover/);
  assert.equal(JSON.stringify(img),before);
  assert.match(renderToStaticMarkup(createElement(ProfileContentBlocks,{blocks:[img]})),/aspect-ratio:0.6/);
 }
});
test('paired secondary controls live in one closed section menu and image remains visible outside its dialog',()=>{
 hookState=[];hookCursor=0;
 const blocks=[block('heading','heading',50,0,'Heading'),block('text','text',50,0,'Body'),block('image','image_grid',50,50)];
 const html=renderToStaticMarkup(InlineContentEditor({blocks,items:blocks.map(block=>({kind:'block',key:block.id,block})),listing:{id:'profile'},renderSpecial:()=>null,editing:true,available:true,imagesAvailable:true,saveAction:async()=>({success:'saved'}),saveImage:async()=>({success:'saved'})}));
 assert.equal((html.match(/class="pairBar"/g)||[]).length,1);
 assert.match(html,/<details class="sectionMenu"><summary aria-label="Abschnitt bearbeiten">/);
 assert.doesNotMatch(html,/<details class="sectionMenu" open/);
 assert.match(html,/<details class="sectionMenu">[\s\S]*Duplizieren[\s\S]*Abschnitt ausblenden[\s\S]*Abschnitt löschen/);
 assert.match(html,/<div class="pairedImageEditor">[\s\S]*<img[\s\S]*Bild bearbeiten[\s\S]*<dialog/);
});

test('captionless image frame fills its grid column and paired typography cannot scroll or resize',()=>{
 const imageCss=readFileSync(new URL('../src/components/portal/profile-content-blocks.module.css',import.meta.url),'utf8');
 assert.match(imageCss,/\.frame \{ width: 100%; max-width: 100%/);
 const editorCss=readFileSync(new URL('../src/components/admin/inline-profile.module.css',import.meta.url),'utf8');
 assert.match(editorCss,/\.field textarea \{ overflow: hidden; resize: none; border: 0; padding: 0/);
 assert.match(imageCss,/max-width: 65ch/);
 assert.doesNotMatch(imageCss,/editorialPair[^}]*min-height/);
});

test('stored field-bound pairs render identically in editor and public view for both sides and 25/50/75 shares',()=>{
 for(const kind of ['about','business'])for(const side of ['left','right'])for(const share of [25,50,75]){
  const img=block('image','image_grid',share,side==='left'?0:100-share);
  const item={key:'section:'+kind,kind,heading:'Abschnitt',headingAlign:'center',bodyAlign:'left',layout:{width_percent:100-share,offset_percent:side==='left'?share:0,text_align:'left'},imageBlock:img,pairLayout:{width_percent:100,offset_percent:0,text_align:'left'}};
  const listing={id:'profile',description:'Beschreibung',businessAreas:'Bereiche'};
  const before=JSON.stringify(item);
  const publicHtml=renderToStaticMarkup(createElement(ProfileEditorialContent,{items:[item],listing}));
  hookState=[];hookCursor=0;
  const editorHtml=renderToStaticMarkup(InlineContentEditor({blocks:[img],items:[item],listing,renderSpecial:()=>createElement('p',null,'Beschreibung'),editing:true,available:true,imagesAvailable:true,saveAction:async()=>({}),saveImage:async()=>({})}));
  for(const html of [publicHtml,editorHtml]){
   assert.match(html,new RegExp(`data-image-side="${side}"`));
   assert.ok(html.includes(`minmax(0, ${side==='left'?share:100-share}fr) minmax(0, ${side==='left'?100-share:share}fr)`));
   assert.equal((html.match(/data-text-image="true"/g)||[]).length,1);
   assert.match(html,/src="\/real-image.webp"/);
  }
  assert.equal(JSON.stringify(item),before,'stored block metadata must remain unchanged');
 }
});
