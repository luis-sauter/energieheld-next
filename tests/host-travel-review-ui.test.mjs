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
 if(s==='next/link')return {url:'data:text/javascript,export default "a"',shortCircuit:true};
 if(s.endsWith('.css'))return {url:'data:text/javascript,export default {}',shortCircuit:true};
 if(s.endsWith('/admin/actions'))return {url:'data:text/javascript,export async function approveTravelProfile(...a){globalThis.__hostDecisions.push(["approved",...a]);return {success:"Published"}};export async function rejectTravelProfile(...a){globalThis.__hostDecisions.push(["rejected",...a]);return {success:"Feedback saved"}}',shortCircuit:true};
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
