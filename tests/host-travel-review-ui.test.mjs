import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync,readFileSync } from 'node:fs';
import { transpileModule,ModuleKind,JsxEmit,ScriptTarget } from 'typescript';
const states=new Map();let active='',cursor=0,context=null;const tasks=[];
globalThis.__hostHooks={
 useState(initial){const bucket=states.get(active);const index=cursor++;if(!(index in bucket))bucket[index]=typeof initial==='function'?initial():initial;return [bucket[index],next=>{bucket[index]=typeof next==='function'?next(bucket[index]):next}]},
 useTransition(){const [pending,setPending]=this.useState(false);return [pending,fn=>{setPending(true);tasks.push(Promise.resolve(fn()).finally(()=>setPending(false)))}]},
 useContext(){return context},
 useActionState(action,initial){const [state,setState]=this.useState(initial);return [state,async()=>setState(await action()),false]},
};
globalThis.__hostDecisions=[];globalThis.__hostSubmission={};
registerHooks({resolve(s,c,next){
 if(s==='react'&&c.parentURL?.includes('/src/components/'))return {url:'data:text/javascript,export function createContext(){return {}};export const useState=(...a)=>globalThis.__hostHooks.useState(...a);export const useTransition=(...a)=>globalThis.__hostHooks.useTransition(...a);export const useContext=(...a)=>globalThis.__hostHooks.useContext(...a);export const useActionState=(...a)=>globalThis.__hostHooks.useActionState(...a)',shortCircuit:true};
 if(s==='next/navigation')return {url:'data:text/javascript,export function useRouter(){return {refresh(){}}}',shortCircuit:true};
    if(s==='next/link')return {url:'data:text/javascript,export default "a"',shortCircuit:true};
 if(s.endsWith('.css'))return {url:'data:text/javascript,export default {}',shortCircuit:true};
 if(s.endsWith('/admin/actions'))return {url:'data:text/javascript,export async function setProfilePublication(id,publish,revision,proposals){globalThis.__hostDecisions.push([publish?"approved":"withdrawn",id,revision,proposals]);return {success:"Published"}};export async function rejectTravelProfile(...a){globalThis.__hostDecisions.push(["rejected",...a]);return {success:"Feedback saved"}}',shortCircuit:true};
 if(s.endsWith('/gestalten/actions'))return {url:'data:text/javascript,export async function submitFirstPublication(){return globalThis.__hostSubmission}',shortCircuit:true};
 if(s.startsWith('@/')||s.startsWith('.')){const b=s.startsWith('@/')?new URL('../src/'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of ['.ts','.tsx'])if(existsSync(new URL(b.href+ext)))return next(b.href+ext,c)}return next(s,c);
},load(u,c,next){if(/\.tsx?$/.test(u))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(u),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX,target:ScriptTarget.ES2022}}).outputText};return next(u,c)}});
const {TravelReviewProvider}=await import('../src/components/admin/travel-review-context.tsx');
const {TravelTaxonomyEditor}=await import('../src/components/admin/travel-taxonomy-editor.tsx');
const {ReviewActions}=await import('../src/components/admin/review-actions.tsx');
const {CompanyPublication}=await import('../src/components/auth/company-publication.tsx');
function render(key,component,props={}){active=key;cursor=0;if(!states.has(key))states.set(key,[]);return component(props)}
function nodes(element,predicate){if(!element||typeof element!=='object')return [];if(Array.isArray(element))return element.flatMap(e=>nodes(e,predicate));return [...(predicate(element)?[element]:[]),...nodes(element.props?.children,predicate)]}
function text(element){if(element==null||typeof element==='boolean')return '';if(typeof element==='string'||typeof element==='number')return String(element);if(Array.isArray(element))return element.map(text).join('');return text(element.props?.children)}
const terms=[{term_key:'theme:wanderurlaub',dimension:'theme',label:'Wandern'},{term_key:'accommodation:hotel',dimension:'accommodation',label:'Hotel'},{term_key:'feature:pool',dimension:'feature',label:'Pool'}];
const snapshot={terms,assignedKeys:['theme:wanderurlaub'],proposedKeys:['accommodation:hotel'],revision:3};
function reset(){states.clear();context=null;tasks.length=0;globalThis.__hostDecisions=[]}
const button=(tree,label)=>nodes(tree,e=>e.type==='button'&&text(e)===label)[0];

