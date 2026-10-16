import test,{before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
let db;
const one='11111111-1111-8111-8111-111111111111',two='22222222-2222-8222-8222-222222222222',premium='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const address={country:'DE',region:'Bayern',city:'Beispielort',postalCode:'84364',street:'Beispielweg 1'};
before(async()=>{
 db=new PGlite();
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE ROLE portal_editor;GRANT authenticated TO portal_editor;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
 CREATE TABLE public.companies(id uuid PRIMARY KEY);INSERT INTO public.companies VALUES('${premium}');
 CREATE TABLE public.company_profiles(id uuid PRIMARY KEY,display_name text,status text,company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE);INSERT INTO public.company_profiles VALUES('${premium}','Existing Premium','approved','${premium}');
 CREATE TABLE public.company_profile_public_visibility(profile_id uuid PRIMARY KEY REFERENCES public.company_profiles(id) ON DELETE CASCADE,is_listed boolean);INSERT INTO public.company_profile_public_visibility VALUES('${premium}',true);
 CREATE TABLE public.travel_terms(term_key text PRIMARY KEY);INSERT INTO public.travel_terms VALUES('theme:wellnessangebote');`);
 await db.exec(readFileSync(new URL('../supabase/proposals/20261015225242_basic_acquisition_foundation.sql',import.meta.url),'utf8'));
 await db.exec(`INSERT INTO acquisition.municipalities VALUES('DE:AGS:sample','DE','sample','Beispielort','Bayern','https://example.invalid/municipality');
 INSERT INTO acquisition.operators(id,legal_name) VALUES('${premium}','One operator, two houses');
 INSERT INTO acquisition.accommodation_identities(id,canonical_key,name,operator_id,municipality_id,address,active_verified_at,identity_review)
 VALUES('${one}','source:1','First lodging','${premium}','DE:AGS:sample','{}',now(),'verified'),('${two}','source:2','Second lodging','${premium}','DE:AGS:sample','{}',now(),'verified');`);
 await db.query(`INSERT INTO public.basic_accommodation_contacts(id,name,address,phone,status,is_listed) VALUES($1,'First lodging',$3,'+49856312345','approved',true),($2,'Second lodging',$3,'+49856312346','draft',false)`,[one,two,JSON.stringify(address)]);
});
after(async()=>db?.close());beforeEach(async()=>db.exec('BEGIN'));afterEach(async()=>db.exec('RESET ROLE;ROLLBACK'));
async function denied(sql,params=[]){await db.exec('SAVEPOINT denied');await assert.rejects(db.query(sql,params));await db.exec('ROLLBACK TO SAVEPOINT denied');}
test('anon and authenticated can read only approved/listed contact columns, never draft content',async()=>{
 for(const role of ['anon','authenticated','portal_editor']){await db.exec(`SET LOCAL ROLE ${role}`);const r=await db.query('SELECT id,name,address,phone FROM public.basic_accommodation_contacts');assert.equal(r.rows.length,1);assert.deepEqual(Object.keys(r.rows[0]),['id','name','address','phone']);await denied('SELECT * FROM public.basic_accommodation_contacts');await db.exec('RESET ROLE');}
});
test('anon, owner-like authenticated, editor and service role cannot read or write acquisition tables',async()=>{
 for(const role of ['anon','authenticated','portal_editor','service_role']){await db.exec(`SET LOCAL ROLE ${role}`);for(const table of ['operators','municipalities','research_runs','accommodation_identities','research_details','sources','theme_evidence','price_observations'])await denied(`SELECT * FROM acquisition.${table}`);await denied('UPDATE public.basic_accommodation_contacts SET is_listed=true');await denied('SELECT acquisition.guard_basic_contact()');await db.exec('RESET ROLE');}
});
test('all internal tables force RLS and no internal function is an exposed public RPC',async()=>{
 const rows=await db.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='acquisition' AND relkind='r'");assert.equal(rows.rows.length,8);assert.ok(rows.rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
 const grants=await db.query("SELECT has_schema_privilege('anon','acquisition','USAGE') AS anon,has_schema_privilege('authenticated','acquisition','USAGE') AS authenticated,has_function_privilege('anon','acquisition.guard_basic_contact()','EXECUTE') AS execute");assert.deepEqual(grants.rows[0],{anon:false,authenticated:false,execute:false});
});
test('address cannot hide a website/email/operator and phone is mandatory E164',async()=>{
 await denied('UPDATE public.basic_accommodation_contacts SET address=$1 WHERE id=$2',[JSON.stringify({...address,website:'https://private.invalid'}),two]);
 await denied('UPDATE public.basic_accommodation_contacts SET address=$1 WHERE id=$2',[JSON.stringify({...address,street:null}),two]);
 await denied('UPDATE public.basic_accommodation_contacts SET phone=$1 WHERE id=$2',['',two]);
 await denied('UPDATE public.basic_accommodation_contacts SET phone=$1 WHERE id=$2',['private@example.invalid',two]);
});
test('a single operator can retain two distinct accommodation identities',async()=>{
 const r=await db.query('SELECT count(*)::int AS n FROM acquisition.accommodation_identities WHERE operator_id=$1',[premium]);assert.equal(r.rows[0].n,2);
});
test('linking an existing profile hides its Basic projection and never changes the profile',async()=>{
 const before=(await db.query('SELECT * FROM public.company_profiles')).rows;
 await db.query('UPDATE acquisition.accommodation_identities SET existing_profile_id=$1 WHERE id=$2',[premium,one]);
 const r=await db.query('SELECT status,is_listed FROM public.basic_accommodation_contacts WHERE id=$1',[one]);assert.deepEqual(r.rows[0],{status:'draft',is_listed:false});
 await denied("UPDATE public.basic_accommodation_contacts SET status='approved',is_listed=true WHERE id=$1",[one]);
 assert.deepEqual((await db.query('SELECT * FROM public.company_profiles')).rows,before);
 await db.query('UPDATE acquisition.accommodation_identities SET existing_profile_id=null WHERE id=$1',[one]);assert.equal((await db.query('SELECT is_listed FROM public.basic_accommodation_contacts WHERE id=$1',[one])).rows[0].is_listed,false);
});
test('unverified identities cannot be published and foreign profile IDs cannot be invented',async()=>{
 await db.query("UPDATE acquisition.accommodation_identities SET identity_review='pending' WHERE id=$1",[two]);await denied("UPDATE public.basic_accommodation_contacts SET status='approved',is_listed=true WHERE id=$1",[two]);
 await denied("UPDATE acquisition.accommodation_identities SET existing_profile_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' WHERE id=$1",[two]);
 await db.query("UPDATE acquisition.accommodation_identities SET identity_review='closed' WHERE id=$1",[one]);
 assert.equal((await db.query('SELECT is_listed FROM public.basic_accommodation_contacts WHERE id=$1',[one])).rows[0].is_listed,false);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM acquisition.accommodation_identities')).rows[0].n,2);
});
test('foreign currency requires actual rate and timestamp before an EUR comparison can be stored',async()=>{
 await db.exec(`INSERT INTO acquisition.research_runs VALUES('${premium}','DE:AGS:sample',now(),'[]',2,2,'[]','sample',null);
 INSERT INTO acquisition.sources(id,identity_id,run_id,provider,url,checked_at,claim) VALUES('${premium}','${one}','${premium}','official','https://example.invalid',now(),'Factual source');`);
 await denied(`INSERT INTO acquisition.price_observations(id,identity_id,source_id,original_amount,currency,price_basis,eur_per_person_night,checked_at) VALUES($1,$2,$1,120,'CHF','person_night',120,now())`,[premium,one]);
});

test('contact people require a source belonging to the same lodging, not another house of its operator',async()=>{
 await db.exec(`INSERT INTO acquisition.research_runs VALUES('${premium}','DE:AGS:sample',now(),'[]',2,2,'[]','sample',null);
 INSERT INTO acquisition.sources(id,identity_id,run_id,provider,url,checked_at,claim) VALUES('${premium}','${one}','${premium}','official','https://example.invalid',now(),'Synthetic contact source');`);
 const insert=`INSERT INTO acquisition.research_details(identity_id,contact_person,contact_source_id,retention_review_at,checked_at,payload_fingerprint) VALUES($1,'Synthetic Person',$2,now(),now(),repeat('a',64))`;
 await denied(insert,[one,null]);await denied(insert,[two,premium]);
 await db.query(insert,[one,premium]);
});

test('unknown private address fields may be NULL but nested contacts or invalid types are rejected',async()=>{
 await db.query('UPDATE acquisition.accommodation_identities SET address=NULL WHERE id=$1',[two]);
 await db.query('UPDATE acquisition.accommodation_identities SET address=$1 WHERE id=$2',[JSON.stringify({country:'DE',addressLine:null}),two]);
 await denied('UPDATE acquisition.accommodation_identities SET address=$1 WHERE id=$2',[JSON.stringify({country:'DE',website:'private'}),two]);
 await denied('UPDATE acquisition.accommodation_identities SET address=$1 WHERE id=$2',[JSON.stringify({country:'DE',postalCode:12345}),two]);
});

test('profile archival, direct deletion and cascading company deletion remain possible without republishing Basic',async()=>{
 await db.query('UPDATE acquisition.accommodation_identities SET existing_profile_id=$1 WHERE id=$2',[premium,one]);
 await db.query('UPDATE public.company_profile_public_visibility SET is_listed=false WHERE profile_id=$1',[premium]);
 assert.equal((await db.query('SELECT existing_profile_id FROM acquisition.accommodation_identities WHERE id=$1',[one])).rows[0].existing_profile_id,premium);
 await db.exec('SAVEPOINT direct_delete');await db.query('DELETE FROM public.company_profiles WHERE id=$1',[premium]);
 assert.equal((await db.query('SELECT existing_profile_id FROM acquisition.accommodation_identities WHERE id=$1',[one])).rows[0].existing_profile_id,null);
 assert.equal((await db.query('SELECT is_listed FROM public.basic_accommodation_contacts WHERE id=$1',[one])).rows[0].is_listed,false);
 await db.exec('ROLLBACK TO SAVEPOINT direct_delete');await db.query('DELETE FROM public.companies WHERE id=$1',[premium]);
 assert.equal((await db.query('SELECT count(*)::int n FROM public.company_profiles')).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM acquisition.accommodation_identities')).rows[0].n,2);
 assert.equal((await db.query('SELECT is_listed FROM public.basic_accommodation_contacts WHERE id=$1',[one])).rows[0].is_listed,false);
});

test('comparison prices cannot bypass basis, occupancy, nights or verified extras requirements',async()=>{
 await db.exec(`INSERT INTO acquisition.research_runs VALUES('${premium}','DE:AGS:sample',now(),'[]',2,2,'[]','sample',null);
 INSERT INTO acquisition.sources(id,identity_id,run_id,provider,url,checked_at,claim) VALUES('${premium}','${one}','${premium}','official','https://example.invalid',now(),'Synthetic price source');`);
 for(const [basis,occupancy,nights,extras] of [['unknown',null,null,true],['unit_night',null,null,true],['stay',2,null,true],['person_night',null,null,false]]){
 await denied(`INSERT INTO acquisition.price_observations(id,identity_id,source_id,original_amount,currency,price_basis,occupancy,nights,travel_period,board,extras_verified,eur_per_person_night,checked_at) VALUES($1,$2,$1,120,'EUR',$3,$4,$5,'2026','breakfast',$6,120,now())`,[premium,one,basis,occupancy,nights,extras]);
 }
 await db.query(`INSERT INTO acquisition.price_observations(id,identity_id,source_id,original_amount,currency,price_basis,extras_verified,eur_per_person_night,checked_at) VALUES($1,$2,$1,120,'EUR','unknown',false,NULL,now())`,[premium,one]);
 await denied("UPDATE acquisition.price_observations SET original_amount='NaN' WHERE id=$1",[premium]);
 await denied("UPDATE acquisition.price_observations SET exchange_rate='Infinity' WHERE id=$1",[premium]);
});

test('migration fails on partial or repeated application and a failed transaction leaves no foundation',async()=>{
 const isolated=new PGlite();
 try{
 await isolated.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE TABLE public.company_profiles(id uuid PRIMARY KEY);CREATE TABLE public.travel_terms(term_key text PRIMARY KEY);CREATE SCHEMA acquisition;`);
 const sql=readFileSync(new URL('../supabase/proposals/20261015225242_basic_acquisition_foundation.sql',import.meta.url),'utf8');
 await assert.rejects(isolated.exec(sql));await isolated.exec('ROLLBACK');
 assert.equal((await isolated.query("SELECT to_regclass('public.basic_accommodation_contacts')::text t")).rows[0].t,null);
 await isolated.exec('DROP SCHEMA acquisition');
 await assert.rejects(isolated.exec(sql.replace(/COMMIT;\s*$/,"SELECT 1/0; COMMIT;")));await isolated.exec('ROLLBACK');
 assert.equal((await isolated.query("SELECT to_regnamespace('acquisition')::text n")).rows[0].n,null);
 await isolated.exec(sql);await assert.rejects(isolated.exec(sql));await isolated.exec('ROLLBACK');
 assert.equal((await isolated.query('SELECT count(*)::int n FROM public.basic_accommodation_contacts')).rows[0].n,0);
 }finally{await isolated.close();}
});
test('stable pagination and a text index are prepared without touching existing search functions',async()=>{
 await db.query("UPDATE public.basic_accommodation_contacts SET status='approved',is_listed=true WHERE id=$1",[two]);
 const first=(await db.query('SELECT id FROM public.basic_accommodation_contacts ORDER BY lower(name),id LIMIT 1 OFFSET 0')).rows;
 const second=(await db.query('SELECT id FROM public.basic_accommodation_contacts ORDER BY lower(name),id LIMIT 1 OFFSET 1')).rows;
 assert.equal(first.length,1);assert.equal(second.length,1);assert.notEqual(first[0].id,second[0].id);
 assert.equal((await db.query("SELECT id FROM public.basic_accommodation_contacts WHERE search_vector @@ plainto_tsquery('pg_catalog.german','lodging')")).rows.length,2);
});
test('5000 local synthetic contacts keep indexed page retrieval and exact counts',async()=>{
 await db.exec(`INSERT INTO acquisition.accommodation_identities(id,canonical_key,name,municipality_id,address,active_verified_at,identity_review)
 SELECT md5('large-fixture-'||g)::uuid,'large-fixture:'||g,'Fixture '||lpad(g::text,5,'0'),'DE:AGS:sample','{}',now(),'verified' FROM generate_series(1,5000) g;
 INSERT INTO public.basic_accommodation_contacts(id,name,address,phone,status,is_listed)
 SELECT id,name,'{"country":"DE","region":"Bayern","city":"Beispielort","postalCode":"84364","street":"Beispielweg 9"}','+49856312345','approved',true
 FROM acquisition.accommodation_identities WHERE canonical_key LIKE 'large-fixture:%';ANALYZE public.basic_accommodation_contacts;`);
 const query="SELECT id,name FROM public.basic_accommodation_contacts WHERE status='approved' AND is_listed ORDER BY lower(name),id LIMIT 20";
 const start=performance.now(),page=await db.query(query),duration=performance.now()-start;
 assert.equal(page.rows.length,20);assert.equal((await db.query("SELECT count(*)::int AS n FROM public.basic_accommodation_contacts WHERE status='approved' AND is_listed")).rows[0].n,5001);
 const plan=JSON.stringify((await db.query('EXPLAIN '+query)).rows);assert.match(plan,/basic_contacts_name_idx/);
 const result=await db.query("SELECT id FROM public.basic_accommodation_contacts WHERE status='approved' AND is_listed AND search_vector @@ plainto_tsquery('pg_catalog.german','04999')");assert.equal(result.rows.length,1);
 console.log(JSON.stringify({localOnly:true,syntheticContacts:5000,firstPageMs:Math.round(duration*100)/100,nameIndexUsed:true}));
});
