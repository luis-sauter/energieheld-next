import test from "node:test";
import assert from "node:assert/strict";
import "./helpers/load-ts.mjs";
const { bannerWidth, presentedBanners, legacyCreative } = await import("../src/lib/banner-presentation.ts");
const { sidebarCreative } = await import("../src/lib/advertising-rail.ts");
const { sidebarContentAt, sidebarContentToken } = await import("../src/lib/sidebar-content.ts");
const { defaultSidebarOrder, moveSidebarSlot } = await import("../src/lib/sidebar-order.ts");

test("reordering changes only content, never A–L identities; stored Legacy assignment reloads in A", () => {
  const ads=presentedBanners([],[]);
  const sources=moveSidebarSlot([...defaultSidebarOrder],2,0);
  const rendered=defaultSidebarOrder.map((_,i)=>sidebarContentAt(ads,sources,i));
  assert.deepEqual(rendered.slice(0,3).map(x=>x.placement),defaultSidebarOrder.slice(0,3));
  assert.equal(rendered[0].id,"ferienanlage-nationalpark"); assert.equal(rendered[1].id,"city-apart-square");
  const reload=presentedBanners([],[{placement:"sidebar_top",size:"small",legacy_hidden:false,
    legacy_target_url:"https://example.org",legacy_placement:"sidebar_bottom"}]);
  assert.equal(sidebarCreative("sidebar_top",reload).id,rendered[0].id);
  assert.equal(sidebarContentToken("sidebar_top",reload[0]),"legacy:sidebar_bottom");
  const empty=presentedBanners([],[{placement:"sidebar_top",size:"large",legacy_hidden:false,
    legacy_target_url:null,legacy_placement:"sidebar_12"}]);
  assert.equal(sidebarCreative("sidebar_top",empty),undefined,"no original fallback may fill a moved empty slot");
});

test("sizes use the measured 350×120 and 350×350 reference envelopes while preserving any actual ratio", () => {
  for (const [size,height] of [["small",120],["medium",235],["large",350]]) {
    for (const ratio of [0.5,1,350/120,8]) {
      const width = bannerWidth(size,ratio);
      assert.ok(width>0 && width<=100);
      assert.ok(width/ratio <= height/350*100+1e-8);
      assert.equal(width,Math.min(100,height/350*ratio*100));
    }
  }
  assert.equal(bannerWidth("small",350/120),100,"small legacy banner retains its existing full width");
  assert.equal(bannerWidth("large",1),100,"City Apart keeps its original full-width square size");
});
test("one shared resolver recognizes legacy/live/empty slots and never emits a double creative", () => {
  const legacy = presentedBanners([],[]);
  assert.equal(legacy.length,10); assert.equal(legacy[0].source,"legacy");
  const live={...legacyCreative("sidebar_top"),id:"campaign-id",image_path:"private/path"};
  const all=presentedBanners([live],[]);
  assert.equal(all.filter((row)=>row.placement==="sidebar_top").length,1);
  assert.equal(all[0].source,"campaign"); assert.equal(sidebarCreative("sidebar_11",all),undefined);
});
test("persisted deletion prevents fallback resurrection after reload but a new campaign may fill the freed slot", () => {
  const hidden={placement:"sidebar_top",size:"medium",legacy_hidden:true,legacy_target_url:null};
  const reloaded=presentedBanners([],[hidden]);
  assert.equal(sidebarCreative("sidebar_top",reloaded),undefined);
  assert.equal(sidebarCreative("sidebar_middle",reloaded).id,"haus-salzburg");
  const next={...legacyCreative("sidebar_top"),id:"new",image_path:"private/path"};
  assert.equal(sidebarCreative("sidebar_top",presentedBanners([next],[hidden])).id,"new");
});
test("unavailable private creative never exposes its legacy fallback; legacy URL/size remain scoped", () => {
  const blocked=presentedBanners([{...legacyCreative("sidebar_top"),id:"private",image_path:"private/path",imageUrl:undefined}],[]);
  assert.equal(sidebarCreative("sidebar_top",blocked),undefined);
  const changed=presentedBanners([],[{placement:"sidebar_middle",size:"small",legacy_hidden:false,legacy_target_url:"https://example.org/new"}]);
  assert.equal(changed.find((row)=>row.placement==="sidebar_middle").target_url,"https://example.org/new");
  assert.equal(changed[0].target_url,"https://city-apart-dresden.de/");
});
