import test,{before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMediaTestDatabase} from './helpers/media-database.mjs';
const admin='33333333-3333-4333-8333-333333333333',owner='11111111-1111-4111-8111-111111111111';let db,baseline;
const read=name=>readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
async function actor(role='anon',id=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await db.exec('set local role '+role);}
async function denied(sql,args=[],pattern){await db.exec('savepoint denied');await assert.rejects(db.query(sql,args),pattern);await db.exec('rollback to savepoint denied;release savepoint denied');}
const data={company_name:'QA Unterkunft',contact_name:'QA Kontakt',contact_email:'qa@example.test',contact_phone:'0123456789',website:'',message:'Anfrage ohne Werbeauswahl',consent:true,fax:'',details:{internal_name:'Angebotsanfrage',target_url:'https://example.test/',requested_start_date:'',requested_end_date:'',targets:[]}};
const submit=(value=data,key=crypto.randomUUID())=>db.query('select submit_portal_offer_request($1,$2)',[value,key]);
before(async()=>{
 db=await createMediaTestDatabase(true);await db.exec('alter table storage.objects add column metadata jsonb;grant select,insert,update,delete on storage.objects to anon');await db.exec('create table auth.users(id uuid primary key)');await db.query('insert into portal_admins values($1)',[admin]);
 await db.query("insert into companies values($1,$1,'Bestand')",[owner]);await db.query("insert into company_profiles(id,company_id,display_name,status) values($1,$1,'Bestand','draft')",[owner]);
 for(const name of ['20260917203041_company_ad_campaigns.sql','20260918202110_company_ad_campaign_targets.sql','20260925091403_company_directory_order.sql','20260925103400_directory_demo_and_sidebar_order.sql','20260925160039_expand_legacy_advertising_rail.sql','20260930120000_ad_target_placements.sql'])await db.exec(await read(name));
 await db.exec("create table travel_terms(dimension text,slug text);insert into travel_terms values('theme','wellnessangebote')");
 for(const name of ['20260930143000_portal_ad_target_areas.sql','20260930170000_editorial_ad_campaigns.sql'])await db.exec(await read(name));
 await db.exec("alter table company_ad_campaigns add column archived_at timestamptz,add column deletion_requested_at timestamptz;create table company_quality_requests(profile_id uuid,requested_at timestamptz,status text);");
 baseline=(await db.query('select * from company_profiles')).rows;
 await db.exec(await read('20261010090721_public_offer_requests.sql'));
 await db.exec(await read('20261010100250_restore_original_offer_form.sql'));
 await db.exec(await read('20261010104719_offer_image_storage_preflight.sql'));
 await db.exec(await read('20261029153903_portal_offer_request_workspaces.sql'));
 await db.exec(await read('20261029200937_offer_request_mail_receipts.sql'));
 await db.exec('grant select on company_quality_requests to authenticated');
 await db.exec('alter table company_ad_campaigns add column lifecycle_group_id uuid');
 await db.exec(await read('20261110143023_portal_offer_request_lifecycle.sql'));
 await db.exec('create trigger guard_archived_ad_campaign before update on company_ad_campaigns for each row execute function private.guard_archived_ad_campaign()');
});after(async()=>db?.close());beforeEach(async()=>db.exec('begin'));afterEach(async()=>db.exec('rollback'));


