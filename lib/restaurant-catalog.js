// Public editorial snapshots only. Never insert venues into a provider response.
const catalog = require('../data/restaurant-catalog-gap.json');
const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
function distance(lat, lon, a, b) {
  const rad = Math.PI / 180;
  const h = Math.sin((lat-a)*rad/2)**2 + Math.cos(lat*rad)*Math.cos(a*rad)*Math.sin((lon-b)*rad/2)**2;
  return 12742*Math.asin(Math.min(1,Math.sqrt(h)));
}
function match(venue) {
  if (!venue || !Number.isFinite(venue.lat) || !Number.isFinite(venue.lon) ||
      !['restaurant', undefined].includes(venue.category) || (venue.type && venue.type !== 'restaurant') ||
      distance(venue.lat,venue.lon,44.55907,6.07967)>20) return;
  return catalog.find(r => {
    if (![r.name,...r.aliases].some(n=>fold(n)===fold(venue.name)) || (venue.city && fold(venue.city)!==fold(r.city))) return false;
    if (r.id==='le-pasturier-gap' && String(venue.id).startsWith('osm-') && venue.id!=='osm-node-4744015021') return false;
    // Missing coordinates in the editorial record are never fabricated. Require street + city.
    if (r.coordinates) return distance(venue.lat,venue.lon,...r.coordinates)<0.06;
    const address = fold(venue.address), expected = fold(r.address);
    return fold(venue.city)===fold(r.city) && (address===expected || address===expected+fold(r.city) || address===expected+'05000'+fold(r.city));
  });
}
function enrichCatalog(venue) {
  const r=match(venue); if(!r)return venue;
  const sources=r.sources.map(s=>({...s,type:s.kind==='site_officiel'?'Site officiel':'Office de tourisme'}));
  const field={source_url:sources[0].url,checked_at:r.checked_at,status:'published_to_confirm'};
  const info={status:'available',website:r.website,checked_at:r.checked_at,
    opening_hours:r.hours?[{heading:'Horaires publiés',text:r.hours,...field,source_url:r.hours_source_url}]:[],
    prices:r.prices?[{text:r.prices,...field,source_url:r.prices_source_url}]:[],
    menus:r.menu_url?[{label:'Consulter la carte publiée · à confirmer',url:r.menu_url}]:[],
    booking_links:r.booking_url?[{url:r.booking_url,verified:false}]:[],sources,warnings:r.warnings,
    availability:{status:'not_provided'},
    notice:'Fiche publique : aucun partenariat MyEvent-API établi, aucune disponibilité fournie ni réservation confirmée. Horaires et tarifs à reconfirmer ; information absente = non disponible.'};
  return {...venue,website:r.website,opening_hours:r.hours||null,prices:r.prices||null,
    menu_url:r.menu_url,booking_url:r.booking_url,booking_verified:false,booking_method:r.booking_url?'external_request':null,
    restaurant_catalog:{id:r.id,website_verified:r.id==='le-pasturier-gap',information:info,photo:r.photo},restaurant_information:info,
    sources,checked_at:r.checked_at,image:null,images:[]};
}
module.exports={enrichCatalog,match};
