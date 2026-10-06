import test from "node:test";
import assert from "node:assert/strict";
import "./helpers/load-ts.mjs";
const { inlineAdContext, matchesInlineAdContext } = await import("../src/lib/inline-ad-context.ts");
const { prepareInlineAdUpload, saveInlineAd, removeInlineAd, archiveInlineAd, reuseInlineAd } = await import("../src/lib/inline-advertising.ts");
const { saveInlineAdMetadata } = await import('../src/lib/inline-advertising.ts');
const { validateBannerMetadata, onlyBannerMetadataChanged } = await import('../src/lib/banner-search-metadata.ts');
const { adPlacements, berlinToday } = await import("../src/lib/ad-values.ts");
const { travelThemes, destinations } = await import("../src/data/reiseportal-discovery.ts");

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const image = `campaigns/${id}/creative/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png`;

test('inline archive authorizes the actual page/source, preserves shared booking data, and uses existing lifecycle RPC only',async()=>{
 const settings=['sidebar_top','sidebar_bottom'].map((placement,i)=>({placement,display_source:i?'sidebar_top':'sidebar_bottom',size:'small',legacy_hidden:true}));
 const db=client({settings,campaign:{targets:[target('mottoreisen/wellnessangebote','sidebar_bottom'),target('reiseziele/deutschland','sidebar_middle')]}}),before=structuredClone(db.row);
 assert.ok((await archiveInlineAd(db,'/mottoreisen/wellnessangebote',form({placement:'sidebar_top',confirmed:'yes'}))).success);
 assert.deepEqual(db.calls.filter(c=>c.rpc&&!c.rpc.startsWith('get_')).map(c=>c.rpc),['admin_ad_lifecycle']);assert.deepEqual(db.row,before);
 for(const config of [{admin:false},{authenticated:false},{}]){const c=client(config);assert.ok((await archiveInlineAd(c,'/reiseziele/schweiz',form({confirmed:'yes'}))).error);assert.ok(!c.calls.some(c=>c.rpc==='admin_ad_lifecycle'));}
 const unconfirmed=client();assert.ok((await archiveInlineAd(unconfirmed,'/mottoreisen/wellnessangebote',form())).error);assert.ok(!unconfirmed.calls.some(c=>c.rpc==='admin_ad_lifecycle'));
});
test('archive insertion rejects non-admin, unconfirmed, booked and historical occupied slots before cloning',async()=>{
 for(const [config,path,values] of [[{admin:false},'/reiseziele/schweiz',{placement:'sidebar_12'}],[{},'/reiseziele/schweiz',{placement:'sidebar_12',confirmed:''}],[{},'/unterkuenfte-a-z',{placement:'sidebar_top'}],[{active:[{placement:'sidebar_12'}]},'/reiseziele/schweiz',{placement:'sidebar_12'}]]){
  const db=client(config),input=form({archived_id:id,confirmed:'yes',...values});const result=await reuseInlineAd(db,path,input);assert.ok(result.error);assert.ok(!db.calls.some(c=>c.rpc==='admin_ad_lifecycle'));
 }
});
test('archive insertion copies existing media independently, selects only this new page/slot, and keeps archived original bookings untouched',async()=>{
 const copyId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 const db=client({reuseId:copyId,metadata:{postal_code:'12345',city:'QA Ort',term_keys:['theme:wellnessangebote']},campaign:{archived_at:'2026-10-06',is_editorial:true,targets:[target(),target('reiseziele/deutschland','sidebar_top')]}}),before=structuredClone(db.row);
 const result=await reuseInlineAd(db,'/reiseziele/schweiz',form({archived_id:id,confirmed:'yes',placement:'sidebar_12',size:'small'}));
 assert.ok(result.success,result.error);assert.equal(result.ad.id,copyId);assert.equal(result.ad.placement,'sidebar_12');assert.deepEqual(db.calls.find(c=>c.original).original,before);
 const saves=db.calls.filter(c=>c.rpc==='save_ad_campaign');assert.ok(saves.length);for(const save of saves){assert.equal(save.data.p_campaign_id,copyId);assert.deepEqual(save.data.p_data.targets,[target('reiseziele/schweiz','sidebar_12')]);assert.equal(save.data.p_data.requested_start_date,berlinToday());}
 assert.ok(db.calls.find(c=>c.upload).upload.startsWith(`campaigns/${copyId}/creative/`));assert.equal(db.calls.find(c=>c.upload).upsert,false);assert.ok(!db.calls.some(c=>c.remove));
 const metadataSave=db.calls.find(c=>c.rpc==='save_ad_banner_search_metadata');assert.equal(metadataSave.data.p_postal_code,'12345');assert.equal(metadataSave.data.p_city,'QA Ort');assert.deepEqual(metadataSave.data.p_term_keys,['theme:wellnessangebote']);assert.equal(result.metadata.city,'QA Ort');
});

