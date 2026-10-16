'use client';
import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {createResultStream} from '@/lib/result-stream';
import {travelFilterUrl} from '@/lib/reiseportal-facets';
import type {TravelFilterValues} from '@/lib/reiseportal-filter-options';
type Facets={id:string;total:number;facets:Record<string,number>};
export type AccommodationFacetState={value?:Facets;loading:boolean;error:string};
const cache=new Map<string,{value:Facets;until:number}>();
export function clearAccommodationFacets(){cache.clear();}
async function requestFacets(key:string,url:RequestInfo|URL,init?:RequestInit){
  const cached=cache.get(key);
  if(cached&&cached.until>Date.now())return Response.json({items:[cached.value],total:1,nextCursor:null});
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,300);init?.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('Aborted'));},{once:true});});
  const response=await fetch(url,init);
  if(response.ok){const payload=await response.clone().json();if(payload.items?.[0]&&Number.isSafeInteger(payload.items[0].total)&&!init?.signal?.aborted){cache.set(key,{value:payload.items[0],until:Date.now()+30000});if(cache.size>32)cache.delete(cache.keys().next().value!);}}
  return response;
}
export function useAccommodationFacets(values:TravelFilterValues,enabled:boolean){
  const key=travelFilterUrl({...values,query:'',location:'',sort:''});
  const stream=useMemo(()=>{
    return createResultStream<Facets,number>({initial:!enabled?{items:[],total:0,nextCursor:null}:undefined,firstCursor:0,itemKey:r=>r.id,url:()=>'/api/accommodation-facets?'+(key.split('?')[1]??''),request:(url,init)=>requestFacets(key,url,init)});
  },[key,enabled]);
  const state=useSyncExternalStore(stream.subscribe,stream.snapshot,stream.serverSnapshot);
  useEffect(()=>{stream.start();return()=>stream.dispose();},[stream]);
  return {value:enabled?state.items[0]:undefined,loading:enabled&&state.loading,error:enabled?state.error:''};
}
