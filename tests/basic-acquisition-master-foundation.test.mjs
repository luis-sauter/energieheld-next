import test, {before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const sql=readFileSync(new URL('../supabase/proposals/20261016131421_basic_acquisition_master_foundation.sql',import.meta.url),'utf8');
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
const o='20000000-0000-4000-8000-000000000001',p='20000000-0000-4000-8000-000000000002';
const source='30000000-0000-4000-8000-000000000001',run='40000000-0000-4000-8000-000000000001';
const profile='50000000-0000-4000-8000-000000000001';
const admin='70000000-0000-4000-8000-000000000001',visitor='70000000-0000-4000-8000-000000000002';
const categorySource='80000000-0000-4000-8000-000000000001',natureProof='90000000-0000-4000-8000-000000000001',hikingProof='90000000-0000-4000-8000-000000000002';
const companyAddressProof='21000000-0000-4000-8000-000000000001',priceProof='22000000-0000-4000-8000-000000000001';
const tables=['accommodations','source_registry','observations','price_observations','municipalities','processing_runs','audit_events'];
const base=`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE portal_admin; GRANT authenticated TO portal_admin; CREATE ROLE service_role BYPASSRLS;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
CREATE TABLE public.companies(id uuid PRIMARY KEY); INSERT INTO public.companies VALUES('${profile}');
CREATE TABLE public.company_profiles(id uuid PRIMARY KEY,company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,name text);
INSERT INTO public.company_profiles VALUES('${profile}','${profile}','Existing premium');
CREATE TABLE public.travel_terms(term_key text PRIMARY KEY,dimension text NOT NULL DEFAULT 'theme',label text NOT NULL DEFAULT 'Synthetic term');
INSERT INTO public.travel_terms(term_key) VALUES('accommodation:hotel'),('theme:natur-pur'),('feature:sonderthema');
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.portal_admins(user_id uuid PRIMARY KEY);
INSERT INTO public.portal_admins VALUES('70000000-0000-4000-8000-000000000001');
CREATE FUNCTION public.can_review_travel_profiles() RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT FROM public.portal_admins WHERE user_id=auth.uid()) $$;`;
let db;
async function candidate(target,id,obs){
 await target.query('INSERT INTO acquisition.accommodations(id,name,primary_observation_id) VALUES($1,$2,$3)',[id,'Synthetic lodging',obs]);
 await target.query(`INSERT INTO acquisition.observations(id,accommodation_id,source_id,run_id,fact_type,url,facts,observed_at,fingerprint)
 VALUES($1,$2,$3,$4,'identity','https://example.invalid','{}',now(),repeat('a',64))`,[obs,id,source,run]);
}
before(async()=>{
 db=new PGlite();await db.exec(base);await db.exec(sql);
 await db.exec(`INSERT INTO acquisition.source_registry(id,source_key,rule_version,operator_name,dataset_name,access_method,terms_url,valid_from,request_budget,byte_budget)
 VALUES('${source}','synthetic','v1','Synthetic source','Test data','manual','https://example.invalid/terms',now(),100,10485760);
 INSERT INTO acquisition.processing_runs(id,run_type,source_id,rule_version) VALUES('${run}','research','${source}','unapproved'); BEGIN;`);
 await candidate(db,a,o);await candidate(db,b,p);
 await db.query(`INSERT INTO acquisition.observations(id,accommodation_id,source_id,run_id,fact_type,url,facts,observed_at,fingerprint)
 VALUES($1,$2,$3,$4,'company_address','https://example.invalid/address','{}',now(),repeat('9',64))`,[companyAddressProof,a,source,run]);
 await db.query(`INSERT INTO acquisition.observations(id,accommodation_id,source_id,run_id,fact_type,url,facts,review_status,observed_at,checked_at,fingerprint)
 VALUES($1,$2,$3,$4,'price','https://example.invalid/price','{}','verified',now(),now(),repeat('7',64))`,[priceProof,a,source,run]);
 await db.exec('COMMIT');
});
after(async()=>db?.close());beforeEach(async()=>db.exec('BEGIN; SET CONSTRAINTS ALL IMMEDIATE'));afterEach(async()=>{await db.exec('ROLLBACK');await db.exec('RESET ROLE');});
async function denied(statement,params=[]){await db.exec('SAVEPOINT expected_failure');await assert.rejects(db.query(statement,params));await db.exec('ROLLBACK TO SAVEPOINT expected_failure');}
async function categoryFixture(){
 await db.exec(`INSERT INTO public.travel_terms(term_key) SELECT unnest(acquisition.basic_theme_keys()) ON CONFLICT DO NOTHING;
 INSERT INTO acquisition.source_registry(id,source_key,rule_version,operator_name,dataset_name,access_method,terms_url,valid_from,
 request_budget,byte_budget,research_right,extraction_right,allowed_fields,reviewed_at,rights_evidence)
 VALUES('${categorySource}','category-fixture','v1','Synthetic','Synthetic','api','https://example.invalid/terms',now()-interval '1 day',100,10485760,
 'allowed','allowed',ARRAY['travel_categories'],now(),'Synthetic test licence');
 UPDATE acquisition.processing_runs SET status='running',run_type='refresh',source_id='${categorySource}',started_at=now() WHERE id='${run}';
 INSERT INTO acquisition.observations(id,accommodation_id,source_id,run_id,fact_type,term_key,url,facts,review_status,observed_at,checked_at,fingerprint)
 VALUES('${natureProof}','${a}','${categorySource}','${run}','theme','theme:natur-pur','https://example.invalid/nature','{}','verified',now(),now(),repeat('c',64)),
 ('${hikingProof}','${a}','${categorySource}','${run}','theme','theme:wanderurlaub','https://example.invalid/hiking','{}','verified',now(),now(),repeat('d',64));`);
}
async function revision(id=a){return (await db.query('SELECT revision FROM acquisition.accommodations WHERE id=$1',[id])).rows[0].revision;}
async function basis(evidence,id=a,expected){
 const rev=expected??await revision(id);
 return (await db.query('SELECT acquisition.refresh_basic_category_basis($1,$2,$3,$4) value',[id,rev,JSON.stringify(evidence),run])).rows[0].value;
}
async function authenticate(subject=admin){await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[subject]);}
async function saveCategories(selected,expected,id=a,reason='Verified editorial category correction'){
 const rev=expected??await revision(id);
 return (await db.query('SELECT acquisition.save_basic_categories($1,$2,$3,$4) value',[id,rev,selected,reason])).rows[0].value;
}