test('shared/company metadata edits use only the admin metadata RPC after page/source authorization', async()=>{
 const db=client({campaign:{targets:[target(),target('reiseziele/deutschland','sidebar_top')]}});
 const input=form({headline:'Belegter Name',banner_postal_code:'80331',banner_city:'München'});input.append('banner_terms','theme:wellnessangebote');
 const saved=await saveInlineAdMetadata(db,'/mottoreisen/wellnessangebote',input);assert.ok(saved.success,saved.error);
 assert.deepEqual(db.calls.filter(call=>call.rpc).map(call=>call.rpc),['save_ad_banner_search_metadata']);
 assert.equal(db.calls.find(call=>call.rpc).data.p_campaign_id,id);
 assert.ok((await saveInlineAdMetadata(db,'/reiseziele/schweiz',input)).error);
 for(const config of [{admin:false},{authenticated:false}]) assert.ok((await saveInlineAdMetadata(client(config),'/mottoreisen/wellnessangebote',input)).error);
});
test('metadata validation permits unknown location blanks, rejects invalid names/control characters and deduplicates normalized term keys',()=>{
 const input=form({headline:'Name',banner_city:'',banner_postal_code:''});input.append('banner_terms','theme:wellnessangebote');input.append('banner_terms','theme:wellnessangebote');
 assert.deepEqual(validateBannerMetadata(input).data.term_keys,['theme:wellnessangebote']);
 for(const name of ['', 'x'.repeat(101),'Bad\nName']){input.set('headline',name);assert.ok(validateBannerMetadata(input).error);}
});
test('legacy metadata-only edits keep URL overrides and display mappings out of the mutation and bind stable source identity',async()=>{
 const db=client({settings:[{placement:'sidebar_top',legacy_target_url:'https://city-apart-dresden.de/override',size:'large',legacy_hidden:false}]});
 const input=form({campaign_id:'',legacy_id:'city-apart-square',placement:'sidebar_top',original_placement:'sidebar_top',headline:'City Apart',banner_city:'Dresden'});
 const result=await saveInlineAdMetadata(db,'/unterkuenfte-a-z',input);assert.ok(result.success,result.error);
 const writes=db.calls.filter(call=>call.rpc&&!call.rpc.startsWith('get_'));assert.equal(writes.length,1);
 assert.equal(writes[0].data.p_legacy_key,'legacy:https://city-apart-dresden.de/');assert.equal(writes[0].rpc,'save_ad_banner_search_metadata');
});
test('central campaign metadata-only saves compare actual booking fields before selecting the narrow RPC',()=>{
 const db=client();const c={...db.row,placement:'top_banner'};
 const input=form({...c,headline:'Changed public name',targets:'portal_area:mottoreisen/wellnessangebote|top_banner'});
 assert.equal(onlyBannerMetadataChanged(input,c),true);
 input.set('contact_phone','changed');assert.equal(onlyBannerMetadataChanged(input,c),false);
});

