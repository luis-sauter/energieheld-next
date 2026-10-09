import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./helpers/load-ts.mjs";
import { moveImageId } from "../src/lib/media-order.ts";
const { changeAdminCompanyMedia } = await import("../src/lib/admin-company-media.ts");

const profileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherProfileId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const imageId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const secondId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const path = `profiles/${profileId}/gallery/${imageId}.png`;
const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])], { type: "image/png" });
const rows = [
  { id: imageId, storage_path: path, alt_text: "Alt", sort_order: 0 },
  { id: secondId, storage_path: `profiles/${profileId}/gallery/${secondId}.png`, alt_text: null, sort_order: 1 },
];
function form(values) {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((item) => result.append(key, item));
    else result.set(key, value);
  }
  return result;
}
function client({ authenticated = true, admin = true, profileRows = rows, contact = null, missing = false, writeError = false, download = png } = {}) {
  const calls = [];
  return {
    calls,
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: "verified-admin" } : null }, error: null }) },
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      return {
        select(columns) { call.columns = columns; return this; },
        eq(key, value) { call.filters.push([key, value]); return this; },
        is(key, value) { call.filters.push([key, value]); return this; },
        update(payload) { call.action = "update"; call.payload = payload; return this; },
        insert(payload) { call.action = "insert"; call.payload = payload; return this; },
        delete() { call.action = "delete"; return this; },
        async maybeSingle() {
          if (table === "portal_admins") return { data: admin ? { user_id: "verified-admin" } : null, error: null };
          if (call.action) return { data: writeError ? null : { id: call.action === "insert" ? imageId : call.filters.find(([key]) => key === "id")?.[1] }, error: writeError ? { message: "private database error" } : null };
          return { data: missing ? null : { id: profileId, contact_image_path: contact, logo_path: `profiles/${profileId}/logo/${imageId}.png`, company_profile_images: profileRows }, error: null };
        },
      };
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, "company-media");
        return {
          download: async (objectPath) => { calls.push({ action: "download", path: objectPath }); return { data: download, error: null }; },
          remove: async (paths) => { calls.push({ action: "remove", paths }); return { error: null }; },
        };
      },
    },
    rpc: async (name, payload) => { calls.push({ action: "rpc", name, payload }); return { error: null }; },
  };
}

test("non-admin and signed-out users never read or mutate media", async () => {
  for (const options of [{ admin: false }, { authenticated: false }]) {
    const db = client(options);
    const result = await changeAdminCompanyMedia(db, profileId, form({ intent: "logo-remove" }));
    assert.notEqual(result.access, "admin");
    assert.ok(db.calls.every((call) => call.table === "portal_admins"));
  }
});

test("admin prepares upload path from verified profile, not submitted profile ID", async () => {
  const db = client();
  const result = await changeAdminCompanyMedia(db, profileId, form({
    intent: "prepare-gallery", file_type: "image/png", file_size: "100", profile_id: otherProfileId,
  }));
  assert.match(result.uploadPath, new RegExp(`^profiles/${profileId}/gallery/[0-9a-f-]{36}\\.png$`));
  assert.deepEqual(db.calls[1].filters, [["id", profileId]]);
  assert.ok(!db.calls.some((call) => call.table === "companies"));
});

test("admin upload preparation enforces type, size and gallery limit", async () => {
  for (const [file_type, file_size] of [["image/svg+xml", "100"], ["image/png", "5242881"], ["image/png", "0"]]) {
    const db = client();
    const result = await changeAdminCompanyMedia(db, profileId, form({ intent: "prepare-gallery", file_type, file_size }));
    assert.ok(result.error);
    assert.equal(result.uploadPath, undefined);
  }
  const full = client({ profileRows: Array.from({ length: 8 }, (_, index) => ({ ...rows[0], id: String(index) })) });
  assert.match((await changeAdminCompanyMedia(full, profileId, form({ intent: "prepare-gallery", file_type: "image/png", file_size: "100" }))).error, /8/);
});

