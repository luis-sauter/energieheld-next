import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const audit = JSON.parse(readFileSync(new URL('../docs/reiseportal-audience-evidence-audit.json', import.meta.url), 'utf8'));
const sql = readFileSync(new URL('../docs/reiseportal-audience-evidence-assignments.sql', import.meta.url), 'utf8');

test('audience evidence contains all required providers, official sources and only confirmed additions', () => {
  assert.equal(audit.profiles.length, 18);
  assert.equal(new Set(audit.profiles.map(p => p.profile_id)).size, 18);
  for (const slug of ['pension-sonnenhof','das-5-sterne-wellness-hotel-stock-resort','hotel-ravelli-luxury-spa','blausee','platzl-hotel','wirthshof','hoeflehner']) assert.ok(audit.profiles.some(p => p.slug === slug));
  for (const row of audit.profiles) {
    assert.equal(row.verified_at, '2026-10-06');
    assert.match(row.dog_source_url, /^https:\/\//);
    assert.ok(row.dog_evidence_summary && row.dog_restriction_note);
    assert.doesNotMatch(row.slug, /demo/);
    assert.equal(row.intended_term_additions.includes('audience:mit-hund'), row.dog_status === 'DOG_CONFIRMED');
    assert.equal(row.intended_term_additions.includes('audience:familie'), row.family_decision === 'ADD_CONFIRMED');
    assert.equal(row.intended_term_additions.includes('audience:paar'), row.pair_decision === 'ADD_CONFIRMED');
    if (row.family_decision === 'ADD_CONFIRMED') assert.ok(row.family_source_url);
    if (row.pair_decision === 'ADD_CONFIRMED') assert.ok(row.pair_source_url);
  }
  assert.equal(audit.retained_audience_assignments.length, 26);
  assert.doesNotMatch(sql, /\b(?:DELETE|UPDATE|ALTER|CREATE|DROP|GRANT|DISABLE)\b/i);
});

test('exact additive cloud assignment SQL is idempotent, preserves old relations and checks profile identity/status', async () => {
  const db = new PGlite();
  try {
    await db.exec("create table company_profiles(id uuid primary key,slug text,status text); create table travel_terms(term_key text primary key,dimension text); create table company_profile_travel_terms(profile_id uuid references company_profiles,term_key text references travel_terms,primary key(profile_id,term_key));");
    for (const key of ['audience:mit-hund','audience:familie','audience:paar','theme:radwandern']) await db.query('insert into travel_terms values($1,$2)', [key,key.split(':')[0]]);
    for (const row of audit.profiles) await db.query('insert into company_profiles values($1,$2,$3)', [row.profile_id,row.slug,'approved']);
    await db.query('insert into company_profile_travel_terms values($1,$2)', [audit.profiles[0].profile_id,'theme:radwandern']);
    await db.exec(sql);await db.exec(sql);
    const result = await db.query('select profile_id,term_key from company_profile_travel_terms order by profile_id,term_key');
    assert.equal(result.rows.length, 17);
    for (const p of audit.profiles) for (const key of p.intended_term_additions) assert.ok(result.rows.some(r=>r.profile_id===p.profile_id&&r.term_key===key));
    await db.exec('delete from company_profile_travel_terms');
    await db.query("update company_profiles set status='draft' where id=$1", [audit.profiles[0].profile_id]);
    await db.query("update company_profiles set slug='wrong-profile' where id=$1", [audit.profiles[1].profile_id]);
    await db.exec(sql);
    const guarded = await db.query('select * from company_profile_travel_terms');
    assert.equal(guarded.rows.length, 14);
    assert.ok(guarded.rows.every(r=>r.profile_id!==audit.profiles[0].profile_id&&r.profile_id!==audit.profiles[1].profile_id));
  } finally { await db.close(); }
});