const lifecycle=(id,action)=>db.query('select admin_offer_request_lifecycle($1,$2)',[id,action]);
async function request(){const id=crypto.randomUUID();await actor();await submit(data,id);await actor('authenticated',admin);return id;}
test('archive preserves original request, status, notes and image reference; restore keeps identity',async()=>{
 const id=await request();await db.query('select save_portal_offer_request_workspace($1,$2,$3,$4,$5)',[id,'in_progress',{company_name:'Interner Zusatz'},'Telefonat',0]);
 const before=(await db.query('select * from company_ad_campaigns where id=$1',[id])).rows[0];
 await lifecycle(id,'archive');let row=(await db.query('select * from company_ad_campaigns where id=$1',[id])).rows[0];assert.ok(row.archived_at);assert.equal(row.request_status,'in_progress');
 assert.equal(row.request_message,before.request_message);assert.equal((await db.query('select notes from portal_offer_request_workspaces where request_id=$1',[id])).rows[0].notes[0].text,'Telefonat');
 await denied('select save_portal_offer_request_workspace($1,$2,$3,$4,$5)',[id,'in_progress',{},'Notiz trotz Archiv',1],/not found/);
 await lifecycle(id,'restore');row=(await db.query('select * from company_ad_campaigns where id=$1',[id])).rows[0];assert.equal(row.archived_at,null);assert.equal(row.id,id);assert.equal(row.request_status,'in_progress');
 await db.query('select save_portal_offer_request_workspace($1,$2,$3,$4,$5)',[id,'done',{},'Wieder bearbeitbar',1]);
});
test('anonymous and non-admin identities cannot archive, restore or delete requests',async()=>{
 const id=await request();for(const role of ['anon','authenticated']){await actor(role,role==='anon'?'':owner);for(const action of ['archive','restore','prepare_delete','delete'])await denied('select admin_offer_request_lifecycle($1,$2)',[id,action]);}
});
test('permanent deletion requires prepared archive and removes dependent workspace/receipt',async()=>{
 const id=await request();await db.query('select save_portal_offer_request_workspace($1,$2,$3,$4,$5)',[id,'new',{},'Nur Testnotiz',0]);
 await db.query('select claim_offer_request_mail($1)',[id]);await actor('postgres');assert.equal((await db.query('select count(*)::int n from private.offer_request_mail_receipts where request_id=$1',[id])).rows[0].n,1);await actor('authenticated',admin);
 await denied('select admin_offer_request_lifecycle($1,$2)',[id,'delete'],/Confirmed/);await lifecycle(id,'archive');await denied('select admin_offer_request_lifecycle($1,$2)',[id,'delete'],/Confirmed/);
 await lifecycle(id,'prepare_delete');await denied('select admin_offer_request_lifecycle($1,$2)',[id,'restore'],/Deletion/);await lifecycle(id,'delete');
 assert.equal((await db.query('select id from company_ad_campaigns where id=$1',[id])).rows.length,0);assert.equal((await db.query('select request_id from portal_offer_request_workspaces where request_id=$1',[id])).rows.length,0);await actor('postgres');assert.equal((await db.query('select count(*)::int n from private.offer_request_mail_receipts where request_id=$1',[id])).rows[0].n,0);
});
test('remaining media blocks final deletion and other requests stay intact',async()=>{
 const id=await request(),other=await request();await lifecycle(id,'archive');await lifecycle(id,'prepare_delete');await actor('postgres');const image='campaigns/'+id+'/creative/'+crypto.randomUUID()+'.png';await db.query("insert into storage.objects(bucket_id,name) values('ad-media',$1)",[image]);
 await actor('authenticated',admin);await denied('select admin_offer_request_lifecycle($1,$2)',[id,'delete'],/Clean up media/);await actor('postgres');await db.query('delete from storage.objects where name=$1',[image]);await actor('authenticated',admin);await lifecycle(id,'delete');assert.equal((await db.query('select id from company_ad_campaigns where id=$1',[other])).rows.length,1);
});
test('source fields remain immutable and non-request campaigns cannot use request lifecycle',async()=>{
 const id=await request();await actor('postgres');await denied("update company_ad_campaigns set contact_name='Changed' where id=$1",[id],/immutable/);await actor('authenticated',admin);await denied('select admin_offer_request_lifecycle($1,$2)',[owner,'archive'],/not found/);await denied('select admin_offer_request_lifecycle($1,$2)',[id,'reuse'],/Invalid/);
});
