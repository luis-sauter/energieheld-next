'use client';
import { Icon } from "@/components/portal/icon";

import {useCallback,useEffect,useRef,useState} from 'react';
import dynamic from 'next/dynamic';
import {validPortalMapData,type PortalMapData} from '@/lib/portal-map-entries';
import styles from './openstreetmap-map.module.css';
const OpenStreetMap=dynamic(()=>import('./openstreetmap-map'),{ssr:false,loading:()=> <div className={styles.loading}>Karte wird geladen …</div>});
type Location={lat:number;lon:number;city:string;source?:'db-ip'};
export function NearbyHomeMap() {
 const root=useRef<HTMLElement>(null);
 const [ready,setReady]=useState(false),[geoReady,setGeoReady]=useState(false),[location,setLocation]=useState<Location|null>(null);
 const [data,setData]=useState<PortalMapData|null>(null),[error,setError]=useState('');
 const [view,setView]=useState<{lat:number;lon:number;radius:number}|null>(null);
 const onViewChange=useCallback((next:{lat:number;lon:number;radius:number})=>setView(current=>current&&current.lat===next.lat&&current.lon===next.lon&&current.radius===next.radius?current:next),[]);
 useEffect(()=>{if(!root.current)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setReady(true);observer.disconnect();}},{rootMargin:'250px'});observer.observe(root.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  if(!ready)return;const controller=new AbortController();
  void fetch('/api/visitor-location',{cache:'no-store',signal:controller.signal}).then(async response=>{
   const d=await response.json(),l=d.location;
   if(l&&Number.isFinite(l.lat)&&Number.isFinite(l.lon)&&l.lat>=34&&l.lat<=72&&l.lon>=-25&&l.lon<=45)setLocation({lat:l.lat,lon:l.lon,city:typeof l.city==='string'?l.city:'',...(d.source==='db-ip'?{source:'db-ip' as const}:{})});
  }).catch(()=>{}).finally(()=>{if(!controller.signal.aborted)setGeoReady(true);});
  return()=>controller.abort();
 },[ready]);
 useEffect(()=>{
  if(!geoReady||!location)return;const controller=new AbortController();
  const center=view??{lat:location.lat,lon:location.lon,radius:20};
  const query=`lat=${center.lat}&lon=${center.lon}&radius=${center.radius}`;
  const timer=setTimeout(()=>void fetch('/api/nearby-map?'+query,{cache:'no-store',signal:controller.signal}).then(async response=>{
   if(!response.ok)throw Error();const result=await response.json();if(!validPortalMapData(result))throw Error();
   if(!controller.signal.aborted){setData(result);setError('');}
  }).catch(()=>{if(!controller.signal.aborted)setError('Die Gastgeber konnten gerade nicht geladen werden. Bitte versuchen Sie es später erneut.');}),350);
  return()=>{clearTimeout(timer);controller.abort();};
 },[geoReady,location,view]);
 return <section ref={root} className={styles.section} aria-labelledby="locations-title" data-company-map data-nearby-map>
  <div className="container"><header className={styles.header}><div><p className="eyebrow">Gastgeber entdecken</p><h2 id="locations-title">Gastgeber in Ihrer Nähe</h2>{location?.city&&<p>{location.city}</p>}</div><p className={styles.mapHelp}>Karte verschieben oder zoomen · bis 300 km</p></header>
   <div className={styles.frame} data-map-radius={view?.radius??20} data-map-center={view?`${view.lat},${view.lon}`:undefined}>{ready&&geoReady?location?<OpenStreetMap entries={data?.entries??[]} location={location} onViewChange={onViewChange}/>:<div className={styles.loading}>Ihr Standort ist derzeit nicht verfügbar.</div>:<div className={styles.loading}>Gastgeber und Karte werden geladen …</div>}</div>
   <div className={styles.footer}><p role="status">{error||(geoReady&&!location?'Bitte versuchen Sie es später erneut.':!data?'Gastgeber werden geladen …':data.entries.length===0?'In diesem Kartenausschnitt sind derzeit keine Gastgeberstandorte verfügbar.':'Gastgeberstandorte im aktuellen Kartenausschnitt')}</p></div>
   {data&&data.entries.length>0&&<p className={styles.hint}>Standortauswahl aus unserem Portal. Vergrößern Sie die Karte, um weitere nah beieinanderliegende Pins zu sehen.</p>}
   {location?.source==='db-ip'&&<p className={styles.hint}>Standortbestimmung: <a href="https://db-ip.com" target="_blank" rel="noopener noreferrer">DB-IP</a></p>}
   <a className={styles.directory} href="/unterkuenfte-a-z">Alle Gastgeber entdecken <span aria-hidden="true"><Icon name="chevron-right" size={20} /></span></a>
  </div>
 </section>;
}
