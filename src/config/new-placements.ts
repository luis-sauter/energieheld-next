// Populate only for explicitly selected, actually new public placements.
// Import dates and ordinary edits must never reset this clock.
export const newPlacementStarts: Readonly<Record<string,string>> = {};
export function isNewPlacement(start:string|undefined,now=Date.now()) {
 const timestamp=start?Date.parse(start):NaN;
 return Number.isFinite(timestamp)&&now>=timestamp&&now-timestamp<14*24*60*60*1000;
}