test("admin upload rejects foreign paths and wrong kind before download or write", async () => {
  for (const uploadedPath of [
    `profiles/${otherProfileId}/gallery/${imageId}.png`,
    `profiles/${profileId}/logo/${imageId}.png`,
    `profiles/${profileId}/gallery/${imageId}.svg`,
  ]) {
    const db = client();
    const result = await changeAdminCompanyMedia(db, profileId, form({ intent: "gallery-upload", uploaded_path: uploadedPath }));
    assert.ok(result.error);
    assert.ok(!db.calls.some((call) => call.action === "download" || call.action === "insert"));
  }
});

test("downloaded bytes, extension and alt-text limit are checked before linking", async () => {
  const badBytes = client({ download: new Blob(["<svg/>"], { type: "image/png" }) });
  assert.ok((await changeAdminCompanyMedia(badBytes, profileId, form({ intent: "gallery-upload", uploaded_path: path }))).error);
  assert.ok(!badBytes.calls.some((call) => call.action === "insert"));
  const longAlt = client();
  assert.match((await changeAdminCompanyMedia(longAlt, profileId, form({ intent: "gallery-upload", uploaded_path: path, alt_text: "x".repeat(501) }))).error, /500/);
  assert.ok(!longAlt.calls.some((call) => call.action === "download"));
  const db = client();
  const result = await changeAdminCompanyMedia(db, profileId, form({ intent: "gallery-upload", uploaded_path: path, alt_text: " Blick auf das Haus " }));
  assert.ok(result.success);
  const insert = db.calls.find((call) => call.action === "insert");
  assert.equal(insert.payload.profile_id, profileId);
  assert.equal(insert.payload.alt_text, "Blick auf das Haus");
  assert.equal(insert.payload.storage_path, path);
});

test("logo replacement uses the selected profile and detaches the old file first", async () => {
  const db = client();
  const logoPath = `profiles/${profileId}/logo/${secondId}.png`;
  const result = await changeAdminCompanyMedia(db, profileId, form({ intent: "logo-upload", uploaded_path: logoPath }));
  assert.ok(result.success);
  const write = db.calls.find((call) => call.action === "update");
  assert.deepEqual(write.payload, { logo_path: logoPath });
  assert.ok(write.filters.some(([key, value]) => key === "id" && value === profileId));
  assert.deepEqual(db.calls.at(-1).paths, [`profiles/${profileId}/logo/${imageId}.png`]);
});

test("gallery replacement retains its row and order, validates the target and cleans only the old object", async () => {
  const replacementPath = `profiles/${profileId}/gallery/${crypto.randomUUID()}.png`;
  const fullRows = [...rows, ...Array.from({ length: 6 }, (_, index) => ({
    id: crypto.randomUUID(), storage_path: `profiles/${profileId}/gallery/${crypto.randomUUID()}.png`,
    alt_text: null, sort_order: index + 2,
  }))];
  const db = client({ profileRows: fullRows });
  assert.ok((await changeAdminCompanyMedia(db, profileId, form({ intent: "prepare-gallery",
    image_id: imageId, file_type: "image/png", file_size: "100" }))).uploadPath);
  assert.ok((await changeAdminCompanyMedia(db, profileId, form({ intent: "prepare-gallery",
    image_id: otherProfileId, file_type: "image/png", file_size: "100" }))).error);
  const saved = await changeAdminCompanyMedia(db, profileId, form({ intent: "gallery-upload",
    image_id: imageId, uploaded_path: replacementPath, alt_text: "Neue Ansicht" }));
  assert.ok(saved.success);
  const write = db.calls.find((call) => call.table === "company_profile_images" && call.action === "update");
  assert.deepEqual(write.payload, { storage_path: replacementPath, alt_text: "Neue Ansicht" });
  assert.deepEqual(write.filters, [["profile_id", profileId], ["id", imageId], ["storage_path", path]]);
  assert.ok(!db.calls.some((call) => call.action === "insert" || call.action === "delete"));
  assert.deepEqual(db.calls.at(-1), { action: "remove", paths: [path] });
  const failed = client({ writeError: true });
  assert.ok((await changeAdminCompanyMedia(failed, profileId, form({ intent: "gallery-upload",
    image_id: imageId, uploaded_path: replacementPath }))).error);
  assert.deepEqual(failed.calls.at(-1), { action: "remove", paths: [replacementPath] });
  const migration = readFileSync(new URL("../supabase/migrations/20260929142000_replace_profile_gallery_image.sql", import.meta.url), "utf8");
  assert.match(migration, /GRANT UPDATE \(storage_path\) ON public\.company_profile_images TO authenticated/);
  assert.match(migration, /NEW\.profile_id <> OLD\.profile_id/);
  assert.match(migration, /storage\.objects o WHERE o\.bucket_id = 'company-media' AND o\.name = NEW\.storage_path/);
  assert.doesNotMatch(migration, /TO anon|DISABLE ROW LEVEL SECURITY|CREATE POLICY/);
});

