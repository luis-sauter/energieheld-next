'use client';
import {useEffect,useRef,useState} from 'react';
import dynamic from 'next/dynamic';
import {validPortalMapData,type PortalMapData} from '@/lib/portal-map-entries';
import styles from './openstreetmap-map.module.css';
const OpenStreetMap=dynamic(()=>import('./openstreetmap-map'),{ssr:false,loading:()=> <div className={styles.loading}>Karte wird geladen …</div>});
type Location={lat:number;lon:number;city:string};
export function NearbyHomeMap() {
 const root=useRef<HTMLElement>(null);
 const [ready,setReady]=useState(false),[geoReady,setGeoReady]=useState(false),[location,setLocation]=useState<Location|null>(null);
 const [data,setData]=useState<PortalMapData|null>(null),[error,setError]=useState('');
 useEffect(()=>{if(!root.current)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setReady(true);observer.disconnect();}},{rootMargin:'250px'});observer.observe(root.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  if(!ready)return;const controller=new AbortController();
  void fetch('/api/visitor-location',{cache:'no-store',signal:controller.signal}).then(async response=>{
   const d=await response.json(),l=d.location;
   if(l&&Number.isFinite(l.lat)&&Number.isFinite(l.lon)&&l.lat>=34&&l.lat<=72&&l.lon>=-25&&l.lon<=45)setLocation({lat:l.lat,lon:l.lon,city:typeof l.city==='string'?l.city:''});
  }).catch(()=>{}).finally(()=>{if(!controller.signal.aborted)setGeoReady(true);});
  return()=>controller.abort();
 },[ready]);
 useEffect(()=>{
  if(!geoReady||!location)return;const controller=new AbortController();
  const query=`lat=${location.lat}&lon=${location.lon}&radius=50`;
  void fetch('/api/nearby-map?'+query,{cache:'no-store',signal:controller.signal}).then(async response=>{
   if(!response.ok)throw Error();const result=await response.json();if(!validPortalMapData(result))throw Error();
   if(!controller.signal.aborted){setData(result);setError('');}
  }).catch(()=>{if(!controller.signal.aborted)setError('Die Unterkünfte konnten gerade nicht geladen werden. Bitte versuchen Sie es später erneut.');});
  return()=>controller.abort();
 },[geoReady,location]);
 return <section ref={root} className={styles.section} aria-labelledby="locations-title" data-company-map data-nearby-map>
  <div className="container"><header className={styles.header}><div><p className="eyebrow">Gastgeber entdecken</p><h2 id="locations-title">Unterkünfte in Ihrer Nähe</h2>{location?.city&&<p>{location.city}</p>}</div><span className={styles.radiusLabel}>50 km Umkreis</span></header>
   <div className={styles.frame}>{ready&&geoReady?location?<OpenStreetMap entries={data?.entries??[]} location={location} radius={50}/>:<div className={styles.loading}>Ihr Standort ist derzeit nicht verfügbar.</div>:<div className={styles.loading}>Unterkünfte und Karte werden geladen …</div>}</div>
   <div className={styles.footer}><p role="status">{error||(geoReady&&!location?'Bitte versuchen Sie es später erneut.':!data?'Unterkünfte werden geladen …':data.entries.length===0?'In diesem Umkreis sind derzeit keine Unterkunftsstandorte verfügbar.':'Unterkunftsstandorte im Umkreis von 50 km · Luftlinie')}</p></div>
   {data&&data.entries.length>0&&<p className={styles.hint}>Standortauswahl aus unserem Portal. Vergrößern Sie die Karte, um weitere nah beieinanderliegende Pins zu sehen.</p>}
   <a className={styles.directory} href="/unterkuenfte-a-z">Alle Unterkünfte entdecken <span aria-hidden="true">→</span></a>
  </div>
 </section>;
}
