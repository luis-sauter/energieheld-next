import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){if(s==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};return n(s,c);}});
await import('./helpers/load-ts.mjs');
const {attachMediaLibraryAsset,mediaLibraryUpload,mediaLibraryPage}=await import('../src/lib/media-library-server.ts');
const {mediaSelectionLimit,mediaNeedsRights,canReuseMediaPath,recordMediaPermission,mediaMayUse,readMediaRights,companySearchPattern}=await import('../src/lib/media-library.ts');
const profile='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='dddddddd-dddd-4ddd-8ddd-dddddddddddd',assetId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',block='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const png=new Blob([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])],{type:'image/png'});
function mock({admin=true,bucket='company-media',sourceProfile=profile,sourcePath='profiles/'+profile+'/gallery/'+assetId+'.png',rows=[],invalid=false,archived=false,rights=''}={}){
 const calls=[],files=new Map(),objects=new Map(),images=[...rows];let galleryId=0;
 const asset={rights,id:assetId,profile_id:sourceProfile,bucket_id:bucket,storage_path:sourcePath,kind:'gallery',name:'Bild',alt_text:'Alt',archived_at:archived?'now':null};
 const client={calls,files,images,auth:{getUser:async()=>({data:{user:{id:'admin'}},error:null})},
 from(table){const q={filters:{},action:null,payload:null,select(){return q;},eq(k,v){q.filters[k]=v;return q;},is(k,v){q.filters[k]=v;return q;},limit(){return q;},order(){return q;},update(v){q.action='update';q.payload=v;return q;},insert(v){q.action='insert';q.payload=v;return q;},async maybeSingle(){return result();},async single(){return result();},then(resolve,reject){return Promise.resolve(result()).then(resolve,reject);}};
 function result(){calls.push({table,...q.filters,action:q.action,payload:q.payload});
 if(table==='portal_admins')return {data:admin?{user_id:'admin'}:null,error:null};
 if(table==='media_library_assets')return {data:archived?null:asset,error:null};
 if(table==='media_library_files'){if(q.action==='insert'){files.set(q.payload.context_key,q.payload.storage_path);return {data:{},error:null};}return {data:files.has(q.filters.context_key)?{storage_path:files.get(q.filters.context_key)}:null,error:null};}
 if(table==='company_profiles')return {data:{id:profile,slug:'firma',logo_path:null,contact_image_path:null,company_profile_images:images},error:null};
 if(table==='profile_content_blocks')return {data:{id:block,type:'image_grid',config:{columns:4},profile_content_block_images:[]},error:null};
 if(table==='profile_content_block_images'){if(q.action==='insert')return {data:{id:crypto.randomUUID()},error:null};return {data:[],error:null};}
 if(table==='company_profile_images'&&q.action==='insert'){const row={id:'gallery-'+(++galleryId),...q.payload};images.push(row);return {data:{id:row.id},error:null};}
 return {data:null,error:null};}return q;},
 storage:{from(bucket){return {download:async path=>{calls.push({download:path,bucket});return {data:invalid?new Blob(['fake'],{type:'image/png'}):(objects.get(path)??png),error:null};},upload:async(path,file,options)=>{calls.push({upload:path,bucket,size:file.size,options});objects.set(path,file);return {error:null};},remove:async paths=>{calls.push({remove:paths});return {error:null};},createSignedUrls:async(paths,expires)=>{calls.push({signed:paths,bucket,expires});return {data:paths.map(p=>({path:p,signedUrl:'https://private.invalid/'+p})),error:null};}}}},
 rpc:async(name,args)=>{calls.push({rpc:name,args});if(name==='media_library_retains_file')return {data:true,error:null};if(name==='media_library_page')return {data:{items:[asset],count:1},error:null};return {data:assetId,error:null};}};return client;
}
test('only server-verified admins can load, prepare or select catalog assets',async()=>{
 const c=mock({admin:false});assert.ok((await mediaLibraryPage(c,null,'','',1)).error);assert.ok((await attachMediaLibraryAsset(c,assetId,{profileId:profile,kind:'gallery'},false)).error);
 const f=new FormData();f.set('intent','prepare-library');assert.ok((await mediaLibraryUpload(c,profile,f)).error);assert.equal(c.calls.some(v=>v.upload||v.download||v.signed),false);
});
test('same gallery original reuses path with no physical upload; duplicates and ninth slot rejected',async()=>{
 const c=mock();assert.ok((await attachMediaLibraryAsset(c,assetId,{profileId:profile,kind:'gallery'},false)).success);assert.equal(c.calls.filter(v=>v.upload).length,0);assert.equal(c.images[0].storage_path,'profiles/'+profile+'/gallery/'+assetId+'.png');
 assert.ok((await attachMediaLibraryAsset(c,assetId,{profileId:profile,kind:'gallery'},false)).error);
 const full=mock({rows:Array.from({length:8},(_,i)=>({id:String(i),storage_path:'x',sort_order:i}))});assert.ok((await attachMediaLibraryAsset(full,assetId,{profileId:profile,kind:'gallery'},false)).error);assert.equal(full.calls.some(v=>v.download||v.upload),false);
});
test('foreign and banner reuse uses persisted destination-scoped permission, never a caller boolean',async()=>{
 const c=mock({sourceProfile:other,sourcePath:'profiles/'+other+'/gallery/'+assetId+'.png'});
 assert.ok((await attachMediaLibraryAsset(c,assetId,{profileId:profile,kind:'gallery'},true)).error);assert.equal(c.calls.some(v=>v.download||v.upload),false);
 const allowed=mock({sourceProfile:other,sourcePath:'profiles/'+other+'/gallery/'+assetId+'.png',rights:recordMediaPermission('Original license', 'Original license',profile,'Written permission 2026-10-09: all profile images')});
 assert.ok((await attachMediaLibraryAsset(allowed,assetId,{profileId:profile,kind:'gallery'})).success);const copy=allowed.calls.find(v=>v.upload);assert.ok(copy.upload.startsWith('profiles/'+profile+'/gallery/'));assert.equal(copy.options.upsert,false);assert.equal(copy.size,png.size);
 assert.ok((await attachMediaLibraryAsset(allowed,assetId,{profileId:profile,kind:'gallery'})).error);assert.equal(allowed.calls.filter(v=>v.upload).length,1);
 for(const rights of ['', 'Admin owns portal',recordMediaPermission('', '',other,'Only source profile')]){const banner=mock({bucket:'ad-media',rights});assert.ok((await attachMediaLibraryAsset(banner,assetId,{profileId:profile,kind:'logo'},true)).error);assert.equal(banner.calls.some(v=>v.download||v.upload),false);}
 const banner=mock({bucket:'ad-media',rights:recordMediaPermission('License', 'License',profile,'Rights holder allows target profile')});assert.ok((await attachMediaLibraryAsset(banner,assetId,{profileId:profile,kind:'logo'})).success);
 assert.equal(mediaNeedsRights({profile_id:profile,bucket_id:'ad-media'},profile),true);
});

