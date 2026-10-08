import test from 'node:test';import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';import {existsSync,readFileSync} from 'node:fs';import {transpileModule,ModuleKind,JsxEmit,ScriptTarget} from 'typescript';
registerHooks({resolve(s,c,next){
 if(s==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};
 if(s==='next/navigation')return {url:'data:text/javascript,export function redirect(p){throw Error("REDIRECT:"+p)}',shortCircuit:true};
 if(s==='next/cache')return {url:'data:text/javascript,export function revalidatePath(...args){globalThis.__hostSubmitInvalidations.push(args)}',shortCircuit:true};
 if(s.endsWith('/supabase/server'))return {url:'data:text/javascript,export async function createClient(){return globalThis.__hostSubmitClient}',shortCircuit:true};
 if(s.startsWith('@/')||s.startsWith('.')){const b=s.startsWith('@/')?new URL('../src/'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of ['.ts','.tsx'])if(existsSync(new URL(b.href+ext)))return next(b.href+ext,c)}return next(s,c);
},load(u,c,next){if(/\.tsx?$/.test(u))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(u),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX,target:ScriptTarget.ES2022}}).outputText};return next(u,c)}});
const {submitFirstPublication}=await import('../src/app/(energieheld)/firma/profil/gestalten/actions.ts');
function setup(status='draft',error=false){const profile={id:'own',display_name:'Own stay',status,description:'Actual info',company_profile_images:[{id:'media'}]};const writes=[];globalThis.__hostSubmitInvalidations=[];const client={profile,writes,auth:{getUser:async()=>({data:{user:{id:'verified-owner'}}})},from(table){let payload;const equals={};return {select(){return this},eq(k,v){equals[k]=v;return this},update(p){payload=p;return this},async maybeSingle(){if(payload){if(error)return {error:{message:'private'}};if(equals.status!==profile.status)return {data:null};writes.push(payload);Object.assign(profile,payload);return {data:{company_id:'company'}};}return {data:table==='companies'?{id:'company'}:{...profile}};}}}};globalThis.__hostSubmitClient=client;return client;}

test('first submission/resubmission returns persisted confirmation, keeps profile/media and invalidates only after success',async()=>{
 for(const status of ['draft','rejected']){const c=setup(status);const result=await submitFirstPublication();assert.equal(result.submitted,true);assert.equal(c.profile.status,'pending');assert.equal(c.profile.id,'own');assert.equal(c.profile.description,'Actual info');assert.deepEqual(c.profile.company_profile_images,[{id:'media'}]);assert.equal(c.writes.length,1);assert.ok(globalThis.__hostSubmitInvalidations.length>0)}
 const failed=setup('draft',true);const result=await submitFirstPublication();assert.ok(result.error);assert.equal(result.submitted,undefined);assert.equal(result.success,undefined);assert.equal(failed.profile.status,'draft');assert.equal(globalThis.__hostSubmitInvalidations.length,0);
});

test('pending reload/repeated or concurrent submission never writes twice; approved cannot be resubmitted; guest rejected',async()=>{
 const pending=setup('pending');assert.equal((await submitFirstPublication()).submitted,true);assert.equal(pending.writes.length,0);
 const concurrent=setup();const results=await Promise.all([submitFirstPublication(),submitFirstPublication()]);assert.equal(concurrent.writes.length,1);assert.equal(concurrent.profile.status,'pending');assert.ok(results.some(r=>r.submitted));
 const published=setup('approved');assert.ok((await submitFirstPublication()).error);assert.equal(published.writes.length,0);
 const guest=setup();guest.auth.getUser=async()=>({data:{user:null}});await assert.rejects(submitFirstPublication(),/REDIRECT:\/login/);assert.equal(guest.writes.length,0);
});

test('Owner onboarding, private feedback and Admin preparation order use existing routes; status-gated feedback avoids historical active notices',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const first=read('src/app/(energieheld)/firma/profil/page.tsx');assert.match(first,/Angaben zu Ihrer Unterkunft/);assert.match(first,/Schritt 1 von 2/);assert.match(first,/Unsere Redaktion unterstützt/);
 const second=read('src/app/(energieheld)/firma/profil/gestalten/page.tsx');assert.match(second,/Schritt 2 von 2/);assert.match(second,/Zeigen Sie uns Ihre Unterkunft/);assert.match(second,/bis zu 8 Galeriebilder/);assert.match(second,/CompanyProfileDesigner/);
 const company=read('src/app/(energieheld)/firma/page.tsx');assert.match(company,/status === "rejected" \? await loadReviewFeedback/);assert.match(company,/Unsere Redaktion hat eine Rückfrage/);
 const admin=read('src/app/(energieheld)/admin/firmen/[id]/page.tsx');assert.ok(admin.indexOf('id="angaben"')<admin.indexOf('id="reisezuordnungen"'));assert.ok(admin.indexOf('id="reisezuordnungen"')<admin.indexOf('id="verifizierung"'));assert.ok(admin.indexOf('id="verifizierung"')<admin.indexOf('id="pruefung"'));assert.equal((admin.match(/<ReviewActions /g)||[]).length,1);assert.match(admin,/bearbeiten=1/);
});
