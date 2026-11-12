import {newPlacementStarts,newBannerProfiles,isNewPlacement} from '../config/new-placements';
export type BadgeKind='profile'|'banner'|'basic';
export type NewBadge={kind:BadgeKind;entity_id:string;enabled:boolean;starts_at:string;expires_at:string;revision:number};
export function newBadgeVisible(id:string,kind:BadgeKind,rows:readonly NewBadge[],now=Date.now()):boolean {
  const own=rows.find(row=>row.kind===kind&&row.entity_id===id);
  if(own)return own.enabled&&Date.parse(own.starts_at)<=now&&now<Date.parse(own.expires_at);
  if(kind==='banner') {
    const profile=newBannerProfiles[id];
    return profile?newBadgeVisible(profile,'profile',rows,now):false;
  }
  return kind==='profile'&&isNewPlacement(newPlacementStarts[id],now);
}
export function validBadgeExpiry(value:unknown,now=Date.now()) {
  return typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)>now&&Date.parse(value)<=now+366*86400000;
}
