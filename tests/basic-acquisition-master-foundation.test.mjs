import test, {before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const sql=readFileSync(new URL('../supabase/proposals/20261016131421_basic_acquisition_master_foundation.sql',import.meta.url),'utf8');
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
const o='20000000-0000-4000-8000-000000000001',p='20000000-0000-4000-8000-000000000002';
const source='30000000-0000-4000-8000-000000000001',run='40000000-0000-4000-8000-000000000001';
const profile='50000000-0000-4000-8000-000000000001';
const tables=['accommodations','source_registry','observations','price_observations','municipalities','processing_runs','audit_events'];
const base=`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE portal_admin; GRANT authenticated TO portal_admin; CREATE ROLE service_role BYPASSRLS;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
CREATE TABLE public.companies(id uuid PRIMARY KEY); INSERT INTO public.companies VALUES('${profile}');
CREATE TABLE public.company_profiles(id uuid PRIMARY KEY,company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,name text);
INSERT INTO public.company_profiles VALUES('${profile}','${profile}','Existing premium');
CREATE TABLE public.travel_terms(term_key text PRIMARY KEY);
INSERT INTO public.travel_terms VALUES('accommodation:hotel'),('theme:natur-pur'),('feature:sonderthema');`;
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
 await candidate(db,a,o);await candidate(db,b,p);await db.exec('COMMIT');
});
after(async()=>db?.close());beforeEach(async()=>db.exec('BEGIN; SET CONSTRAINTS ALL IMMEDIATE'));afterEach(async()=>db.exec('RESET ROLE; ROLLBACK'));
async function denied(statement,params=[]){await db.exec('SAVEPOINT expected_failure');await assert.rejects(db.query(statement,params));await db.exec('ROLLBACK TO SAVEPOINT expected_failure');}

test('exactly seven private tables, all RLS/FORCE, no operator or split work tables',async()=>{
 const result=await db.query("SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='acquisition' AND c.relkind='r' ORDER BY c.relname");
 assert.deepEqual(result.rows.map(r=>r.relname),[...tables].sort());assert.ok(result.rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
});

test('street, house number, postal code and city are separate for both addresses and retain leading zeroes',async()=>{
 await db.query(`UPDATE acquisition.accommodations SET street='Testweg',house_number='12a',postal_code='01234',city='Testort',
 company_street='Firmenweg',company_house_number='9',company_postal_code='00123',company_city='Firmensitz',company_country='FR',company_address_observation_id=$2 WHERE id=$1`,[a,o]);
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

test('price bases distinguish unit/person and stay/night; unknown, invalid and unproved FX never compare',async()=>{
 const insert=`INSERT INTO acquisition.price_observations(accommodation_id,observation_id,original_amount,currency,basis,occupancy,nights,period_start,period_end,board,extras_verified,eur_per_person_night,observed_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,'2026-10-01','2026-10-31','self_catering',true,$8,now())`;
 for(const [basis,occupancy,nights] of [['person_night',null,null],['unit_night',2,null],['person_stay',null,2],['unit_stay',2,2]])
  await db.query(insert,[a,o,120,'EUR',basis,occupancy,nights,60]);
 for(const [basis,occupancy,nights] of [['unknown',null,null],['unit_night',null,null],['person_stay',null,null],['unit_stay',2,null]])
  await denied(insert,[a,o,120,'EUR',basis,occupancy,nights,60]);
 for(const amount of ['NaN','Infinity','-Infinity','0','-1'])await denied(insert,[a,o,amount,'EUR','person_night',null,null,60]);
 await denied(insert,[a,o,120,'CHF','person_night',null,null,120]);
 await denied(insert,[b,o,120,'EUR','person_night',null,null,120]);
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
