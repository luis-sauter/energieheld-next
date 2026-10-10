import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/load-ts.mjs';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};return next(s,c);}});
const {loadProfileImports}=await import('../src/lib/profile-import.ts');
function client({user=true,admin=true,error=false}={}){
 const calls=[];
 return {calls,auth:{getUser:async()=>({data:{user:user?{id:'verified-admin',user_metadata:{role:'admin'}}:null},error:null})},from(table){calls.push(table);return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:admin?{user_id:'verified-admin'}:null,error:null}),in:async(_,ids)=>({data:error?null:ids.map(profile_id=>({profile_id,source_url:'https://example.com/',imported_at:'2026-10-10T00:00:00Z',review_note:'Pending rights'})),error:error?{message:'unavailable'}:null})};}};
}
test('import provenance batches only requested profile IDs after verified admin access',async()=>{const c=client();let r=await loadProfileImports(c,['one','two']);assert.deepEqual([...r.keys()],['one','two']);assert.deepEqual(c.calls,['portal_admins','company_profile_imports']);});
test('guest cannot request import provenance',async()=>{let c=client({user:false});assert.equal((await loadProfileImports(c,['one'])).size,0);assert.deepEqual(c.calls,[]);});
test('user metadata cannot grant access to private import notes',async()=>{let c=client({admin:false});assert.equal((await loadProfileImports(c,['one'])).size,0);assert.deepEqual(c.calls,['portal_admins']);});
test('empty page and unavailable optional provenance preserve existing profile UI',async()=>{let c=client();assert.equal((await loadProfileImports(c,[])).size,0);assert.deepEqual(c.calls,[]);assert.equal((await loadProfileImports(client({error:true}),['one'])).size,0);});
