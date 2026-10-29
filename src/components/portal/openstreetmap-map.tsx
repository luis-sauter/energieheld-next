'use client';
import {useEffect,useRef,useState} from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type {PortalMapEntry} from '@/lib/portal-map-entries';
import styles from './openstreetmap-map.module.css';
const tileUrl=process.env.NEXT_PUBLIC_OSM_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
type Props={entries:PortalMapEntry[];location:{lat:number;lon:number}|null;radius:number};
export default function OpenStreetMap({entries,location,radius}:Props){
 const element=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),points=useRef<L.LayerGroup|null>(null),radiusLayer=useRef<L.LayerGroup|null>(null);
 const [tileError,setTileError]=useState(false);
 useEffect(()=>{
  if(!element.current)return;
  const instance=L.map(element.current,{scrollWheelZoom:false,minZoom:4,maxZoom:18,zoomControl:false,attributionControl:true});map.current=instance;
  instance.attributionControl.setPrefix(false);
  L.control.zoom({position:'topright',zoomInTitle:'Vergrößern',zoomOutTitle:'Verkleinern'}).addTo(instance);
  L.control.scale({imperial:false,position:'topleft'}).addTo(instance);
  L.tileLayer(tileUrl,{maxZoom:19,keepBuffer:0,updateWhenIdle:true,referrerPolicy:'strict-origin-when-cross-origin',attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap-Mitwirkende</a> · Standorte: Betreiberangaben / © swisstopo'}).on('tileerror',()=>setTileError(true)).addTo(instance);
  points.current=L.layerGroup().addTo(instance);radiusLayer.current=L.layerGroup().addTo(instance);
  const observer=new ResizeObserver(()=>instance.invalidateSize({pan:false}));observer.observe(element.current);
  return()=>{observer.disconnect();instance.remove();map.current=null;points.current=null;radiusLayer.current=null;};
 },[]);
 useEffect(()=>{
  const instance=map.current,layer=radiusLayer.current;if(!instance||!layer)return;
  layer.clearLayers();
  if(location){
   instance.fitBounds(L.latLng(location.lat,location.lon).toBounds(radius*2000),{padding:[24,24],animate:false});
   L.circle([location.lat,location.lon],{radius:radius*1000,color:'#13237F',weight:1.5,dashArray:'6 6',fillColor:'#13237F',fillOpacity:.025,interactive:false}).addTo(layer);
   L.circleMarker([location.lat,location.lon],{radius:7,color:'#fff',weight:3,fillColor:'#13237F',fillOpacity:1}).bindTooltip('Ihr ungefährer Ausgangspunkt').addTo(layer);
  }else instance.fitBounds([[45.5,5.6],[55.1,17.4]],{padding:[12,12],animate:false});
 },[location,radius]);
 useEffect(()=>{
  const instance=map.current,layer=points.current;if(!instance||!layer)return;
  const draw=()=>{
   layer.clearLayers();const zoom=instance.getZoom(),occupied:L.Point[]=[];
   const icon=L.divIcon({className:styles.pin,html:'<svg viewBox="0 0 28 36" aria-hidden="true"><path d="M14 35S1 22 1 14a13 13 0 0 1 26 0c0 8-13 21-13 21Z" fill="#F7902F" stroke="white" stroke-width="2"/><path d="m7 14 7-6 7 6M9 13v9h10v-9M13 22v-6h3v6" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',iconSize:[24,31],iconAnchor:[12,31]});
   // Keep original coordinates; reveal crowded locations on zoom instead of
   // inventing positions or replacing accommodation pins with number clusters.
   for(const entry of entries){
    const point=instance.project([entry.lat,entry.lon],zoom);
    if(occupied.some(other=>Math.abs(other.x-point.x)<30&&Math.abs(other.y-point.y)<35))continue;
    occupied.push(point);
    L.marker([entry.lat,entry.lon],{icon,interactive:false,keyboard:false}).addTo(layer);
   }
  };
  draw();instance.on('zoomend',draw);return()=>{instance.off('zoomend',draw);layer.clearLayers();};
 },[entries]);
 return <><div ref={element} className={styles.map} aria-label="OpenStreetMap mit Unterkünften aus dem Reiseportal" data-osm-map/>{tileError&&<p className={styles.tileError}>Einzelne Kartenteile konnten nicht geladen werden. Bitte versuchen Sie es später erneut.</p>}</>;
}