test('Basic category vocabulary matches all eleven active portal themes; seasons, special topic and retired diving are excluded',async()=>{
 const catalog=readFileSync(new URL('../src/data/reiseportal-discovery.ts',import.meta.url),'utf8');
 const historical=catalog.slice(catalog.indexOf('export const historicalTravelThemes'),catalog.indexOf('export const travelThemes'));
 const expected=[...historical.matchAll(/slug: "([a-z-]+)"/g)].map(m=>'theme:'+m[1]).filter(k=>k!=='theme:tauchurlaub').sort();
 const keys=(await db.query('SELECT acquisition.basic_theme_keys() keys')).rows[0].keys.sort();
 assert.equal(keys.length,11);assert.deepEqual(keys,expected);
});

test('automatic categories require verified permitted same-lodging, matching-theme evidence',async()=>{
 await categoryFixture();
 await denied('SELECT acquisition.refresh_basic_category_basis($1,$2,$3,$4)',[a,1,JSON.stringify({'theme:natur-pur':p}),run]);
 await denied('SELECT acquisition.refresh_basic_category_basis($1,$2,$3,$4)',[b,1,JSON.stringify({'theme:natur-pur':natureProof}),run]);
 await denied('SELECT acquisition.refresh_basic_category_basis($1,$2,$3,$4)',[a,1,JSON.stringify({'theme:wanderurlaub':natureProof}),run]);
 const result=await basis({'theme:natur-pur':natureProof});assert.deepEqual(result.assignedKeys,['theme:natur-pur']);
 await denied('UPDATE acquisition.accommodations SET effective_theme_keys=$2 WHERE id=$1',[a,['theme:wanderurlaub']]);
});

test('unknown or expired source permissions cannot provide the automatic basis',async()=>{
 await categoryFixture();
 for(const [index,expiry] of [[1,true],[2,false]]){
  const sourceId=`81000000-0000-4000-8000-00000000000${index}`,evidenceId=`91000000-0000-4000-8000-00000000000${index}`;
  await db.query(`INSERT INTO acquisition.source_registry(id,source_key,rule_version,operator_name,dataset_name,access_method,terms_url,valid_from,valid_until,
  request_budget,byte_budget,research_right,extraction_right,allowed_fields,reviewed_at,rights_evidence)
  VALUES($1,$2,'v1','Synthetic','Synthetic','api','https://example.invalid/terms',now()-interval '2 days',$3,100,10485760,$4,$4,ARRAY['travel_categories'],now(),'Synthetic rights')`,
  [sourceId,'rights-fixture-'+index,expiry?new Date(Date.now()-86400000):null,expiry?'allowed':'unknown']);
  await db.query(`INSERT INTO acquisition.observations(id,accommodation_id,source_id,run_id,fact_type,term_key,url,facts,review_status,observed_at,checked_at,fingerprint)
  VALUES($1,$2,$3,$4,'theme','theme:natur-pur','https://example.invalid','{}','verified',now(),now(),repeat('e',64))`,[evidenceId,a,sourceId,run]);
  await denied('SELECT acquisition.refresh_basic_category_basis($1,$2,$3,$4)',[a,1,JSON.stringify({'theme:natur-pur':evidenceId}),run]);
 }
});

test('manual removals and additions survive automatic replay, removal and changed source evidence',async()=>{
 await categoryFixture();await basis({'theme:natur-pur':natureProof});await authenticate();
 const changed=await saveCategories(['theme:wanderurlaub']);
 assert.deepEqual(changed.assignedKeys,['theme:wanderurlaub']);
 assert.deepEqual(changed.manualDecisions,{'theme:natur-pur':false,'theme:wanderurlaub':true});
 const before=await revision();
 const replay=await basis({'theme:natur-pur':natureProof});assert.equal(replay.revision,before);
 await basis({});assert.deepEqual((await db.query('SELECT effective_theme_keys keys FROM acquisition.accommodations WHERE id=$1',[a])).rows[0].keys,['theme:wanderurlaub']);
 const after=await basis({'theme:natur-pur':natureProof,'theme:wanderurlaub':hikingProof});assert.deepEqual(after.assignedKeys,['theme:wanderurlaub']);
 assert.deepEqual((await db.query('SELECT manual_theme_decisions value FROM acquisition.accommodations WHERE id=$1',[a])).rows[0].value,{'theme:natur-pur':false,'theme:wanderurlaub':true});
});

