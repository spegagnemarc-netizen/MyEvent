// Public website facts only. No partner inventory, member data or booking writes.
const {cleanURL, VenueError} = require('./venue-safe-fetch');
const {analyseRestaurant} = require('./venue-analysis');
const unique = rows => [...new Map(rows.map(r => [r.url || r.source_url+'|'+r.text, r])).values()];
function createRestaurantInformation({analyse=analyseRestaurant, now=Date.now, ttl=6*60*60*1000, failureTtl=5*60*1000, maxEntries=100}={}) {
  const cache=new Map(), pending=new Map();
  return async function information(input) {
    const url=cleanURL(input), host=new URL(url).hostname;
    // Listings/review aggregators are not the restaurant's official website.
    if (/(^|\.)(tripadvisor\.[a-z.]+|thefork\.[a-z.]+|facebook\.com|instagram\.com|google\.[a-z.]+|pagesjaunes\.fr)$/.test(host)) throw new VenueError('Utilisez le site propre de l’établissement.');
    const hit=cache.get(url);
    if(hit&&hit.expires>now())return hit.value;
    if(pending.has(url))return pending.get(url);
    if(pending.size>=2)throw new VenueError('Consultation occupée. Réessayez plus tard.',429);
    const task=(async()=>{
      let value;
      try {
        const r=await analyse(url);
        const menus=unique(r.menu_links||[]).slice(0,3).map(m=>({...m,label:/carte|menu|tarif/i.test(m.label||'')?m.label:'Consulter la carte / le menu'}));
        const prices=unique(r.prices||[]).slice(0,6);
        const hours=unique(r.opening_hours||[]).slice(0,14);
        const booking=unique(r.booking_links||[]).slice(0,3);
        value={status:hours.length||prices.length||menus.length||booking.length?'available':'unavailable',
          website:r.website, opening_hours:hours, menus, prices, booking_links:booking,
          sources:r.sources||[], checked_at:r.checked_at,
          availability:{status:'not_provided',message:'Information non disponible : aucune API partenaire de disponibilités connectée.'},
          notice:'Informations publiées sur le site déclaré de l’établissement, à reconfirmer. Un lien de réservation ne confirme ni créneau ni réservation.',
          warnings:r.warnings||[]};
      } catch {
        value={status:'unavailable',website:url,opening_hours:[],menus:[],prices:[],booking_links:[],sources:[],checked_at:null,
          availability:{status:'not_provided',message:'Information non disponible'},
          notice:'Information non disponible : site inaccessible, consultation refusée ou document non analysable.',warnings:[]};
      }
      if(cache.size>=maxEntries)cache.delete(cache.keys().next().value);
      cache.set(url,{value,expires:now()+(value.status==='unavailable'?failureTtl:ttl)});
      return value;
    })().finally(()=>pending.delete(url));
    pending.set(url,task);return task;
  };
}
module.exports={createRestaurantInformation,restaurantInformation:createRestaurantInformation()};
