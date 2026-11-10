import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/load-ts.mjs';
const {changeOfferRequestLifecycle}=await import('../src/lib/offer-request-lifecycle.ts');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function fixture({admin=true,archived=false,cleanupFails=false,request=true}={}){
 const calls=[];let removed=false;
 const client={auth:{getUser:async()=>({data:{user:{id}},error:null})},from(table){const q={select(){return q},eq(){return q},maybeSingle:async()=>table==='portal_admins'?{data:admin?{user_id:id}:null}:{data:{id,request_status:request?'new':null,archived_at:archived?'2026-11-10':null}}};return q},rpc:async(name,args)=>{calls.push([name,args.p_action]);return {data:id,error:null}},storage:{from:()=>({list:async()=>({data:removed?[]:[{name:id+'.png'}],error:null}),remove:async paths=>{calls.push(['remove',...paths]);if(cleanupFails)return {error:{}};removed=true;return {data:paths,error:null}}})}};return{client,calls};
}
function form(action,confirmed=true){const f=new FormData();f.set('id',id);f.set('action',action);if(confirmed)f.set('confirmed','yes');return f;}
test('rejects non-admin and missing confirmation without invoking lifecycle',async()=>{for(const opts of [{admin:false},{}]){const f=fixture(opts);assert.ok((await changeOfferRequestLifecycle(f.client,form('delete',opts.admin===false))).error);assert.deepEqual(f.calls,[]);}});
test('archive and restore use request RPC and return useful destinations',async()=>{for(const action of ['archive','restore']){const f=fixture();const r=await changeOfferRequestLifecycle(f.client,form(action));assert.ok(r.success);assert.deepEqual(f.calls,[['admin_offer_request_lifecycle',action]]);assert.ok(r.redirectTo.includes(action==='archive'?'archiv=1':id));}});
test('delete archives first, prepares, removes exact request media, then deletes',async()=>{const f=fixture();assert.ok((await changeOfferRequestLifecycle(f.client,form('delete'))).success);assert.deepEqual(f.calls.map(x=>x[1]),['archive','prepare_delete','campaigns/'+id+'/creative/'+id+'.png','delete']);});
test('storage error leaves archived record for retry and never invokes final deletion',async()=>{const f=fixture({archived:true,cleanupFails:true});assert.ok((await changeOfferRequestLifecycle(f.client,form('delete'))).error);assert.ok(!f.calls.some(x=>x[1]==='delete'));});
test('banner campaigns cannot be passed to request lifecycle',async()=>{const f=fixture({request:false});assert.ok((await changeOfferRequestLifecycle(f.client,form('delete'))).error);assert.deepEqual(f.calls,[]);});
