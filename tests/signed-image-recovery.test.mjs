import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!s.endsWith('.ts')){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return next(u.href,c);}return next(s,c);}});
const {installSignedImageRecovery,signedImageReference}=await import('../src/lib/signed-image-recovery.ts');

const origin='https://portal.supabase.co';
const path='profiles/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/gallery/photo.jpg';
const relative=`/object/sign/company-media/${path}?token=fresh`;
const old=`${origin}/storage/v1/object/sign/company-media/${path}?token=expired`;
const fresh=`${origin}/storage/v1${relative}`;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function image(src=old){const attributes=new Map();return {tagName:'IMG',src,currentSrc:src,srcset:'',complete:false,naturalWidth:0,isConnected:true,events:[],setAttribute(n,v){attributes.set(n,v)},removeAttribute(n){attributes.delete(n)},hasAttribute(n){return attributes.has(n)},dispatchEvent(e){this.events.push(e.type)}};}
function document(images=[]){let listener;return {images,addEventListener(type,fn,capture){assert.equal(type,'error');assert.equal(capture,true);listener=fn;},removeEventListener(){listener=null;},fail(target){listener?.({target});}};}

test('only own signed image buckets and canonical paths can be renewed',()=>{
 assert.ok(signedImageReference(old,origin));
 for(const src of [old.replace(origin,'https://attacker.test'),old.replace('company-media','offer-request-files'),old.replace('profiles/','campaigns/'),old.replace('photo.jpg','%2e%2e/photo.jpg'),old.replace('photo.jpg','clip.mp4'),old.replace('?token=expired','')]) assert.equal(signedImageReference(src,origin),null);
});

test('expired lazy images recover together with one anonymous request and unchanged lifetime',async()=>{
 const a=image(),b=image(),doc=document([a,b]);let calls=0;
 const dispose=installSignedImageRecovery(doc,origin,'public-key',async(url,options)=>{
  calls++;assert.equal(url,`${origin}/storage/v1/object/sign/company-media/${path}`);assert.equal(options.credentials,'omit');assert.equal(options.headers.Authorization,'Bearer public-key');assert.equal(JSON.parse(options.body).expiresIn,3600);
  return {ok:true,json:async()=>({signedURL:relative})};
 });
 assert.equal(calls,0);doc.fail(a);doc.fail(b);await tick();assert.equal(calls,1);assert.equal(a.src,fresh);assert.equal(b.src,fresh);dispose();
});

test('pre-hydration failures recover, unloaded lazy images stay lazy, cleanup removes handler',async()=>{
 const broken=image(),lazy=image();broken.complete=true;const doc=document([broken,lazy]);let calls=0;
 const dispose=installSignedImageRecovery(doc,origin,'public',async()=>{calls++;return {ok:true,json:async()=>({signedURL:relative})};});
 await tick();assert.equal(calls,1);assert.equal(broken.src,fresh);assert.equal(lazy.src,old);dispose();doc.fail(lazy);await tick();assert.equal(calls,1);
});

test('Storage denial does not expose private media or retry indefinitely',async()=>{
 const a=image(),doc=document();let calls=0;const dispose=installSignedImageRecovery(doc,origin,'public',async()=>{calls++;return {ok:false};});
 doc.fail(a);await tick();doc.fail(a);await tick();assert.equal(calls,1);assert.equal(a.src,old);dispose();
});

test('async recovery never overwrites a later editorial image or unmounted page',async()=>{
 for(const detached of [false,true]){const a=image(),doc=document();let done;const dispose=installSignedImageRecovery(doc,origin,'public',()=>new Promise(resolve=>done=resolve));doc.fail(a);if(detached)dispose();else a.currentSrc=a.src='/new-editorial.jpg';done({ok:true,json:async()=>({signedURL:relative})});await tick();assert.equal(a.src,detached?old:'/new-editorial.jpg');dispose();}
});

test('responsive banner refreshes the selected source while preserving the desktop fallback',async()=>{
 const selected=old.replace('company-media','ad-media').replace('profiles/','campaigns/').replace('/gallery/','/creative/');
 const a=image('/desktop.webp');a.currentSrc=selected;const source={srcset:selected};a.parentElement={tagName:'PICTURE',querySelectorAll:()=>[source]};const doc=document();
 const renewed=new URL(selected);renewed.searchParams.set('token','fresh');const dispose=installSignedImageRecovery(doc,origin,'public',async(_url,options)=>{assert.equal(JSON.parse(options.body).expiresIn,300);return {ok:true,json:async()=>({signedURL:renewed.pathname.replace('/storage/v1','')+renewed.search})};});
 doc.fail(a);await tick();assert.equal(source.srcset,renewed.href);assert.equal(a.src,'/desktop.webp');dispose();
});

test('untrusted signing response cannot switch host, bucket or image',async()=>{
 const a=image(),doc=document();const dispose=installSignedImageRecovery(doc,origin,'public',async()=>({ok:true,json:async()=>({signedURL:relative.replace('photo.jpg','private.jpg')})}));doc.fail(a);await tick();assert.equal(a.src,old);dispose();
});


test('optimized responsive images remain mounted during renewal and refresh all size candidates',async()=>{
 const previous=process.env.NEXT_PUBLIC_SUPABASE_URL;process.env.NEXT_PUBLIC_SUPABASE_URL=origin;
 try{const {mediaImageAttributes,unwrapMediaImage}=await import('../src/lib/responsive-media.ts');const attrs=mediaImageAttributes(old,'320px'),a=image(attrs.src);a.srcset=attrs.srcSet;const doc=document();let finish;
 const dispose=installSignedImageRecovery(doc,origin,'public',()=>new Promise(r=>finish=r));doc.fail(a);assert.equal(a.hasAttribute('data-portal-image-recovering'),true);finish({ok:true,json:async()=>({signedURL:relative})});await tick();assert.equal(a.hasAttribute('data-portal-image-recovering'),false);assert.equal(unwrapMediaImage(a.src),fresh);assert.ok(a.srcset.includes(encodeURIComponent(fresh)));assert.deepEqual(a.events,[]);dispose();
 }finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previous;}
});