test('same asset in two contexts uses separate safe paths; repeat context reuses copy and preserves original',async()=>{
 const c=mock();assert.ok((await attachMediaLibraryAsset(c,assetId,{profileId:profile,kind:'block',blockId:block},false)).success);
 assert.ok((await attachMediaLibraryAsset(c,assetId,{profileId:profile,kind:'block',blockId:block},false)).success);
 assert.equal(c.calls.filter(v=>v.upload).length,1);assert.ok(c.calls.find(v=>v.upload).upload.startsWith('profiles/'+profile+'/blocks/'+block+'/'));
 assert.equal(c.calls.some(v=>v.remove?.includes('profiles/'+profile+'/gallery/'+assetId+'.png')),false);
});
test('upload catalog capacity is independent of eight gallery slots; prepare enforces actual 5 MiB/type boundary',async()=>{
 const c=mock({rows:Array.from({length:8},(_,i)=>({id:String(i)}))});const f=new FormData();f.set('intent','prepare-library');f.set('file_type','image/png');f.set('file_size','5242880');assert.ok((await mediaLibraryUpload(c,profile,f)).uploadPath);f.set('file_size','5242881');assert.ok((await mediaLibraryUpload(c,profile,f)).error);f.set('file_size','12');f.set('file_type','image/svg+xml');assert.ok((await mediaLibraryUpload(c,profile,f)).error);
});
test('invalid bytes and foreign replacement identifiers are rejected before attachment',async()=>{
 const c=mock({sourceProfile:other,invalid:true,rights:recordMediaPermission('', '',profile,'Written permission')});assert.ok((await attachMediaLibraryAsset(c,assetId,{profileId:profile,kind:'logo'},true)).error);assert.equal(c.calls.some(v=>v.upload),false);
 const r=mock();assert.ok((await attachMediaLibraryAsset(r,assetId,{profileId:profile,kind:'gallery',replacementId:other},false)).error);assert.equal(r.calls.some(v=>v.upload||v.download),false);
});
test('signed private thumbnails are batched and bounded; no permanent public URL',async()=>{
 const c=mock();const page=await mediaLibraryPage(c,profile,'','',1);assert.equal(page.count,1);assert.equal(c.calls.filter(v=>v.signed).length,1);assert.equal(c.calls.find(v=>v.signed).expires,600);assert.match(page.items[0].src,/private.invalid/);
});
test('selection limits and profile path checks prevent cross-profile reuse',()=>{
 assert.equal(mediaSelectionLimit({kind:'gallery',capacity:7}),7);assert.equal(mediaSelectionLimit({kind:'gallery',capacity:0}),0);assert.equal(mediaSelectionLimit({kind:'gallery',capacity:7,replacementId:'x'}),1);assert.equal(mediaSelectionLimit({kind:'block',capacity:4}),1);
 assert.equal(canReuseMediaPath({bucket_id:'company-media',storage_path:'profiles/'+other+'/gallery/'+assetId+'.png'},{profileId:profile,kind:'gallery'}),false);
});

