import test,{before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMediaTestDatabase} from './helpers/media-database.mjs';
const admin='33333333-3333-4333-8333-333333333333',owner='11111111-1111-4111-8111-111111111111';let db,baseline;
const read=name=>readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
async function actor(role='anon',id=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await db.exec('set local role '+role);}
async function denied(sql,args=[],pattern){await db.exec('savepoint denied');await assert.rejects(db.query(sql,args),pattern);await db.exec('rollback to savepoint denied;release savepoint denied');}
const data={company_name:'QA Unterkunft',contact_name:'QA Kontakt',contact_email:'qa@example.test',contact_phone:'',website:'',message:'Anfrage ohne Werbeauswahl',consent:true,fax:''};
const submit=(value=data,key=crypto.randomUUID())=>db.query('select submit_portal_offer_request($1,$2)',[value,key]);
before(async()=>{
 db=await createMediaTestDatabase(true);await db.exec('create table auth.users(id uuid primary key)');await db.query('insert into portal_admins values($1)',[admin]);
 await db.query("insert into companies values($1,$1,'Bestand')",[owner]);await db.query("insert into company_profiles(id,company_id,display_name,status) values($1,$1,'Bestand','draft')",[owner]);
 for(const name of ['20260917203041_company_ad_campaigns.sql','20260918202110_company_ad_campaign_targets.sql','20260925091403_company_directory_order.sql','20260925103400_directory_demo_and_sidebar_order.sql','20260925160039_expand_legacy_advertising_rail.sql','20260930120000_ad_target_placements.sql'])await db.exec(await read(name));
 await db.exec("create table travel_terms(dimension text,slug text);insert into travel_terms values('theme','wellnessangebote')");
 for(const name of ['20260930143000_portal_ad_target_areas.sql','20260930170000_editorial_ad_campaigns.sql'])await db.exec(await read(name));
 await db.exec("alter table company_ad_campaigns add column archived_at timestamptz,add column deletion_requested_at timestamptz;create table company_quality_requests(profile_id uuid,requested_at timestamptz,status text);");
 baseline=(await db.query('select * from company_profiles')).rows;
 await db.exec(await read('20261010090721_public_offer_requests.sql'));
 await db.exec('grant select on company_quality_requests to authenticated');
});after(async()=>db?.close());beforeEach(async()=>db.exec('begin'));afterEach(async()=>db.exec('rollback'));
test('anonymous submission persists once without profile/banner/targets; no anonymous read or direct insert',async()=>{
 const key=crypto.randomUUID();await actor();await submit(data,key);await submit(data,key);
 await denied('select * from company_ad_campaigns');await denied("insert into company_ad_campaigns(internal_name) values('bypass')");
 await actor('authenticated',owner);assert.equal((await db.query('select * from company_ad_campaigns')).rows.length,0);
 await actor('authenticated',admin);const rows=(await db.query('select * from company_ad_campaigns')).rows;assert.equal(rows.length,1);const c=rows[0];assert.equal(c.request_status,'new');assert.equal(c.profile_id,null);assert.equal(c.is_editorial,false);assert.equal(c.status,'draft');assert.equal(c.image_path,null);assert.equal(c.contact_email,data.contact_email);assert.equal((await db.query('select * from company_ad_campaign_targets')).rows.length,0);
 await actor('postgres');assert.deepEqual((await db.query('select * from company_profiles')).rows,baseline);
});
test('admin statuses remain discoverable; owners/guests cannot update; general inquiry cannot be published or booked',async()=>{
 await actor();await submit();await actor('postgres');const id=(await db.query('select id from company_ad_campaigns')).rows[0].id;
 for(const [role,user] of [['anon',''],['authenticated',owner]]){await actor(role,user);await denied('select set_portal_offer_request_status($1,$2)',[id,'done']);}
 await actor('authenticated',admin);for(const status of ['in_progress','done','new'])await db.query('select set_portal_offer_request_status($1,$2)',[id,status]);
 await denied('select set_portal_offer_request_status($1,$2)',[id,'approved']);
 await actor('postgres');await denied("update company_ad_campaigns set status='approved' where id=$1",[id],/immutable/);await denied("update company_ad_campaigns set request_status=null where id=$1",[id]);await denied("insert into company_ad_campaign_targets(campaign_id,target_type,placement) values($1,'homepage','sidebar_top')",[id],/cannot have booking/);
 assert.equal((await db.query('select count(*) n from company_ad_campaigns')).rows[0].n,1);
});
test('validation, consent, honeypot, limits and repeated submission are enforced inside SQL',async()=>{
 await actor();for(const value of [{...data,consent:false},{...data,company_name:123},{...data,message:{bad:'type'}},{...data,fax:'spam'},{...data,company_name:''},{...data,contact_email:'bad'},{...data,message:'x'.repeat(5001)},{...data,website:'javascript:alert(1)'}])await denied('select submit_portal_offer_request($1,$2)',[value,crypto.randomUUID()],/invalid offer/);
 for(let i=0;i<3;i++)await submit();await denied('select submit_portal_offer_request($1,$2)',[data,crypto.randomUUID()],/rate limit/);
});
test('public wrappers are invoker; private implementation has fixed search path and explicit grants, no table rights expanded',async()=>{
 const rows=(await db.query("select n.nspname,p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('submit_portal_offer_request','set_portal_offer_request_status')")).rows;
 assert.ok(rows.filter(r=>r.nspname==='public').every(r=>!r.prosecdef));assert.ok(rows.every(r=>r.proconfig?.includes('search_path=""')));
 assert.equal((await db.query("select has_table_privilege('anon','company_ad_campaigns','INSERT') allowed")).rows[0].allowed,false);
});

test('same admin queue counts general requests; done stays in inventory but leaves open tasks',async()=>{
 await actor();await submit();await actor('authenticated',admin);let q=(await db.query('select editorial_work_queue() q')).rows[0].q;assert.equal(q.counts.advertising,1);assert.equal(q.tasks[0].status,'new');
 const id=q.tasks[0].id;await db.query('select set_portal_offer_request_status($1,$2)',[id,'done']);q=(await db.query('select editorial_work_queue() q')).rows[0].q;assert.equal(q.counts.advertising,0);assert.equal((await db.query('select id from company_ad_campaigns')).rows.length,1);
});
