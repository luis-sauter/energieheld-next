import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { transpileModule, ModuleKind, JsxEmit, ScriptTarget } from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
registerHooks({resolve(s,c,n){
 if(s.endsWith('.css'))return {url:'data:text/javascript,export default {}',shortCircuit:true};
 if(s.includes('/firma/profil/')&&s.endsWith('actions'))return {url:'data:text/javascript,export async function saveProfile(){return {}};export async function saveEditorialNote(){return {}}',shortCircuit:true};
 if(s.startsWith('@/')||s.startsWith('.')){const b=s.startsWith('@/')?new URL('../src/'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const e of ['.ts','.tsx'])if(existsSync(new URL(b.href+e)))return n(b.href+e,c)}return n(s,c);
},load(u,c,n){if(/\.tsx?$/.test(u))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(u),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX,target:ScriptTarget.ES2022}}).outputText};return n(u,c)}});
const {CompanyProfileForm}=await import('../src/components/auth/company-profile-form.tsx');
const {EditorialNoteForm}=await import('../src/components/auth/editorial-note-form.tsx');
const {loadOwnerTravelInput,saveOwnEditorialNote}=await import('../src/lib/owner-profile-input.ts');
const {updateOwnCompanyProfile,profileFields}=await import('../src/lib/company-profile.ts');
const terms=[['accommodation:hotel','accommodation','Hotel'],['audience:familie','audience','Familie'],['audience:paar','audience','Paar'],['audience:mit-hund','audience','Mit Hund'],['theme:radwandern','theme','Radwandern'],['audience:gruppe','audience','Gruppe'],['feature:pool','feature','Pool']].map(([term_key,dimension,label])=>({term_key,dimension,label}));
function client(status='draft') {
 const calls=[];const c={calls,auth:{getUser:async()=>({data:{user:{id:'owner'}}})},rpc:async(name,args)=>{calls.push({name,args});return {error:null}},from(table){let payload;const q={select(){return q},eq(key,value){calls.push({table,key,value});return q},order(){return q},maybeSingle:async()=>({data:table==='companies'?{id:'own-company'}:{id:'own-profile',status,company_profile_categories:[],company_quality_reviews:null,company_quality_requests:null}}),upsert(data){payload=data;calls.push({table,payload});return Promise.resolve({error:null})},then(resolve){return Promise.resolve({data:table==='travel_terms'?terms:[{term_key:'accommodation:hotel'},{term_key:'audience:familie'},{term_key:'theme:radwandern'}]}).then(resolve)}};return q}};return c;
}
function form(extra={}){const f=new FormData();f.set('display_name','Own Name');f.set('intent','save');for(const [k,v] of Object.entries(extra))f.set(k,v);return f}
test('existing central terms preselect; checkboxes have public audience labels, no Ctrl UI; approved read-only',async()=>{
 const travel=await loadOwnerTravelInput(client(),'own-profile');assert.equal(travel.terms.length,5);assert.equal(travel.assignedKeys.length,3);
 const props={initialValues:Object.fromEntries(profileFields.map(k=>[k,''])),travelSelection:{...travel,approved:false}};
 const html=renderToStaticMarkup(createElement(CompanyProfileForm,props));
 for(const label of ['Unterkunftsart','Für wen','Welche Reisearten','Mit Hund','Mit Kindern','Zu zweit','Weitere Informationen zu Ihrem Angebot','Speichern &amp; Profil gestalten'])assert.ok(html.includes(label));
 assert.equal((html.match(/type="checkbox"/g)||[]).length,5);assert.equal((html.match(/checked=""/g)||[]).length,3);assert.doesNotMatch(html,/multiple=|audience:gruppe|feature:pool/);
 const approved=renderToStaticMarkup(createElement(CompanyProfileForm,{...props,travelSelection:{...travel,approved:true}}));assert.equal((approved.match(/<fieldset[^>]*disabled/g)||[]).length,3);assert.match(approved,/von der Redaktion gepflegt/);
});
test('one atomic owner save validates/deduplicates terms, ignores manipulated profile id, and preserves approved classifications',async()=>{
 const c=client();const f=form({travel_selection:'1',profile_id:'foreign',business_areas:'Supplement'});f.append('travel_terms','audience:familie');f.append('travel_terms','audience:familie');f.append('travel_terms','theme:radwandern');
 assert.ok((await updateOwnCompanyProfile(c,f)).success);const rpc=c.calls.find(x=>x.name);assert.equal(rpc.name,'save_own_travel_profile');assert.deepEqual(rpc.args.selected_terms,['audience:familie','theme:radwandern']);assert.equal(rpc.args.fields.business_areas,'Supplement');assert.equal('profile_id' in rpc.args,false);
 const approved=client('approved');assert.ok((await updateOwnCompanyProfile(approved,f)).error);assert.equal(approved.calls.some(x=>x.name),false);
 assert.ok((await updateOwnCompanyProfile(approved,form({travel_selection:'1'}))).success);assert.equal(approved.calls.find(x=>x.name).args.selected_terms,null);
 const failed=client();failed.rpc=async()=>({error:{message:'secret'}});const result=await updateOwnCompanyProfile(failed,f);assert.ok(result.error);assert.doesNotMatch(result.error,/secret/);assert.equal(result.success,undefined);
});
test('notes authorize from verified owner company/profile, ignore foreign id, enforce 4000 and normalize empty',async()=>{
 for(const text of ['Private note','   ']){const c=client();const result=await saveOwnEditorialNote(c,form({owner_note:text,profile_id:'foreign'}));assert.ok(result.success);const upsert=c.calls.find(x=>x.payload);assert.deepEqual(upsert.payload,{profile_id:'own-profile',owner_note:text.trim()||null});assert.ok(c.calls.some(x=>x.key==='owner_user_id'&&x.value==='owner'))}
 const c=client();assert.ok((await saveOwnEditorialNote(c,form({owner_note:'x'.repeat(4001)}))).error);assert.equal(c.calls.some(x=>x.payload),false);
 c.auth.getUser=async()=>({data:{user:null}});assert.ok((await saveOwnEditorialNote(c,form({owner_note:'private'}))).error);
 const html=renderToStaticMarkup(createElement(EditorialNoteForm,{initialNote:'Private & <input>'}));assert.match(html,/maxLength="4000"/i);assert.match(html,/nur für die Redaktion sichtbar/);assert.match(html,/Private &amp; &lt;input&gt;/);
});
test('private notes absent from public/search/SEO projections, map uses existing saved profile address',()=>{
 for(const path of ['src/lib/company-presentation.ts','src/lib/portal-search.ts','src/app/sitemap.ts'])if(existsSync(new URL('../'+path,import.meta.url)))assert.doesNotMatch(readFileSync(new URL('../'+path,import.meta.url),'utf8'),/editorial_notes|owner_note/);
 const designer=readFileSync(new URL('../src/components/auth/company-media-form.tsx',import.meta.url),'utf8');assert.match(designer,/<ListingDetail\s+showMap/);
 const page=readFileSync(new URL('../src/app/(energieheld)/firma/profil/gestalten/page.tsx',import.meta.url),'utf8');assert.match(page,/loadCompanyDashboard\(client\)/);assert.ok(page.indexOf('<EditorialNoteForm')<page.indexOf('<CompanyPublication'));assert.match(page,/companyProfileListing\(profile, media\)/);
});
test('mail sources brand correct direct callback/OTP type with no vendor text/secrets',()=>{
 for(const [file,type,cta] of [['confirmation','email','E-Mail-Adresse bestätigen'],['recovery','recovery','Neues Passwort festlegen']]){
 const html=readFileSync(new URL('../docs/auth-email-templates/'+file+'.html',import.meta.url),'utf8');assert.match(html,/DAS Reiseportal/);assert.doesNotMatch(html,/supabase|ConfirmationURL|https?:\/\//i);assert.ok(html.includes(cta));assert.ok(html.includes('{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type='+type));
 }
});