test('unchanged saves do not create overrides or audit entries, and stale saves fail before no-op',async()=>{
 await categoryFixture();await basis({'theme:natur-pur':natureProof});await authenticate();
 const before=await revision(),count=(await db.query('SELECT count(*)::int n FROM acquisition.audit_events')).rows[0].n;
 const same=await saveCategories(['theme:natur-pur']);assert.equal(same.revision,before);assert.deepEqual(same.manualDecisions,{});
 assert.equal((await db.query('SELECT count(*)::int n FROM acquisition.audit_events')).rows[0].n,count);
 await denied('SELECT acquisition.save_basic_categories($1,$2,$3,$4)',[a,before-1,['theme:natur-pur'],'Stale no-op']);
});

test('Admin category change has verified actor, actual time, before/after manual and effective values',async()=>{
 await categoryFixture();await basis({'theme:natur-pur':natureProof});await authenticate();
 const before=await revision();await saveCategories(['theme:wanderurlaub']);
 const event=(await db.query("SELECT * FROM acquisition.audit_events WHERE event_type='basic_categories_admin'")).rows[0];
 assert.equal(event.actor_user_id,admin);assert.equal(event.old_revision,before);assert.equal(event.new_revision,before+1);
 assert.ok(event.happened_at instanceof Date);assert.deepEqual(event.before_values,{manual:{},effective:['theme:natur-pur']});
 assert.deepEqual(event.after_values,{manual:{'theme:natur-pur':false,'theme:wanderurlaub':true},effective:['theme:wanderurlaub']});
});

test('category change and audit roll back together if the detailed audit insert fails',async()=>{
 await categoryFixture();await authenticate();const before=await revision();
 await db.exec("ALTER TABLE acquisition.audit_events ADD CONSTRAINT reject_category_test CHECK(event_type<>'basic_categories_admin')");
 await denied('SELECT acquisition.save_basic_categories($1,$2,$3,$4)',[a,before,['theme:natur-pur'],'Atomic test']);
 assert.equal(await revision(),before);assert.deepEqual((await db.query('SELECT manual_theme_decisions value FROM acquisition.accommodations WHERE id=$1',[a])).rows[0].value,{});
});

test('authentication and actual Admin membership are checked even for a database-owner function call',async()=>{
 for(const subject of ['',visitor]){
  await authenticate(subject);
  await denied('SELECT acquisition.read_basic_categories($1)',[a]);
  await denied('SELECT acquisition.save_basic_categories($1,$2,$3,$4)',[a,1,['theme:natur-pur'],'Unauthorized']);
 }
 await authenticate();const result=(await db.query('SELECT acquisition.read_basic_categories($1) value',[a])).rows[0].value;
 assert.deepEqual(Object.keys(result).sort(),['id','name','city','country','revision','assignedKeys','manualDecisions','automaticKeys','terms'].sort());
 assert.doesNotMatch(JSON.stringify(result),/business_email|official_website|acquisition_note|operator_name|source_registry/);
});

test('later narrow authenticated execution still requires Admin membership and never grants table reads',async()=>{
 await categoryFixture();
 // Fixture-only grants model the later Phase-B wrapper's narrow execution path;
 // these grants are absent from the actual proposal.
 await db.exec('GRANT USAGE ON SCHEMA acquisition TO authenticated; GRANT EXECUTE ON FUNCTION acquisition.read_basic_categories(uuid),acquisition.save_basic_categories(uuid,bigint,text[],text) TO authenticated');
 await db.exec('SET LOCAL ROLE authenticated');
 await authenticate(visitor);
 await denied('SELECT acquisition.read_basic_categories($1)',[a]);
 await denied('SELECT acquisition.save_basic_categories($1,$2,$3,$4)',[a,1,['theme:natur-pur'],'Unauthorized test']);
 await authenticate(admin);
 const saved=(await db.query('SELECT acquisition.save_basic_categories($1,$2,$3,$4) value',[a,1,['theme:natur-pur'],'Authenticated Admin decision'])).rows[0].value;
 assert.deepEqual(saved.assignedKeys,['theme:natur-pur']);
 await denied('SELECT * FROM acquisition.accommodations');await denied('SELECT * FROM acquisition.audit_events');
 await db.exec('RESET ROLE');
 assert.equal((await db.query("SELECT actor_user_id FROM acquisition.audit_events WHERE event_type='basic_categories_admin'")).rows[0].actor_user_id,admin);
});

test('category importer has exactly one non-login capability and cannot write Admin decisions, CRM or Premiums',async()=>{
 await categoryFixture();
 assert.deepEqual((await db.query("SELECT rolcanlogin,rolsuper,rolbypassrls,rolcreaterole FROM pg_roles WHERE rolname='acquisition_category_importer'")).rows[0],{rolcanlogin:false,rolsuper:false,rolbypassrls:false,rolcreaterole:false});
 assert.equal((await db.query("SELECT count(*)::int n FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid WHERE r.rolname='acquisition_category_importer'")).rows[0].n,0);
 await db.exec('SET LOCAL ROLE acquisition_category_importer');
 const result=(await db.query('SELECT acquisition.refresh_basic_category_basis($1,$2,$3,$4) value',[a,1,JSON.stringify({'theme:natur-pur':natureProof}),run])).rows[0].value;
 assert.deepEqual(result.assignedKeys,['theme:natur-pur']);
 for(const q of ["SELECT * FROM acquisition.accommodations","UPDATE acquisition.accommodations SET manual_theme_decisions='{}'","UPDATE acquisition.accommodations SET acquisition_note='forbidden'",
  'SELECT acquisition.read_basic_categories(null)',"SELECT acquisition.save_basic_categories(null,1,'{}','forbidden')","UPDATE public.company_profiles SET name='forbidden'","TRUNCATE public.basic_accommodation_contacts"])
  await denied(q);
 await db.exec('RESET ROLE');
});

