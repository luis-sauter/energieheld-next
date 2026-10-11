import test from'node:test';import assert from'node:assert/strict';import'./helpers/load-ts.mjs';
const{retryMediaRead}=await import('../src/lib/media-read-retry.ts');
test('overload and SQL timeouts are not retried into the saturated service',async()=>{
 for(const error of[{status:429},{status:544},{statusCode:'544'},{code:'57014',status:500}]){
  let calls=0;const result={data:null,error};assert.equal(await retryMediaRead(async()=>{calls++;return result;}),result);assert.equal(calls,1);
 }
});
test('one existing transient network retry remains bounded; permission errors are never retried',async()=>{
 let calls=0;const success={data:[],error:null};assert.equal(await retryMediaRead(async()=>++calls===1?{error:{message:'fetch failed'}}:success),success);assert.equal(calls,2);
 calls=0;await retryMediaRead(async()=>{calls++;return{error:{status:403}};});assert.equal(calls,1);
});
