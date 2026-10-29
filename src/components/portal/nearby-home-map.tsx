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
 const [radius,setRadius]=useState(50),[overview,setOverview]=useState(false),[data,setData]=useState<PortalMapData|null>(null),[error,setError]=useState('');
 useEffect(()=>{if(!root.current)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setReady(true);observer.disconnect();}},{rootMargin:'250px'});observer.observe(root.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  if(!ready)return;const controller=new AbortController();
  void fetch('/api/visitor-location',{cache:'no-store',signal:controller.signal}).then(async response=>{
   const d=await response.json(),l=d.location;
   if(l&&Number.isFinite(l.lat)&&Number.isFinite(l.lon)&&l.lat>=34&&l.lat<=72&&l.lon>=-25&&l.lon<=45)setLocation({lat:l.lat,lon:l.lon,city:typeof l.city==='string'?l.city:''});else setOverview(true);
  }).catch(()=>{if(!controller.signal.aborted)setOverview(true);}).finally(()=>{if(!controller.signal.aborted)setGeoReady(true);});
  return()=>controller.abort();
 },[ready]);
 useEffect(()=>{
  if(!geoReady)return;const controller=new AbortController();
  const query=overview||!location?'view=overview':`lat=${location.lat}&lon=${location.lon}&radius=${radius}`;
  void fetch('/api/nearby-map?'+query,{cache:'no-store',signal:controller.signal}).then(async response=>{
   if(!response.ok)throw Error();const result=await response.json();if(!validPortalMapData(result))throw Error();
   if(!controller.signal.aborted){setData(result);setError('');}
  }).catch(()=>{if(!controller.signal.aborted)setError('Die Unterkünfte konnten gerade nicht geladen werden. Bitte versuchen Sie es später erneut.');});
  return()=>controller.abort();
 },[geoReady,location,overview,radius]);
 function select(km:number){if(overview||radius!==km){setData(null);setError('');setRadius(km);setOverview(false);}}
 const title=location&&!overview?'Unterkünfte in Ihrer Nähe':'Unterkünfte auf der Karte';
 return <section ref={root} className={styles.section} aria-labelledby="locations-title" data-company-map data-nearby-map>
  <div className="container"><header className={styles.header}><div><p className="eyebrow">Gastgeber entdecken</p><h2 id="locations-title">{title}</h2><p>{location&&!overview?`${location.city?location.city+' · ':''}Ihr ungefährer Standort anhand der IP-Adresse.`:'Entdecken Sie Gastgeber in Deutschland, Österreich, der Schweiz und Südtirol.'}</p></div>
   <div className={styles.radii} role="group" aria-label="Kartenausschnitt auswählen">
    {location&&[20,50].map(km=><button key={km} aria-pressed={!overview&&radius===km} onClick={()=>select(km)}>{km} km</button>)}
    <button aria-pressed={overview} onClick={()=>{if(!overview){setData(null);setError('');setOverview(true);}}}>Gesamtübersicht</button>
   </div></header>
   <div className={styles.frame}>{ready&&geoReady?<OpenStreetMap entries={data?.entries??[]} location={overview?null:location} radius={radius} overview={overview}/>:<div className={styles.loading}>Unterkünfte und Karte werden geladen …</div>}</div>
   <div className={styles.footer}><p role="status">{error||(!data?'Unterkünfte werden geladen …':`${data.entries.length} Unterkünfte aus unserem Portal${data.limited?' · Auswahl der Standorte':''}`)}</p>
   </div>
   <p className={styles.hint}>Orange Punkte zeigen Unterkunftsstandorte. Zahlen fassen mehrere Unterkünfte zusammen. Der Umkreis zeigt die Luftlinie.</p>
   <a className={styles.directory} href="/unterkuenfte-a-z">Alle Unterkünfte entdecken <span aria-hidden="true">→</span></a>
  </div>
 </section>;
}