test('invalid categories, malformed evidence, duplicate choices and missing reasons are rejected',async()=>{
 await categoryFixture();await authenticate();
 for(const selected of [['theme:tauchurlaub'],['theme:saison-herbst'],['feature:sonderthema'],['theme:invented'],['theme:natur-pur','theme:natur-pur'],[null]])
  await denied('SELECT acquisition.save_basic_categories($1,$2,$3,$4)',[a,1,selected,'Invalid test']);
 await denied('SELECT acquisition.save_basic_categories($1,$2,$3,$4)',[a,1,['theme:natur-pur'],'']);
 for(const evidence of [[],{'theme:invented':natureProof},{'theme:natur-pur':true},{'theme:natur-pur':'not-a-uuid'}])
  await denied('SELECT acquisition.refresh_basic_category_basis($1,$2,$3,$4)',[a,1,JSON.stringify(evidence),run]);
});

test('interleaved Admin and import revisions never silently overwrite a newer decision',async()=>{
 await categoryFixture();await basis({'theme:natur-pur':natureProof});await authenticate();const loaded=await revision();
 await basis({'theme:natur-pur':natureProof,'theme:wanderurlaub':hikingProof});
 await denied('SELECT acquisition.save_basic_categories($1,$2,$3,$4)',[a,loaded,[],'Old selection']);
 await saveCategories([]);const corrected=await revision();
 await denied('SELECT acquisition.refresh_basic_category_basis($1,$2,$3,$4)',[a,loaded,JSON.stringify({'theme:natur-pur':natureProof}),run]);
 assert.equal(await revision(),corrected);
 const row=(await db.query('SELECT effective_theme_keys,approval_status,visibility_status FROM acquisition.accommodations WHERE id=$1',[a])).rows[0];
 assert.deepEqual(row,{effective_theme_keys:[],approval_status:'not_requested',visibility_status:'never_published'});
});

test('a new source version cannot restore an explicitly excluded category',async()=>{
 await categoryFixture();await basis({'theme:natur-pur':natureProof});await authenticate();await saveCategories([]);
 const nextSource='82000000-0000-4000-8000-000000000001',nextProof='92000000-0000-4000-8000-000000000001';
 await db.query(`INSERT INTO acquisition.source_registry(id,source_key,rule_version,operator_name,dataset_name,access_method,terms_url,valid_from,
 request_budget,byte_budget,research_right,extraction_right,allowed_fields,reviewed_at,rights_evidence)
 VALUES($1,'category-fixture','v2','Synthetic','Synthetic','api','https://example.invalid/terms',now()-interval '1 day',100,10485760,'allowed','allowed',ARRAY['travel_categories'],now(),'New synthetic permission')`,[nextSource]);
 await db.query(`INSERT INTO acquisition.observations(id,accommodation_id,source_id,run_id,fact_type,term_key,url,facts,review_status,observed_at,checked_at,fingerprint)
 VALUES($1,$2,$3,$4,'theme','theme:natur-pur','https://example.invalid/v2','{}','verified',now(),now(),repeat('f',64))`,[nextProof,a,nextSource,run]);
 const refreshed=await basis({'theme:natur-pur':nextProof});assert.deepEqual(refreshed.assignedKeys,[]);
 assert.deepEqual((await db.query('SELECT manual_theme_decisions value FROM acquisition.accommodations WHERE id=$1',[a])).rows[0].value,{'theme:natur-pur':false});
});

test('purpose-specific source summaries are derived, field-limited and never imply publication from public access',async()=>{
 const initial=(await db.query('SELECT acquisition.source_use_summary($1) value',[a])).rows[0].value;
 assert.deepEqual(initial,{access:'unknown',research:'unknown',extraction:'unknown',publication:'unknown',acquisition:'unknown'});
 await categoryFixture();
 const permitted='83000000-0000-4000-8000-000000000001';
 const nameProof='95000000-0000-4000-8000-000000000001',locationProof='95000000-0000-4000-8000-000000000002',phoneProof='95000000-0000-4000-8000-000000000003';
 await db.query(`INSERT INTO acquisition.source_registry(id,source_key,rule_version,operator_name,dataset_name,access_method,terms_url,valid_from,
 request_budget,byte_budget,access_right,research_right,extraction_right,publication_right,acquisition_right,allowed_fields,reviewed_at,rights_evidence)
 VALUES($1,'complete-contact','v1','Synthetic','Synthetic','api','https://example.invalid/terms',now()-interval '1 day',100,10485760,
 'allowed','allowed','allowed','allowed','allowed',ARRAY['name','location','phone'],now(),'Synthetic full contact permission')`,[permitted]);
 for(const [id,type] of [[nameProof,'identity'],[locationProof,'location'],[phoneProof,'phone']])
  await db.query(`INSERT INTO acquisition.observations(id,accommodation_id,source_id,run_id,fact_type,url,facts,review_status,observed_at,checked_at,fingerprint)
  VALUES($1,$2,$3,$4,$5,'https://example.invalid','{}','verified',now(),now(),md5($5)||md5($5))`,[id,a,permitted,run,type]);
 await db.query("UPDATE acquisition.accommodations SET primary_observation_id=$2,location_observation_id=$3,phone_observation_id=$4,city='Testort',phone='+49856312345' WHERE id=$1",[a,nameProof,locationProof,phoneProof]);
 const contact=(await db.query('SELECT acquisition.source_use_summary($1) value',[a])).rows[0].value;
 assert.deepEqual(contact,{access:'allowed',research:'allowed',extraction:'allowed',publication:'allowed',acquisition:'allowed'});
 // Category source grants research/extraction only, not public reuse.
 await basis({'theme:natur-pur':natureProof});
 const withTheme=(await db.query('SELECT acquisition.source_use_summary($1) value',[a])).rows[0].value;
 assert.equal(withTheme.publication,'unknown');assert.equal(withTheme.research,'allowed');
 await authenticate();await saveCategories([]);
 assert.equal((await db.query('SELECT acquisition.source_use_summary($1) value',[a])).rows[0].value.publication,'allowed');
});