test('real local selection changes preview immediately without save; dirty/pending/error block publication; explicit save updates revision',async()=>{
 reset();const calls=[];let result={error:'Conflict: reload'};
 const refresh=()=>{context=render('provider',TravelReviewProvider,{snapshot,children:null,saveAction:async(...args)=>{calls.push(args);return result}}).props.value;return context};
 refresh();assert.deepEqual(context.selected,['theme:wanderurlaub']);assert.equal(context.dirty,false);
 let editor=render('editor',TravelTaxonomyEditor);const hotel=nodes(editor,e=>e.type==='label'&&text(e).startsWith('Hotel'))[0];nodes(hotel,e=>e.type==='input')[0].props.onChange();refresh();
 assert.equal(context.dirty,true);assert.equal(calls.length,0);assert.deepEqual(context.assignedKeys,['theme:wanderurlaub']);editor=render('editor',TravelTaxonomyEditor);
 assert.match(text(editor),/Ausgewählt · noch nicht gespeichert/);assert.ok(nodes(editor,e=>e.props?.href==='/unterkuenfte-a-z?unterkunftstyp=hotel').length);
 let actions=render('actions',ReviewActions,{profileId:'profile',status:'pending',canReview:true});assert.equal(button(actions,'Profil veröffentlichen').props.disabled,true);assert.match(text(actions),/zuerst die Reisezuordnungen/);
 button(editor,'Reisezuordnungen speichern').props.onClick();refresh();assert.equal(context.busy,true);assert.equal(button(render('actions',ReviewActions,{profileId:'profile',status:'pending',canReview:true}),'Profil veröffentlichen').props.disabled,true);
 await Promise.all(tasks);refresh();assert.equal(context.dirty,true);assert.deepEqual(context.assignedKeys,snapshot.assignedKeys);assert.equal(context.message.success,undefined);
 result={success:'Saved',assignedKeys:['theme:wanderurlaub','accommodation:hotel'],revision:5};context.save();await Promise.all(tasks);refresh();
 assert.equal(context.dirty,false);assert.equal(context.revision,5);assert.deepEqual(calls.at(-1),[['theme:wanderurlaub','accommodation:hotel'],snapshot.assignedKeys,snapshot.proposedKeys,3]);
 actions=render('actions',ReviewActions,{profileId:'profile',status:'pending',canReview:true});assert.equal(button(actions,'Profil veröffentlichen').props.disabled,false);
 button(actions,'Profil veröffentlichen').props.onClick();refresh();assert.equal(context.busy,true);await Promise.all(tasks);assert.deepEqual(globalThis.__hostDecisions,[['approved','profile',5,snapshot.proposedKeys]]);
});

test('concrete feedback uses same stored revision/proposals; unavailable pending decisions explain why; approved has no first approval',async()=>{
 reset();context={revision:7,proposedKeys:['accommodation:hotel'],dirty:false,busy:false,setDeciding:()=>{}};
 const props={profileId:'profile',status:'pending',canReview:true};let tree=render('feedback',ReviewActions,props);button(tree,'Rückfrage an Gastgeber').props.onClick();tree=render('feedback',ReviewActions,props);
 assert.match(text(tree),/Was soll der Gastgeber ergänzen oder ändern/);const field=nodes(tree,e=>e.type==='textarea')[0];assert.equal(field.props.required,true);assert.equal(field.props.maxLength,4000);field.props.onChange({target:{value:'Please add an exterior photo'}});
 tree=render('feedback',ReviewActions,props);nodes(tree,e=>e.type==='form')[0].props.onSubmit({preventDefault(){}});await Promise.all(tasks);assert.deepEqual(globalThis.__hostDecisions,[['rejected','profile',7,'Please add an exterior photo',['accommodation:hotel']]]);
 context=null;
 for(const [key,p,reason]of [['denied',{...props,canReview:false,expectedRevision:7},'Portal-Adminrechte'],['missing',props,'Profilstand fehlt']]){const tree=render(key,ReviewActions,p);assert.equal(button(tree,'Profil veröffentlichen').props.disabled,true);assert.match(text(tree),new RegExp(reason));}
 assert.equal(button(render('approved',ReviewActions,{...props,status:'approved'}),'Profil veröffentlichen'),undefined);
});

