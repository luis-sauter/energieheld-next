import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {registerHooks,createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transpileModule,ModuleKind,JsxEmit} from 'typescript';
const require=createRequire(import.meta.url);
const reactUrl=pathToFileURL(require.resolve('react')).href;
let states=[],cursor=0;
globalThis.__cropHooks={state(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];}};
registerHooks({
 resolve(specifier,context,next){
  if(specifier.endsWith('/admin/mediathek/actions'))return {shortCircuit:true,url:'data:text/javascript,export async function searchLibraryProfiles(){throw Error("Unexpected remote company search")};export async function createLibraryCompany(){throw Error("Unexpected company creation")}'};
  if(specifier==='react' && context.parentURL?.endsWith('.tsx'))return{shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(`import * as R from ${JSON.stringify(reactUrl)};export const Children=R.Children,cloneElement=R.cloneElement,isValidElement=R.isValidElement,useId=R.useId,useMemo=R.useMemo,createContext=R.createContext,useContext=R.useContext,useActionState=R.useActionState;export const useState=v=>globalThis.__cropHooks.state(v),useRef=v=>({current:v}),useEffect=()=>{};`)};
  if(specifier.endsWith('/admin/werbung/actions'))return{shortCircuit:true,url:'data:text/javascript,export async function lifecycleCampaign(){throw Error("Unexpected lifecycle mutation during crop test")}'};
  if(specifier==='next/navigation')return{shortCircuit:true,url:'data:text/javascript,export function useRouter(){return {refresh(){}}}'};
  if(specifier==='next/link')return{shortCircuit:true,url:'data:text/javascript,export default "a"'};
  if(specifier.endsWith('/supabase/client'))return{shortCircuit:true,url:'data:text/javascript,export function createClient(){if(globalThis.inlineArchiveMedia)return globalThis.inlineArchiveMedia;throw Error("Unexpected upload")}'};
  if(specifier.endsWith('.module.css'))return{shortCircuit:true,url:'data:text/javascript,export default new Proxy({}, {get:(_,key)=>key})'};
  if(specifier.startsWith('@/')||specifier.startsWith('.')){
   const url=specifier.startsWith('@/')?new URL('../src/'+specifier.slice(2),import.meta.url):new URL(specifier,context.parentURL);
   for(const ext of ['.ts','.tsx'])if(existsSync(new URL(url.href+ext)))return next(url.href+ext,context);
  }return next(specifier,context);
 },load(url,context,next){if(url.endsWith('.tsx'))return{shortCircuit:true,format:'module',source:transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText};return next(url,context);}
});
const {BannerSearchFields}=await import('../src/components/advertising/banner-search-fields.tsx');
const {ImageCropControls}=await import('../src/components/admin/image-crop-controls.tsx');
const {BannerMediaPicker}=await import('../src/components/advertising/banner-media-picker.tsx');
const {InlineBannerDialog}=await import('../src/components/advertising/inline-banner-editor.tsx');
const {CampaignSlot}=await import('../src/components/advertising/campaign-view.tsx');
const {CampaignLifecycle}=await import('../src/components/advertising/campaign-lifecycle.tsx');
function nodes(node){if(!node)return[];if(Array.isArray(node))return node.flatMap(nodes);if(typeof node!=='object')return[];return[node,...nodes(node.props?.children)];}
const find=(tree,predicate)=>nodes(tree).find(predicate);
const render=(props)=>{cursor=0;return InlineBannerDialog(props);};

