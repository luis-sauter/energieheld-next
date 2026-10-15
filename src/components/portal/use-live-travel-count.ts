'use client';
import {useEffect,useMemo,useSyncExternalStore} from 'react';
import type {TravelFilterValues} from '@/lib/reiseportal-filter-options';
import {travelFilterUrl} from '@/lib/reiseportal-facets';
import {queryWords} from '@/lib/portal-search-values';
import {createCountCache,createLiveCount,type LiveCountState} from '@/lib/live-travel-count';
const cache=createCountCache();
const serverState:LiveCountState={key:'',status:'idle'};
export function useLiveTravelCount(values:TravelFilterValues,completed?:{values:TravelFilterValues;total?:number;error?:string}) {
  const keyFor=(v:TravelFilterValues)=>travelFilterUrl({...v,query:v.query.trim()}).split('?')[1]??'';
  const key=values.query.trim()?keyFor(values):'';
  const seed=completed&&!completed.error&&key===keyFor(completed.values)?completed.total:undefined;
  const failed=Boolean(completed?.error&&key===keyFor(completed.values));
  const empty=Boolean(key&&!queryWords(values.query).length);
  const stream=useMemo(()=>createLiveCount({cache}),[]);
  const state=useSyncExternalStore(stream.subscribe,stream.snapshot,()=>serverState);
  useEffect(()=>{stream.start();return()=>stream.dispose();},[stream]);
  useEffect(()=>{stream.start();stream.update(failed?'':key,empty?0:seed);},[stream,key,seed,empty,failed]);
  const current:LiveCountState=!key?serverState:failed?{key,status:'error'}
    :seed!==undefined?{key,status:'ready',total:seed}
    :state.key===key?state:{key,status:'loading'};
  return {...current,cancel:stream.dispose};
}