test('submission confirmation is persisted pending or actual server success, never errors; approved hides first submission',async()=>{
 reset();let tree=render('publication',CompanyPublication,{status:'draft'});assert.ok(button(tree,'Profil zur Prüfung einreichen'));assert.doesNotMatch(text(tree),/wurde zur Prüfung eingereicht/);
 globalThis.__hostSubmission={error:'Could not save'};await nodes(tree,e=>e.type==='form')[0].props.action();tree=render('publication',CompanyPublication,{status:'draft'});assert.match(text(tree),/Could not save/);assert.doesNotMatch(text(tree),/wurde zur Prüfung eingereicht/);
 globalThis.__hostSubmission={submitted:true,success:'Saved'};await nodes(tree,e=>e.type==='form')[0].props.action();tree=render('publication',CompanyPublication,{status:'draft'});assert.match(text(tree),/Ihr Profil wurde zur Prüfung eingereicht/);assert.equal(button(tree,'Profil zur Prüfung einreichen'),undefined);
 assert.match(text(render('reloaded',CompanyPublication,{status:'pending'})),/Wartet auf redaktionelle Prüfung/);assert.equal(render('public',CompanyPublication,{status:'approved'}),null);
});

test('first editorial selection of Peter-like proposals is dirty; explicit save/reload confirms only chosen terms; true no-op never calls save',async()=>{
 reset();
 const keys=['accommodation:camping','accommodation:ferienwohnung','audience:familie','theme:campingurlaub','theme:golfurlaub','theme:radwandern','theme:urlaub-am-wasser'];
 const allTerms=[...keys,'theme:wanderurlaub'].map(k=>({term_key:k,dimension:k.split(':')[0],label:k.split(':')[1]}));
 let current={terms:allTerms,assignedKeys:[],proposedKeys:keys,revision:20};const calls=[];
 const refresh=()=>{context=render('peter-provider',TravelReviewProvider,{snapshot:current,children:null,saveAction:async(...args)=>{calls.push(args);return {success:'Reisezuordnungen gespeichert.',assignedKeys:[...args[0]].sort(),revision:23}}}).props.value;return render('peter-editor',TravelTaxonomyEditor)};
 let tree=refresh();assert.equal(nodes(tree,e=>e.type==='input'&&e.props.type==='checkbox'&&e.props.checked).length,0);
 assert.equal(nodes(tree,e=>e.type==='small'&&['Bereits bestätigt','Bestätigt und gespeichert'].includes(text(e))).length,0);assert.match(text(tree),/Noch keine Reisezuordnungen gespeichert/);
 assert.equal(button(tree,'Reisezuordnungen speichern').props.disabled,true);context.save();await Promise.all(tasks);assert.equal(calls.length,0);
 context.toggle('accommodation:camping');context.toggle('audience:familie');context.toggle('theme:wanderurlaub');tree=refresh();
 assert.equal(context.dirty,true);assert.equal(button(tree,'Reisezuordnungen speichern').props.disabled,false);
 assert.match(text(tree),/Zur Übernahme ausgewählt · noch nicht gespeichert/);assert.match(text(tree),/Vorschlag · nicht übernommen/);
 assert.ok(nodes(tree,e=>e.props?.href==='/unterkuenfte-a-z?thema=wanderurlaub').length);
 assert.equal(nodes(tree,e=>e.props?.href==='/unterkuenfte-a-z?thema=golfurlaub').length,0);
 assert.equal(calls.length,0);button(tree,'Reisezuordnungen speichern').props.onClick();await Promise.all(tasks);tree=refresh();
 assert.equal(context.dirty,false);assert.equal(context.revision,23);assert.equal(calls.length,1);assert.deepEqual(calls[0][1],[]);assert.deepEqual(calls[0][2],keys);
 assert.match(text(tree),/Bereits bestätigt/);assert.match(text(tree),/Alle ausgewählten Zuordnungen sind bereits gespeichert/);
 context.save();await Promise.all(tasks);assert.equal(calls.length,1);
 current={...current,assignedKeys:[...context.assignedKeys],revision:context.revision};states.clear();tree=refresh();
 assert.equal(context.dirty,false);assert.deepEqual(context.selected,current.assignedKeys);assert.equal(button(tree,'Reisezuordnungen speichern').props.disabled,true);
 assert.equal(nodes(tree,e=>e.type==='input'&&e.props.type==='checkbox'&&e.props.checked).length,3);
 assert.equal(globalThis.__hostDecisions.length,0);
});

