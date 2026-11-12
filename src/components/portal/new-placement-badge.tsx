'use client';
import {newBadgeVisible,type BadgeKind} from '@/lib/new-badge';
import {useNewBadges} from './new-badge-context';
export function NewPlacementBadge({id,kind='profile',variant='ribbon'}:{id:string;kind?:BadgeKind;variant?:'ribbon'|'label'}) {
 const {rows,now}=useNewBadges();
 const visible=rows!==null&&newBadgeVisible(id,kind,rows,now);
 if(!visible)return null;
 if(variant==='label')return <span className="new-placement-badge"> Neu</span>;
 return <svg className="new-placement-ribbon" data-new-ribbon data-new-kind={kind}
   viewBox="0 0 100 100" preserveAspectRatio="xMaxYMin meet" role="img" aria-label="Neu" focusable="false">
   <path d="M0 0H100V100Z" fill="#00B050"/>
   <path d="M0 0L100 100" fill="none" stroke="#000" strokeOpacity=".2" strokeWidth="5"/>
   <path d="M3 0L100 97" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth="1.5"/>
   <text x="68" y="31" textAnchor="middle" dominantBaseline="central" transform="rotate(45 68 31)" fill="#fff">Neu</text>
 </svg>;
}
