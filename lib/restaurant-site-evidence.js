// Reviewed evidence only; never accept client-supplied attestations.
const {verifyIdentity}=require('./restaurant-website-identity');
const records=require('../data/restaurant-site-evidence.json');
const phone=s=>String(s||'').replace(/^\+33/,'0').replace(/\D/g,'');
function corroborate(venue,{evidence=records,now=Date.now()}={}){
 for(const record of evidence){
  if(!verifyIdentity(venue,{identity:record})||!record.phone||venue.phone&&phone(venue.phone)!==phone(record.phone))continue;
  let target;try{target=new URL(record.website);if(target.protocol!=='https:'||target.username||target.password)continue;}catch{continue;}
  const valid=(record.sources||[]).filter(s=>s.reviewed===true&&Date.parse(s.checked_at)<=now&&Date.parse(s.expires_at)>now&&verifyIdentity(venue,{identity:s})&&phone(s.phone)===phone(record.phone));
  const publishers=new Set(valid.filter(s=>s.kind==='independent').map(s=>s.publisher));
  if(publishers.size<2||!valid.some(s=>s.domain===target.hostname.replace(/^www\./,'')))continue;
  return {website:target.href,website_verified:true,verification_method:'reviewed_independent_sources',status:'available',opening_hours:[],menus:[],prices:[],booking_links:[],authorized_photos:[],sources:valid.map(s=>({type:'Recoupement · '+s.publisher+(s.access==='indexed'?' · extrait indexé':''),url:s.url,checked_at:s.checked_at})),notice:'Site confirmé par recoupement ; consultation automatique directe indisponible. Horaires et menus non déduits de cette validation.'};
 }
 return null;
}
module.exports={corroborate};
