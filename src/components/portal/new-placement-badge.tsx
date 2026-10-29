import {isNewPlacement,newPlacementStarts} from '@/config/new-placements';
export function NewPlacementBadge({id,className=''}:{id:string;className?:string}) {
 return isNewPlacement(newPlacementStarts[id])?<span className={`new-placement-badge ${className}`}> Neu</span>:null;
}