test('archive choice replaces new-upload fields and inserts chosen archived banner through the bound reuse action',async()=>{
 states=[];let inserted;const calls=[];
 const props={selected:{placement:'sidebar_12'},options:{label:'Schweiz',availability:{},archived:[{id:'original',name:'Historischer Banner'}],reuse:async form=>{calls.push(Object.fromEntries(form));return {success:'ok',ad:{id:'copy',headline:'Historischer Banner',placement:'sidebar_12'},metadata:{name:'Historischer Banner',city:'Ort',postal_code:'12345',term_keys:['theme:wandern']}};}},onSaved:(ad,metadata)=>inserted={ad,metadata},onClose(){}};
 let tree=render(props);find(tree,n=>n.type==='input'&&n.props.type==='radio'&&!n.props.checked).props.onChange();
 tree=render(props);assert.equal(find(tree,n=>n.type==='input'&&n.props.type==='file'),undefined);
 const select=find(tree,n=>n.type==='select'&&n.props.required);select.props.onChange({target:{value:'original'}});
 tree=render(props);assert.equal(find(tree,n=>n.type==='input'&&n.props.type==='checkbox'),undefined);
 await find(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});
 assert.deepEqual(calls,[{archived_id:'original',placement:'sidebar_12',size:'large',confirmed:'yes'}]);assert.equal(inserted.ad.id,'copy');assert.equal(inserted.metadata.city,'Ort');
});
test('legacy archive copies only verified displayed media via existing upload/save/crop then existing archive action',async()=>{
 states=[];const calls=[],originalFetch=globalThis.fetch;
 globalThis.fetch=async url=>{calls.push(['fetch',url]);return new Response(new Blob(['fixture'],{type:'image/png'}));};
 globalThis.inlineArchiveMedia={storage:{from:bucket=>({upload:async(path,blob,options)=>{calls.push(['upload',bucket,path,options.upsert]);return {error:null};}})}};
 try{
 const banner={id:'legacy-source',source:'legacy',placement:'sidebar_top',imageUrl:'/images/legacy.png',target_url:'https://example.org',size:'small',shared:false,crop:{focus_x:20,focus_y:70,zoom:1.3},metadata:{name:'Legacy',postal_code:'',city:'',term_keys:[]}};
 const props={selected:{placement:banner.placement,banner},options:{label:'Startseite',availability:{},prepare:async form=>{calls.push(['prepare',Object.fromEntries(form)]);return {campaignId:'copy',uploadPath:'campaigns/copy/creative/new.png'};},save:async form=>{calls.push(['save',Object.fromEntries(form)]);return {success:'ok',ad:{id:'copy',source:'campaign'}};},saveCrop:async form=>{calls.push(['crop',Object.fromEntries(form)]);return {success:'ok'};},archive:async form=>{calls.push(['archive',Object.fromEntries(form)]);return {success:'ok'};}},onChanged(){},onRemoved(){},onClose(){}};
 const action=find(render(props),n=>n.type===CampaignLifecycle).props.onArchive;
 assert.ok((await action(new FormData())).error);assert.deepEqual(calls,[]);
 const confirmation=new FormData();confirmation.set('confirmed','yes');assert.ok((await action(confirmation)).success);
 assert.deepEqual(calls.map(c=>c[0]),['fetch','prepare','upload','save','crop','archive']);assert.equal(calls[1][1].legacy_id,'legacy-source');assert.equal(calls[2][3],false);assert.equal(calls.at(-1)[1].campaign_id,'copy');assert.equal(calls.at(-1)[1].legacy_id,undefined);assert.equal(calls.at(-2)[1].focus_x,'20');
 }finally{globalThis.fetch=originalFetch;delete globalThis.inlineArchiveMedia;}
});
test('categories start collapsed, count selected values, retain multiple choices through closing/re-render/reload',()=>{
 const terms=Array.from({length:50},(_,i)=>({term_key:'theme:t'+i,label:'Thema '+i,dimension:'theme'}));
 let value={name:'Banner',postal_code:'12345',city:'Ort',term_keys:['theme:t1','theme:t2']};
 const render=()=>BannerSearchFields({value,terms,onChange:next=>value=next});
 let tree=render();assert.equal(find(tree,n=>n.type==='details').props.open,undefined);
 assert.deepEqual(find(tree,n=>n.type==='summary').props.children,['Kategorien · ',2,' ausgewählt']);
 find(tree,n=>n.type==='input'&&n.props.value==='theme:t3').props.onChange({target:{checked:true}});
 tree=render();assert.equal(find(tree,n=>n.type==='input'&&n.props.value==='theme:t1').props.checked,true);
 assert.equal(find(tree,n=>n.type==='summary').props.children[1],3);
 find(tree,n=>n.type==='input'&&n.props.value==='theme:t2').props.onChange({target:{checked:false}});
 tree=render();assert.deepEqual(value.term_keys,['theme:t1','theme:t3']);assert.equal(find(tree,n=>n.type==='details').props.open,undefined);
 const css=readFileSync(new URL('../src/components/advertising/banner-search-fields.module.css',import.meta.url),'utf8');
 assert.match(css,/summary:focus-visible/);assert.match(css,/max-height: 280px/);assert.match(css,/overflow-y: auto/);
});
test('shared profile/banner crop controls execute pan, arrows, zoom, center and reset, and block changes during save',()=>{
 let crop={focus_x:50,focus_y:50,zoom:1};const setCrop=value=>crop=typeof value==='function'?value(crop):value;
 const render=(disabled=false)=>ImageCropControls({crop,setCrop,ratio:350/120,disabled,renderImage:()=>null});
 let tree=render();const frame=find(tree,n=>n.props?.onPointerDown);
 const target={getBoundingClientRect:()=>({width:350,height:120}),setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){}};
 frame.props.onPointerDown({pointerType:'touch',pointerId:1,clientX:0,clientY:0,currentTarget:target,preventDefault(){}});
 frame.props.onPointerMove({pointerId:1,clientX:35,clientY:-12,currentTarget:target});assert.equal(crop.focus_x,30);assert.equal(crop.focus_y,70);
 frame.props.onPointerUp({pointerId:1,clientX:35,clientY:-12,currentTarget:target});
 tree=render();find(tree,n=>n.props?.['aria-label']==='Zoom erhöhen').props.onClick();assert.equal(crop.zoom,1.1);
 tree=render();find(tree,n=>n.type==='button'&&n.props.children==='Zentrieren').props.onClick();assert.deepEqual(crop,{focus_x:50,focus_y:50,zoom:1.1});
 tree=render();find(tree,n=>n.props?.['aria-label']==='Bild nach rechts').props.onClick();assert.equal(crop.focus_x,45);
 tree=render();find(tree,n=>n.type==='button'&&n.props.children==='Zurücksetzen').props.onClick();assert.deepEqual(crop,{focus_x:50,focus_y:50,zoom:1});
 assert.ok(nodes(render(true)).filter(n=>n.type==='button').every(n=>n.props.disabled));
});
test('dialog crop is opt-in, sizes update immediately; crop-only save uses presentation action, shared banner hides crop',async()=>{
 states=[];const calls=[];let saved;
 const banner={id:'existing',source:'campaign',placement:'sidebar_top',imageUrl:'/existing.png',target_url:'https://example.org',size:'small',shared:false,editorial:true,metadata:{name:'Existing',postal_code:'',city:'',term_keys:[]}};
 const props={selected:{placement:banner.placement,banner},options:{label:'Startseite',banners:[banner],availability:{},saveMetadata:async()=>{throw Error('Crop must not mutate search metadata');},saveCrop:async form=>{calls.push(Object.fromEntries(form));return{success:'ok'};},save:async()=>{throw Error('Crop must not save campaign');}},onSaved:ad=>saved=ad,onMetadataSaved(){},onClose(){}};
 let tree=render(props);let controls=find(tree,n=>n.type===ImageCropControls);assert.equal(controls.props.ratio,350/120);
 assert.equal(find(tree,n=>n.type===CampaignSlot).props.ad.crop,undefined);
 find(tree,n=>n.type==='select'&&n.props.value==='small').props.onChange({target:{value:'medium'}});
 tree=render(props);assert.ok(Math.abs(find(tree,n=>n.type===ImageCropControls).props.ratio-350/235)<1e-12);
 find(tree,n=>n.type==='select'&&n.props.value==='medium').props.onChange({target:{value:'small'}});
 controls=find(render(props),n=>n.type===ImageCropControls);controls.props.setCrop({focus_x:25,focus_y:75,zoom:1.5});
 tree=render(props);assert.deepEqual(find(tree,n=>n.type===CampaignSlot).props.ad.crop,{focus_x:25,focus_y:75,zoom:1.5});
 await find(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});
 assert.equal(calls.length,1);assert.equal(calls[0].campaign_id,'existing');assert.equal(calls[0].focus_x,'25');assert.equal(calls[0].focus_y,'75');assert.equal(calls[0].zoom,'1.5');assert.deepEqual(saved.crop,{focus_x:25,focus_y:75,zoom:1.5});
 states=[];tree=render({...props,selected:{placement:banner.placement,banner:{...banner,shared:true}}});assert.equal(find(tree,n=>n.type===ImageCropControls),undefined);
 states=[];tree=render({...props,selected:{placement:banner.placement}});assert.equal(find(tree,n=>n.type===ImageCropControls),undefined);
});



