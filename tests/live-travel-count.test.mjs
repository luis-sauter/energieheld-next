import test from 'node:test';import assert from 'node:assert/strict';import './helpers/load-ts.mjs';
import {createLiveCount,createCountCache,LIVE_COUNT_TTL} from '../src/lib/live-travel-count.ts';
const flush=()=>new Promise(r=>setImmediate(r));const response=total=>new Response(JSON.stringify({total}));
test('debounce coalesces fast B/Ba/Bay/Bayern typing and caches backward edits without polling',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const calls=[];const stream=createLiveCount({request:async url=>{calls.push(url);return response(7)}});
 for(const q of ['B','Ba','Bay','Bayern']){stream.update('q='+q);t.mock.timers.tick(70);}assert.equal(calls.length,0);t.mock.timers.tick(300);await flush();assert.equal(calls.length,1);assert.deepEqual(stream.snapshot(),{key:'q=Bayern',status:'ready',total:7});
 stream.update('q=Bay');t.mock.timers.tick(300);await flush();assert.equal(calls.length,2);stream.update('q=Bayern');assert.equal(stream.snapshot().total,7);t.mock.timers.tick(99999);assert.equal(calls.length,2);stream.update('');assert.equal(stream.snapshot().status,'idle');stream.dispose();
});
test('one in-flight request; only latest debounced filter/query proceeds, stale count never publishes',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const pending=[];const stream=createLiveCount({request:(url,options)=>new Promise(resolve=>pending.push({url,options,resolve}))});
 stream.update('q=B');t.mock.timers.tick(300);assert.equal(pending.length,1);stream.update('q=Ba');t.mock.timers.tick(300);stream.update('q=Bayern&ziel=deutschland');t.mock.timers.tick(300);assert.equal(pending.length,1);pending[0].resolve(response(90));await flush();assert.equal(pending.length,2);assert.equal(stream.snapshot().status,'loading');assert.equal(stream.snapshot().total,undefined);assert.match(pending[1].url,/Bayern/);pending[1].resolve(response(3));await flush();assert.equal(stream.snapshot().total,3);stream.dispose();
});
test('cache expires and is bounded, seed skips requests, errors do not auto-retry, disposal aborts',async t=>{
 let now=0;const cache=createCountCache(()=>now);for(let i=0;i<33;i++)cache.set('key'+i,i);assert.equal(cache.get('key0'),undefined);assert.equal(cache.get('key32'),32);now=LIVE_COUNT_TTL;assert.equal(cache.get('key32'),undefined);
 t.mock.timers.enable({apis:['setTimeout']});let calls=0,signal;const stream=createLiveCount({request:async(_url,opts)=>{calls++;signal=opts.signal;return new Response('{}',{status:503})}});stream.update('q=Wellness',51);t.mock.timers.tick(300);assert.equal(calls,0);assert.equal(stream.snapshot().total,51);stream.update('q=bad');t.mock.timers.tick(300);await flush();assert.equal(stream.snapshot().status,'error');t.mock.timers.tick(99999);assert.equal(calls,1);stream.dispose();assert.equal(signal.aborted,true);
});

test('submitting before the debounce deadline cancels the unused preview; a later edit can restart',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let calls=0;const stream=createLiveCount({request:async()=>{calls++;return response(1)}});stream.update('q=B');stream.dispose();t.mock.timers.tick(300);await flush();assert.equal(calls,0);stream.start();stream.update('q=Bay');t.mock.timers.tick(300);await flush();assert.equal(calls,1);assert.equal(stream.snapshot().total,1);stream.dispose();
});
