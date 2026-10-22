// Curated links supplied and checked for this TEST mission, matched by exact OSM identity.
// No photos, schedules, tariffs or scraped search-engine data are stored here.
const references=Object.freeze({
 'osm-way-90900940':Object.freeze({url:'https://lasergamesgap.fr/',checked_at:'2026-10-21',source:'Site fourni pour Laser Games Gap, identité OSM vérifiée'}) ,
 'osm-way-90870199':Object.freeze({url:'https://www.ville-gap.fr/alp-arena/',checked_at:'2026-10-18',source:'Site municipal fourni et vérifié pour Alp’Arena'})
});
function officialReference(v){const reference=references[v?.id];return reference?{...v,website:reference.url,website_reference:reference}:v;}
module.exports={officialReference};