test('new local image previews before upload and Premium uses natural ratio',async()=>{
 states=[];let submitted=0;
 const props={selected:{placement:'top_banner'},options:{label:'Reiseziele',banners:[],availability:{},saveMetadata:async()=>({success:'ok'}),saveCrop:async()=>({error:'Crop fehlgeschlagen'}),save:async()=>{submitted++;return{success:'ok',ad:{id:'new',placement:'top_banner',imageUrl:'/saved.png',target_url:'https://example.org',source:'campaign'}};}},onSaved(){throw Error('Must not report successful crop');},onClose(){}};
 let tree=render(props);
 find(tree,n=>n.type==='button'&&n.props.children==='Bild hinzufügen').props.onClick();
 tree=render(props);
 const picker=find(tree,n=>n.type===BannerMediaPicker);
 assert.ok(picker,'existing shared media picker is available');
 picker.props.onSelected(new File(['image'],'new.png',{type:'image/png'}));
 tree=render(props);const measure=find(tree,n=>n.type==='img'&&n.props.hidden);assert.match(measure.props.src,/^blob:/);
 measure.props.onLoad({currentTarget:{naturalWidth:2048,naturalHeight:333}});
 tree=render(props);assert.equal(find(tree,n=>n.type===ImageCropControls).props.ratio,2048/333);
 assert.match(find(tree,n=>n.type===CampaignSlot).props.ad.imageUrl,/^blob:/);
 assert.equal(submitted,0,'local preview does not upload');
 URL.revokeObjectURL(measure.props.src);
});
test('public rendering uses crop only when explicit, retains natural legacy and signed URLs, meaningful alt and clickable creative',()=>{
 const ad={id:'test',placement:'sidebar_top',image_path:'private/path',imageUrl:'https://private.example/image?token=test',headline:'Banner name',body_text:null,target_url:'https://example.org',banner_size:'small',image_width:350,image_height:120};
 const normal=renderToStaticMarkup(createElement(CampaignSlot,{placement:ad.placement,ad}));
 assert.doesNotMatch(normal,/cropFrame|cropImage|scale\(/);assert.match(normal,/width="350" height="120"/);
 const cropped=renderToStaticMarkup(createElement(CampaignSlot,{placement:ad.placement,ad:{...ad,crop:{focus_x:25,focus_y:75,zoom:1.5}}}));
 assert.match(cropped,/cropFrame/);assert.match(cropped,/object-position:25% 75%/);assert.match(cropped,/scale\(1.5\)/);assert.match(cropped,/alt="Banner name"/);
 assert.match(cropped,/rel="sponsored noopener noreferrer" target="_blank"/);assert.match(cropped,/private.example/);
 assert.match(cropped,/loading="lazy" decoding="async"/);
});

test('crop save failure reports error and does not close or claim success',async()=>{
 states=[];let closed=false;
 const banner={id:'existing',source:'campaign',placement:'sidebar_top',imageUrl:'/existing.png',target_url:'https://example.org',size:'small',shared:false,metadata:{name:'Existing',postal_code:'',city:'',term_keys:[]}};
 const props={selected:{placement:banner.placement,banner},options:{label:'Mottoreisen',banners:[banner],availability:{},saveCrop:async()=>({error:'Crop fehlgeschlagen'})},onSaved:()=>closed=true,onClose:()=>closed=true};
 let tree=render(props);find(tree,n=>n.type===ImageCropControls).props.setCrop({focus_x:20,focus_y:80,zoom:2});
 tree=render(props);await find(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});
 assert.equal(closed,false);assert.equal(find(render(props),n=>n.props?.role==='alert').props.children,'Crop fehlgeschlagen');
});


