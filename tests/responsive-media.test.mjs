import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import sharp from 'sharp';
registerHooks({resolve(s,c,next){
  if(s==='server-only')return{url:'data:text/javascript,export {}',shortCircuit:true};
  if(s.startsWith('.')&&!s.endsWith('.ts')){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return next(u.href,c);}
  return next(s,c);
}});
const {privateImageRequest,privateImageRendition}=await import('../src/lib/private-image.server.ts');
const {mediaImageAttributes,unwrapMediaImage,renewMediaAttribute}=await import('../src/lib/responsive-media.ts');
const origin='https://portal.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_URL=origin;
const token=(exp=Math.floor(Date.now()/1000)+300,suffix='sig')=>'header.'+Buffer.from(JSON.stringify({exp})).toString('base64url')+'.'+suffix;
const source=(suffix='sig')=>origin+'/storage/v1/object/sign/ad-media/campaigns/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/creative/photo.png?token='+token(undefined,suffix);

test('only exact-origin private signed images and fixed widths are accepted',()=>{
 const src=source();assert.ok(privateImageRequest(src,640,origin));
 for(const bad of [src.replace(origin,'http://127.0.0.1'),src.replace(origin,'https://attacker.test'),src.replace('ad-media','private-files'),src.replace('/creative/photo.png','/creative/%2e%2e/photo.png'),src+'&download=1',src+'#fragment',src.replace('photo.png','video.mp4')])assert.equal(privateImageRequest(bad,640,origin),null);
 for(const w of [0,-1,Infinity,641,10000])assert.equal(privateImageRequest(src,w,origin),null);
 assert.equal(privateImageRequest(src.replace(/token=.*/, 'token='+token(1)),640,origin),null);
});
test('responsive attributes preserve local originals and refresh every selected rendition',()=>{
 assert.deepEqual(mediaImageAttributes('/reiseportal/photo.webp'),{src:'/reiseportal/photo.webp'});
 const old=source(),fresh=source('renewed'),attrs=mediaImageAttributes(old,'320px');
 assert.equal(unwrapMediaImage(attrs.src),old);assert.equal(attrs.sizes,'auto, 320px');
 const updated=renewMediaAttribute(attrs.srcSet,old,fresh);
 assert.ok(!updated.includes(encodeURIComponent(old)));assert.ok(updated.includes(encodeURIComponent(fresh)));
 assert.equal(renewMediaAttribute('/other.webp',old,fresh),'/other.webp');
});
test('validated upstream bytes become smaller proportional WebP; exact token/width cache is isolated',async()=>{
 const original=await sharp({create:{width:2172,height:724,channels:3,background:'#13237F'}}).png().toBuffer();let calls=0;
 const fetcher=async(_url,options)=>{calls++;assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');return new Response(original,{headers:{'Content-Type':'image/png'}});};
 const request=privateImageRequest(source('valid'),640,origin);
 const result=await privateImageRendition(request,fetcher),meta=await sharp(result.body).metadata();
 assert.equal(meta.width,640);assert.equal(meta.format,'webp');assert.ok(Math.abs(meta.width/meta.height-3)<.02);assert.ok(result.body.length<original.length);
 await privateImageRendition(request,fetcher);assert.equal(calls,1);
 await assert.rejects(privateImageRendition(privateImageRequest(source('denied'),640,origin),async()=>new Response('Denied',{status:403})));assert.equal(calls,1);
});
test('non-images and oversized streams are rejected before decoding',async()=>{
 await assert.rejects(privateImageRendition(privateImageRequest(source('html'),384,origin),async()=>new Response('<html>',{headers:{'Content-Type':'text/html'}})));
 await assert.rejects(privateImageRendition(privateImageRequest(source('large'),384,origin),async()=>new Response('x',{headers:{'Content-Type':'image/png','Content-Length':String(17*1024*1024)}})));
});
test('concurrent variants are deduplicated for the same bearer token',async()=>{
 const original=await sharp({create:{width:800,height:400,channels:3,background:'white'}}).png().toBuffer();let calls=0;
 const r=privateImageRequest(source('concurrent'),384,origin);const get=async()=>{calls++;return new Response(original,{headers:{'Content-Type':'image/png'}});};
 const bodies=await Promise.all([privateImageRendition(r,get),privateImageRendition(r,get),privateImageRendition(r,get)]);
 assert.equal(calls,1);assert.deepEqual(bodies[0],bodies[1]);
});
test('already tiny images are not enlarged in pixels or bytes',async()=>{
 const original=await sharp({create:{width:1,height:1,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).webp({lossless:true}).toBuffer();
 const result=await privateImageRendition(privateImageRequest(source('tiny'),1920,origin),async()=>new Response(original,{headers:{'Content-Type':'image/webp'}}));
 assert.ok(result.body.byteLength<=original.byteLength);assert.equal((await sharp(result.body).metadata()).width,1);
});
