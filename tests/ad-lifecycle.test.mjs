import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/load-ts.mjs';
const { changeAdLifecycle } = await import('../src/lib/ad-lifecycle.ts');
const { adStatus } = await import('../src/lib/ad-values.ts');
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', copy = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const image = `campaigns/${id}/creative/${id}.png`;
function fixture({ admin=true, archived=true, attachFails=false, cleanupFails=false }={}) {
  const calls=[];
  const media={
    download:async path=>{calls.push(['download',path]);return {data:new Blob([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])]),error:null};},
    upload:async(path,blob,options)=>{calls.push(['upload',path,options]);return {error:null};},
    remove:async paths=>{calls.push(['remove',paths]);return cleanupFails?{error:{}}:{data:paths,error:null};},
    list:async folder=>{calls.push(['list',folder]);return {data:calls.some(c=>c[0]==='remove')?[]:[{name:`${id}.png`}],error:null};},
  };
  const client={auth:{getUser:async()=>({data:{user:{id}},error:null})},from(table){
    const query={select(){return query;},eq(){return query;},maybeSingle:async()=>table==='portal_admins'?{data:admin?{user_id:id}:null}:{data:{id,archived_at:archived?'2026-10-06':null,image_path:image}}};return query;
  },storage:{from:()=>media},rpc:async(name,args)=>{
    calls.push(['rpc',args.p_action,args.p_id,args.p_image_path]);
    return {data:args.p_action==='reuse'?copy:id,error:attachFails&&args.p_action==='attach_copy'?{}:null};
  }};
  return {client,calls};
}
function form(action,confirmed=true){const data=new FormData();data.set('campaign_id',id);data.set('action',action);if(confirmed)data.set('confirmed','yes');return data;}
test('lifecycle checks admin, confirmation and archive before writes',async()=>{
  for(const [options,action,confirmed] of [[{admin:false},'archive',true],[{},'delete',false],[{archived:false},'reuse',true],[{archived:false},'delete',true]]){
    const {client,calls}=fixture(options);assert.ok((await changeAdLifecycle(client,form(action,confirmed))).error);assert.equal(calls.length,0);
  }
});
test('reuse downloads verified original and uploads a separate immutable campaign creative before attaching',async()=>{
  const {client,calls}=fixture();const result=await changeAdLifecycle(client,form('reuse'));assert.equal(result.redirectTo,`/admin/werbung/${copy}`);assert.ok(result.success);
  assert.deepEqual(calls.find(c=>c[0]==='download'),['download',image]);const upload=calls.find(c=>c[0]==='upload');assert.ok(upload[1].startsWith(`campaigns/${copy}/creative/`));assert.notEqual(upload[1],image);assert.equal(upload[2].upsert,false);
  assert.equal(calls.some(c=>c[0]==='remove'),false);assert.equal(calls.find(c=>c[1]==='attach_copy')[2],copy);
});
test('failed image attachment cleans only new upload and leaves an accessible independent draft',async()=>{
  const {client,calls}=fixture({attachFails:true});const result=await changeAdLifecycle(client,form('reuse'));assert.ok(result.error);assert.equal(result.redirectTo,`/admin/werbung/${copy}`);
  assert.ok(calls.find(c=>c[0]==='remove')[1][0].startsWith(`campaigns/${copy}/creative/`));
});
test('delete cleans campaign folder before final RPC; cleanup failure never deletes campaign',async()=>{
  for(const cleanupFails of [false,true]){
    const {client,calls}=fixture({cleanupFails});const result=await changeAdLifecycle(client,form('delete'));
    assert.equal(calls.some(c=>c[1]==='prepare_delete'),true);assert.equal(calls.some(c=>c[1]==='delete'),!cleanupFails);
    assert.equal(Boolean(result.error),cleanupFails);assert.deepEqual(calls.find(c=>c[0]==='remove')[1],[image]);
  }
});
test('archive label overrides former active or expired status',()=>{
  assert.equal(adStatus({status:'approved',archived_at:'2026-10-06',approved_start_date:'2020-01-01',approved_end_date:'2020-01-02'}),'Archiviert');
});