test('loaded draft exposes truthful status, ordinary save preserves it, explicit publish uses existing save; cancel writes nothing',async()=>{
 states=[];const calls=[];let saved,closed=false;
 const banner={id:'existing',source:'campaign',placement:'sidebar_top',imageUrl:'/existing.png',target_url:'https://example.org',size:'small',shared:false,editorial:true,status:'draft',requested_start_date:'2026-10-10',requested_end_date:'9999-12-31',updated_at:'saved-version',metadata:{name:'Höflehner',postal_code:'',city:'',term_keys:['theme:natur']}};
 const props={selected:{placement:banner.placement,banner},options:{label:'Startseite',banners:[banner],availability:{},saveMetadata:async form=>{calls.push({metadata:Object.fromEntries(form)});return{success:'ok'};},save:async form=>{calls.push({save:Object.fromEntries(form)});return{success:'ok',ad:{...banner,status:'approved'}};}},onSaved:ad=>saved=ad,onMetadataSaved(){},onClose(){closed=true;}};
 let tree=render(props);assert.match(renderToStaticMarkup(tree),/Entwurf – nicht öffentlich/);
 const publish=find(tree,n=>n.type==='button'&&n.props.value==='publish');assert.ok(publish);
 await find(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.ok(calls[0].metadata);assert.equal(calls[0].metadata.intent,undefined);
 await find(render(props),n=>n.type==='form').props.onSubmit({preventDefault(){},nativeEvent:{submitter:{value:'publish'}}});
 assert.equal(calls[1].save.intent,'publish');assert.equal(calls[1].save.expected_updated_at,'saved-version');assert.equal(saved.status,'approved');
 const before=calls.length;find(render(props),n=>n.type==='button'&&n.props.children==='Abbrechen').props.onClick();assert.equal(closed,true);assert.equal(calls.length,before);
});

test('image replacement keeps stored crop, targets and URL through the actual media-picker/save path',async()=>{
 states=[];const calls=[];let saved;
 const banner={id:'existing',source:'campaign',placement:'sidebar_top',imageUrl:'/old.png',target_url:'https://example.org/old',size:'small',shared:false,editorial:true,status:'approved',crop:{focus_x:25,focus_y:75,zoom:1.5},metadata:{name:'Existing',postal_code:'12345',city:'Ort',term_keys:['theme:natur']}};
 const props={selected:{placement:banner.placement,banner},options:{label:'Startseite',banners:[banner],availability:{},prepare:async form=>{calls.push({prepare:Object.fromEntries(form)});return{campaignId:'existing',uploadPath:'new-image'};},save:async form=>{calls.push({save:Object.fromEntries(form)});return{success:'ok',ad:{...banner,image_path:'new-image',imageUrl:'/new.png'}};},saveCrop:async form=>{calls.push({crop:Object.fromEntries(form)});return{success:'ok'};}},onSaved:ad=>saved=ad,onClose(){}};
 globalThis.inlineArchiveMedia={storage:{from:()=>({upload:async()=>({error:null})})}};
 find(render(props),n=>n.type==='button'&&n.props.children==='Bild ersetzen').props.onClick();
 find(render(props),n=>n.type===BannerMediaPicker).props.onSelected(new File(['image'],'new.png',{type:'image/png'}));
 await find(render(props),n=>n.type==='form').props.onSubmit({preventDefault(){}});
 assert.equal(calls[1].save.target_url,banner.target_url);assert.equal(calls[1].save.banner_terms,'theme:natur');assert.equal(calls[1].save.campaign_id,'existing');
 assert.equal(calls[2].crop.zoom,'1.5');assert.deepEqual(saved.crop,banner.crop);
 delete globalThis.inlineArchiveMedia;
});

test('only opt-in homepage Premium reduces natural frame height by 20 percent without changing width or other slots',()=>{
 const ad={id:'premium',placement:'top_banner',headline:'Premium',imageUrl:'/wide.png',target_url:'https://example.org',image_width:1000,image_height:400};
 states=[];cursor=0;const html=renderToStaticMarkup(createElement(CampaignSlot,{placement:'top_banner',ad,compactPremium:true}));
 assert.match(html,/aspect-ratio:3.125/);assert.equal(1000/3.125,320);assert.match(html,/data-compact-premium="true"/);
 states=[];cursor=0;const standard=renderToStaticMarkup(createElement(CampaignSlot,{placement:'sidebar_top',ad:{...ad,placement:'sidebar_top'},compactPremium:true}));assert.doesNotMatch(standard,/cropFrame|data-compact-premium/);
});