test('editing and removing reordered content resolves its booking source on the server',async()=>{
 const settings=['sidebar_top','sidebar_bottom'].map((placement,i)=>({placement,display_source:i?'sidebar_top':'sidebar_bottom',size:'medium',legacy_hidden:true}));
 const db=client({settings,campaign:{is_editorial:true,targets:[target('mottoreisen/wellnessangebote','sidebar_bottom')]}});
 const saved=await saveInlineAd(db,'/mottoreisen/wellnessangebote',form({placement:'sidebar_top'}));
 assert.ok(saved.success,saved.error);assert.equal(saved.ad.placement,'sidebar_top');
 assert.equal(db.calls.find(call=>call.rpc==='save_ad_campaign').data.p_data.targets[0].placement,'sidebar_bottom');
 const removed=await removeInlineAd(db,'/mottoreisen/wellnessangebote',form({placement:'sidebar_top',action:'banner'}));
 assert.ok(removed.success,removed.error);assert.equal(db.calls.find(call=>call.rpc==='remove_inline_ad_banner').data.p_placement,'sidebar_bottom');
 const stale=client({settings,campaign:{targets:[target()]}});
 assert.ok((await saveInlineAd(stale,'/mottoreisen/wellnessangebote',form({placement:'sidebar_top'}))).error);
 assert.ok(!stale.calls.some(call=>call.rpc==='save_ad_campaign'));
});
const target = (key = "mottoreisen/wellnessangebote", placement = "top_banner") => ({ target_type: "portal_area", category_id: null, target_key: key, placement });
const form = (values = {}) => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ campaign_id: id, placement: "top_banner", target_url: "https://example.org/new", ...values })) data.set(key, value);
  return data;
};

function client({ authenticated = true, admin = true, campaign = {}, saveError = null, reviewError = null, removeError = null, settings = [], active = [], reuseId = null, metadata = null } = {}) {
  const calls = [];
  const row = { id, is_editorial: false, profile_id: "existing-company", status: "approved", image_path: image,
    internal_name: "Existing", headline: "Existing image alt", body_text: "Existing text", target_url: "https://example.org/old",
    requested_start_date: "2026-09-01", requested_end_date: "2026-12-31", approved_start_date: "2026-09-01", approved_end_date: "2026-12-31",
    contact_name: "Existing contact", contact_phone: "+49 123", contact_email: "info@example.org", targets: [target()], ...campaign };
  return { calls, row,
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: "verified-admin", user_metadata: { role: "admin" } } : null }, error: null }) },
    from(table) {
      const call = { table, filters: [] }; calls.push(call);
      return { select(columns) { call.columns = columns; return this; }, eq(key, value) { call.filters.push([key,value]); return this; },
        is(key,value) { call.filters.push([key,value]); return this; },
        in(key,value) { call.filters.push([key,value]); return this; },order(){return this;},
        then(resolve) { const data=table==='ad_slot_presentations'?settings:metadata&&table==='ad_banner_search_metadata'?[{banner_key:`campaign:${reuseId}`,postal_code:metadata.postal_code,city:metadata.city}]:metadata&&table==='ad_banner_search_terms'?metadata.term_keys.map(term_key=>({banner_key:`campaign:${reuseId}`,term_key})):[];return Promise.resolve({ data, error: null }).then(resolve); },
        async maybeSingle() { return { data: table === "portal_admins" ? admin ? { user_id: "verified-admin" } : null : structuredClone(row), error: null }; } };
    },
    async rpc(name, data) {
      calls.push({ rpc: name, data });
      if (name === "get_active_ad_campaigns") return { data: active, error: null };
      if (name === 'admin_ad_lifecycle' && data.p_action === 'reuse' && reuseId) {
        calls.push({original:structuredClone(row)});
        Object.assign(row,{id:reuseId,status:'draft',archived_at:null,image_path:null,targets:[],requested_start_date:null,requested_end_date:null,approved_start_date:null,approved_end_date:null});
        return {data:reuseId,error:null};
      }
      if (name === 'admin_ad_lifecycle' && data.p_action === 'attach_copy') row.image_path=data.p_image_path;
      if (name === "remove_inline_ad_banner") {
        if (removeError) return { error: removeError };
        const previous = row.image_path; row.status = "draft"; row.image_path = null;
        if (data.p_remove_banner) row.targets = [];
        return { data: previous, error: null };
      }
      if (name === "create_editorial_ad_campaign") {
        Object.assign(row, { is_editorial: true, profile_id: null, status: "draft", image_path: null, internal_name: "", headline: "",
          requested_start_date: berlinToday(), requested_end_date: berlinToday(), approved_start_date: null, approved_end_date: null,
          targets: [{ target_type: data.p_target_type, target_key: data.p_target_key, category_id: null, placement: data.p_placement }] });
        return { data: id, error: null };
      }
      if (name === "save_ad_campaign") {
        if (saveError) return { error: saveError };
        Object.assign(row, data.p_data); if (data.p_submit) row.status = "pending";
      }
      if (name === "review_ad_campaign") {
        if (reviewError) return { error: reviewError };
        row.status = "approved"; row.approved_start_date = data.p_start; row.approved_end_date = data.p_end;
      }
      return { data: null, error: null };
    },
    storage: { from(bucket) {
      calls.push({ bucket });
      return {
        async download(path) { calls.push({ download: path }); return { data: new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jv1EAAAAASUVORK5CYII=", "base64")], { type: "image/png" }), error: null }; },
        async remove(paths) { calls.push({ remove: paths }); return { error: null }; },
        async upload(path,blob,options) {calls.push({upload:path,upsert:options.upsert});return {error:null};},
        async createSignedUrls(paths) { calls.push({ sign: paths }); return { data: paths.map((path) => ({ path, signedUrl: `https://private.example.org/${path}` })), error: null }; },
      };
    } },
  };
}

