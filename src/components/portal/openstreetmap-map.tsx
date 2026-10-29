'use client';
import {useEffect,useRef,useState} from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type {PortalMapEntry} from '@/lib/portal-map-entries';
import styles from './openstreetmap-map.module.css';
const tileUrl=process.env.NEXT_PUBLIC_OSM_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
type Props={entries:PortalMapEntry[];location:{lat:number;lon:number}|null;radius:number;overview:boolean};
export default function OpenStreetMap({entries,location,radius,overview}:Props){
 const element=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),points=useRef<L.LayerGroup|null>(null),radiusLayer=useRef<L.LayerGroup|null>(null);
 const [tileError,setTileError]=useState(false);
 useEffect(()=>{
  if(!element.current)return;
  const instance=L.map(element.current,{scrollWheelZoom:false,minZoom:4,maxZoom:18,zoomControl:false,attributionControl:true});map.current=instance;
  instance.attributionControl.setPrefix(false);
  L.control.zoom({position:'topright',zoomInTitle:'Vergrößern',zoomOutTitle:'Verkleinern'}).addTo(instance);
  L.control.scale({imperial:false,position:'bottomleft'}).addTo(instance);
  L.tileLayer(tileUrl,{maxZoom:19,keepBuffer:0,updateWhenIdle:true,referrerPolicy:'strict-origin-when-cross-origin',attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap-Mitwirkende</a>'}).on('tileerror',()=>setTileError(true)).addTo(instance);
  points.current=L.layerGroup().addTo(instance);radiusLayer.current=L.layerGroup().addTo(instance);
  const observer=new ResizeObserver(()=>instance.invalidateSize({pan:false}));observer.observe(element.current);
  return()=>{observer.disconnect();instance.remove();map.current=null;points.current=null;radiusLayer.current=null;};
 },[]);
 useEffect(()=>{
  const instance=map.current,layer=radiusLayer.current;if(!instance||!layer)return;
  layer.clearLayers();
  if(location&&!overview){
   instance.fitBounds(L.latLng(location.lat,location.lon).toBounds(radius*2000),{padding:[24,24],animate:false});
   L.circle([location.lat,location.lon],{radius:radius*1000,color:'#13237F',weight:1.5,dashArray:'6 6',fillColor:'#13237F',fillOpacity:.025,interactive:false}).addTo(layer);
   L.circleMarker([location.lat,location.lon],{radius:7,color:'#fff',weight:3,fillColor:'#13237F',fillOpacity:1}).bindTooltip('Ihr ungefährer Ausgangspunkt').addTo(layer);
  }else instance.fitBounds([[45.5,5.6],[55.1,17.4]],{padding:[12,12],animate:false});
 },[location,radius,overview]);
 useEffect(()=>{
  const instance=map.current,layer=points.current;if(!instance||!layer)return;
  const draw=()=>{
   layer.clearLayers();const zoom=instance.getZoom(),groups=new Map<string,PortalMapEntry[]>();
   for(const entry of entries){const p=instance.project([entry.lat,entry.lon],zoom),key=zoom<13?`${Math.floor(p.x/52)}:${Math.floor(p.y/52)}`:`${entry.lat}:${entry.lon}`;const group=groups.get(key)??[];group.push(entry);groups.set(key,group);}
   for(const group of groups.values()){
    const lat=group.reduce((s,e)=>s+e.lat,0)/group.length,lon=group.reduce((s,e)=>s+e.lon,0)/group.length;
    if(group.length>1&&zoom<13){
     const icon=L.divIcon({className:styles.cluster,html:String(group.length),iconSize:[38,38],iconAnchor:[19,19]});
     L.marker([lat,lon],{icon,title:`${group.length} Unterkünfte · Kartenausschnitt vergrößern`,keyboard:true}).on('click',()=>{instance.fitBounds(L.latLngBounds(group.map(e=>[e.lat,e.lon] as L.LatLngTuple)),{maxZoom:14,padding:[48,48]});}).addTo(layer);
    }else for(const entry of group)L.circleMarker([entry.lat,entry.lon],{radius:6,color:'#fff',weight:2,fillColor:'#F7902F',fillOpacity:1,interactive:false}).addTo(layer);
   }
  };
  draw();instance.on('zoomend',draw);return()=>{instance.off('zoomend',draw);layer.clearLayers();};
 },[entries]);
 return <><div ref={element} className={styles.map} aria-label="OpenStreetMap mit Unterkünften aus dem Reiseportal" data-osm-map/>{tileError&&<p className={styles.tileError}>Einzelne Kartenteile konnten nicht geladen werden. Bitte versuchen Sie es später erneut.</p>}</>;
}
