import test,{before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createBasicIntegrationDatabase,addSyntheticBasic} from './helpers/basic-integration-database.mjs';
let db;
async function rejected(run,code){await db.exec('SAVEPOINT negative');try{await assert.rejects(run,e=>e.code===code);}finally{await db.exec('ROLLBACK TO SAVEPOINT negative; RELEASE SAVEPOINT negative');}}
const admin='77777777-7777-4777-8777-777777777777',profile='11111111-1111-4111-8111-111111111111';
const query=async(q='',filters={},cursor=null)=> (await db.query('select public.search_public_accommodations($1,$2,$3) result',[q,filters,cursor])).rows[0].result;
async function actor(role,id=''){await db.exec('RESET ROLE');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE '+role);}
before(async()=>{db=await createBasicIntegrationDatabase();
 await db.query('insert into portal_admins values($1)',[admin]);
 await db.exec("insert into travel_terms select k,'theme',k,split_part(k,':',2) from unnest(acquisition.basic_theme_keys())k;insert into travel_terms values('accommodation:pension','accommodation','Pension','pension');");
 await db.query("insert into company_profiles(id,display_name,slug,city,country,status) values($1,'Test Premium','premium','Testort','Deutschland','approved')",[profile]);
 await db.query("insert into company_profile_directory_packages values($1,'premium')",[profile]);
 // Synthetic-only fixture override. The Cloud proposal retains both barriers.
 await db.exec('ALTER TABLE public.basic_accommodation_contacts DROP CONSTRAINT foundation_listing_inactive;');
});
after(async()=>db?.close());
beforeEach(async()=>db.exec('BEGIN'));afterEach(async()=>{await db.exec('ROLLBACK;RESET ROLE');});
test('public provider returns only contact fields and never grants projection/private table access',async()=>{
 await addSyntheticBasic(db);await actor('anon');const r=await query();assert.equal(r.total,2);assert.equal(r.items[0].entry.kind,'profile');
 const b=r.items[1].entry;assert.deepEqual(Object.keys(b).sort(),['address','id','kind','name','phone']);assert.equal(b.address.houseNumber,'12a');assert.equal(b.address.postalCode,'01234');
 for(const sql of ['select * from acquisition.accommodations','select * from public.basic_accommodation_contacts'])await rejected(()=>db.exec(sql),'42501');
});
test('private website/email/notes and theme labels produce no Basic free-text hits; name/location do',async()=>{
 await addSyntheticBasic(db);
 await actor('anon');for(const q of ['Secretsuchwort','wellness','+498000000000'])assert.equal((await query(q)).items.filter(r=>r.entry.kind==='basic').length,0);
 for(const q of ['Testpension','Testort','Teststraße','01234','Deutschland'])assert.equal((await query(q)).items.filter(r=>r.entry.kind==='basic').length,1,q);
});
test('normal filters/counts include matching Basics; hidden contacts excluded; precise conjunction',async()=>{
 await addSyntheticBasic(db);await addSyntheticBasic(db,{name:'Verborgen',listed:false});await actor('anon');
 assert.equal((await query('',{theme:'wellnessangebote'})).total,1);assert.equal((await query('',{destination:'oesterreich'})).total,0);
 assert.equal((await query('',{theme:'wellnessangebote',audience:'mit-hund'})).total,0);
 const count=(await db.query("select search_public_accommodations('', '{\"theme\":\"wellnessangebote\"}',NULL,20,true,true) r")).rows[0].r;
 assert.equal(count.total,1);assert.deepEqual(count.items,[]);assert.equal(count.facets['theme:wellnessangebote'],1);
});
test('actual keyset has no offset ceiling, no duplicates at ties and respects Premium-first and cursor scope',async()=>{
 for(let i=0;i<23;i++)await addSyntheticBasic(db,{name:'Gleichnamige Pension'});
 await actor('anon');const a=await query();assert.equal(a.items.length,20);assert.equal(a.items[0].entry.id,profile);assert.equal(a.hasMore,true);
 const b=await query('',{},a.items.at(-1).after);assert.equal(b.items.length,4);assert.equal(b.hasMore,false);assert.equal(new Set([...a.items,...b.items].map(r=>r.entry.id)).size,24);
 await rejected(()=>query('Neu',{},a.items.at(-1).after),'22023');
});
test('Admin wrappers deny anonymous and ordinary signed-in users; valid Admin gets only eleven themes and no CRM',async()=>{
 const id=await addSyntheticBasic(db);
 for(const [role,user]of[['anon',''],['authenticated',profile]]){await actor(role,user);await rejected(()=>db.query('select admin_basic_categories($1)',[id]),'42501');await db.exec('RESET ROLE');}
 await actor('authenticated',admin);const r=(await db.query('select admin_basic_categories($1) r',[id])).rows[0].r;assert.equal(r.terms.length,11);assert.equal('business_email'in r,false);
 const page=(await db.query('select admin_basic_accommodations() r')).rows[0].r;assert.equal(page.total,1);assert.equal('phone'in page.items[0],false);
});
test('manual Admin changes update filters atomically and preserve verified actor/revision; invalid/stale save denied',async()=>{
 const id=await addSyntheticBasic(db);await actor('authenticated',admin);
 const r=(await db.query("select save_admin_basic_categories($1,1,ARRAY['theme:familienurlaub'],'QA') r",[id])).rows[0].r;assert.equal(r.revision,2);assert.deepEqual(r.assignedKeys,['theme:familienurlaub']);
 await rejected(()=>db.query("select save_admin_basic_categories($1,1,ARRAY['theme:golfurlaub'],'QA')",[id]),'40001');
 await actor('postgres');const audit=(await db.query("select actor_user_id,before_values,after_values from acquisition.audit_events where event_type='basic_categories_admin'")).rows[0];assert.equal(audit.actor_user_id,admin);assert.ok(audit.before_values);assert.ok(audit.after_values);
 assert.deepEqual((await db.query('select filter_keys from basic_accommodation_contacts where id=$1',[id])).rows[0].filter_keys,['theme:familienurlaub']);
});