test("inline contexts accept only real homepage, directory, 12 themes and four destinations", () => {
  const paths = ["/", "/unterkuenfte-a-z", "/mottoreisen", "/reiseziele", ...travelThemes.map((item) => `/mottoreisen/${item.slug}`), ...destinations.map((item) => `/reiseziele/${item.slug}`)];
  assert.equal(paths.length, 20);
  for (const path of paths) assert.equal(inlineAdContext(path)?.path, path);
  for (const path of ["/admin", "/experten/foo", "/mottoreisen/fake", "/reiseziele/fake", "/reiseziele/deutschland/", "/?page=admin"]) assert.equal(inlineAdContext(path), null);
  assert.equal(matchesInlineAdContext(target(), inlineAdContext("/mottoreisen/wellnessangebote")), true);
  assert.equal(matchesInlineAdContext(target("mottoreisen/wanderurlaub"), inlineAdContext("/mottoreisen/wellnessangebote")), false);
});

test("size choices persist as controlled relative presentation, not arbitrary dimensions", async () => {
  for (const size of ["small", "medium", "large"]) {
    const db = client();
    assert.ok((await saveInlineAd(db, "/mottoreisen/wellnessangebote", form({ size }))).success);
    const rpc = db.calls.find((call) => call.rpc === "save_inline_ad_presentation");
    assert.equal(rpc.data.p_size, size); assert.equal(rpc.data.p_target_key, "mottoreisen/wellnessangebote");
    assert.equal(rpc.data.p_campaign_id, id);
  }
  const db = client();
  assert.ok((await saveInlineAd(db, "/mottoreisen/wellnessangebote", form({ size: "999px" }))).error);
  assert.equal(db.calls.length, 0);
});

test("remove only the authorized single-target editorial banner, then clean its exact unreferenced image", async () => {
  for (const action of ["image", "banner"]) {
    const db = client({ campaign: { is_editorial: true, profile_id: null } });
    const result = await removeInlineAd(db, "/mottoreisen/wellnessangebote", form({ action }));
    assert.ok(result.success); assert.equal(result.removed, action === "banner");
    assert.equal(db.row.image_path, null);
    assert.deepEqual(db.calls.find((call) => call.remove).remove, [image]);
    if (action === "image") {
      assert.equal(result.ad.suppressed, true);
      const saved = await saveInlineAd(db, "/mottoreisen/wellnessangebote", form({ size: "small" }));
      assert.ok(saved.success); assert.equal(saved.ad.suppressed, true);
      assert.equal(db.row.status, "draft", "saving an imageless draft must not publish it");
    }
  }
});

test("failed, forged, non-admin, shared and company banner removals cannot remove Storage objects", async () => {
  for (const config of [{ authenticated: false }, { admin: false }, {},
    { campaign: { is_editorial: true, targets: [target(),target("mottoreisen/wanderurlaub")] } },
    { campaign: { is_editorial: true }, removeError: { message: "changed" } }]) {
    const db = client(config);
    assert.ok((await removeInlineAd(db, "/mottoreisen/wellnessangebote", form({ action: "banner" }))).error);
    assert.ok(!db.calls.some((call) => call.remove));
  }
  const db = client({ campaign: { is_editorial: true } });
  assert.ok((await removeInlineAd(db, "/reiseziele/deutschland", form({ action: "banner" }))).error);
  assert.ok(!db.calls.some((call) => call.rpc || call.bucket));
});

