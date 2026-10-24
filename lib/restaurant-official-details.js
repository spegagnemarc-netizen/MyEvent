// Manually consulted public facts for one pilot; never a stock/availability feed.
const checkedAt = '2026-10-24';
const site = 'https://www.restaurantlepasturier.com/';
const menu = site + 'carte-tradtionnelle-et-de-saison/';
const contact = site + 'contact-et-reservation/';
const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function enrichPilot(venue) {
  if (!venue || fold(venue.name) !== 'lepasturier' ||
      (venue.city && fold(venue.city) !== 'gap') ||
      !Number.isFinite(venue.lat) || !Number.isFinite(venue.lon) ||
      Math.abs(venue.lat - 44.5603045) > 0.0005 || Math.abs(venue.lon - 6.0799698) > 0.0007 ||
      !['restaurant', undefined].includes(venue.category) ||
      (venue.type && venue.type !== 'restaurant') ||
      (String(venue.id).startsWith('osm-') && venue.id !== 'osm-node-4744015021')) return venue;
  return {
    ...venue,
    website: site,
    phone: '04 92 53 69 29',
    opening_hours: 'Du mardi au samedi : 12 h–13 h 15 et 19 h 30–21 h 15. Fermé dimanche et lundi.',
    prices: 'Exemples de la carte de saison : daurade 27 € ; bœuf 35 € ; tarte au citron 9,50 €. Prix par plat, sans estimation de budget par personne. Carte et prix susceptibles de changer : à confirmer auprès du restaurant.',
    menu_url: menu,
    booking_url: contact,
    booking_method: 'external_request',
    booking_verified: false,
    official_restaurant: {id: 'le-pasturier-gap', checked_at: checkedAt},
    sources: [
      {type: 'Site officiel · horaires et demande de réservation', url: contact, checked_at: checkedAt},
      {type: 'Site officiel · carte et prix publiés', url: menu, checked_at: checkedAt}
    ],
    checked_at: checkedAt
  };
}
const {enrichCatalog} = require('./restaurant-catalog');
function enrichRestaurant(venue) {
  const enriched = enrichCatalog(enrichPilot(venue));
  // Keep the pilot presentation compatible; the accordion loads the same curated snapshot.
  if (enriched.official_restaurant) { const {restaurant_information, ...pilot} = enriched; return pilot; }
  return enriched;
}
module.exports = {enrichRestaurant};
