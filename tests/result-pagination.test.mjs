import test from 'node:test';import assert from 'node:assert/strict';import './helpers/load-ts.mjs';
import {createResultStream} from '../src/lib/result-stream.ts';
import {searchResultBatch,mergeSearchHits,readSearchCursor} from '../src/lib/portal-search-values.ts';
const hit=(type,id,rank)=>({type,id,title:id,rank,url:'/public/'+id,excerpt:''});
test('two ordered search cursors preserve all mixed ranks with twenty profile rows per RPC window',()=>{
 const profiles=Array.from({length:127},(_,i)=>hit('accommodation','p'+String(i).padStart(3,'0'),1000-i*5));const other=Array.from({length:43},(_,i)=>hit(i%2?'ad':'theme','a'+i,999-i*11));
 for(const type of [undefined,'accommodation','theme','ad']){
  let cursor={profiles:0,other:0},all=[],rounds=0;const expected=mergeSearchHits([...profiles,...other]).filter(h=>!type||h.type===type);
  while(cursor){const batch=searchResultBatch(profiles.slice(cursor.profiles,cursor.profiles+20),other,127,type,cursor);assert.ok(batch.hits.length<=20);assert.equal(batch.total,expected.length);all.push(...batch.hits);cursor=batch.nextCursor;assert.ok(++rounds<20);}
  assert.deepEqual(all,expected);assert.equal(new Set(all.map(h=>h.type+':'+h.id)).size,expected.length);
 }
 assert.deepEqual(readSearchCursor(-1,'invalid'),{profiles:0,other:0});
});
const response=page=>new Response(JSON.stringify(page),{headers:{'content-type':'application/json'}});
const make=(request,initial={items:[{id:'first'}],nextCursor:20,total:51})=>createResultStream({initial,firstCursor:0,url:c=>'/page?offset='+c,itemKey:x=>x.id,request});
test('one in-flight request, append/dedup, stable totals, terminal cursor and no overrun',async()=>{
 let resolve,calls=0;const store=make(async()=>{calls++;return await new Promise(r=>resolve=r);});const task=store.load();await store.load();assert.equal(calls,1);resolve(response({items:[{id:'first'},{id:'second'}],nextCursor:40,total:51}));await task;assert.deepEqual(store.snapshot().items.map(x=>x.id),['first','second']);assert.equal(store.snapshot().total,51);
 const final=store.load();resolve(response({items:[{id:'last'}],nextCursor:null,total:51}));await final;await store.load();assert.equal(calls,2);assert.equal(store.snapshot().items.length,3);
});
test('failure retains cards; retry is manual; non-progressing cursor stops automatic loops',async()=>{
 let fail=true,calls=0;const store=make(async()=>{calls++;return fail?new Response('',{status:503}):response({items:[{id:'new'}],nextCursor:null,total:51});});await store.load();assert.equal(store.snapshot().items.length,1);assert.ok(store.snapshot().error);assert.equal(calls,1);fail=false;await store.load();assert.equal(store.snapshot().items.length,2);
 const stalled=make(async()=>response({items:[{id:'new'}],nextCursor:20,total:51}));await stalled.load();assert.ok(stalled.snapshot().error);assert.equal(stalled.snapshot().items.length,1);
});
test('disposed old query cannot publish delayed data; strict restart aborts prior request',async()=>{
 let finish;const old=make(async()=>await new Promise(r=>finish=r));const task=old.load();old.dispose();finish(response({items:[{id:'wrong-query'}],nextCursor:null,total:1}));await task;assert.deepEqual(old.snapshot().items.map(x=>x.id),['first']);
 const fresh=createResultStream({firstCursor:0,url:c=>'/new?offset='+c,itemKey:item=>item.id,request:async()=>response({items:[{id:'new-query'}],nextCursor:null,total:1})});fresh.start();await new Promise(r=>setTimeout(r,0));assert.deepEqual(fresh.snapshot().items.map(x=>x.id),['new-query']);fresh.dispose();
});

test('strict effect restart aborts the first initial request and accepts only the current response',async()=>{const pending=[];const store=createResultStream({firstCursor:0,url:c=>'/page?offset='+c,itemKey:item=>item.id,request:async(_,options)=>await new Promise(resolve=>pending.push({resolve,signal:options.signal}))});store.start();store.dispose();assert.equal(pending[0].signal.aborted,true);store.start();assert.equal(pending.length,2);pending[0].resolve(response({items:[{id:'obsolete'}],nextCursor:null,total:1}));pending[1].resolve(response({items:[{id:'current'}],nextCursor:null,total:1}));await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(store.snapshot().items.map(x=>x.id),['current']);assert.equal(store.snapshot().loading,false);store.dispose();});