test("legacy URL/size and deletion affect only the actual bound mapping; stale legacy controls are rejected", async () => {
  const legacyForm = () => form({ campaign_id: "", legacy_id: "city-apart-square", placement: "sidebar_top", original_placement: "sidebar_top", size: "medium" });
  const db = client();
  const saved = await saveInlineAd(db, "/", legacyForm());
  assert.ok(saved.success); assert.equal(saved.ad.source, "legacy");
  assert.equal(saved.ad.target_url, "https://example.org/new");
  const removal = legacyForm(); removal.set("action", "banner");
  assert.equal((await removeInlineAd(db, "/", removal)).removed, true);
  assert.ok(!db.calls.some((call) => call.remove || call.rpc === "save_ad_campaign"));
  for (const config of [{ admin: false }, { active: [{ placement: "sidebar_top" }] },
    { settings: [{ placement: "sidebar_top", legacy_hidden: true }] }]) {
    const denied = client(config);
    assert.ok((await removeInlineAd(denied, "/", removal)).error);
    assert.ok(!denied.calls.some((call) => call.rpc === "save_inline_ad_presentation"));
  }
});

test("removing a legacy image retains URL as a standard editorial draft without copying its static file", async () => {
  const db = client();
  const result = await removeInlineAd(db, "/", form({ campaign_id: "", legacy_id: "city-apart-square",
    placement: "sidebar_top", original_placement: "sidebar_top", action: "image" }));
  assert.ok(result.success); assert.equal(result.ad.suppressed, true); assert.equal(result.ad.id, id);
  assert.equal(db.row.status, "draft"); assert.equal(db.row.target_url, "https://city-apart-dresden.de/");
  assert.ok(!db.calls.some((call) => call.download || call.remove || call.sign));
});

test("moved Legacy content is edited/removed through its new fixed slot; former asset ID is rejected", async () => {
  const settings=[{placement:"sidebar_top",legacy_placement:"sidebar_bottom",size:"small",legacy_hidden:false,legacy_target_url:"https://example.org/moved"}];
  const db=client({settings});
  const moved=form({campaign_id:"",legacy_id:"ferienanlage-nationalpark",placement:"sidebar_top",original_placement:"sidebar_top",action:"banner"});
  assert.equal((await saveInlineAd(db,"/",moved)).ad.id,"ferienanlage-nationalpark");
  assert.equal((await removeInlineAd(db,"/",moved)).removed,true);
  const wrong=client({settings}); moved.set("legacy_id","city-apart-square");
  assert.ok((await removeInlineAd(wrong,"/",moved)).error);
  assert.ok(!wrong.calls.some(call=>call.rpc==='save_inline_ad_presentation'));
});

test("visitor and ordinary account cannot prepare uploads or save even with admin metadata", async () => {
  for (const options of [{ authenticated: false }, { admin: false }]) {
    const db = client(options);
    assert.ok((await prepareInlineAdUpload(db, "/mottoreisen/wellnessangebote", form())).error);
    assert.ok((await saveInlineAd(db, "/mottoreisen/wellnessangebote", form())).error);
    assert.ok(db.calls.every((call) => call.table === "portal_admins"));
  }
});

test("forged foreign-context campaign IDs and unknown context perform no mutation", async () => {
  for (const path of ["/mottoreisen/wanderurlaub", "/reiseziele/deutschland", "/invalid"]) {
    const db = client();
    assert.ok((await prepareInlineAdUpload(db, path, form())).error);
    assert.ok((await saveInlineAd(db, path, form())).error);
    assert.ok(!db.calls.some((call) => call.rpc || call.bucket));
  }
});