test("alt-text update and delete stay scoped to selected profile and image", async () => {
  const foreign = client();
  assert.ok((await changeAdminCompanyMedia(foreign, profileId, form({ intent: "gallery-alt", image_id: otherProfileId, alt_text: "x" }))).error);
  assert.ok(!foreign.calls.some((call) => call.action === "update"));
  const foreignDelete = client();
  assert.ok((await changeAdminCompanyMedia(foreignDelete, profileId, form({ intent: "gallery-remove", image_id: otherProfileId }))).error);
  assert.ok(!foreignDelete.calls.some((call) => call.action === "delete"));
  const longAlt = client();
  assert.match((await changeAdminCompanyMedia(longAlt, profileId, form({ intent: "gallery-alt", image_id: imageId, alt_text: "x".repeat(501) }))).error, /500/);
  assert.ok(!longAlt.calls.some((call) => call.action === "update"));
  const db = client();
  assert.ok((await changeAdminCompanyMedia(db, profileId, form({ intent: "gallery-alt", image_id: imageId, alt_text: " Neu " }))).success);
  const write = db.calls.find((call) => call.action === "update");
  assert.deepEqual(write.filters, [["profile_id", profileId], ["id", imageId]]);
  assert.deepEqual(write.payload, { alt_text: "Neu" });
  const deleted = client();
  assert.ok((await changeAdminCompanyMedia(deleted, profileId, form({ intent: "gallery-remove", image_id: imageId }))).success);
  assert.deepEqual(deleted.calls.find((call) => call.action === "delete").filters, [["profile_id", profileId], ["id", imageId]]);
  assert.deepEqual(deleted.calls.at(-1), { action: "remove", paths: [path] });
});

test("drag order sends a complete, exact profile permutation to existing RPC", async () => {
  assert.deepEqual(moveImageId([imageId, secondId], imageId, secondId), [secondId, imageId]);
  const db = client();
  const result = await changeAdminCompanyMedia(db, profileId, form({
    intent: "gallery-reorder", image_ids: [secondId, imageId, otherProfileId], profile_id: otherProfileId,
  }));
  assert.ok(result.error);
  assert.ok(!db.calls.some((call) => call.action === "rpc"));
  const correct = client();
  assert.ok((await changeAdminCompanyMedia(correct, profileId, form({ intent: "gallery-reorder", image_ids: [secondId, imageId] }))).success);
  assert.deepEqual(correct.calls.at(-1), {
    action: "rpc", name: "reorder_company_images",
    payload: { p_profile_id: profileId, p_image_ids: [secondId, imageId] },
  });
});


