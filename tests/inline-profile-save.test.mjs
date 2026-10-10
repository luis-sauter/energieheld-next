import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {transpileModule,ModuleKind,ScriptTarget} from 'typescript';
registerHooks({resolve(s,c,next){
 const stub=code=>({url:'data:text/javascript,'+encodeURIComponent(code),shortCircuit:true});
 if(c.parentURL?.endsWith('/inline-profile-save.ts')&&s==='./admin-profile')return stub('export async function updateAdminCompanyProfile(client,id,form){client.writes++;return client.result}');
 if(c.parentURL?.endsWith('/inline-profile-save.ts')&&s==='./admin-review')return stub('export async function checkAdmin(client){return client.access}');
 if(c.parentURL?.endsWith('/inline-profile-save.ts')&&s==='./profile-freshness')return stub('export async function loadAdminProfileFreshness(client){return client.states.shift()}');
 if(s.startsWith('.')){const b=new URL(s,c.parentURL);if(existsSync(new URL(b.href+'.ts')))return next(b.href+'.ts',c)}return next(s,c);
},load(u,c,next){if(u.endsWith('.ts'))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(u),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,target:ScriptTarget.ES2022}}).outputText};return next(u,c)}});
const {saveInlineProfileFields}=await import('../src/lib/inline-profile-save.ts');
const fresh={content_revision:4,reviewed_at:null,review_invalidated_at:null};
function fixture({access='admin',current='Hotel',revision=4,after=4,readError=null}={}){
 const form=new FormData();form.set('display_name','Hotel');form.set('editor_revision',String(revision));
 const client={access,writes:0,result:{access,success:'Saved'},states:[fresh,{...fresh,content_revision:after}],from(){return {select(){return this},eq(){return this},maybeSingle:async()=>({data:{display_name:current},error:readError})}}};return {client,form};
}
test('existing fields-only no-op preserves exact revision; own real change increments once',async()=>{
 for(const [current,after] of [['Hotel',4],['Old name',5]]){const {client,form}=fixture({current,after});const r=await saveInlineProfileFields(client,'id',form);assert.equal(r.freshness.content_revision,after);assert.equal(client.writes,1);}
});
test('stale/invalid snapshot, invalid input, denied roles and failed read prevent mutation',async()=>{
 for(const options of [{revision:3},{revision:0},{access:'owner'},{access:'guest'},{readError:{message:'offline'}}]){const {client,form}=fixture(options);const r=await saveInlineProfileFields(client,'id',form);assert.equal(r.success,undefined);assert.equal(client.writes,0);}
 const {client,form}=fixture();form.set('display_name','');assert.ok((await saveInlineProfileFields(client,'id',form)).error);assert.equal(client.writes,0);
});
test('unexpected concurrent content or review change never returns a usable reviewed snapshot',async()=>{
 for(const patch of [{content_revision:6},{reviewed_at:'2026-10-10'},{review_invalidated_at:'2026-10-10'}]){const {client,form}=fixture();client.states[1]={...fresh,...patch};const r=await saveInlineProfileFields(client,'id',form);assert.equal(client.writes,1);assert.ok(r.error);assert.equal(r.success,undefined);assert.equal(r.freshness,undefined);}
});
test('failed field save stops orchestration; existing callers without editor snapshot keep their original save',async()=>{
 const {client,form}=fixture();client.result={access:'admin',error:'Validation failed'};const r=await saveInlineProfileFields(client,'id',form);assert.equal(r.error,'Validation failed');assert.equal(client.states.length,1);
 form.delete('editor_revision');client.result={access:'admin',success:'Saved'};assert.equal((await saveInlineProfileFields(client,'id',form)).success,'Saved');assert.equal(client.states.length,1);
});
