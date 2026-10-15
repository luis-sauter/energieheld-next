// Offline preparation only. Not imported by any public page, API or admin UI.
import { createHash } from 'node:crypto';

export type BasicAddress = { country: string; region: string; city: string; postalCode: string; street: string };
export type BasicContact = { id: string; name: string; address: BasicAddress; phone: string };
export type PriceObservation = {
  amount: number; currency: string; basis: 'person_night' | 'unit_night' | 'stay' | 'unknown';
  occupancy?: number | null; nights?: number | null; board?: string | null;
  mandatoryExtraPerPersonNight?: number | null; extrasKnown: boolean;
  period?: string | null; sourceUrl: string; isFromPrice?: boolean;
};
export type PilotRecord = {
  sourceKey: string; name: string; accommodationType?: string | null;
  address: { country: string; region: string; municipality: string; locality: string; postalCode: string; addressLine: string };
  phone: string; website?: string | null; operatorId?: string | null;
  themes: string[]; themeEvidence: { feature: string; sourceUrl: string }[];
  sources: { url: string; checkedAt: string; activityEvidence?: string }[];
  price: PriceObservation | null;
};
export type ExistingIdentity = {
  id: string; display_name: string; street?: string | null; postal_code?: string | null;
  city?: string | null; country?: string | null; phone?: string | null; website?: string | null;
};
export const normalizeIdentityText = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/ß/g, 'ss').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const countries: Record<string,string> = { deutschland:'DE', germany:'DE', de:'DE', osterreich:'AT', austria:'AT', at:'AT', schweiz:'CH', switzerland:'CH', ch:'CH', italien:'IT', italy:'IT', it:'IT' };
export const normalizeCountry = (value: string) => countries[normalizeIdentityText(value)] ?? '';
export function normalizePhone(value: string, country: string) {
  if (!value || /[a-z@;,]/i.test(value)) return '';
  if(value.includes('/')&&(value.split('/').length!==2||value.split('/')[0].replace(/\D/g,'').length>8))return '';
  let phone = value.replace(/\(0\)/g, '').replace(/[\s()./-]/g, '');
  if (phone.startsWith('00')) phone = '+' + phone.slice(2);
  const prefix: Record<string,string> = { DE:'+49', AT:'+43', CH:'+41', IT:'+39' };
  if (/^0/.test(phone) && prefix[country]) phone = prefix[country] + (country === 'IT' ? phone : phone.slice(1));
  return /^\+[1-9]\d{6,14}$/.test(phone) ? phone : '';
}
export function websiteHost(value?: string | null) {
  try { const u=new URL(value ?? ''); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.hostname.toLowerCase().replace(/^www\./,'') : ''; } catch { return ''; }
}
export function stablePilotId(sourceKey: string) {
  const hex=createHash('sha256').update('reiseportal-accommodation-pilot:v1:'+sourceKey).digest('hex').slice(0,32).split('');
  hex[12]='8'; hex[16]=['8','9','a','b'][parseInt(hex[16],16)&3];
  const s=hex.join('');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
}
const httpSource=(value:string) => {try {const u=new URL(value);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password;}catch{return false;}};
export function publicBasicFields(value: BasicContact): BasicContact {
  // Construct every nested field explicitly; never spread a research object.
  return {id:value.id,name:value.name,address:{country:value.address.country,region:value.address.region,city:value.address.city,postalCode:value.address.postalCode,street:value.address.street},phone:value.phone};
}
export function visibleBasicContact(value: BasicContact & { status: string; isListed: boolean }): BasicContact | null {
  return value.status==='approved'&&value.isListed ? publicBasicFields(value) : null;
}
export function priceComparison(price: PriceObservation | null) {
  const unknown={status:'unverified' as const,eurPerPersonNight:null};
  if (!price || !Number.isFinite(price.amount) || price.amount<=0 || !httpSource(price.sourceUrl) || !price.period || !price.board || !price.extrasKnown) return unknown;
  if (price.currency !== 'EUR') return {...unknown,status:'exchange_rate_required' as const};
  let base=price.amount;
  if (price.basis==='unit_night' || price.basis==='stay') {
    if (!Number.isInteger(price.occupancy)||!price.occupancy||price.occupancy<1) return unknown;
    base/=price.occupancy;
    if(price.basis==='stay'){if(!Number.isInteger(price.nights)||!price.nights||price.nights<1)return unknown;base/=price.nights;}
  } else if(price.basis!=='person_night') return unknown;
  const extra=price.mandatoryExtraPerPersonNight ?? 0;
  if (!Number.isFinite(extra)||extra<0) return unknown;
  const total=Math.round((base+extra)*100)/100;
  return {status:total<=200 ? price.isFromPrice?'indicative_under_limit' as const:'within_limit' as const:'above_limit' as const,eurPerPersonNight:total};
}
type Identity = {name:string;country:string;postalCode:string;street:string;phone:string;host:string};
function identity(record: PilotRecord): Identity {
  const country=normalizeCountry(record.address.country);
  return {name:normalizeIdentityText(record.name),country,postalCode:record.address.postalCode.trim(),street:normalizeIdentityText(record.address.addressLine),phone:normalizePhone(record.phone,country),host:websiteHost(record.website)};
}
function existingIdentity(record:ExistingIdentity):Identity {
  const country=normalizeCountry(record.country??'');
  return {name:normalizeIdentityText(record.display_name),country,postalCode:record.postal_code?.trim()??'',street:normalizeIdentityText(record.street??''),phone:normalizePhone(record.phone??'',country),host:websiteHost(record.website)};
}
export function compareIdentity(a:Identity,b:Identity) {
  const name=Boolean(a.name&&a.name===b.name),address=Boolean(a.country&&a.country===b.country&&a.postalCode&&a.postalCode===b.postalCode&&a.street&&a.street===b.street);
  const phone=Boolean(a.phone&&a.phone===b.phone),host=Boolean(a.host&&a.host===b.host);
  const signals=[name&&'name',address&&'address',phone&&'phone',host&&'website'].filter(Boolean);
  // An operator, domain or switchboard alone never merges distinct properties.
  const addressConflict=Boolean(a.country&&b.country&&a.postalCode&&b.postalCode&&a.street&&b.street&&!address);
  const duplicate=address&&(name||phone||host)||!addressConflict&&name&&phone&&host;
  return {decision:duplicate?'duplicate' as const:signals.length?'manual_review' as const:'distinct' as const,signals};
}
export type StagedBasic = {sourceKey:string;id:string;fingerprint:string;record:PilotRecord};
function validShape(record:PilotRecord) {
  return record && typeof record.sourceKey==='string' && record.sourceKey.trim().length>0 && record.sourceKey.length<=2048 && typeof record.name==='string' && record.name.trim().length>0 && record.name.length<=300 && record.address &&
    ['country','region','municipality','locality','postalCode','addressLine'].every(k=>typeof record.address[k as keyof PilotRecord['address']]==='string') && typeof record.phone==='string' &&
    Array.isArray(record.themes)&&record.themes.every(t=>typeof t==='string')&&Array.isArray(record.themeEvidence)&&record.themeEvidence.every(e=>e&&typeof e.feature==='string'&&typeof e.sourceUrl==='string')&&
    Array.isArray(record.sources)&&record.sources.every(s=>s&&typeof s.url==='string'&&typeof s.checkedAt==='string');
}
export function prepareBasicPilot(records:PilotRecord[],existing:ExistingIdentity[],prior:StagedBasic[]=[],allowedThemes:readonly string[]=[]) {
  const staged=prior.map(row=>({...row})),decisions:{sourceKey:string;decision:string;issues:string[];matches?:string[];price?:ReturnType<typeof priceComparison>}[]=[];
  for(const record of records){
    const issues:string[]=[];
    if(!validShape(record)){decisions.push({sourceKey:typeof record?.sourceKey==='string'?record.sourceKey:'',decision:'incomplete',issues:['invalid_identity']});continue;}
    const key=identity(record);
    if(!key.country||!(key.country==='DE'||key.country==='IT'?/^\d{5}$/:/^\d{4}$/).test(key.postalCode)||!record.address.locality?.trim()||!key.street||!record.address.region?.trim()||!/[0-9]/.test(record.address.addressLine))issues.push('missing_address');
    if(!key.phone)issues.push('missing_or_invalid_phone');
    if(!record.sources?.length||record.sources.some(s=>!httpSource(s.url)||!Number.isFinite(Date.parse(s.checkedAt))))issues.push('missing_sources');
    if(!record.sources?.some(s=>s.activityEvidence))issues.push('activity_unverified');
    if(!record.accommodationType)issues.push('accommodation_type_unverified');
    if(!record.themes?.length||!record.themeEvidence?.length||record.themeEvidence.some(s=>!httpSource(s.sourceUrl)))issues.push('category_unverified');
    if(!allowedThemes.length||record.themes.some(key=>!allowedThemes.includes(key)))issues.push('category_catalog_unverified');
    const matches=existing.map(e=>({id:e.id,...compareIdentity(key,existingIdentity(e))})).filter(e=>e.decision!=='distinct');
    if(matches.length){decisions.push({sourceKey:record.sourceKey,decision:matches.some(e=>e.decision==='duplicate')?'existing_profile':'manual_review',issues,matches:matches.map(e=>e.id)});continue;}
    const fingerprint=createHash('sha256').update(JSON.stringify(record)).digest('hex');
    const previous=staged.find(e=>e.sourceKey===record.sourceKey);
    if(previous){decisions.push({sourceKey:record.sourceKey,decision:previous.fingerprint===fingerprint?'unchanged':'changed_source_requires_review',issues:[]});continue;}
    const batch=staged.filter(e=>compareIdentity(key,identity(e.record)).decision!=='distinct');
    if(batch.length){decisions.push({sourceKey:record.sourceKey,decision:'batch_identity_review',issues:[],matches:batch.map(e=>e.id)});continue;}
    if(issues.length){decisions.push({sourceKey:record.sourceKey,decision:'incomplete',issues});continue;}
    const price=priceComparison(record.price);
    if(price.status==='above_limit'){decisions.push({sourceKey:record.sourceKey,decision:'outside_price_limit',issues:[],price});continue;}
    staged.push({sourceKey:record.sourceKey,id:stablePilotId(record.sourceKey),fingerprint,record});
    decisions.push({sourceKey:record.sourceKey,decision:'potential_basic',issues:price.eurPerPersonNight===null?['price_unverified']:[],price});
  }
  const publicPreview=staged.map(({id,record})=>publicBasicFields({id,name:record.name.trim(),phone:normalizePhone(record.phone,normalizeCountry(record.address.country)),address:{country:normalizeCountry(record.address.country),region:record.address.region,city:record.address.locality,postalCode:record.address.postalCode,street:record.address.addressLine}}));
  return {mode:'local_dry_run' as const,canPublish:false,decisions,staged,publicPreview,summary:{researched:records.length,potentialBasic:decisions.filter(d=>d.decision==='potential_basic').length,existingProfiles:decisions.filter(d=>d.decision==='existing_profile').length,manualReview:decisions.filter(d=>['manual_review','batch_identity_review','changed_source_requires_review'].includes(d.decision)).length,incomplete:decisions.filter(d=>d.decision==='incomplete').length,unchanged:decisions.filter(d=>d.decision==='unchanged').length,priceUnverified:decisions.filter(d=>d.issues.includes('price_unverified')).length}};
}
