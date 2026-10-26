// Release interlock: change only after explicit activation approval and privacy review.
export const AUTOMATIC_ADS_RELEASE_APPROVED = false;
export function normalizeSettings(raw = {}) {
 const integer=(v,f,min,max)=>Number.isInteger(v)&&v>=min&&v<=max?v:f;
 return {enabled:raw.enabled===true, feed_enabled:raw.feed_enabled===true,
 spacing:integer(raw.spacing,8,5,30), max_slots:integer(raw.max_slots,2,0,2),
 publisher_id:/^ca-pub-\d{16}$/.test(raw.publisher_id||'')?raw.publisher_id:'',
 slot_id:/^\d{10}$/.test(raw.slot_id||'')?raw.slot_id:'',
 cmp_id:integer(raw.cmp_id,0,1,65535), approved:raw.approved===true};
}
export function automaticReady(c, environment, releaseApproved = AUTOMATIC_ADS_RELEASE_APPROVED) {
 return releaseApproved && environment==='production' && c.enabled && c.feed_enabled && c.approved && !!c.publisher_id && !!c.slot_id && c.cmp_id>0;
}
export function planSlots(postCount,c,sponsoredPositions=[]) {
 const occupied=new Set(sponsoredPositions), result=[];
 // Both kinds share the cap. Keep a spacing-sized gap around direct campaigns.
 for(let pos=c.spacing;pos<=postCount && result.length+occupied.size<c.max_slots;pos+=c.spacing){
  if([...occupied].some(other=>Math.abs(other-pos)<c.spacing))continue;
  result.push(pos);
 }
 return result;
}
