import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {transpileModule,ModuleKind,JsxEmit} from 'typescript';

let active, creates=0;
globalThis.__dialogHooks={
 state(value){const i=active.cursor++;if(!(i in active.slots))active.slots[i]=typeof value==='function'?value():value;const instance=active;return [instance.slots[i],next=>{instance.slots[i]=typeof next==='function'?next(instance.slots[i]):next;}];},
 ref(value){const i=active.cursor++;return active.slots[i]??=( {current:value} );},
 effect(){},create(){creates++;return {};}
};
registerHooks({resolve(s,c,n){const stub=source=>({url:'data:text/javascript,'+encodeURIComponent(source),shortCircuit:true});
 if(s==='react'&&/(media-company-create|media-library-context|banner-media-picker)\.tsx$/.test(c.parentURL??''))return stub('export const useState=v=>globalThis.__dialogHooks.state(v),useRef=v=>globalThis.__dialogHooks.ref(v),useEffect=()=>{},createContext=()=>({Provider:"context"}),useContext=()=>null;');
 if(s==='next/dynamic.js')return stub('export default ()=>"library-browser";');
 if(s==='next/navigation')return stub('export const useRouter=()=>({refresh(){}});');
 if(s.endsWith('/admin/mediathek/actions'))return stub('export const createLibraryCompany=()=>globalThis.__dialogHooks.create();');
 if(s.endsWith('.module.css'))return stub('export default {};');
 if(s.startsWith('@/')||s.startsWith('.')){const u=s.startsWith('@/')?new URL('../src/'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of ['.ts','.tsx'])if(existsSync(new URL(u.href+ext)))return n(u.href+ext,c);}return n(s,c);
},load(u,c,n){if(/\.tsx?$/.test(u))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(u),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText};return n(u,c);}});
const {MediaCompanyCreate}=await import('../src/components/admin/media-company-create.tsx');
const {MediaLibraryProvider}=await import('../src/components/admin/media-library-context.tsx');
const {BannerMediaPicker}=await import('../src/components/advertising/banner-media-picker.tsx');
const nodes=n=>Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];
const label=n=>Array.isArray(n)?n.map(label).join(''):n&&typeof n==='object'?label(n.props?.children):n??'';

// Model native top-layer ownership and React's synthetic close/cancel propagation.
// This is an executable component regression, not a browser/real focus-trap claim.
function environment(){
 const topLayer=new Set();let focused,reset=0;
 const trigger={focus(){focused=trigger;}};
 globalThis.HTMLElement=class {};globalThis.document={activeElement:new HTMLElement()};
 function instance(Component,props){const state={slots:[],cursor:0};let tree,dialogNode;
  const native={open:false,showModal(){this.open=true;topLayer.add(this);},close(){if(!this.open)return;this.open=false;topLayer.delete(this);this.dispatch('close');},
   dispatch(type){const event={target:this,currentTarget:this,stopped:false,defaultPrevented:false,stopPropagation(){this.stopped=true;},preventDefault(){this.defaultPrevented=true;}};
    const lineage=[this];while(lineage.at(-1).parent)lineage.push(lineage.at(-1).parent);
    for(const node of lineage){event.currentTarget=node;node.props?.[type==='close'?'onClose':'onCancel']?.(event);if(event.stopped)break;}
    if(type==='cancel'&&!event.defaultPrevented)this.close();return event;
   }};
  function render(){active=state;state.cursor=0;tree=Component(props);dialogNode=nodes(tree).find(n=>n.type==='dialog');native.props=dialogNode.props;
   for(const node of nodes(tree)){if(node.props?.ref)node.props.ref.current=node.type==='dialog'?native:node.type==='form'?{reset(){reset++;}}:trigger;}return tree;}
  return {native,render,button:caption=>nodes(render()).find(n=>n.type==='button'&&label(n)===caption),nodes:()=>nodes(render())};
 }
 return {instance,topLayer,trigger,get focused(){return focused;},get reset(){return reset;}};
}

test('actual cancel handler in nested library never leaves an empty open parent/backdrop; closing library releases the final modal',async()=>{
 const env=environment();creates=0;
 const library=env.instance(MediaLibraryProvider,{profileId:'profile',children:'Profile page'});
 library.render().props.value.open({kind:'video'});library.render();assert.equal(env.topLayer.size,1);
 const company=env.instance(MediaCompanyCreate,{});company.render();company.native.parent=library.native;
 for(let cycle=0;cycle<3;cycle++){
  company.button('+ Neues Unternehmen hinzufügen').props.onClick();assert.equal(env.topLayer.size,2);
  company.button('Abbrechen').props.onClick();library.render();
  assert.equal(company.native.open,false);assert.equal(env.topLayer.size,1);
  assert.ok(library.nodes().some(n=>n.type==='library-browser'),'outer dialog retains content instead of an orphan gray backdrop');
  assert.equal(env.focused,env.trigger);
 }
 assert.equal(creates,0);assert.equal(env.reset,3);
 await library.nodes().find(n=>n.type==='library-browser').props.onClose();library.render();
 assert.equal(library.native.open,false);assert.equal(env.topLayer.size,0,'no modal/backdrop remains to block the page');
 assert.equal(library.nodes().some(n=>n.type==='library-browser'),false);
});

test('standalone company management/central library cancel releases its only modal and repeated Escape does not create a company',()=>{
 const env=environment();creates=0;const company=env.instance(MediaCompanyCreate,{});company.render();
 for(let cycle=0;cycle<3;cycle++){
  company.button('+ Neues Unternehmen hinzufügen').props.onClick();assert.equal(env.topLayer.size,1);
  if(cycle===1)company.native.dispatch('cancel');else company.button('Abbrechen').props.onClick();
  assert.equal(env.topLayer.size,0);assert.equal(company.native.open,false);assert.equal(env.focused,env.trigger);
 }
 assert.equal(creates,0);
});

test('outer library ignores descendant close/cancel events even when another child does not stop propagation',()=>{
 const env=environment();const library=env.instance(MediaLibraryProvider,{profileId:'profile'});
 library.render().props.value.open({kind:'gallery'});library.render();
 const foreign={};let prevented=false;
 library.native.props.onClose({target:foreign,currentTarget:library.native});
 library.native.props.onCancel({target:foreign,currentTarget:library.native,preventDefault(){prevented=true;}});
 assert.equal(prevented,false);assert.equal(library.native.open,true);assert.ok(library.nodes().some(n=>n.type==='library-browser'));
});

test('banner library Escape cancels only its own dialog, not a nested company dialog',()=>{
 const env=environment();let closed=0;const picker=env.instance(BannerMediaPicker,{onClose(){closed++;},onSelected(){}});picker.render();let prevented=false;
 picker.native.props.onCancel({target:{},currentTarget:picker.native,preventDefault(){prevented=true;}});assert.equal(closed,0);assert.equal(prevented,false);
 picker.native.props.onCancel({target:picker.native,currentTarget:picker.native,preventDefault(){prevented=true;}});assert.equal(closed,1);assert.equal(prevented,true);
});
