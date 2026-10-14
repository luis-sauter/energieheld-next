'use client';
import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {createResultStream,type ResultBatch} from '@/lib/result-stream';
export type {ResultBatch} from '@/lib/result-stream';
export function useResultStream<T,C>({initial,firstCursor,url,itemKey,identity='',initialIdentity=identity}:{identity?:string;initialIdentity?:string;initial?:ResultBatch<T,C>;firstCursor:C;url:(cursor:C)=>string;itemKey:(item:T)=>string}){
 // Capture callbacks and the initial snapshot per query; recreated render
 // functions must not reset pages already appended for the same query.
 const stream=useMemo(()=>createResultStream({initial:identity===initialIdentity?initial:undefined,firstCursor,url,itemKey}),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [identity,initialIdentity]);
 const state=useSyncExternalStore(stream.subscribe,stream.snapshot,stream.serverSnapshot);
 useEffect(()=>{stream.start();return ()=>stream.dispose();},[stream]);
 return {...state,load:stream.load};
}
