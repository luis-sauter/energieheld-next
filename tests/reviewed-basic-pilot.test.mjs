import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createBasicIntegrationDatabase} from './helpers/basic-integration-database.mjs';
import {reviewedPilotSql,validateReviewedPilot} from '../scripts/lib/reviewed-basic-pilot.mjs';
export const fixture=()=>({version:'reviewed-basic-pilot-v1',runId:crypto.randomUUID(),checkedAt:'2026-10-16T10:00:00Z',rightsAttestation:'Synthetic rights fixture, not a real licence',records:[{
 id:crypto.randomUUID(),sourceId:crypto.randomUUID(),municipalityId:crypto.randomUUID(),municipalityCode:'09277113',municipalityName:'Testort',regionCode:'DE-BY',
 name:'Synthetic Pilot Hotel',phone:'+498000000111',accommodationType:'accommodation:hotel',address:{street:'Teststraße',houseNumber:'7',postalCode:'01234',city:'Testort',region:'Bayern',country:'DE'},
 contactUrl:'https://example.invalid/contact',themeUrl:'https://example.invalid/spa',priceUrl:'https://example.invalid/prices',municipalityUrl:'https://official.invalid/09277113',termsUrl:'https://example.invalid/terms',
 theme:{key:'theme:wellnessangebote',fact:'Synthetic spa evidence'},price:{amount:85,tax:3.4,start:'2026-02-01',end:'2027-01-06',board:'Frühstück'}
}]});
let db;
beforeEach(async()=>{db=await createBasicIntegrationDatabase();await db.exec("insert into travel_terms select k,'theme',k,split_part(k,':',2) from unnest(acquisition.basic_theme_keys())k;insert into travel_terms values('accommodation:hotel','accommodation','Hotel','hotel');");await db.exec(await readFile(new URL('../supabase/proposals/20261016154647_basic_reviewed_pilot_publication.sql',import.meta.url),'utf8'));});
afterEach(async()=>db?.close());
test('reviewed pilot publishes one contact, keeps separated address fields, replay preserves manual decisions and never republishes',async()=>{
 const manifest=fixture(),sql=reviewedPilotSql(manifest),id=manifest.records[0].id;
 await db.exec(sql);
 const first=(await db.query("select search_public_accommodations('Synthetic') r")).rows[0].r;
 assert.equal(first.total,1);assert.equal(first.items[0].entry.kind,'basic');assert.equal(first.items[0].entry.address.houseNumber,'7');assert.equal(first.items[0].entry.address.postalCode,'01234');
 const snapshot=(await db.query("select revision,manual_theme_decisions from acquisition.accommodations where id=$1",[id])).rows[0];
 await db.exec(sql);assert.deepEqual((await db.query('select revision,manual_theme_decisions from acquisition.accommodations where id=$1',[id])).rows[0],snapshot);
 await db.query("insert into portal_admins values('77777777-7777-4777-8777-777777777777')");
 await db.exec("set request.jwt.claim.sub='77777777-7777-4777-8777-777777777777';set role authenticated");
 await db.query("select save_admin_basic_categories($1,$2,ARRAY['theme:familienurlaub'],'Synthetic manual correction')",[id,snapshot.revision]);await db.exec('RESET ROLE');
 await db.exec(sql);assert.deepEqual((await db.query('select effective_theme_keys from acquisition.accommodations where id=$1',[id])).rows[0].effective_theme_keys,['theme:familienurlaub']);
 assert.equal((await db.query("select search_public_accommodations('', '{\"theme\":\"familienurlaub\"}') r")).rows[0].r.total,1);
 const revision=(await db.query('select revision from acquisition.accommodations where id=$1',[id])).rows[0].revision;
 await db.exec("set role authenticated");await db.query("select save_admin_basic_categories($1,$2,ARRAY[]::text[],'Remove last category')",[id,revision]);await db.exec('RESET ROLE');
 assert.equal((await db.query('select visibility_status from acquisition.accommodations where id=$1',[id])).rows[0].visibility_status,'withdrawn');
 await db.exec(sql);assert.equal((await db.query('select is_listed from basic_accommodation_contacts where id=$1',[id])).rows[0].is_listed,false);
});
test('changed replay aborts, no ambiguous duplicate or partial batch survives',async()=>{
 const manifest=fixture(),sql=reviewedPilotSql(manifest);await db.exec(sql);
 const changed=structuredClone(manifest);changed.records[0].name='Changed';await assert.rejects(db.exec(reviewedPilotSql(changed)));await db.exec('ROLLBACK');
 const duplicate=fixture();duplicate.records[0].phone=manifest.records[0].phone;
 await assert.rejects(db.exec(reviewedPilotSql(duplicate)));await db.exec('ROLLBACK');
 assert.equal((await db.query('select count(*) n from acquisition.processing_runs where id=$1',[duplicate.runId])).rows[0].n,0);
});
test('malformed/unreviewed/over-budget input cannot create a ready pilot SQL',()=>{
 for(const mutate of [m=>m.rightsAttestation='',m=>m.records[0].price.amount=250,m=>m.records[0].price.tax=NaN,m=>m.records[0].phone='',m=>m.records[0].address.houseNumber=undefined,m=>m.records[0].themeUrl='https://other.invalid/spa']){const m=fixture();mutate(m);assert.throws(()=>validateReviewedPilot(m));}
});
