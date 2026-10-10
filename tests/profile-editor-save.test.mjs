import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';
let state=[], cursor=0, refreshes=0, clears=0;
globalThis.__profileSaveHooks={
 state(v){const i=cursor++;if(!(i in state))state[i]=typeof v==='function'?v():v;return[state[i],v=>state[i]=typeof v==='function'?v(state[i]):v]},
 ref(v){const i=cursor++;if(!(i in state))state[i]={current:v};return state[i]},
 refresh(){refreshes++},clear(){clears++}
};
registerHooks({resolve(s,c,next){
 const stub=code=>({url:'data:text/javascript,'+encodeURIComponent(code),shortCircuit:true});
 if(s==='react'&&c.parentURL?.endsWith('/inline-profile-editor.tsx'))return stub('export const useState=v=>globalThis.__profileSaveHooks.state(v),useRef=v=>globalThis.__profileSaveHooks.ref(v);');
 if(s.endsWith('/travel-review-context'))return stub('export function useTravelReview(){return globalThis.__profileTravel??null};export function TravelReviewProvider(){return null};');
 if(s.endsWith('/contact-image-editor'))return stub('export function ContactImageEditor(){return null}');
 if(s==='next/link')return stub('export default "a"');
 if(s==='next/navigation')return stub('export const useRouter=()=>({refresh:()=>globalThis.__profileSaveHooks.refresh()});');
 if(s.endsWith('/inline-editor-history'))return stub('export const InlineEditorHistoryContext={Provider:()=>null};export const useInlineEditorHistoryController=()=>({busy:false,state:{past:[],future:[]},feedback:{},clear:()=>globalThis.__profileSaveHooks.clear()});');
 if(s.endsWith('/use-inline-admin-media'))return stub('export const useInlineAdminMedia=()=>({busy:false});');
 if(s.endsWith('/listing-detail'))return stub('export function ListingDetail(){return null}');
 if(s.endsWith('/inline-content-editor'))return stub('export function InlineContentEditor(){return null}export function FixedHeadingEditor(){return null}export function SectionPartFrame(){return null}');
 if(s==='./profile-freshness')return stub('export function ProfileFreshness(){return null}');
 if(s==='./editorial-textarea')return stub('export function EditorialTextarea(){return null}');
 if(s.endsWith('.module.css'))return stub('export default new Proxy({}, {get:(_,k)=>k})');
 if(s.startsWith('@/')||s.startsWith('.')){const base=s.startsWith('@/')?new URL('../src/'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of ['.ts','.tsx'])if(existsSync(new URL(base.href+ext)))return next(base.href+ext,c)}return next(s,c);
},load(url,c,next){if(/\.tsx?$/.test(url))return{shortCircuit:true,format:'module',source:transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText};return next(url,c)}});
const {InlineProfileEditor}=await import('../src/components/admin/inline-profile-editor.tsx');
const nodes=n=>Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];
const text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props?.children):n??'';
function fixture(saveProfile){state=[];cursor=0;refreshes=0;clears=0;const props={listing:{name:'Profil',location:{}},categories:[],values:{display_name:'Profil'},media:{},rows:[],saveProfile,saveMedia:async()=>({}),contentBlocks:[],contentAvailable:false,imagesAvailable:false,saveContent:async()=>({}),saveBlockImage:async()=>({}),initialEditing:true,freshness:{}};
 const render=()=>{cursor=0;const wrapped=InlineProfileEditor(props);return wrapped.props.children.type(wrapped.props.children.props)};
 const form=()=>nodes(render()).find(n=>n.type==='form');
 const button=name=>nodes(render()).find(n=>n.type==='button'&&text(n)===name);
 const listing=()=>nodes(render()).find(n=>n.props?.inlineFields);
 const dirty=()=>listing().props.inlineFields.display_name.props.children[1].props.onChange({target:{value:'Changed'}});
 const submit=async(value)=>{const NativeFormData=globalThis.FormData;globalThis.FormData=class extends NativeFormData{constructor(){super();this.set('display_name','Changed')}};try{return await form().props.onSubmit({preventDefault(){},currentTarget:{},nativeEvent:{submitter:value?{value}:null}})}finally{globalThis.FormData=NativeFormData}};
 return{render,form,button,listing,dirty,submit,editing:()=>!!form()};
}
test('ordinary Save and keyboard submission use one handler, keep editor open and reset dirty',async()=>{
 for(const mode of ['stay',undefined]){let calls=0;const f=fixture(async data=>{calls++;assert.equal(data.get('display_name'),'Changed');return{success:'Gespeichert'}});f.dirty();await f.submit(mode);assert.equal(calls,1);assert.equal(f.editing(),true);assert.equal(refreshes,1);assert.match(text(f.render()),/Gespeichert/);assert.equal(nodes(f.render()).find(n=>n.props?.state&&n.props?.review===undefined).props.disabled,false);}
});
test('Save and close only closes after success, disables all actions and rejects a duplicate submit',async()=>{
 let calls=0,resolve;const f=fixture(()=>{calls++;return new Promise(r=>resolve=r)});f.dirty();const pending=f.submit('close');assert.equal(f.editing(),true);for(const name of ['Speichern und schließen','Abbrechen'])assert.equal(f.button(name).props.disabled,true);assert.match(text(f.render()),/Änderungen werden gespeichert/);await f.submit('close');assert.equal(calls,1);resolve({success:'Gespeichert'});await pending;assert.equal(f.editing(),false);assert.equal(refreshes,1);assert.equal(clears,1);assert.match(text(f.render()),/Gespeichert/);
});
test('validation/server errors and rejected saves keep editor, inputs, dirty and error feedback',async()=>{
 for(const save of [async()=>({error:'Validierung fehlgeschlagen'}),async()=>{throw new Error('network')},async()=>({success:'ambiguous',error:'Nicht gespeichert'})]){const f=fixture(save);f.dirty();const input=f.listing().props.inlineFields.display_name;await f.submit('close');assert.equal(f.editing(),true);assert.equal(refreshes,0);assert.equal(clears,0);assert.equal(f.listing().props.inlineFields.display_name.key,input.key);assert.ok(nodes(f.render()).some(n=>n.props?.role==='alert'));assert.equal(nodes(f.render()).find(n=>n.props?.state).props.disabled,true);assert.equal(f.button('Speichern und schließen').props.disabled,false);}
});
test('Cancel closes without invoking Save and retains its history-clearing semantics',()=>{let calls=0;const f=fixture(async()=>{calls++;return{}});f.dirty();f.button('Abbrechen').props.onClick();assert.equal(f.editing(),false);assert.equal(calls,0);assert.equal(refreshes,0);assert.equal(clears,1)});

