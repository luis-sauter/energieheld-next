export type LiveCountState = {key:string;status:'idle'|'loading'|'ready'|'error';total?:number};
export const LIVE_COUNT_DELAY = 300;
export const LIVE_COUNT_TTL = 30_000;
export function createCountCache(now = Date.now) {
  const entries = new Map<string,{total:number;until:number}>();
  return {
    get(key:string) { const row=entries.get(key); if(row && row.until>now()) return row.total; entries.delete(key); },
    set(key:string,total:number) { entries.delete(key); entries.set(key,{total,until:now()+LIVE_COUNT_TTL}); if(entries.size>32) entries.delete(entries.keys().next().value!); },
  };
}
export function createLiveCount({request=fetch,cache=createCountCache(),delay=LIVE_COUNT_DELAY}:{request?:typeof fetch;cache?:ReturnType<typeof createCountCache>;delay?:number}={}) {
  let state:LiveCountState={key:'',status:'idle'}, active=true, busy=false, queued=false, generation=0;
  let timer:ReturnType<typeof setTimeout>|undefined, controller:AbortController|undefined;
  const listeners=new Set<()=>void>();
  const emit=(next:LiveCountState)=>{state=next;listeners.forEach(listener=>listener());};
  async function pump() {
    if(!active || busy || !queued || !state.key) return;
    queued=false;busy=true;
    const key=state.key, version=generation, own=new AbortController();controller=own;
    try {
      const response=await request('/api/portal-count?'+key,{signal:own.signal,cache:'no-store'});
      if(!response.ok)throw Error('Unavailable');
      const data=await response.json();
      if(!Number.isSafeInteger(data.total)||data.total<0)throw Error('Invalid count');
      if(!active||own.signal.aborted)return;
      cache.set(key,data.total);
      if(version===generation)emit({key,status:'ready',total:data.total});
    } catch {
      if(active && !own.signal.aborted && version===generation)emit({key,status:'error'});
    } finally { if(controller===own){busy=false;void pump();} }
  }
  return {
    snapshot:()=>state,
    subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
    start:()=>{active=true;},
    update:(key:string,seed?:number)=>{
      generation++;clearTimeout(timer);queued=false;
      if(!key){emit({key,status:'idle'});return;}
      if(seed!==undefined)cache.set(key,seed);
      const total=cache.get(key);
      if(total!==undefined){emit({key,status:'ready',total});return;}
      emit({key,status:'loading'});
      timer=setTimeout(()=>{queued=true;void pump();},delay);
    },
    dispose:()=>{active=false;generation++;clearTimeout(timer);queued=false;controller?.abort();busy=false;},
  };
}