test('exactly seven private tables, all RLS/FORCE, no operator or split work tables',async()=>{
 const result=await db.query("SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='acquisition' AND c.relkind='r' ORDER BY c.relname");
 assert.deepEqual(result.rows.map(r=>r.relname),[...tables].sort());assert.ok(result.rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
});

test('street, house number, postal code and city are separate for both addresses and retain leading zeroes',async()=>{
 await db.query(`UPDATE acquisition.accommodations SET street='Testweg',house_number='12a',postal_code='01234',city='Testort',
 company_street='Firmenweg',company_house_number='9',company_postal_code='00123',company_city='Firmensitz',company_country='FR',company_address_observation_id=$2 WHERE id=$1`,[a,companyAddressProof]);
 const row=(await db.query('SELECT street,house_number,postal_code,city,company_street,company_house_number,company_postal_code,company_city,company_country FROM acquisition.accommodations WHERE id=$1',[a])).rows[0];
 assert.deepEqual(row,{street:'Testweg',house_number:'12a',postal_code:'01234',city:'Testort',company_street:'Firmenweg',company_house_number:'9',company_postal_code:'00123',company_city:'Firmensitz',company_country:'FR'});
});

test('uncompleted candidate is private and cannot invent default company address or phone',async()=>{
 const row=(await db.query('SELECT street,house_number,postal_code,city,company_city,phone,acquisition_phone,approval_status,visibility_status FROM acquisition.accommodations WHERE id=$1',[b])).rows[0];
 assert.deepEqual(row,{street:null,house_number:null,postal_code:null,city:null,company_city:null,phone:null,acquisition_phone:null,approval_status:'not_requested',visibility_status:'never_published'});
});

test('all portal/API roles including service bypass cannot access private data/functions or public draft',async()=>{
 for(const role of ['anon','authenticated','portal_admin','service_role']){
  await db.exec(`SET LOCAL ROLE ${role}`);
  for(const table of tables){await denied(`SELECT * FROM acquisition.${table}`);await denied(`DELETE FROM acquisition.${table}`);}
  await denied('SELECT acquisition.guard_accommodation()');await denied('SELECT id,name,address,phone FROM public.basic_accommodation_contacts');
  await denied('INSERT INTO acquisition.accommodations(id,name,primary_observation_id) VALUES($1,$2,$3)',[a,'Blocked',o]);
  await denied('UPDATE public.basic_accommodation_contacts SET is_listed=true');await db.exec('RESET ROLE');
 }
});

test('all populated private contacts/company fields require same-lodging evidence',async()=>{
 for(const field of ['phone_observation_id','location_observation_id','operator_observation_id','company_address_observation_id','person_observation_id','primary_observation_id'])
  await denied(`UPDATE acquisition.accommodations SET ${field}=$2 WHERE id=$1`,[b,o]);
 await denied("UPDATE acquisition.accommodations SET contact_person='Synthetic person' WHERE id=$1",[a]);
 await denied("UPDATE acquisition.accommodations SET company_street='Unproved' WHERE id=$1",[a]);
 await denied("UPDATE acquisition.accommodations SET phone='+49856312345' WHERE id=$1",[a]);
});

test('primary evidence can be inserted in same transaction but cannot remain missing at commit',async()=>{
 await db.exec('SET CONSTRAINTS ALL DEFERRED');
 await db.query("INSERT INTO acquisition.accommodations(id,name,primary_observation_id) VALUES('60000000-0000-4000-8000-000000000001','Unproved','60000000-0000-4000-8000-000000000002')");
 await denied('SET CONSTRAINTS ALL IMMEDIATE');
});

test('source rights start unknown and cannot assert permission without proof; history cannot be overwritten',async()=>{
 const rights=(await db.query('SELECT access_right,research_right,extraction_right,publication_right,acquisition_right FROM acquisition.source_registry')).rows[0];
 assert.ok(Object.values(rights).every(v=>v==='unknown'));
 await denied(`INSERT INTO acquisition.source_registry(source_key,rule_version,operator_name,dataset_name,access_method,terms_url,valid_from,request_budget,byte_budget,publication_right)
 VALUES('new','v1','Test','Test','manual','https://example.invalid',now(),100,1,'allowed')`);
 for(const table of ['source_registry','observations','audit_events'])await denied(`DELETE FROM acquisition.${table}`);
 await denied("UPDATE acquisition.observations SET facts='{}'");
 await denied("UPDATE acquisition.source_registry SET publication_right='allowed'");
});

test('public contact contract allows location without street, preserves optional separated address and rejects private fields',async()=>{
 const minimal={city:'Testort',region:'Bayern',country:'DE'};
 await db.query('INSERT INTO public.basic_accommodation_contacts(id,name,address,phone) VALUES($1,$2,$3,$4)',[a,'Synthetic',JSON.stringify(minimal),'+49856312345']);
 for(const invalid of [{...minimal,email:'private@example.invalid'},{...minimal,street:22},{...minimal,houseNumber:{}},{...minimal,city:null},{}])
  await denied('UPDATE public.basic_accommodation_contacts SET address=$2 WHERE id=$1',[a,JSON.stringify(invalid)]);
 await db.query('UPDATE public.basic_accommodation_contacts SET address=$2 WHERE id=$1',[a,JSON.stringify({...minimal,street:'Testweg',houseNumber:'12a',postalCode:'01234'})]);
 await denied('UPDATE public.basic_accommodation_contacts SET is_listed=true WHERE id=$1',[a]);
 await denied("UPDATE acquisition.accommodations SET approval_status='approved',visibility_status='public' WHERE id=$1",[a]);
});

test('public search index includes name and location only, excludes private data and phone',async()=>{
 await db.query('INSERT INTO public.basic_accommodation_contacts(id,name,address,phone) VALUES($1,$2,$3,$4)',[a,'Synthetic lodging',JSON.stringify({city:'Testort',region:'Bayern',country:'DE'}),'+49856312345']);
 assert.equal((await db.query("SELECT count(*)::int n FROM public.basic_accommodation_contacts WHERE search_vector @@ plainto_tsquery('german','Testort')")).rows[0].n,1);
 assert.equal((await db.query("SELECT count(*)::int n FROM public.basic_accommodation_contacts WHERE search_vector @@ plainto_tsquery('german','49856312345')")).rows[0].n,0);
});

test('CRM status, contact block and premium-customer evidence stay distinct from review/publication',async()=>{
 await denied("UPDATE acquisition.accommodations SET acquisition_status='interested' WHERE id=$1",[a]);
 await db.query("UPDATE acquisition.accommodations SET acquisition_status='interested',review_note='Actual test decision',contact_block=true,contact_block_reason='No contact' WHERE id=$1",[a]);
 await denied("UPDATE acquisition.accommodations SET acquisition_status='premium_customer',review_note='Claim without evidence' WHERE id=$1",[a]);
 const row=(await db.query('SELECT acquisition_status,review_status,approval_status FROM acquisition.accommodations WHERE id=$1',[a])).rows[0];
 assert.deepEqual(row,{acquisition_status:'interested',review_status:'unreviewed',approval_status:'not_requested'});
 await denied("UPDATE acquisition.accommodations SET contact_block_reason='' WHERE id=$1",[a]);
});

test('revision, audit and 180-day review date are managed; stale age does not withdraw',async()=>{
 await denied('UPDATE acquisition.accommodations SET revision=99 WHERE id=$1',[a]);
 await denied("UPDATE acquisition.accommodations SET review_status='checked' WHERE id=$1",[a]);
 await db.query("UPDATE acquisition.accommodations SET checked_at='2026-01-01T12:00:00Z',next_review_on='2030-01-01',review_note='Checked test' WHERE id=$1 AND revision=1",[a]);
 const row=(await db.query('SELECT revision,next_review_on::text,visibility_status FROM acquisition.accommodations WHERE id=$1',[a])).rows[0];
 assert.equal(row.revision,2);assert.equal(row.next_review_on,'2026-06-30');assert.equal(row.visibility_status,'never_published');
 assert.equal((await db.query("UPDATE acquisition.accommodations SET name='Outdated overwrite' WHERE id=$1 AND revision=1 RETURNING id",[a])).rows.length,0);
 const audit=(await db.query('SELECT old_revision,new_revision,changed_fields FROM acquisition.audit_events WHERE accommodation_id=$1 ORDER BY new_revision',[a])).rows;
 assert.equal(audit.length,2);assert.equal(audit[1].old_revision,1);assert.ok(audit[1].changed_fields.includes('checked_at'));
});

test('profile deletion and company cascade keep identity and persistent publication block',async()=>{
 const initial=(await db.query('SELECT * FROM public.company_profiles')).rows;
 await db.query('UPDATE acquisition.accommodations SET existing_profile_id=$2 WHERE id=$1',[a,profile]);
 assert.deepEqual((await db.query('SELECT * FROM public.company_profiles')).rows,initial);
 await db.query('DELETE FROM public.companies WHERE id=$1',[profile]);
 const row=(await db.query('SELECT existing_profile_id,had_profile_link,publication_block,visibility_status FROM acquisition.accommodations WHERE id=$1',[a])).rows[0];
 assert.deepEqual(row,{existing_profile_id:null,had_profile_link:true,publication_block:'profile_link',visibility_status:'never_published'});
 await db.query('UPDATE acquisition.accommodations SET had_profile_link=false,publication_block=null WHERE id=$1',[a]);
 assert.equal((await db.query('SELECT had_profile_link FROM acquisition.accommodations WHERE id=$1',[a])).rows[0].had_profile_link,true);
 await denied('DELETE FROM acquisition.accommodations WHERE id=$1',[a]);
});

test('self-links, cycles, chains and non-accommodation types are rejected',async()=>{
 await denied("UPDATE acquisition.accommodations SET canonical_accommodation_id=id,identity_status='duplicate' WHERE id=$1",[a]);
 await db.query("UPDATE acquisition.accommodations SET canonical_accommodation_id=$2,identity_status='duplicate' WHERE id=$1",[b,a]);
 await denied("UPDATE acquisition.accommodations SET canonical_accommodation_id=$2,identity_status='duplicate' WHERE id=$1",[a,b]);
 await denied("UPDATE acquisition.accommodations SET accommodation_type='theme:natur-pur' WHERE id=$1",[a]);
 await denied("UPDATE acquisition.accommodations SET accommodation_type='feature:sonderthema' WHERE id=$1",[a]);
});

test('municipality foreign key cannot be bypassed by missing optional geographic components',async()=>{
 await denied("UPDATE acquisition.accommodations SET municipality_id='90000000-0000-4000-8000-000000000001' WHERE id=$1",[a]);
 await db.query(`INSERT INTO acquisition.municipalities(id,country,code_system,official_code,name,region_code,region_name,valid_from,official_evidence)
 VALUES('90000000-0000-4000-8000-000000000001','DE','AGS','09277113','Synthetic municipality','DE-BY','Bayern','2026-01-01','https://example.invalid/official')`);
 await db.query("UPDATE acquisition.accommodations SET municipality_id='90000000-0000-4000-8000-000000000001',country='DE',region_code='DE-BY',region_name='Bayern' WHERE id=$1",[a]);
 await denied("UPDATE acquisition.accommodations SET country='AT' WHERE id=$1",[a]);
});

test('municipality predecessor/successor history rejects missing references, cycles, country conflicts and dangling deletions',async()=>{
 const oldId='93000000-0000-4000-8000-000000000001',newId='93000000-0000-4000-8000-000000000002',foreignId='93000000-0000-4000-8000-000000000003';
 const insert=`INSERT INTO acquisition.municipalities(id,country,code_system,official_code,name,region_code,region_name,valid_from,valid_until,predecessor_ids)
 VALUES($1,$2,$3,$4,'Synthetic municipality','TEST','Test region',$5,$6,$7)`;
 // SQL URI required as official evidence, not an assertion about any real town.
 await db.exec("ALTER TABLE acquisition.municipalities ALTER COLUMN official_evidence SET DEFAULT 'https://example.invalid/official'");
 await db.query(insert,[oldId,'DE','AGS','00000001','2020-01-01','2025-01-01',[]]);
 await db.query(insert,[newId,'DE','AGS','00000002','2025-01-01',null,[oldId]]);
 await db.query('UPDATE acquisition.municipalities SET successor_ids=$2 WHERE id=$1',[oldId,[newId]]);
 await denied('UPDATE acquisition.municipalities SET predecessor_ids=$2 WHERE id=$1',[newId,[newId]]);
 await denied('UPDATE acquisition.municipalities SET predecessor_ids=$2 WHERE id=$1',[newId,[profile]]);
 await denied('UPDATE acquisition.municipalities SET predecessor_ids=$2 WHERE id=$1',[newId,[oldId,oldId]]);
 await denied(insert,[foreignId,'AT','GKZ','00001','2026-01-01',null,[oldId]]);
 await denied('DELETE FROM acquisition.municipalities WHERE id=$1',[oldId]);
 await denied("UPDATE acquisition.municipalities SET valid_until='2027-01-01' WHERE id=$1",[oldId]);
});

test('evidence must have the correct fact type, and Premium-customer status needs a confirmed relationship',async()=>{
 await denied('UPDATE acquisition.accommodations SET person_observation_id=$2 WHERE id=$1',[a,o]);
 await denied("UPDATE acquisition.accommodations SET business_relationship_observation_id=$2,acquisition_status='premium_customer',review_note='Unproved relationship' WHERE id=$1",[a,o]);
 const relationship='94000000-0000-4000-8000-000000000001';
 await db.query(`INSERT INTO acquisition.observations(id,accommodation_id,source_id,run_id,fact_type,url,facts,review_status,observed_at,checked_at,fingerprint)
 VALUES($1,$2,$3,$4,'business_relationship','https://example.invalid/contract','{"confirmed":true}','verified',now(),now(),repeat('8',64))`,[relationship,a,source,run]);
 await db.query("UPDATE acquisition.accommodations SET business_relationship_observation_id=$2,acquisition_status='premium_customer',review_note='Synthetic confirmed contract' WHERE id=$1",[a,relationship]);
 assert.equal((await db.query('SELECT acquisition_status FROM acquisition.accommodations WHERE id=$1',[a])).rows[0].acquisition_status,'premium_customer');
});

test('last successful import cannot reference research or a run without actual imported rows',async()=>{
 await denied('UPDATE acquisition.accommodations SET last_import_run_id=$2,last_import_at=now() WHERE id=$1',[a,run]);
 await db.query("UPDATE acquisition.processing_runs SET run_type='import',status='succeeded',started_at=now()-interval '1 minute',finished_at=now() WHERE id=$1",[run]);
 await denied('UPDATE acquisition.accommodations SET last_import_run_id=$2,last_import_at=now() WHERE id=$1',[a,run]);
 await db.query('UPDATE acquisition.processing_runs SET candidates=1,imported=1 WHERE id=$1',[run]);
 await db.query('UPDATE acquisition.accommodations SET last_import_run_id=$2,last_import_at=now() WHERE id=$1',[a,run]);
});

test('price bases distinguish unit/person and stay/night; unknown, invalid and unproved FX never compare',async()=>{
 const insert=`INSERT INTO acquisition.price_observations(accommodation_id,observation_id,original_amount,currency,basis,occupancy,nights,period_start,period_end,board,extras_verified,eur_per_person_night,observed_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,'2026-10-01','2026-10-31','self_catering',true,$8,now())`;
 for(const [basis,occupancy,nights,price] of [['person_night',null,null,120],['unit_night',2,null,60],['person_stay',null,2,60],['unit_stay',2,2,30]])
  await db.query(insert,[a,priceProof,120,'EUR',basis,occupancy,nights,price]);
 for(const [basis,occupancy,nights] of [['unknown',null,null],['unit_night',null,null],['person_stay',null,null],['unit_stay',2,null]])
  await denied(insert,[a,priceProof,120,'EUR',basis,occupancy,nights,60]);
 for(const amount of ['NaN','Infinity','-Infinity','0','-1'])await denied(insert,[a,priceProof,amount,'EUR','person_night',null,null,60]);
 await denied(insert,[a,priceProof,120,'CHF','person_night',null,null,120]);
 await denied(insert,[b,priceProof,120,'EUR','person_night',null,null,120]);
 await denied(insert,[a,priceProof,120,'EUR','person_night',null,null,60]);
});

test('price conversion uses all mandatory-extras bases, actual FX and unrounded boundary values',async()=>{
 const calc='SELECT acquisition.calculate_price_eur($1,$2,$3,$4,$5,$6,$7)::text value';
 const value=(await db.query(calc,[800,'CHF','unit_stay',2,4,JSON.stringify({person_night:5,unit_night:10,person_stay:8,unit_stay:16}),1.1])).rows[0].value;
 assert.equal(Number(value),125.4); // (100 + 5 + 5 + 2 + 2) * 1.1
 assert.equal(Number((await db.query(calc,[200.004,'EUR','person_night',null,null,'{}',null])).rows[0].value),200.004);
 for(const extras of [{unknown:4},{person_night:-1},{person_stay:'4'},{unit_stay:10}])
  await denied(calc,[100,'EUR','person_night',null,null,JSON.stringify(extras),null]);
});

test('a comparable foreign price requires verified same-lodging exchange evidence and exact computation',async()=>{
 const exchange='96000000-0000-4000-8000-000000000001';
 await db.query(`INSERT INTO acquisition.observations(id,accommodation_id,source_id,run_id,fact_type,url,facts,review_status,observed_at,checked_at,fingerprint)
 VALUES($1,$2,$3,$4,'exchange_rate','https://example.invalid/fx','{"currency":"CHF","eurRate":1.1}','verified',now(),now(),repeat('6',64))`,[exchange,a,source,run]);
 const insert=`INSERT INTO acquisition.price_observations(accommodation_id,observation_id,original_amount,currency,basis,occupancy,period_start,period_end,board,extras_verified,
 exchange_rate,exchange_rate_at,exchange_rate_observation_id,eur_per_person_night,comparison_status,observed_at)
 VALUES($1,$2,200,'CHF','unit_night',2,'2026-10-01','2026-10-31','self_catering',true,1.1,now(),$3,$4,'comparable',now())`;
 await db.query(insert,[a,priceProof,exchange,110]);
 await denied(insert,[a,priceProof,o,110]);await denied(insert,[a,priceProof,exchange,100]);
 await denied(insert,[b,priceProof,exchange,110]);
});

test('source bindings, replay fingerprints and run budgets have strict limits',async()=>{
 await denied('UPDATE acquisition.processing_runs SET requests_used=101 WHERE id=$1',[run]);
 await denied('UPDATE acquisition.processing_runs SET bytes_received=10485761 WHERE id=$1',[run]);
 await denied('UPDATE acquisition.processing_runs SET batch_size=51 WHERE id=$1',[run]);
 await denied("UPDATE acquisition.processing_runs SET status='made_up' WHERE id=$1",[run]);
 const q=`INSERT INTO acquisition.observations(accommodation_id,source_id,run_id,fact_type,external_key,url,facts,observed_at,fingerprint)
 VALUES($1,$2,$3,'identity_binding','source-record-1','https://example.invalid','{}',now(),repeat('b',64))`;
 await db.query(q,[a,source,run]);await denied(q,[a,source,run]);await denied(q,[b,source,run]);
 await db.query(`INSERT INTO acquisition.source_registry(id,source_key,rule_version,operator_name,dataset_name,access_method,terms_url,valid_from,request_budget,byte_budget)
 VALUES('30000000-0000-4000-8000-000000000002','synthetic','v2','Synthetic source','Test data','manual','https://example.invalid/terms',now(),100,10485760)`);
 await denied(q,[b,'30000000-0000-4000-8000-000000000002',run]);
});

test('manual publication hold survives a later profile link and unlink',async()=>{
 await db.query("UPDATE acquisition.accommodations SET publication_block='manual',existing_profile_id=$2 WHERE id=$1",[a,profile]);
 await db.query('UPDATE acquisition.accommodations SET existing_profile_id=null,publication_block=null WHERE id=$1',[a]);
 assert.equal((await db.query('SELECT publication_block FROM acquisition.accommodations WHERE id=$1',[a])).rows[0].publication_block,'manual');
});

test('partial/repeated application fails closed and errors roll all DDL back',async()=>{
 const isolated=new PGlite();try{
  await isolated.exec(base);await isolated.exec('CREATE SCHEMA acquisition');
  await assert.rejects(isolated.exec(sql));await isolated.exec('ROLLBACK');
  assert.equal((await isolated.query("SELECT to_regclass('public.basic_accommodation_contacts')::text t")).rows[0].t,null);
  await isolated.exec('DROP SCHEMA acquisition');
  await assert.rejects(isolated.exec(sql.replace(/COMMIT;\s*$/,'SELECT 1/0; COMMIT;')));await isolated.exec('ROLLBACK');
  assert.equal((await isolated.query("SELECT to_regnamespace('acquisition')::text n")).rows[0].n,null);
  await isolated.exec(sql);await assert.rejects(isolated.exec(sql));await isolated.exec('ROLLBACK');
  assert.equal((await isolated.query('SELECT count(*)::int n FROM acquisition.accommodations')).rows[0].n,0);
 }finally{await isolated.close();}
});
