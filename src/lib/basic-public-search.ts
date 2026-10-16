import 'server-only';
import {createPublicClient} from './supabase/public';
import {portalSearchFilters,accommodationSearchOnly} from './portal-search-filters';
import {readBasicContact,type BasicContact} from './basic-contact';
import {mergeSearchHits,queryWords,searchQuery,searchType,type SearchCursor,type SearchHit} from './portal-search-values';
import type {TravelFilterValues} from './reiseportal-filter-options';
export const basicIntegrationEnabled = () => process.env.BASIC_ACCOMMODATIONS_ENABLED === 'true';
export type AccommodationCursor = {scope:string;tier:number;order:number;text:string;name:string;id:string};
type ProfileEntry = {kind:'profile';id:string;title:string;url:string;rank:number;excerpt:string};
export type AccommodationEntry = BasicContact | ProfileEntry;
export type AccommodationPage = {total:number;items:{entry:AccommodationEntry;after:AccommodationCursor}[];hasMore:boolean;facets:Record<string,number>};
export function readAccommodationCursor(raw:string|undefined):AccommodationCursor|null {
  if(!raw)return null;
  if(raw.length>2048)throw Error('Invalid cursor');
  const c=JSON.parse(raw);
  if(!c||typeof c.scope!=='string'||!Number.isInteger(c.tier)||!Number.isFinite(c.order)||typeof c.text!=='string'||typeof c.name!=='string'||typeof c.id!=='string')throw Error('Invalid cursor');
  return c;
}
export async function loadAccommodationPage(query:string,filters?:TravelFilterValues,cursor:AccommodationCursor|null=null,options:{countOnly?:boolean;facets?:boolean;basicsOnly?:boolean;signal?:AbortSignal}={}):Promise<AccommodationPage>{
  const request=createPublicClient().rpc('search_public_accommodations',{p_query:searchQuery(query),p_filters:portalSearchFilters(filters),p_cursor:cursor,p_limit:20,p_count_only:Boolean(options.countOnly),p_facets:Boolean(options.facets),p_basics_only:Boolean(options.basicsOnly)});
  const {data,error}=await(options.signal?request.abortSignal(options.signal):request);
  if(error||!data||!Number.isSafeInteger(data.total)||data.total<0||!Array.isArray(data.items)||data.items.length>20||typeof data.hasMore!=='boolean')throw Error('Accommodation search unavailable');
  const page=data as AccommodationPage;
  page.items=page.items.map(row=>({after:readAccommodationCursor(JSON.stringify(row.after))!,entry:row.entry.kind==='basic'?readBasicContact(row.entry):row.entry}));
  return page;
}

// Two bounded streams: the existing banner/catalog resolver remains canonical;
// only accommodation results use the new shared keyset/filter/count provider.
export async function searchMixedAccommodations(value:unknown,options:{type?:unknown;page?:unknown;filters?:TravelFilterValues;cursor?:SearchCursor;countOnly?:boolean;signal?:AbortSignal},loadContext:()=>Promise<SearchHit[]>){
  const query=searchQuery(value),filtered=accommodationSearchOnly(options.filters),type=filtered?'accommodation':searchType(options.type);
  const empty={query,type,page:1,total:0,accommodationTotal:0,hits:[] as SearchHit[],nextCursor:null as SearchCursor|null};
  if(!queryWords(query).length)return empty;
  try{
    const scope=JSON.stringify([query,portalSearchFilters(options.filters),type??'']);
    const state=options.cursor?.token?JSON.parse(options.cursor.token):{a:null,done:false,o:0,scope};
    if(options.cursor?.token&&options.cursor.token.length>4096||state.scope!==scope||!Number.isInteger(state.o)||state.o<0||state.o>512||typeof state.done!=='boolean')throw Error('Invalid cursor scope');
    const [accommodations,context]=await Promise.all([loadAccommodationPage(query,options.filters,state.a,{countOnly:options.countOnly||state.done||Boolean(type&&type!=='accommodation'),signal:options.signal}),filtered?Promise.resolve([]):loadContext()]);
    const other=mergeSearchHits(context).filter(h=>!type||h.type===type);
    const total=type==='accommodation'?accommodations.total:type?other.length:accommodations.total+other.length;
    if(options.countOnly)return {...empty,total,accommodationTotal:accommodations.total};
    const rows=type&&type!=='accommodation'||state.done?[]:accommodations.items;
    let a=0,o=state.o;
    const hits:SearchHit[]=[];
    while(hits.length<20&&(a<rows.length||o<other.length)){
      const row=rows[a],entry=row?.entry;
      const next=entry?(entry.kind==='basic'?{id:entry.id,type:'accommodation' as const,title:entry.name,excerpt:'',url:'',rank:-1,basic:entry}:{...entry,type:'accommodation' as const}):undefined;
      if(o<other.length&&(!next||other[o].rank>next.rank)){hits.push(other[o++]);}else if(next){hits.push(next);a++;}
    }
    const done=state.done||a===rows.length&&!accommodations.hasMore;
    const nextState={scope,a:a?rows[a-1].after:state.a,done,o};
    return {...empty,total,accommodationTotal:accommodations.total,hits,nextCursor:(!type||type==='accommodation')&&!done||o<other.length?{profiles:0,other:0,token:JSON.stringify(nextState)}:null};
  }catch{return {...empty,error:'Die Portalsuche ist gerade nicht verfügbar. Bitte versuchen Sie es später erneut.'};}
}
