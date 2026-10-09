import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {transpileModule,ModuleKind,JsxEmit} from 'typescript';
let slots=[],cursor=0,effects=[],calls=[],reduced=false;
const current='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const asset={id:'image',name:'Eigenes Bild',profile_id:current,profile_name:'Pension Sonnenhof',bucket_id:'company-media',rights:'',archived_at:null,src:'',usages:[],storage_path:'picture.png'};
globalThis.__mediaUX={
 state(v){const i=cursor++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},
 ref(v){const i=cursor++;if(!(i in slots))slots[i]={current:v};return slots[i];},
 effect(fn,deps){const i=cursor++;const prior=slots[i];if(!prior||deps.some((v,j)=>v!==prior.deps[j])){prior?.cleanup?.();slots[i]={deps};effects.push(()=>{slots[i].cleanup=fn();});}},
 async search(q,page){calls.push(['search',q,page]);return {items:q==='missing'?[]:[{id:current,display_name:'Pension Sonnenhof'}],more:false};},
 async profiles(){return {items:[{id:current,display_name:'Pension Sonnenhof'}]};},
 async load(profile,kind,q){calls.push(['load',profile,kind,q]);return {items:[asset],count:1};},
 async apply(id,target){calls.push(['apply',id,target]);return {success:'Saved'};}
};
registerHooks({resolve(s,c,n){const stub=x=>({url:'data:text/javascript,'+encodeURIComponent(x),shortCircuit:true});
 if(s==='react'&&/media-library-(browser|company-picker)\.tsx$/.test(c.parentURL??''))return stub('export const useState=v=>globalThis.__mediaUX.state(v),useRef=v=>globalThis.__mediaUX.ref(v),useEffect=(f,d)=>globalThis.__mediaUX.effect(f,d),useId=()=>"picker",startTransition=f=>f();');
 if(s.endsWith('/admin/mediathek/actions'))return stub('export const searchLibraryProfiles=(...a)=>globalThis.__mediaUX.search(...a),libraryProfiles=()=>globalThis.__mediaUX.profiles(),loadLibrary=(...a)=>globalThis.__mediaUX.load(...a),applyLibraryAsset=(...a)=>globalThis.__mediaUX.apply(...a),updateLibraryAsset=async()=>({success:"Saved"}),archiveLibraryAsset=async()=>({}),deleteLibraryAsset=async()=>({}),uploadLibrary=async()=>({});');
 if(s==='next/image')return stub('export default "img"');if(s.endsWith('.module.css'))return stub('export default new Proxy({}, {get:(_,k)=>k})');
 if(s.startsWith('@/')||s.startsWith('.')){const u=s.startsWith('@/')?new URL('../src/'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of ['.ts','.tsx'])if(existsSync(new URL(u.href+ext)))return n(u.href+ext,c);}return n(s,c);
},load(u,c,n){if(/\.tsx?$/.test(u))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(u),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText};return n(u,c);}});
const {MediaLibraryCompanyPicker}=await import('../src/components/admin/media-library-company-picker.tsx');
const {MediaLibraryBrowser}=await import('../src/components/admin/media-library-browser.tsx');
const {revealMediaDetails,restoreMediaGrid}=await import('../src/lib/media-library-navigation.ts');
const nodes=n=>Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];
const text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props?.children):n??'';
function fixture(Component,props){slots=[];cursor=0;effects=[];calls=[];
 globalThis.document={addEventListener(){},removeEventListener(){},getElementById(){return null;}};globalThis.window={matchMedia:()=>({matches:reduced})};
 const dom={scrollTop:120,scrollTo(v){calls.push(['scroll',v]);this.scrollTop=v.top;},getBoundingClientRect(){return {top:20};},focus(v){calls.push(['focus',v]);},contains(){return true;},querySelector(){return null;}};
 function render(){cursor=0;const tree=Component(props);for(const node of nodes(tree))if(node.props?.ref)node.props.ref.current=node.type==='h3'?{...dom,getBoundingClientRect:()=>({top:620})}:dom;const pending=effects;effects=[];pending.forEach(f=>f());return tree;}
 return {dom,render,all:()=>nodes(render()),button:label=>nodes(render()).find(n=>n.type==='button'&&text(n)===label),async settle(ms=10){render();await new Promise(r=>setTimeout(r,ms));return render();}};
}
test('company dropdown searches on demand; arrows/Enter choose, Escape and mouse return focus; no results remain understandable',async()=>{
 let chosen;const f=fixture(MediaLibraryCompanyPicker,{value:current,name:'Pension Sonnenhof',disabled:false,onChange:c=>chosen=c});
 assert.match(text(f.render()),/Pension Sonnenhof/);assert.equal(calls.filter(c=>c[0]==='search').length,0);
 f.all().find(n=>n.props?.['aria-haspopup']).props.onClick();await f.settle();
 let input=f.all().find(n=>n.props?.role==='combobox');assert.equal(input.props['aria-controls'],'picker-list');
 input.props.onChange({target:{value:'Sonnen'}});await f.settle(210);assert.deepEqual(calls.find(c=>c[0]==='search'&&c[1]==='Sonnen'),['search','Sonnen',1]);
 input=f.all().find(n=>n.props?.role==='combobox');input.props.onKeyDown({key:'ArrowDown',preventDefault(){}});f.render();input=f.all().find(n=>n.props?.role==='combobox');assert.equal(input.props['aria-activedescendant'],'picker-option-1');input.props.onKeyDown({key:'Enter',preventDefault(){}});assert.equal(chosen.id,current);assert.equal(f.all().some(n=>n.props?.role==='combobox'),false);
 f.all().find(n=>n.props?.['aria-haspopup']).props.onClick();await f.settle();f.all().find(n=>n.props?.role==='option'&&n.props.children==='Alle Unternehmen').props.onClick();assert.equal(chosen.id,'');
 f.all().find(n=>n.props?.['aria-haspopup']).props.onClick();await f.settle();f.all().find(n=>n.props?.role==='combobox').props.onChange({target:{value:'missing'}});await f.settle(210);assert.match(text(f.render()),/Keine Unternehmen gefunden/);
 const menu=f.all().find(n=>n.props?.className==='companyMenu');let stopped=false;menu.props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){stopped=true;}});assert.equal(stopped,true);assert.equal(f.all().some(n=>n.props?.role==='combobox'),false);assert.ok(calls.some(c=>c[0]==='focus'&&c[1].preventScroll));
});
test('current profile loads automatically; image search and company switch retain filters but clear selected images',async()=>{
 const f=fixture(MediaLibraryBrowser,{initialProfileId:current,target:{profileId:current,kind:'gallery',capacity:2}});f.render();await f.settle();assert.match(text(f.render()),/Pension Sonnenhof/);assert.ok(calls.some(c=>c[0]==='load'&&c[1]===current));
 f.all().find(n=>n.props?.['aria-label']==='Eigenes Bild auswählen').props.onClick();assert.equal(f.button('Ausgewählte Bilder verwenden').props.disabled,false);
 f.all().find(n=>n.type===MediaLibraryCompanyPicker).props.onChange({id:other,display_name:'Andere Firma'});await f.settle();assert.equal(f.button('Ausgewählte Bilder verwenden').props.disabled,true);assert.ok(calls.some(c=>c[0]==='load'&&c[1]===other));
 f.all().find(n=>n.type==='input'&&n.props.type==='search').props.onChange({target:{value:'Berg'}});await f.settle(280);assert.ok(calls.some(c=>c[0]==='load'&&c[3]==='Berg'));
});
test('details focus/scroll locally, close restores grid/selection, repeated opening works and apply delegates once',async()=>{
 let applied=0;const f=fixture(MediaLibraryBrowser,{initialProfileId:current,target:{profileId:current,kind:'gallery',capacity:1},onApplied(){applied++;}});f.render();await f.settle();
 f.all().find(n=>n.props?.['aria-label']==='Eigenes Bild auswählen').props.onClick();const trigger={focus:v=>calls.push(['trigger-focus',v])};f.button('Bilddetails & Verwendung').props.onClick({currentTarget:trigger});f.render();assert.match(text(f.render()),/Bilddetails/);assert.ok(calls.some(c=>c[0]==='scroll'&&c[1].behavior==='smooth'));assert.ok(calls.some(c=>c[0]==='focus'&&c[1].preventScroll));
 const NativeFormData=globalThis.FormData;globalThis.FormData=class extends NativeFormData{constructor(){super();}};try{f.all().find(n=>n.type==='form').props.onSubmit({preventDefault(){},currentTarget:{}});await f.settle();await f.settle();}finally{globalThis.FormData=NativeFormData;}assert.equal(f.button('Ausgewähltes Bild verwenden').props.disabled,false);f.button('Bilddetails & Verwendung').props.onClick({currentTarget:trigger});f.render();f.button('Details schließen').props.onClick();assert.equal(f.button('Ausgewähltes Bild verwenden').props.disabled,false);assert.ok(calls.some(c=>c[0]==='trigger-focus'&&c[1].preventScroll));
 reduced=true;f.button('Bilddetails & Verwendung').props.onClick({currentTarget:trigger});f.render();assert.equal(calls.filter(c=>c[0]==='scroll').at(-1)[1].behavior,'instant');f.button('Details schließen').props.onClick();f.button('Ausgewähltes Bild verwenden').props.onClick();await f.settle();assert.equal(applied,1);assert.equal(calls.filter(c=>c[0]==='apply').length,1);reduced=false;
});
test('navigation never uses window scrolling or scrollIntoView; reduced motion and restoring exact scroll position',()=>{
 const events=[];const container={scrollTop:80,getBoundingClientRect:()=>({top:100}),scrollTo:v=>events.push(v)},heading={getBoundingClientRect:()=>({top:500}),focus:v=>events.push(v)};
 revealMediaDetails(container,heading,true);assert.deepEqual(events,[{preventScroll:true},{top:456,behavior:'instant'}]);restoreMediaGrid(container,heading,80);assert.deepEqual(events.slice(-2),[{top:80,behavior:'instant'},{preventScroll:true}]);
});

test('banner context selects without applying/creating a campaign and permits profile-less upload',async()=>{
 let picked,uploaded;
 const f=fixture(MediaLibraryBrowser,{onSelected(a){picked=a;},onUpload(file){uploaded=file;}});f.render();await f.settle();
 assert.equal(f.button('Bilder hochladen').props.disabled,false);
 f.all().find(n=>n.props?.['aria-label']==='Eigenes Bild auswählen').props.onClick();f.button('Ausgewähltes Bild verwenden').props.onClick();await f.settle();assert.equal(picked.id,asset.id);assert.equal(calls.some(c=>c[0]==='apply'),false);
 const file=new File(['bytes'],'upload.png',{type:'image/png'});
 f.all().find(n=>n.type==='input'&&n.props.type==='file').props.onChange({target:{files:[file],value:'file'}});await f.settle();assert.equal(uploaded,file);assert.equal(calls.some(c=>c[0]==='apply'),false);
 assert.doesNotMatch(text(f.render()),/Zusätzliche Nutzungserlaubnis|Beleg der Nutzungserlaubnis/);
});
