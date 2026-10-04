import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/load-ts.mjs';
const { validateVideoFile, isProfileVideoPath, signProfileVideo, changeAuthorizedProfileVideo, VIDEO_MAX_BYTES } = await import('../src/lib/profile-video.ts');
const { changeAdminCompanyMedia } = await import('../src/lib/admin-company-media.ts');
const { changeOwnCompanyMedia } = await import('../src/lib/company-media.ts');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', other='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const path=`profiles/${id}/video/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.mp4`;
const bytes=new Uint8Array([0,0,0,20,...Buffer.from('ftypisom'),0,0,0,0,...Buffer.from('mp42')]);
const mp4=new File([bytes],'film.mp4',{type:'video/mp4'});
const form=values=>{const f=new FormData();for(const [k,v] of Object.entries(values))f.set(k,v);return f;};
function client({admin=true, authenticated=true, writeError=false, video_path=null, download=mp4, signed=true}={}) {
  const calls=[];
  return {calls,auth:{getUser:async()=>({data:{user:authenticated?{id:'user'}:null},error:null})},from(table){
    const call={table,filters:[]};calls.push(call);
    return {select(){return this;},eq(k,v){call.filters.push([k,v]);return this;},is(k,v){call.filters.push([k,v]);return this;},update(payload){call.payload=payload;return this;},async maybeSingle(){
      if(table==='portal_admins')return {data:admin?{user_id:'user'}:null,error:null};
      if(table==='companies')return {data:{id:'company'},error:null};
      return {data:writeError&&call.payload?null:{id,video_path,company_profile_images:[]},error:writeError&&call.payload?{}:null};
    }};
  },storage:{from(bucket){assert.equal(bucket,'company-profile-videos');return {
    download:async p=>{calls.push({download:p});return {data:download,error:null};},
    remove:async paths=>{calls.push({remove:paths});return {error:null};},
    createSignedUrl:async p=>{calls.push({signed:p});return {data:signed?{signedUrl:'https://signed.example/video'}:null,error:signed?null:{}};}
  };}}};
}
test('video MIME, container bytes, nonempty and conservative size limit',async()=>{
  assert.equal((await validateVideoFile(mp4)).extension,'mp4');
  const webm=new File([new Uint8Array([0x1a,0x45,0xdf,0xa3,0x87,0x42,0x82,0x84,...Buffer.from('webm')])],'v.webm',{type:'video/webm'});
  assert.equal((await validateVideoFile(webm)).extension,'webm');
  for(const file of [new File([],'v.mp4',{type:'video/mp4'}),new File(['<script>'],'v.mp4',{type:'video/mp4'}),new File([bytes],'v.png',{type:'image/png'}),new File([new Uint8Array(VIDEO_MAX_BYTES+1)],'v.mp4',{type:'video/mp4'}),new File([bytes],'v.webm',{type:'video/webm'})])assert.ok((await validateVideoFile(file)).error);
});
test('verified admin and owner prepare their profile, never a submitted foreign ID',async()=>{
  for(const save of [(c,f)=>changeAdminCompanyMedia(c,id,f),changeOwnCompanyMedia]){
    const c=client();const result=await save(c,form({intent:'prepare-video',file_type:'video/mp4',file_size:'20',profile_id:other}));
    assert.ok(isProfileVideoPath(id,result.uploadPath));assert.ok(!isProfileVideoPath(other,result.uploadPath));
  }
  assert.equal((await changeAdminCompanyMedia(client({admin:false}),id,form({intent:'prepare-video'}))).access,'forbidden');
  assert.ok((await changeOwnCompanyMedia(client({authenticated:false}),form({intent:'video-remove'}))).unauthenticated);
});
test('foreign video rejected before downloading; spoofed bytes cleaned before linking',async()=>{
  const c=client();assert.ok((await changeAuthorizedProfileVideo(c,{id},form({intent:'video-upload',uploaded_path:path.replace(id,other)}))).error);assert.equal(c.calls.length,0);
  const invalid=client({download:new File(['invalid'],'v.mp4',{type:'video/mp4'})});
  assert.ok((await changeAuthorizedProfileVideo(invalid,{id},form({intent:'video-upload',uploaded_path:path}))).error);
  assert.deepEqual(invalid.calls.filter(c=>c.remove).map(c=>c.remove),[[path]]);assert.ok(!invalid.calls.some(c=>c.payload));
});
test('replace and remove use compare-and-swap and clean only detached files',async()=>{
  const previous=path.replace('bbbbbbbb','cccccccc');
  const c=client();assert.ok((await changeAuthorizedProfileVideo(c,{id,video_path:previous},form({intent:'video-upload',uploaded_path:path}))).success);
  const write=c.calls.find(c=>c.payload);assert.deepEqual(write.payload,{video_path:path});assert.deepEqual(write.filters,[['id',id],['video_path',previous]]);
  assert.deepEqual(c.calls.filter(c=>c.remove).map(c=>c.remove),[[previous]]);
  const fail=client({writeError:true});assert.ok((await changeAuthorizedProfileVideo(fail,{id,video_path:previous},form({intent:'video-upload',uploaded_path:path}))).error);
  assert.deepEqual(fail.calls.filter(c=>c.remove).map(c=>c.remove),[[path]]);
  const remove=client();assert.ok((await changeAuthorizedProfileVideo(remove,{id,video_path:path},form({intent:'video-remove'}))).success);assert.deepEqual(remove.calls.find(c=>c.payload).payload,{video_path:null});
});
test('public signing validates profile path and failure leaves gallery available',async()=>{
  const c=client();assert.equal(await signProfileVideo(c,{id,video_path:path.replace(id,other)}),undefined);assert.equal(c.calls.length,0);
  assert.equal(await signProfileVideo(client({signed:false}),{id,video_path:path}),undefined);
  assert.equal((await signProfileVideo(c,{id,video_path:path})).src,'https://signed.example/video');
});

test('50 MB boundary is shared by file validation and owner/admin preparation',async()=>{
 assert.equal(VIDEO_MAX_BYTES,52428800);
 for(const size of [26214401,VIDEO_MAX_BYTES]) {
  const file=new File([bytes,new Uint8Array(size-bytes.length)],'video.mp4',{type:'video/mp4'});
  assert.equal((await validateVideoFile(file)).extension,'mp4');
  for(const save of [(c,f)=>changeAdminCompanyMedia(c,id,f),changeOwnCompanyMedia])assert.ok((await save(client(),form({intent:'prepare-video',file_type:'video/mp4',file_size:String(size)}))).uploadPath);
 }
 for(const save of [(c,f)=>changeAdminCompanyMedia(c,id,f),changeOwnCompanyMedia]) {
  const result=await save(client(),form({intent:'prepare-video',file_type:'video/mp4',file_size:String(VIDEO_MAX_BYTES+1)}));
  assert.match(result.error,/50 MB/);assert.equal(result.uploadPath,undefined);
 }
});
