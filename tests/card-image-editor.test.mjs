import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transpileModule,ModuleKind,JsxEmit,ScriptTarget} from 'typescript';
import vm from 'node:vm';
import * as jsx from 'react/jsx-runtime';
import * as crop from '../src/lib/image-crop.ts';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function load(p,stubs){const loaded={exports:{}};vm.runInNewContext(transpileModule(source(p),{compilerOptions:{module:ModuleKind.CommonJS,target:ScriptTarget.ES2022,jsx:JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module:loaded,exports:loaded.exports,require:name=>{if(name in stubs)return stubs[name];throw Error('Unexpected '+name);},console});return loaded.exports;}
const profile='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',asset='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
test('save validates verified admin, IDs and crop, writes only separate card reference, refreshes only on success',async()=>{
 let access='forbidden',writes=[],refreshes=[];
 const client={from(name){assert.equal(name,'company_profile_card_images');return {async upsert(row){writes.push(row);return {error:null};}}}};
 const {saveCardImage}=load('src/app/(energieheld)/card-image-actions.ts',{'@/lib/supabase/server':{createClient:async()=>client},'@/lib/admin-review':{checkAdmin:async()=>access,isProfileId:v=>typeof v==='string'&&/^[0-9a-f-]{36}$/.test(v)},'@/lib/image-crop':crop,'next/cache':{revalidatePath:(...args)=>refreshes.push(args)}});
 assert.ok((await saveCardImage(profile,asset,crop.DEFAULT_IMAGE_CROP)).error);assert.equal(writes.length,0);
 access='admin';assert.ok((await saveCardImage('bad',asset,crop.DEFAULT_IMAGE_CROP)).error);assert.ok((await saveCardImage(profile,asset,{focus_x:101,focus_y:50,zoom:1})).error);assert.equal(writes.length,0);
 assert.ok((await saveCardImage(profile,asset,{focus_x:25,focus_y:75,zoom:1.2})).success);
 assert.equal(writes.length,1);assert.equal(writes[0].asset_id,asset);assert.equal(writes[0].profile_id,profile);assert.equal(refreshes.length,1);
 assert.doesNotMatch(source('src/app/(energieheld)/card-image-actions.ts'),/company_profile_images|\.storage|service_role/);
});
function harness(){
 const state=[],refs=[],effects=[];let cursor=0,refcursor=0,saves=0,refreshes=0,focused=0,modal=false,current;
 const dialog={showModal(){modal=true;},close(){modal=false;current.props.onClose({target:dialog,currentTarget:dialog});}};
 const react={useState(init){const i=cursor++;if(!(i in state))state[i]=init;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];},useRef(init){const i=refcursor++;refs[i]??={current:init};return refs[i];},useEffect(fn){effects.push(fn);}};
 const {CardImageEditor}=load('src/components/portal/card-image-editor.tsx',{'react':react,'react/jsx-runtime':jsx,'next/dynamic.js':()=> 'LazyTool','next/navigation':{useRouter:()=>({refresh(){refreshes++;}})},'@/app/(energieheld)/card-image-actions':{saveCardImage:async()=>{saves++;return {success:'saved'};}},'@/lib/image-crop':crop,'./accommodation-card.module.css':{default:{edit:'edit'}}});
 const all=n=>Array.isArray(n)?n.flatMap(all):n&&typeof n==='object'?[n,...all(n.props?.children)]:[];
 function render(){cursor=0;refcursor=0;effects.length=0;const tree=CardImageEditor({profileId:profile,profileName:'Real provider'});current=all(tree).find(n=>n.type==='dialog');if(current)current.props.ref.current=dialog;for(const effect of effects)effect();return all(tree);}
 function open(){const button=render().find(n=>n.type==='button');button.props.onClick({currentTarget:{focus(){focused++;}}});return render();}
 return {render,open,dialog,counts:()=>({saves,refreshes,focused,modal})};
}
test('actual card edit/cancel closes native dialog and ignores descendant close/cancel events; reopen works',()=>{
 const h=harness();for(let i=0;i<3;i++){
  const nodes=h.open(),dialog=nodes.find(n=>n.type==='dialog');assert.equal(h.counts().modal,true);
  dialog.props.onClose({target:{},currentTarget:h.dialog});assert.ok(h.render().find(n=>n.type==='dialog'));
  dialog.props.onCancel({target:{},currentTarget:h.dialog,preventDefault(){throw Error('nested cancel swallowed');}});
  const browser=h.render().find(n=>n.type==='LazyTool');assert.equal(browser.props.initialProfileId,profile);assert.equal(browser.props.initialKind,'images');
  browser.props.onClose();assert.equal(h.counts().modal,false);assert.equal(h.render().filter(n=>n.type==='dialog').length,0);assert.equal(h.counts().saves,0);
 }
});
test('library selection and crop are preview-only until explicit save; unrelated images rejected',async()=>{
 const h=harness(),browser=h.open().find(n=>n.type==='LazyTool');
 const image={id:asset,profile_id:profile,kind:'gallery',bucket_id:'company-media',src:'/real.png',alt_text:'Real',archived_at:null};
 assert.throws(()=>browser.props.onSelected({...image,profile_id:'foreign'}));assert.throws(()=>browser.props.onSelected({...image,bucket_id:'ad-media'}));
 browser.props.onSelected(image);let nodes=h.render();assert.equal(h.counts().saves,0);assert.equal(nodes.find(n=>n.type==='LazyTool').props.ratio,35/32);
 const save=nodes.find(n=>n.type==='button'&&n.props.children==='Kartenbild speichern');await save.props.onClick();assert.equal(h.counts().saves,1);assert.equal(h.counts().refreshes,1);assert.equal(h.counts().modal,false);assert.equal(h.render().filter(n=>n.type==='dialog').length,0);
});

test('saved images load once in a signed batch and override only travel cards, with safe pre-migration fallback',async()=>{
 const listings=[{id:profile,images:[{src:'/gallery.png',alt:'Gallery'}],directoryImage:{src:'/directory.png',alt:'Directory'}},{id:asset,images:[]}];
 let rows=[{profile_id:profile,asset_id:asset,bucket_id:'company-media',storage_path:'profiles/'+profile+'/gallery/a.png',alt_text:'Chosen',focus_x:30,focus_y:60,zoom:1.3},{profile_id:asset,asset_id:asset,bucket_id:'project-media',storage_path:'/reiseportal/real.jpg',alt_text:'Historic',focus_x:50,focus_y:50,zoom:1}],queries=0,signings=0;
 const client={from(name){assert.equal(name,'company_profile_card_images');queries++;return {select(){return this;},async in(){return {data:rows,error:null};}};},storage:{from(bucket){assert.equal(bucket,'company-media');return {async createSignedUrls(paths){signings++;assert.equal(paths.length,1);return {data:paths.map(path=>({path,signedUrl:'https://signed.test/'+path}))};}};}}};
 const {withSavedCardImages}=load('src/lib/profile-card-images.ts',{'server-only':{},'react':{cache:fn=>fn},'./supabase/server':{createClient:async()=>client},'./supabase/public':{createPublicClient:()=>client},'./admin-review':{checkAdmin:async()=> 'forbidden'},'./image-crop':crop});
 const original=JSON.stringify(listings),saved=await withSavedCardImages(listings);
 assert.equal(queries,1);assert.equal(signings,1);assert.equal(saved[0].travelImage.alt,'Chosen');assert.equal(saved[0].cardImageCrop.zoom,1.3);assert.equal(saved[1].travelImage.src,'/reiseportal/real.jpg');assert.equal(JSON.stringify(listings),original);assert.deepEqual(saved[0].images,listings[0].images);assert.deepEqual(saved[0].directoryImage,listings[0].directoryImage);
 rows=[];assert.deepEqual(await withSavedCardImages(listings),listings);
});