test("admin without a company prepares all thirteen existing places using the bound context", async () => {
  for (const placement of Object.keys(adPlacements)) {
    const db = client();
    const prepared = await prepareInlineAdUpload(db, "/reiseziele/oesterreich", form({ campaign_id: "", placement, file_type: "image/png", file_size: "100" }));
    assert.equal(prepared.campaignId, id);
    assert.match(prepared.uploadPath, new RegExp(`^campaigns/${id}/creative/[a-f0-9-]+\\.png$`));
    assert.deepEqual(db.calls.find((call) => call.rpc === "create_editorial_ad_campaign").data,
      { p_target_type: "portal_area", p_target_key: "reiseziele/oesterreich", p_placement: placement });
    assert.ok(!db.calls.some((call) => ["companies", "company_profiles"].includes(call.table)));
    assert.equal(db.row.profile_id, null);
  }
});

test("invalid URL, placement or file metadata creates no draft or upload", async () => {
  for (const values of [{ target_url: "javascript:alert(1)" }, { placement: "sidebar_13" }, { file_type: "image/svg+xml" }, { file_size: "6000000" }]) {
    const db = client();
    const result = await prepareInlineAdUpload(db, "/", form({ campaign_id: "", file_type: "image/png", file_size: "100", ...values }));
    assert.ok(result.error); assert.ok(!db.calls.some((call) => call.rpc || call.bucket));
  }
});

test("existing single-target campaign preserves company, dates, contacts and metadata while editing exact context", async () => {
  const db = client({campaign:{targets:[target("mottoreisen/wellnessangebote", "sidebar_12")]}});
  const result = await saveInlineAd(db, "/mottoreisen/wellnessangebote", form({ placement: "sidebar_12", targets: "homepage|top_banner", profile_id: "forged", internal_name: "forged", requested_end_date: "9999-12-31" }));
  assert.ok(result.success);
  const saved = db.calls.find((call) => call.rpc === "save_ad_campaign").data;
  assert.deepEqual(saved.p_data.targets, [target("mottoreisen/wellnessangebote", "sidebar_12")]);
  assert.equal(saved.p_data.internal_name, "Existing"); assert.equal(saved.p_data.contact_name, "Existing contact");
  assert.equal(saved.p_data.requested_end_date, "2026-12-31"); assert.equal(db.row.profile_id, "existing-company");
  assert.equal(result.ad.placement, "sidebar_12"); assert.ok(result.ad.imageUrl);
  assert.equal(saved.p_submit, false); assert.ok(!db.calls.some((call) => call.rpc === "review_ad_campaign"));
});

test("new editorial creative reuses secure byte validation and existing publication RPC", async () => {
  const db = client();
  const input = form({ campaign_id: "", file_type: "image/png", file_size: "100" });
  const prepared = await prepareInlineAdUpload(db, "/mottoreisen/wellnessangebote", input);
  input.set("uploaded_path", prepared.uploadPath);
  const result = await saveInlineAd(db, "/mottoreisen/wellnessangebote", input);
  assert.ok(result.success, result.error);
  assert.equal(db.row.status, "approved"); assert.equal(db.row.profile_id, null);
  assert.equal(db.row.approved_start_date, berlinToday()); assert.equal(db.row.approved_end_date, "9999-12-31");
  assert.equal(db.row.targets.length, 1);
  assert.equal(db.calls.filter((call) => call.download).length, 1);
  assert.equal(db.calls.filter((call) => call.rpc === "review_ad_campaign").length, 1);
});

test("shared campaigns are not altered inline and report the existing management path", async () => {
  const db = client({ campaign: { targets: [target(), target("mottoreisen/wanderurlaub")] } });
  assert.match((await saveInlineAd(db, "/mottoreisen/wellnessangebote", form())).error, /mehreren Bereichen/);
  assert.match((await prepareInlineAdUpload(db, "/mottoreisen/wellnessangebote", form())).error, /mehreren Bereichen/);
  assert.ok(!db.calls.some((call) => call.rpc || call.bucket));
});

test("foreign media reference rejected before storage read or save", async () => {
  const db = client();
  assert.ok((await saveInlineAd(db, "/mottoreisen/wellnessangebote", form({ uploaded_path: "campaigns/foreign/creative/file.png" }))).error);
  assert.ok(!db.calls.some((call) => call.download || call.rpc));
});

