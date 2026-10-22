import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const publicScripts=new Set(['scripts/build-portal-search-catalog.mjs','scripts/build-europe-map.mjs','scripts/check-repository-boundary.mjs']);
const secretPattern=/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sb_secret_[A-Za-z0-9_-]{15,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/;
export function auditRepositoryFiles(files,read){
  const problems=[];
  for(const file of files){
    const internal=/^(?:workers\/|\.legacy-reiseportal\/|qa\/|backups\/|\.internal\/)/.test(file)
      ||/^(?:AGENTS|CLAUDE)\.md$/.test(file)
      ||/(?:^|\/)\.env(?:\.|$)/.test(file)&&file!=='.env.example'
      ||file.startsWith('scripts/')&&!publicScripts.has(file)
      ||file.startsWith('docs/')&&!/^docs\/auth-email-templates\/(?:confirmation|recovery)\.html$/.test(file)
      ||/^supabase\/(?:proposals|seeds)\//.test(file)
      ||/^supabase\/migrations\/\d+_(?:import_|seed_)/.test(file)
      ||file==='src/lib/basic-accommodation-pilot.ts'
      ||/^public\/reiseportal\/(?:destination-editorial|motto-editorial-v2|news)\/manifest\.json$/.test(file);
    if(internal)problems.push({file,reason:'internal-file'});
    if(/\.(?:[cm]?[jt]sx?|json|sql|toml|ya?ml|md|html)$/.test(file)||file==='.env.example'){
      const text=read(file);
      if(secretPattern.test(text))problems.push({file,reason:'possible-secret'});
    }
  }
  return problems;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const root=process.cwd();
  const files=execFileSync('git',['-c','safe.directory='+root.replaceAll('\\','/'),'ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
  const problems=auditRepositoryFiles(files,file=>readFileSync(file,'utf8'));
  if(problems.length){for(const {file,reason} of problems)console.error(`${reason}: ${file}`);process.exitCode=1;}
  else console.log(`Repository boundary passed: ${files.length} tracked files; no forbidden internal paths or checked secret patterns.`);
}
