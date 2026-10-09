"use client";
import {useState} from 'react';
import {externalVideoEmbed} from '@/lib/external-video';
export function PortalVideo({src,name,external=false,poster}:{src:string;name:string;external?:boolean;poster?:string}) {
 const [play,setPlay]=useState(false); const embed=external?externalVideoEmbed(src):undefined;
 if(external&&!embed)return <p>Videovorschau nicht verfügbar.</p>;
 return <div style={{width:'100%',minWidth:0}}>{!play?<button type="button" className="button" style={{width:'100%',aspectRatio:'16 / 9',background:'#edf5f8',color:'#174761',borderRadius:'0.75rem'}} onClick={()=>setPlay(true)}>▶ {name} – Video laden</button>:external?<iframe src={embed} title={name} loading="lazy" allow="fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={{width:'100%',aspectRatio:'16 / 9',border:0}}/>:<video src={src} poster={poster} controls playsInline preload="metadata" aria-label={name} style={{width:'100%',height:'auto',maxWidth:'100%'}}/>}</div>;
}