test("conflict returns error without approval and storage replacement cleanup stays in existing helper", async () => {
  const db = client({ saveError: { message: "ad_booking_conflict" } });
  const result = await saveInlineAd(db, "/mottoreisen/wellnessangebote", form({ uploaded_path: image }));
  assert.match(result.error, /belegt/);
  assert.ok(!db.calls.some((call) => call.rpc === "review_ad_campaign"));
  assert.ok(db.calls.some((call) => call.remove?.includes(image)));
});

test("approval failure does not claim public success and keeps saved pending creative", async () => {
  const db = client({ campaign: { status: "pending" }, reviewError: { message: "ad_booking_conflict" } });
  const result = await saveInlineAd(db, "/mottoreisen/wellnessangebote", form());
  assert.ok(result.error); assert.equal(result.success, undefined); assert.equal(db.row.status, "pending");
});

test('page-bound legacy IDs cannot edit a historical banner belonging to another page',async()=>{
 for(const path of ['/mottoreisen/natur-pur','/mottoreisen','/unterkuenfte-a-z']){const db=client();const request=form({campaign_id:'',legacy_id:path==='/unterkuenfte-a-z'?'legacy-539':'city-apart-square',placement:'sidebar_top',original_placement:'sidebar_top',action:'banner'});assert.ok((await removeInlineAd(db,path,request)).error);assert.ok(!db.calls.some(c=>c.rpc==='save_inline_ad_presentation'||c.bucket));}
 const db=client();const saved=await saveInlineAd(db,'/mottoreisen/natur-pur',form({campaign_id:'',legacy_id:'legacy-539',placement:'sidebar_top',original_placement:'sidebar_top',size:'medium'}));assert.ok(saved.success);assert.equal(saved.ad.id,'legacy-539');assert.equal(saved.ad.image_width,350);assert.equal(saved.ad.banner_size,'medium');
});


test('crop-only mutations authorize the page/source and never alter campaign, booking, metadata or Storage',async()=>{
 const {saveInlineAdCrop}=await import('../src/lib/inline-advertising.ts');
 const settings=[{placement:'sidebar_top',display_source:'sidebar_bottom'},{placement:'sidebar_bottom',display_source:'sidebar_top'}];
 const db=client({settings,campaign:{targets:[target('mottoreisen/wellnessangebote','sidebar_bottom')]}});
 const before=structuredClone(db.row);
 const saved=await saveInlineAdCrop(db,'/mottoreisen/wellnessangebote',form({placement:'sidebar_top',focus_x:'25',focus_y:'75',zoom:'1.5'}));
 assert.ok(saved.success,saved.error);assert.deepEqual(db.row,before);
 const writes=db.calls.filter(x=>x.rpc);assert.deepEqual(writes.map(x=>x.rpc),['save_inline_ad_crop']);
 assert.equal(writes[0].data.p_placement,'sidebar_bottom');assert.equal(writes[0].data.p_reference,'campaign:'+id+':'+image);
 assert.ok(!db.calls.some(x=>x.bucket));
 for(const config of [{admin:false},{authenticated:false},{campaign:{targets:[target(),target('reiseziele/deutschland')]} }]){
  const blocked=client(config);assert.ok((await saveInlineAdCrop(blocked,'/mottoreisen/wellnessangebote',form({focus_x:'25',focus_y:'75',zoom:'1.5'}))).error);
  assert.ok(!blocked.calls.some(x=>x.rpc==='save_inline_ad_crop'));
 }
 const legacy=client();const result=await saveInlineAdCrop(legacy,'/unterkuenfte-a-z',form({campaign_id:'',legacy_id:'city-apart-square',placement:'sidebar_top',original_placement:'sidebar_top',focus_x:'20',focus_y:'80',zoom:'2'}));
 assert.ok(result.success,result.error);assert.equal(legacy.calls.find(x=>x.rpc==='save_inline_ad_crop').data.p_reference,'legacy:city-apart-square');
 assert.ok(!legacy.calls.some(x=>x.bucket));
 assert.ok((await saveInlineAdCrop(client(),'/reiseziele/schweiz',form({focus_x:'20',focus_y:'80',zoom:'2'}))).error);
 assert.ok((await saveInlineAdCrop(client(),'/mottoreisen/wellnessangebote',form({focus_x:'-1',focus_y:'80',zoom:'2'}))).error);
});
