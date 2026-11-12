'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import type {NewBadge} from '@/lib/new-badge';
const Context=createContext<{rows:NewBadge[]|null;now:number}>({rows:null,now:0});
export function NewBadgeProvider({rows,now,children}:{rows:NewBadge[]|null;now:number;children:ReactNode}) {
  const [clock,setClock]=useState(now);
  useEffect(()=>{
    const current=Date.now();
    const future=(rows??[]).flatMap(row=>[Date.parse(row.starts_at),Date.parse(row.expires_at)]).filter(time=>time>current);
    // Wake only at a badge boundary; never rerender all cards every second.
    const next=Math.min(...future,current+24*60*60*1000);
    const timer=setTimeout(()=>setClock(Date.now()),Math.max(100,next-current+20));
    const update=()=>setClock(Date.now());
    window.addEventListener('focus',update);
    return ()=>{clearTimeout(timer);window.removeEventListener('focus',update);};
  },[rows,clock]);
  return <Context.Provider value={{rows,now:clock}}>{children}</Context.Provider>;
}
export function useNewBadges(){return useContext(Context);}
