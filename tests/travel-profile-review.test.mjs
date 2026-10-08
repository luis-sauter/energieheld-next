import test from 'node:test';import assert from 'node:assert/strict';import './helpers/load-ts.mjs';
const {reviewTravelProfile}=await import('../src/lib/admin-review.ts');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function client({user=true,admin=true,capability=true,rpcError=false}={}){const calls=[];return {calls,auth:{getUser:async()=>({data:{user:user?{id:'verified-user'}:null}})},from(table){assert.equal(table,'portal_admins');return {select(){return this},eq(){return this},maybeSingle:async()=>({data:admin?{user_id:'verified-user',can_review_profiles:capability}:null})}},rpc:async(name,args)=>{calls.push({name,args});return {data:args.p_decision,error:rpcError?{}:null}}};}
test('travel approval verifies verified admin/id; travel approval independent from Freshness capability then calls only fixed decision RPC without category mutation',async()=>{
 for(const decision of ['approved','rejected']){const c=client();assert.ok((await reviewTravelProfile(c,id,decision,3,'Please update')).success);assert.deepEqual(c.calls,[{name:'review_travel_profile_with_feedback',args:{p_profile_id:id,p_decision:decision,p_feedback:decision==='rejected'?'Please update':null,p_expected_revision:3}}]);}
 for(const options of [{user:false},{admin:false}]){const c=client(options);const result=await reviewTravelProfile(c,id,'approved',3);assert.equal(result.success,undefined);assert.equal(c.calls.length,0);}
 const allAdmins=client({capability:false});assert.ok((await reviewTravelProfile(allAdmins,id,'approved',3)).success);
 const invalid=client();assert.ok((await reviewTravelProfile(invalid,'bad','approved')).error);assert.equal(invalid.calls.length,0);
 assert.ok((await reviewTravelProfile(client({rpcError:true}),id,'approved')).error);
});