test('compact profile picker uses confirmed terms and explicit save; cancel restores the saved selection', () => {
  const snapshot = { terms: [{term_key:'theme:radwandern',dimension:'theme',label:'Radwandern'},{term_key:'audience:familie',dimension:'audience',label:'Familie'}], assignedKeys:['theme:radwandern'], proposedKeys:['audience:familie'], revision:4 };
  const props = { snapshot, saveAction:async()=>({}), children:null };
  context = render('compact-context',TravelReviewProvider,props).props.value;
  const initial = render('compact-picker',TravelTaxonomyEditor,{compact:true,published:true});
  assert.equal(initial.type,'details');
  const inputs = nodes(initial,n=>n.type==='input'&&n.props.type==='checkbox');
  assert.equal(inputs.length,2); assert.equal(inputs.filter(n=>n.props.checked).length,1);
  context.toggle('audience:familie'); context = render('compact-context',TravelReviewProvider,props).props.value; assert.equal(context.dirty,true);
  context.reset(); context = render('compact-context',TravelReviewProvider,props).props.value; assert.equal(context.dirty,false); assert.deepEqual(context.selected,['theme:radwandern']);
});


test('fresh server revision updates clean picker while preserving dirty changes and their conflict snapshot', () => {
  reset();
  const props = {snapshot,saveAction:async()=>({}),children:null};
  const refresh = p => { context=render('sync-context',TravelReviewProvider,p).props.value; return context; };
  refresh(props);
  const newer={...snapshot,revision:8,assignedKeys:['accommodation:hotel']};
  refresh({...props,snapshot:newer});refresh({...props,snapshot:newer});
  assert.equal(context.revision,8); assert.deepEqual(context.selected,newer.assignedKeys);
  context.toggle('feature:pool');refresh({...props,snapshot:newer});
  const concurrent={...newer,revision:9,assignedKeys:['theme:wanderurlaub']};
  refresh({...props,snapshot:concurrent});refresh({...props,snapshot:concurrent});
  assert.equal(context.revision,8);assert.deepEqual(context.selected,['accommodation:hotel','feature:pool']);assert.equal(context.dirty,true);
});

test('compact selection has no filters and stays open when toggles return to the saved selection',()=>{
 reset();const props={snapshot,saveAction:async()=>({}),children:null};const refresh=()=>{context=render('sticky-provider',TravelReviewProvider,props).props.value;return render('sticky-picker',TravelTaxonomyEditor,{compact:true})};
 let tree=refresh();assert.equal(nodes(tree,e=>e.type==='select'||e.props?.type==='search').length,0);assert.equal(tree.props.open,false);
 tree.props.onToggle({currentTarget:{open:true}});tree=refresh();assert.equal(tree.props.open,true);
 context.toggle('feature:pool');refresh();context.toggle('feature:pool');tree=refresh();assert.equal(context.dirty,false);assert.equal(tree.props.open,true);
 tree.props.onToggle({currentTarget:{open:false}});assert.equal(refresh().props.open,false);
});

test('ownerless editorial drafts offer publication; published shows public link and withdrawal, not repeated approval',()=>{
 reset();context={revision:3,dirty:false,busy:false,proposedKeys:[]};
 assert.ok(button(render('draft',ReviewActions,{profileId:'profile',status:'draft',canReview:true,canPublishDraft:true}),'Profil veröffentlichen'));
 assert.equal(button(render('owner-draft',ReviewActions,{profileId:'profile',status:'draft',canReview:true}),'Profil veröffentlichen'),undefined);
 const published=render('published',ReviewActions,{profileId:'profile',status:'approved',listed:true,slug:'real-profile',canReview:true});
 assert.equal(button(published,'Profil veröffentlichen'),undefined);assert.ok(button(published,'Veröffentlichung zurücknehmen'));
 assert.equal(nodes(published,n=>n.type==='a')[0].props.href,'/unterkuenfte/real-profile');
 assert.ok(button(render('withdrawn',ReviewActions,{profileId:'profile',status:'approved',listed:false,canReview:true}),'Profil veröffentlichen'));
});