test('contact prepare/upload reuses admin authorization and only changes its own contact reference',async()=>{
 for(const options of [{authenticated:false},{admin:false},{missing:true}]){
  const db=client(options);const result=await changeAdminCompanyMedia(db,profileId,form({intent:'prepare-contact',file_type:'image/png',file_size:'12'}));
  assert.equal(result.uploadPath,undefined);assert.equal(db.calls.some(c=>c.action==='update'),false);
 }
 const db=client();const prepared=await changeAdminCompanyMedia(db,profileId,form({intent:'prepare-contact',file_type:'image/png',file_size:'12'}));assert.match(prepared.uploadPath,new RegExp('^profiles/'+profileId+'/contact/'));
 const uploaded=await changeAdminCompanyMedia(db,profileId,form({intent:'contact-upload',uploaded_path:prepared.uploadPath}));assert.ok(uploaded.success);
 const call=db.calls.find(c=>c.payload);assert.deepEqual(call.payload,{contact_image_path:prepared.uploadPath});assert.ok(call.filters.some(([key,value])=>key==='id'&&value===profileId));assert.ok(call.filters.some(([key,value])=>key==='contact_image_path'&&value===null));
 for(const path of ['profiles/'+otherProfileId+'/contact/'+imageId+'.png','profiles/'+profileId+'/gallery/'+imageId+'.png']){
  const invalid=client();assert.ok((await changeAdminCompanyMedia(invalid,profileId,form({intent:'contact-upload',uploaded_path:path}))).error);assert.equal(invalid.calls.some(c=>c.action==='download'||c.action==='update'||c.action==='remove'),false);
 }
 const failed=client({writeError:true});assert.ok((await changeAdminCompanyMedia(failed,profileId,form({intent:'contact-upload',uploaded_path:prepared.uploadPath}))).error);assert.ok(failed.calls.some(c=>c.action==='remove'&&c.paths.includes(prepared.uploadPath)));
 const invalidBytes=client({download:new Blob(['fake'],{type:'image/png'})});assert.ok((await changeAdminCompanyMedia(invalidBytes,profileId,form({intent:'contact-upload',uploaded_path:prepared.uploadPath}))).error);assert.equal(invalidBytes.calls.some(c=>c.payload&&c.name!=='media_library_retains_file'),false);
});


test('contact replacement/removal CAS preserves names and unrelated media and cleans old file only after success',async()=>{
 const previous='profiles/'+profileId+'/contact/'+imageId+'.png', next='profiles/'+profileId+'/contact/'+secondId+'.png';
 for(const intent of ['contact-upload','contact-remove']){
  const db=client({contact:previous});const result=await changeAdminCompanyMedia(db,profileId,form({intent,uploaded_path:next}));assert.ok(result.success);
  const update=db.calls.find(c=>c.payload);assert.deepEqual(update.payload,{contact_image_path:intent==='contact-upload'?next:null});assert.ok(update.filters.some(([key,value])=>key==='contact_image_path'&&value===previous));
  const cleanup=db.calls.find(c=>c.action==='remove');assert.deepEqual(cleanup.paths,[previous]);assert.ok(db.calls.indexOf(cleanup)>db.calls.indexOf(update));
 }
 const failed=client({contact:previous,writeError:true});assert.ok((await changeAdminCompanyMedia(failed,profileId,form({intent:'contact-upload',uploaded_path:next}))).error);assert.deepEqual(failed.calls.filter(c=>c.action==='remove').flatMap(c=>c.paths),[next]);
 const thrown=client({contact:previous});thrown.storage.from=()=>({download:async()=>{throw Error('private detail')},remove:async paths=>{thrown.calls.push({action:'remove',paths});return {error:null};}});
 const result=await changeAdminCompanyMedia(thrown,profileId,form({intent:'contact-upload',uploaded_path:next}));assert.ok(result.error);assert.equal(result.error.includes('private detail'),false);assert.equal(thrown.calls.some(c=>c.payload&&c.name!=='media_library_retains_file'),false);assert.deepEqual(thrown.calls.find(c=>c.action==='remove').paths,[next]);
});
