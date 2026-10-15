import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const migration=await readFile(new URL('../supabase/migrations/20261015110000_special_topic_term.sql',import.meta.url),'utf8');
const seed=await readFile(new URL('../supabase/seeds/reviewed-special-topic.sql',import.meta.url),'utf8');
const ids=[...seed.matchAll(/'([a-f0-9-]{36})'/g)].map(m=>m[1]);
async function fixture(){
 const db=new PGlite();
 await db.exec(`CREATE TABLE travel_terms(term_key text PRIMARY KEY,dimension text,slug text,label text,UNIQUE(dimension,slug));
 CREATE TABLE company_profiles(id uuid PRIMARY KEY,status text);
 CREATE TABLE company_profile_public_visibility(profile_id uuid PRIMARY KEY,is_listed boolean);
 CREATE TABLE company_profile_travel_terms(profile_id uuid REFERENCES company_profiles(id),term_key text REFERENCES travel_terms(term_key),seasonal_teaser text,PRIMARY KEY(profile_id,term_key));
 INSERT INTO travel_terms VALUES ('theme:saison-herbst','theme','saison-herbst','Herbst'),('audience:paar','audience','paar','Paare');`);
 for(const id of ids){await db.query("INSERT INTO company_profiles VALUES($1,'approved')",[id]);await db.query("INSERT INTO company_profile_travel_terms VALUES($1,'theme:saison-herbst','Unverändert'),($1,'audience:paar',null)",[id]);}
 return db;
}
test('catalog migration adds only one term, is repeatable, and preserves all assignments and profiles',async()=>{
 const db=await fixture();try{
 const before=(await db.query('SELECT * FROM company_profile_travel_terms ORDER BY profile_id,term_key')).rows;
 await db.exec(migration);await db.exec(migration);
 assert.equal((await db.query("SELECT count(*) n FROM travel_terms WHERE dimension='feature'")).rows[0].n,1);
 assert.deepEqual((await db.query('SELECT * FROM company_profile_travel_terms ORDER BY profile_id,term_key')).rows,before);
 await db.exec("UPDATE travel_terms SET label='Different' WHERE term_key='feature:sonderthema'");
 await assert.rejects(()=>db.exec(migration),/Conflicting/);
 }finally{await db.close();}
});
test('reviewed transfer adds exactly four independent keys; all old assignments, teasers and publication states remain',async()=>{
 const db=await fixture();try{
 await db.exec(migration);
 const profiles=(await db.query('SELECT * FROM company_profiles ORDER BY id')).rows;
 const before=(await db.query('SELECT * FROM company_profile_travel_terms ORDER BY profile_id,term_key')).rows;
 await db.exec(seed);
 assert.equal((await db.query("SELECT count(*) n FROM company_profile_travel_terms WHERE term_key='feature:sonderthema'")).rows[0].n,4);
 assert.deepEqual((await db.query("SELECT * FROM company_profile_travel_terms WHERE term_key<>'feature:sonderthema' ORDER BY profile_id,term_key")).rows,before);
 assert.deepEqual((await db.query('SELECT * FROM company_profiles ORDER BY id')).rows,profiles);
 await assert.rejects(()=>db.exec(seed),/baseline changed/);
 }finally{await db.close();}
});
test('missing, draft, unlisted, no-autumn or prior special decisions abort before any transfer',async()=>{
 for(const change of [
  "DELETE FROM company_profile_travel_terms WHERE profile_id=$1",
  "UPDATE company_profiles SET status='draft' WHERE id=$1",
  "INSERT INTO company_profile_public_visibility VALUES($1,false)",
  "DELETE FROM company_profile_travel_terms WHERE profile_id=$1 AND term_key='theme:saison-herbst'",
  "INSERT INTO company_profile_travel_terms(profile_id,term_key) VALUES($1,'feature:sonderthema')"
 ]){
  const db=await fixture();try{
   await db.exec(migration);await db.query(change,[ids[0]]);
   const before=(await db.query('SELECT * FROM company_profile_travel_terms ORDER BY profile_id,term_key')).rows;
   await assert.rejects(()=>db.exec(seed),/baseline changed/);
   assert.deepEqual((await db.query('SELECT * FROM company_profile_travel_terms ORDER BY profile_id,term_key')).rows,before);
  }finally{await db.close();}
 }
});
