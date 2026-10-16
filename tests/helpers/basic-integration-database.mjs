import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
export const integrationFile='20261016152914_basic_search_admin_pilot.sql';
const read=name=>readFile(new URL('../../supabase/'+name,import.meta.url),'utf8');
export async function basicIntegrationSchema(){
 const search=await read('migrations/20261001190000_public_portal_search.sql');
 return `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE TABLE public.portal_admins(user_id uuid PRIMARY KEY); GRANT SELECT ON public.portal_admins TO authenticated;
 CREATE FUNCTION public.can_review_travel_profiles() RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$ SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT FROM public.portal_admins WHERE user_id=auth.uid()) $$;
 CREATE TABLE public.company_profiles(id uuid PRIMARY KEY,display_name text,slug text,city text,country text,status text,phone text,street text,postal_code text,website text);
 CREATE TABLE public.travel_terms(term_key text PRIMARY KEY,dimension text,label text,slug text);
 CREATE TABLE public.company_profile_travel_terms(profile_id uuid,term_key text,seasonal_teaser text);
 CREATE TABLE public.company_profile_directory_packages(profile_id uuid PRIMARY KEY,package text);
 CREATE TABLE public.company_directory_order(profile_id uuid PRIMARY KEY,sort_order integer,demo_slug text);
 CREATE TABLE public.company_profile_imports(profile_id uuid PRIMARY KEY,imported_at timestamptz);
 CREATE VIEW public.portal_search_documents AS SELECT id,display_name title,'/unterkuenfte/'||slug url,city location,''::text terms,''::text headings,''::text body,to_tsvector('german',display_name||' '||city) document FROM public.company_profiles WHERE status='approved';
 ${search.slice(search.indexOf('CREATE FUNCTION public.portal_search_normalize'),search.indexOf('-- Useful row-level'))}
 `+await read('migrations/20261016131421_basic_acquisition_master_foundation.sql')+await read('proposals/'+integrationFile);
}
export async function createBasicIntegrationDatabase(){const db=new PGlite();await db.exec(await basicIntegrationSchema());return db;}
export async function addSyntheticBasic(db,{id=crypto.randomUUID(),name='Testpension',city='Testort',country='DE',keys=['theme:wellnessangebote'],listed=true}={}){
 const source=crypto.randomUUID(),run=crypto.randomUUID(),observation=crypto.randomUUID();
 await db.exec('SAVEPOINT add_basic; SET CONSTRAINTS ALL DEFERRED;');
 await db.query("insert into acquisition.source_registry(id,source_key,rule_version,operator_name,dataset_name,access_method,terms_url,valid_from,request_budget,byte_budget)values($1,$2,'v1','Synthetic','Synthetic','manual','https://example.invalid/terms',now(),1,100)",[source,source]);
 await db.query("insert into acquisition.processing_runs(id,run_type,rule_version)values($1,'research','test')",[run]);
 await db.query("insert into acquisition.accommodations(id,name,primary_observation_id,review_note)values($1,$2,$3,'Secretsuchwort')",[id,name,observation]);
 await db.query("insert into acquisition.observations(id,accommodation_id,source_id,run_id,source_key,fact_type,url,facts,observed_at,fingerprint)values($1,$2,$3,$4,$5,'identity','https://example.invalid','{}',now(),repeat('a',64))",[observation,id,source,run,source]);
 // Only isolated synthetic tests bypass the inactive listing barrier. No such
 // operation is part of the application migration or approved cloud import.
 await db.query("insert into public.basic_accommodation_contacts(id,name,address,phone,is_listed,filter_keys,accommodation_type)values($1,$2,$3,'+498000000000',$4,$5,'accommodation:pension')",[id,name,{city,region:'Testregion',country,street:'Teststraße',houseNumber:'12a',postalCode:'01234'},listed,keys]);
 await db.exec('SET CONSTRAINTS ALL IMMEDIATE; RELEASE SAVEPOINT add_basic;');return id;
}
