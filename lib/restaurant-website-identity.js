const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
function verifyIdentity(venue,info){
 const i=info.identity;if(!venue||!i||!venue.name||!venue.address||!venue.city||fold(i.name)!==fold(venue.name))return false;
 const city=fold(venue.city);if(!(fold(i.city)===city||fold(i.address).includes(city)))return false;
 const street=s=>fold(s).replace(/\d{5}/g,'').replaceAll(city,'');
 const a=street(venue.address),b=street(i.address);if(a.length<5||a!==b)return false;
 if(Number.isFinite(i.lat)&&Number.isFinite(i.lon)&&Number.isFinite(venue.lat)&&Number.isFinite(venue.lon)&&Math.hypot((i.lat-venue.lat)*111.2,(i.lon-venue.lon)*111.2*Math.cos(venue.lat*Math.PI/180))>0.1)return false;
 return true;
}
module.exports={verifyIdentity};
