// Pure, offline rules. Evidence must have been fetched and attributed by the
// source adapter; these functions never crawl, write or publish automatically.
export const ACTIVE_RESEARCH_THEMES=Object.freeze(['natur-pur','nordic-walking','radwandern','wanderurlaub','familienurlaub','golfurlaub','urlaub-am-wasser','campingurlaub','romantik-zu-zweit','wellnessangebote','geschaeftsreisen'].map(k=>'theme:'+k));
const strengths={mention:1,service:2,specialization:3};
export function reviewResearchBatch(records){
 const ids=new Set(),counts=Object.fromEntries(ACTIVE_RESEARCH_THEMES.map(k=>[k,0]));
 const reviewed=records.map(record=>{
  if(!record.id||ids.has(record.id))throw Error('Unique lodging identity required');ids.add(record.id);
  const matrix=ACTIVE_RESEARCH_THEMES.map(key=>{
   const claims=(record.claims??[]).filter(c=>c.key===key).map(c=>{
    if(!Object.hasOwn(strengths,c.strength)||typeof c.fact!=='string'||!c.fact.trim()||!c.sameBusiness||!/^https?:\/\//.test(c.url??''))throw Error('Attributed factual theme evidence required');
    return {...c,score:strengths[c.strength]};
   });
   const score=Math.max(0,...claims.map(c=>c.score));
   return {key,score,status:score>=2?'supported':score===1?'mention_only':'not_established',claims};
  });
  if((record.claims??[]).some(c=>!ACTIVE_RESEARCH_THEMES.includes(c.key)))throw Error('Inactive theme');
  const automatic=matrix.filter(m=>m.score>=2).map(m=>m.key).sort();
  const manual=record.manualDecisions??{};
  if(Object.entries(manual).some(([k,v])=>!ACTIVE_RESEARCH_THEMES.includes(k)||typeof v!=='boolean'))throw Error('Invalid manual decision');
  const effective=ACTIVE_RESEARCH_THEMES.filter(k=>manual[k]===true||manual[k]!==false&&automatic.includes(k));
  return {id:record.id,matrix,automatic,effective,preferred:null};
 });
 // Strong specializations win before balancing. Stable ID/key tie breaks make
 // this invariant to source iteration order. Every supported filter survives.
 const priority=r=>Math.max(0,...r.matrix.filter(m=>r.effective.includes(m.key)).map(m=>m.score));
 for(const r of [...reviewed].sort((a,b)=>priority(b)-priority(a)||a.id.localeCompare(b.id,'en'))){
  const best=priority(r);const candidates=r.effective.filter(k=>(r.matrix.find(m=>m.key===k)?.score??0)===best);
  candidates.sort((a,b)=>counts[a]-counts[b]||a.localeCompare(b,'en'));
  r.preferred=candidates[0]??null;if(r.preferred)counts[r.preferred]++;
 }
 return reviewed.sort((a,b)=>a.id.localeCompare(b.id,'en'));
}
export function legalResearchTargets(homeUrl,links){
 const origin=new URL(homeUrl);return [...new Set(links.filter(link=>{
  try{const u=new URL(link.url,origin);return ['http:','https:'].includes(u.protocol)&&u.hostname.replace(/^www\./,'')===origin.hostname.replace(/^www\./,'')&&/impressum|imprint|legal-notice/i.test((link.label??'')+' '+u.pathname)}catch{return false}
 }).map(link=>new URL(link.url,origin).href))];
}
export function verifiedBusinessContact({name,role,sourceRoleLabel=role,sourceUrl,sourceText,sameBusiness,checkedAt}){
 if(!sameBusiness||!name?.trim()||!role?.trim()||!sourceRoleLabel?.trim()||!/^https?:\/\//.test(sourceUrl??'')||!Number.isFinite(Date.parse(checkedAt))||!name.split('; ').every(part=>sourceText?.includes(part))||!sourceText.includes(sourceRoleLabel))throw Error('Explicit same-business name, role and legal evidence required');
 return {name:name.trim(),role:role.trim(),sourceUrl,checkedAt};
}
