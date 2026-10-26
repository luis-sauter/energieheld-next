import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import './helpers/load-ts.mjs';
const {directoryBannerPool,directoryImageKey,sameCreative}=await import('../src/lib/directory-banner-layout.ts');
const {validateOfferPeriod,OFFER_PERIOD_ERROR}=await import('../src/lib/offer-period.ts');
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ad=(id,path)=>({id,placement:'sidebar_top',headline:'Same company',target_url:'https://hotel.test/',image_path:path,imageUrl:'https://storage.test/'+path+'?token=one'});
test('directory has no campaign/path/token/crop duplicate, excludes invalid delivery, retains distinct motives',()=>{
 const pixel={bits:'01010101',color:[30,60,90],pixels:[30,60,90]};
 const other={bits:'11000011',color:[30,60,90],pixels:[90,20,70]};
 const rows=[ad('a','original'),{...ad('b','original'),crop:{zoom:2}},{...ad('c','copy'),imageUrl:'https://other.test/copy'},ad('d','different'),{...ad('draft','draft'),status:'draft'},{...ad('expired','expired'),approved_end_date:'2020-01-01'},{...ad('future','future'),approved_start_date:'2099-01-01'},{...ad('hidden','hidden'),suppressed:true}];
 const pool=directoryBannerPool(rows,{original:[pixel],copy:[pixel],different:[other]},'2026-10-12');
 assert.deepEqual(pool.map(a=>a.id),['a','d']);assert.equal(sameCreative([pixel],[other]),false);
 assert.equal(directoryImageKey({...ad('x',null),imageUrl:'https://store.test/banner.webp?token=a&width=350'}),directoryImageKey({...ad('y',null),imageUrl:'https://store.test/banner.webp?token=b&width=700'}));
 assert.equal(directoryBannerPool([ad('only','one')]).length,1);
 assert.doesNotMatch(source('src/components/portal/travel-directory.tsx'),/directoryBannerSequence|DirectoryBannerContinuation/);
});

test('directory excludes Premium before deduplication so a normal variant survives',()=>{
 const normal=ad('same','normal');
 const pool=directoryBannerPool([{...normal,placement:'top_banner'},normal,
   {...ad('premium','premium'),placement:'top_banner'},
   {...ad('legacy','legacy'),source:'legacy'},ad('second','second'),normal]);
 assert.deepEqual(pool.map(row=>row.id),['same','second']);
});
test('optional period distinguishes partial native badInput from empty and validates paired range',()=>{
 const input=value=>({value,validity:{badInput:false},message:'',setCustomValidity(message){this.message=message}});
 const start=input(''),end=input('');assert.equal(validateOfferPeriod(start,end),'');
 start.validity.badInput=true;assert.equal(validateOfferPeriod(start,end),OFFER_PERIOD_ERROR);
 start.validity.badInput=false;start.value='2026-11-01';assert.equal(validateOfferPeriod(start,end),OFFER_PERIOD_ERROR);
 end.value='2026-11-10';assert.equal(validateOfferPeriod(start,end),'');assert.equal(start.message,'');
 end.value='2026-10-31';assert.match(validateOfferPeriod(start,end),/nicht vor/);
 start.value='';end.value='';assert.equal(validateOfferPeriod(start,end),'');assert.equal(end.message,'');
});
test('preview-image save cannot refresh the whole layout or reshuffle server-rendered card groups',()=>{
 const action=source('src/app/(energieheld)/card-image-actions.ts'),editor=source('src/components/portal/card-image-editor.tsx');
 assert.doesNotMatch(action,/revalidatePath\(/);assert.doesNotMatch(editor,/router.refresh\(/);
 assert.match(editor,/onSaved\?\.\(/);assert.match(source('src/components/portal/card-image-surface.tsx'),/useState<SavedImage/);
 assert.doesNotMatch(source('src/components/portal/discovery-detail.tsx'),/use client/);
 assert.match(source('src/components/portal/use-rotation-motion.ts'),/!editingCard && rotationCanPlay/);
});
test('second-image entry uses existing tools with local slot preview and reversible cancellation',()=>{
 const paired=source('src/components/admin/paired-image-editor.tsx'),grid=source('src/components/admin/inline-image-grid-editor.tsx');
 assert.match(paired,/Zweites Bild bearbeiten/);assert.match(paired,/Zweites Bild hinzufügen/);
 assert.match(paired,/event.target !== event.currentTarget/);assert.match(paired,/InlineImageGridEditor[^>]*secondImage/);
 assert.match(grid,/onCancel: enlarged/);assert.match(grid,/String\(columns\)/);
 assert.match(grid,/Math.max\(2, previewColumns\)/);
});
