'use client';
import {useEffect,useRef,useState} from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type {PortalMapEntry} from '@/lib/portal-map-entries';
import styles from './openstreetmap-map.module.css';
import {mapViewportQuery,nearbyMapMaxRadius,type MapViewportQuery} from '@/lib/nearby-map';
const tileUrl=process.env.NEXT_PUBLIC_OSM_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
type Props={entries:PortalMapEntry[];location:{lat:number;lon:number}|null;onViewChange?:(view:MapViewportQuery)=>void};
export default function OpenStreetMap({entries,location,onViewChange}:Props){
 const element=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),points=useRef<L.LayerGroup|null>(null),origin=useRef<L.LayerGroup|null>(null);
 const viewCallback=useRef(onViewChange);
 useEffect(()=>{viewCallback.current=onViewChange;},[onViewChange]);
 const [tileError,setTileError]=useState(false);
 useEffect(()=>{
  if(!element.current)return;
  const instance=L.map(element.current,{scrollWheelZoom:true,minZoom:4,maxZoom:18,zoomSnap:.25,zoomDelta:.5,maxBounds:[[34,-25],[72,45]],maxBoundsViscosity:1,zoomControl:false,attributionControl:true});map.current=instance;
  instance.attributionControl.setPrefix(false);
  L.control.zoom({position:'topright',zoomInTitle:'Vergrößern',zoomOutTitle:'Verkleinern'}).addTo(instance);
  L.tileLayer(tileUrl,{maxZoom:19,keepBuffer:0,updateWhenIdle:true,referrerPolicy:'strict-origin-when-cross-origin',attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap-Mitwirkende</a> · Standorte: Betreiberangaben / © swisstopo'}).on('tileerror',()=>setTileError(true)).addTo(instance);
  points.current=L.layerGroup().addTo(instance);origin.current=L.layerGroup().addTo(instance);
  const observer=new ResizeObserver(()=>instance.invalidateSize({pan:false}));observer.observe(element.current);
  return()=>{observer.disconnect();instance.remove();map.current=null;points.current=null;origin.current=null;};
 },[]);
 useEffect(()=>{
  const instance=map.current,layer=origin.current;if(!instance||!layer||!location)return;
  layer.clearLayers();
  const corners=()=>{const bounds=instance.getBounds();return [bounds.getNorthEast(),bounds.getNorthWest(),bounds.getSouthEast(),bounds.getSouthWest()].map(p=>({lat:p.lat,lon:p.lng}));};
  const visibleRadius=()=>Math.max(...corners().map(p=>instance.getCenter().distanceTo([p.lat,p.lon])/1000));
  const publish=()=>{constrainZoom();const c=instance.getCenter();viewCallback.current?.(mapViewportQuery({lat:c.lat,lon:c.lng},corners()));};
  const constrainZoom=()=>{
   const min=instance.getZoom()+Math.log2(visibleRadius()/nearbyMapMaxRadius);
   instance.setMinZoom(Math.max(4,Math.ceil((min-1e-8)*4)/4));
  };
  instance.fitBounds(L.latLng(location.lat,location.lon).toBounds(40000),{padding:[0,0],animate:false});
  const initial=instance.getZoom()+Math.log2(visibleRadius()/20);
  constrainZoom();
  instance.setZoom(Math.min(18,Math.ceil(initial*4)/4),{animate:false});
  L.circleMarker([location.lat,location.lon],{radius:7,color:'#fff',weight:3,fillColor:'#13237F',fillOpacity:1}).bindTooltip('Ihr ungefährer Ausgangspunkt').addTo(layer);
  publish();instance.on('moveend',publish);
  const resize=()=>{constrainZoom();publish();};instance.on('resize',resize);
  return()=>{instance.off('moveend',publish);instance.off('resize',resize);};
 },[location]);
 useEffect(()=>{
  const instance=map.current,layer=points.current;if(!instance||!layer)return;
  const draw=()=>{
   layer.clearLayers();const zoom=instance.getZoom(),occupied:L.Point[]=[];
   const icon=L.divIcon({className:styles.pin,html:'<svg viewBox="0 0 28 36" aria-hidden="true"><path d="M14 35S1 22 1 14a13 13 0 0 1 26 0c0 8-13 21-13 21Z" fill="#F7902F" stroke="white" stroke-width="2"/><path d="m7 14 7-6 7 6M9 13v9h10v-9M13 22v-6h3v6" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',iconSize:[24,31],iconAnchor:[12,31]});
   // Keep original coordinates; reveal crowded locations on zoom instead of
   // inventing positions or replacing accommodation pins with number clusters.
   for(const entry of entries){
    if(!instance.getBounds().contains([entry.lat,entry.lon]))continue;
    const point=instance.project([entry.lat,entry.lon],zoom);
    if(occupied.some(other=>Math.abs(other.x-point.x)<30&&Math.abs(other.y-point.y)<35))continue;
    occupied.push(point);
    L.marker([entry.lat,entry.lon],{icon,interactive:false,keyboard:false}).addTo(layer);
   }
  };
  draw();instance.on('moveend',draw);return()=>{instance.off('moveend',draw);layer.clearLayers();};
 },[entries]);
 return <><div ref={element} className={styles.map} aria-label="OpenStreetMap mit Unterkünften aus dem Reiseportal" data-osm-map/>{tileError&&<p className={styles.tileError}>Einzelne Kartenteile konnten nicht geladen werden. Bitte versuchen Sie es später erneut.</p>}</>;
}