test('confirmed public project image is hash-checked and copied into private target without mutating original',async()=>{
 const manifest=JSON.parse(readFileSync(new URL('../src/data/media-library-project-assets.json',import.meta.url),'utf8'));const image=manifest.find(a=>a.kind==='gallery');
 const c=mock({bucket:'project-media',sourcePath:image.path});const result=await attachMediaLibraryAsset(c,assetId,{profileId:profile,kind:'logo'},false);assert.ok(result.success);
 assert.equal(c.calls.filter(v=>v.upload).length,1);assert.ok(c.calls.find(v=>v.upload).upload.startsWith('profiles/'+profile+'/logo/'));
 assert.equal(c.calls.some(v=>v.download===image.path||v.remove?.includes(image.path)),false);
});
test('cataloged original cleanup is skipped after usage removal',async()=>{
 const {retainedProfileMedia}=await import('../src/lib/media-retention.ts');const c=mock();assert.equal(await retainedProfileMedia(c,'known'),true);
 assert.equal(await retainedProfileMedia({rpc:async()=>({error:{},data:null})},'unknown'),false);
});

test('license and unrelated permissions survive edits; blank scope revokes only target permission',()=>{
 assert.equal(recordMediaPermission('', 'L'.repeat(1000), '', ''),'L'.repeat(1000));
 const first=recordMediaPermission('Original license','Original license',other,'Other company permission');
 const both=recordMediaPermission(first,'Updated license',profile,'Target company permission');
 assert.equal(readMediaRights(both).license,'Updated license');assert.equal(readMediaRights(both).permissions.length,2);
 const revoked=recordMediaPermission(both,'Updated license',profile,'');assert.equal(readMediaRights(revoked).permissions.length,1);
 assert.equal(mediaMayUse({profile_id:other,bucket_id:'company-media',rights:revoked},profile),false);
 for(const rights of ['License text', '{"version":1,"license":"","permissions":[{"profileId":"*","evidence":"all"}]}','{"version":1,"license":"","permissions":[{"profileId":"'+profile+'","evidence":""}]}'])assert.equal(mediaMayUse({profile_id:other,bucket_id:'company-media',rights},profile),false);
});
test('company substring search handles case/umlauts and treats regex characters literally',()=>{
 for(const q of ['Sonnen','sonNEN'])assert.ok(new RegExp(companySearchPattern(q),'i').test('Pension Sonnenhof'));
 for(const q of ['Müller','Muller','Mueller'])assert.ok(new RegExp(companySearchPattern(q),'i').test('Hotel Müller'));
 for(const q of ['Bü','Bue','Bu'])assert.ok(new RegExp(companySearchPattern(q),'i').test('Ferienbauernhof Büchele'));
 assert.ok(new RegExp(companySearchPattern('Straße'),'i').test('Hotel Strasse'));assert.ok(new RegExp(companySearchPattern('strasse'),'i').test('Hotel Straße'));
 assert.equal(new RegExp(companySearchPattern('.*'),'i').test('Every company'),false);
});

test('documented reuse scope does not authorize another image kind',async()=>{
 const rights=recordMediaPermission('License','License',profile,'Gallery only',['gallery']);
 const c=mock({sourceProfile:other,rights});assert.ok((await attachMediaLibraryAsset(c,assetId,{profileId:profile,kind:'logo'})).error);assert.equal(c.calls.some(v=>v.upload||v.download),false);
 assert.equal(mediaMayUse({profile_id:other,bucket_id:'company-media',rights},profile,'gallery'),true);
});
