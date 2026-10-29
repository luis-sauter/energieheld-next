'use client';
import {useEffect,useRef,useState} from 'react';
import {StaticHomeMap} from './static-home-map';
import {projectLocation,MAP_WIDTH,MAP_HEIGHT} from '@/lib/europe-map';
import styles from './europe-map.module.css';
type Location={lat:number;lon:number;city:string};
type Points={points:number[][];labels?:{lat:number;lon:number;name:string}[];limited:boolean};
export function NearbyHomeMap() {
 const root=useRef<HTMLDivElement>(null);
 const [location,setLocation]=useState<Location|null>(null),[radius,setRadius]=useState(50),[data,setData]=useState<Points|null>(null);
 const [error,setError]=useState(''),[overview,setOverview]=useState(false);
 const [aspect,setAspect]=useState(MAP_WIDTH/MAP_HEIGHT);
 useEffect(()=>{if(!root.current||typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(([entry])=>setAspect(entry.contentRect.width<=600?1.3:MAP_WIDTH/MAP_HEIGHT));observer.observe(root.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  const controller=new AbortController();let started=false;
  async function load(){if(started)return;started=true;try{const r=await fetch('/api/visitor-location',{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error();const d=await r.json();if(d.location&&Number.isFinite(d.location.lat)&&Number.isFinite(d.location.lon))setLocation(d.location);}catch{/* Keep the overview when IP location is unavailable. */}}
  if(typeof IntersectionObserver==='undefined'){void load();return()=>controller.abort();}
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();void load();}},{rootMargin:'300px'});
  if(root.current)observer.observe(root.current);
  return()=>{controller.abort();observer.disconnect();};
 },[]);
 useEffect(()=>{
  if(!location||overview)return;
  const controller=new AbortController();
  void fetch(`/api/nearby-map?lat=${location.lat}&lon=${location.lon}&radius=${radius}`,{cache:'no-store',signal:controller.signal})
   .then(async r=>{if(!r.ok)throw Error();const d=await r.json();if(!Array.isArray(d.points)||d.points.length>500||d.points.some((p:unknown)=>!Array.isArray(p)||p.length!==2||p.some(n=>typeof n!=='number'||!Number.isFinite(n))))throw Error();if(!controller.signal.aborted){setData(d);setError('');}})
   .catch(()=>{if(!controller.signal.aborted)setError('Die Standorte im Umkreis konnten nicht geladen werden.');});
  return()=>controller.abort();
 },[location,radius,overview]);
 if(!location||overview)return <div ref={root}><StaticHomeMap/>{location&&<div className="container"><button className="button" onClick={()=>setOverview(false)}>Unterkünfte in meiner Umgebung</button></div>}</div>;
 const [x,y]=projectLocation(location.lat,location.lon),[nx,ny]=projectLocation(location.lat+radius/111.32,location.lon);
 const r=Math.hypot(nx-x,ny-y),height=r*2.5,width=height*aspect,compact=aspect<2;
 return <div ref={root}><section className={styles.section} aria-labelledby="locations-title" data-company-map data-nearby-map>
  <div className="container"><header className={styles.header}><h2 id="locations-title">Unterkünfte in Ihrer Nähe</h2><p>{location.city?`${location.city} · `:''}Ungefährer Standort anhand Ihrer IP-Adresse. Die Ortung kann abweichen.</p>
   <div role="group" aria-label="Umkreis auswählen">{[20,50].map(km=><button key={km} className={radius===km?'button button-primary':'button'} aria-pressed={radius===km} onClick={()=>{if(radius!==km){setData(null);setError('');setRadius(km);}}}>{km} km</button>)} <button className="button" onClick={()=>setOverview(true)}>Gesamtübersicht</button></div>
  </header><div className={styles.frame}><svg className={styles.map} viewBox={`${x-width/2} ${y-height/2} ${width} ${height}`} role="img" aria-label={`Unterkunftsstandorte im Umkreis von ${radius} Kilometern`}>
   <image href="/reiseportal/maps/europe.svg" x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT}/>
   <circle cx={x} cy={y} r={r} fill="#13237f08" stroke="#13237f" strokeWidth={width/900} strokeDasharray={`${width/160} ${width/200}`}/>
   {data?.points.map(([lat,lon],i)=>{const [px,py]=projectLocation(lat,lon);return <circle key={i} cx={px} cy={py} r={width/(compact?100:250)} fill="#f7902f" stroke="#fff" strokeWidth={width/(compact?450:1200)}/>;})}
   <circle cx={x} cy={y} r={width/(compact?70:180)} fill="#13237f" stroke="#fff" strokeWidth={width/(compact?300:700)}/>
   {data?.labels?.slice(0,compact?4:8).map(label=>{const [px,py]=projectLocation(label.lat,label.lon);return <text key={label.name} x={px+width/(compact?50:150)} y={py-width/(compact?100:250)} fontSize={width/(compact?35:90)} fill="#174761" stroke="#faf8f4" strokeWidth={width/(compact?140:400)} paintOrder="stroke" fontWeight="650">{label.name}</text>;})}
  </svg></div><div className={styles.footnote}><p role="status">{error||(!data?'Unterkünfte im Umkreis werden geladen …':data.points.length?`${data.points.length} dargestellte Standorte${data.limited?' · Auswahl der nächstgelegenen Unterkünfte':''}`:'In diesem Umkreis sind derzeit keine belegten Kartenstandorte verfügbar.')}</p><p>Blau: ungefährer Ausgangspunkt · Orange: Unterkünfte · Luftlinie</p><p className={styles.credit}>Karte: <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Natural Earth</a> · Standorte: Betreiberangaben, © swisstopo / © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap-Mitwirkende</a></p></div>
  <p><a className={styles.link} href="/unterkuenfte-a-z">Alle Unterkünfte entdecken →</a></p></div>
 </section></div>;
}