test('contact uploads block both save intentions until completion and allow Save and close afterwards',async()=>{
 let saves=0;const f=fixture(async()=>{saves++;return{success:'Gespeichert'}});
 const contact=nodes(f.listing().props.contactPersonEditor).find(n=>n.type?.name==='ContactImageEditor');
 contact.props.onBusyChange(true);
 assert.equal(f.button('Speichern').props.disabled,true);assert.equal(f.button('Speichern und schließen').props.disabled,true);
 await f.submit('close');assert.equal(saves,0);assert.equal(f.editing(),true);
 contact.props.onBusyChange(false);await f.submit('close');assert.equal(saves,1);assert.equal(f.editing(),false);
});


test('unsaved travel selection prevents Save and close; cancel respects confirmation and resets only travel choices', async()=>{
 let saves=0,resets=0;const f=fixture(async()=>{saves++;return {success:'Saved'}});
 const originalWindow=globalThis.window;globalThis.__profileTravel={dirty:true,busy:false,reset(){resets++}};
 try{
  await f.submit('close');assert.equal(saves,0);assert.equal(f.editing(),true);assert.match(text(f.render()),/zuerst die Reisezuordnungen/);
  globalThis.window={confirm:()=>false};f.button('Abbrechen').props.onClick();assert.equal(f.editing(),true);assert.equal(resets,0);
  globalThis.window={confirm:()=>true};f.button('Abbrechen').props.onClick();assert.equal(f.editing(),false);assert.equal(resets,1);assert.equal(saves,0);
 }finally{globalThis.__profileTravel=null;globalThis.window=originalWindow;}
});
