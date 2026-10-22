import test from 'node:test';
import assert from 'node:assert/strict';
import {auditRepositoryFiles} from '../scripts/check-repository-boundary.mjs';

test('public runtime, build tools, schema and empty environment template remain allowed',()=>{
  const files=['src/app/page.tsx','public/example.jpg','scripts/build-portal-search-catalog.mjs','supabase/migrations/20261016152914_basic_search_admin_pilot.sql','.env.example','docs/auth-email-templates/recovery.html'];
  assert.deepEqual(auditRepositoryFiles(files,()=>''),[]);
});
test('internal workers, evidence, data imports and real environment files cannot return unnoticed',()=>{
  const files=['workers/acquisition/website_html.py','scripts/run-website-enrichment.mjs','docs/old-inventory.json','supabase/migrations/20260926190001_import_verified_reiseportal_batch_01.sql','.env.local','AGENTS.md','public/reiseportal/news/manifest.json'];
  assert.equal(auditRepositoryFiles(files,()=>'').filter(p=>p.reason==='internal-file').length,files.length);
});
test('possible credentials are reported by filename without echoing their values',()=>{
  const token='sb_'+'secret_'+'x'.repeat(20);
  const result=auditRepositoryFiles(['src/example.ts'],()=>`const value='${token}';`);
  assert.deepEqual(result,[{file:'src/example.ts',reason:'possible-secret'}]);
  assert.ok(!JSON.stringify(result).includes(token));
});
