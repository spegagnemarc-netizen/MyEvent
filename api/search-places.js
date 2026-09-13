const PHOTON_ENDPOINTS = [
  'https://photon.komoot.io/reverse'
];

function send(res, status, body) {
  res.status(status);
  res.setHeader(
    'Cache-Control',
    's-maxage=180, stale-while-revalidate=600'
  );
  return res.json(body);
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function distanceKm(aLat, aLon, bLat, bLon) {
  const R = 6371;
  const rad = Math.PI / 180;

  const x = (bLat - aLat) * rad;
  const y = (bLon - aLon) * rad;

  const q =
    Math.sin(x / 2) ** 2 +
    Math.cos(aLat * rad) *
      Math.cos(bLat * rad) *
      Math.sin(y / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(q));
}

function toNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const n = Number(
    String(value)
      .replace(',', '.')
      .replace(/[^0-9.-]/g, '')
  );

  return Number.isFinite(n) ? n : null;
}

function normalizeFeature(feature, index) {
  const p = feature?.properties || {};
  const coordinates =
    feature?.geometry?.coordinates || [];

  const lon = Number(coordinates[0]);
  const lat = Number(coordinates[1]);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return null;
  }

  const extra =
    p.extra &&
    typeof p.extra === 'object'
      ? p.extra
      : {};

  const osmKey = p.osm_key || '';
  const osmValue = p.osm_value || '';

  const type =
    osmValue ||
    osmKey ||
    'attraction';

  const address = [
    p.housenumber,
    p.street,
    p.postcode,
    p.city || p.locality
  ]
    .filter(Boolean)
    .join(' ');

  const capacity =
    toNumber(extra.capacity) ??
    toNumber(p.capacity);

  const price =
    toNumber(extra.price) ??
    toNumber(p.price);

  const equipment = [
    extra.wheelchair === 'yes' ||
    p.wheelchair === 'yes'
      ? '♿ Accessibilité'
      : '',

    extra.parking
      ? '🅿️ Parking'
      : '',

    extra.internet_access
      ? '📶 Wi-Fi'
      : ''
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    id:
      'photon-' +
      (p.osm_type || 'item') +
      '-' +
      (p.osm_id || index),

    name:
      p.name ||
      p.street ||
      '',

    address:
      address ||
      p.district ||
      p.county ||
      '',

    lat,
    lon,

    type,

    typeLabel:
      type.replaceAll('_', ' '),

    capacity,
    price,
    equipment,

    website:
      extra.website ||
      p.website ||
      '',

    phone:
      extra.phone ||
      p.phone ||
      '',

    source:
      'OpenStreetMap / Photon'
  };
}


/*
 * Catégories recherchées autour de l'événement.
 *
 * On élargit volontairement la recherche afin que
 * l'IA ait beaucoup plus de possibilités :
 *
 * restaurant
 * bowling
 * cinéma
 * théâtre
 * musée
 * karting
 * escape game
 * piscine
 * patinoire
 * golf
 * mini-golf
 * arcade
 * sports
 * loisirs
 * parcs
 * attractions
 * etc.
 */

const MODE_FILTERS = {

  nearby: [

    // RESTAURATION
    'osm.amenity.restaurant',
    'osm.amenity.cafe',
    'osm.amenity.fast_food',
    'osm.amenity.bar',
    'osm.amenity.pub',

    // CULTURE
    'osm.amenity.cinema',
    'osm.amenity.theatre',
    'osm.amenity.museum',
    'osm.amenity.arts_centre',
    'osm.tourism.museum',
    'osm.tourism.gallery',

    // BOWLING
    'osm.amenity.bowling_alley',
    'osm.leisure.bowling_alley',

    // SPORT
    'osm.amenity.fitness_centre',
    'osm.amenity.sports_centre',
    'osm.leisure.sports_centre',
    'osm.leisure.fitness_centre',
    'osm.leisure.sports_hall',

    // PISCINE / ACTIVITÉS AQUATIQUES
    'osm.leisure.swimming_pool',
    'osm.amenity.public_bath',
    'osm.leisure.water_park',

    // GOLF / MINI-GOLF
    'osm.leisure.golf_course',
    'osm.leisure.miniature_golf',

    // PARCS / NATURE
    'osm.leisure.park',
    'osm.leisure.playground',
    'osm.leisure.garden',
    'osm.leisure.nature_reserve',

    // TOURISME / ATTRACTIONS
    'osm.tourism.attraction',
    'osm.tourism.viewpoint',
    'osm.tourism.theme_park',
    'osm.tourism.zoo',
    'osm.tourism.aquarium',

    // LOISIRS / JEUX
    'osm.leisure.amusement_arcade',
    'osm.leisure.escape_game',
    'osm.leisure.toboggan',
    'osm.leisure.ice_rink',

    // PLAGES / BASES DE LOISIRS
    'osm.leisure.beach_resort',
    'osm.leisure.marina',

    // AUTRES ACTIVITÉS
    'osm.amenity.community_centre',
    'osm.amenity.events_venue',
    'osm.leisure.club',
    'osm.leisure.stadium',
    'osm.leisure.track',
    'osm.leisure.pitch',
    'osm.leisure.dance',
    'osm.leisure.fitness_centre'
  ],

  hall: [

    'osm.amenity.community_centre',
    'osm.amenity.social_centre',
    'osm.amenity.conference_centre',
    'osm.amenity.events_venue',
    'osm.leisure.sports_hall',
    'osm.leisure.sports_centre',
    'osm.tourism.hotel',
    'osm.tourism.guest_house'
  ]
};


function buildPhotonUrl(
  mode,
  lat,
  lon,
  radius,
  limit
) {

  const url =
    new URL(PHOTON_ENDPOINTS[0]);

  url.searchParams.set(
    'lat',
    String(lat)
  );

  url.searchParams.set(
    'lon',
    String(lon)
  );

  url.searchParams.set(
    'radius',
    String(radius)
  );

  url.searchParams.set(
    'limit',
    String(limit)
  );

  url.searchParams.set(
    'lang',
    'fr'
  );

  url.searchParams.set(
    'dedupe',
    '1'
  );

  url.searchParams.set(
    'include',
    MODE_FILTERS[mode].join(',')
  );

  return url.toString();
}


async function fetchPhoton(
  url,
  timeoutMs = 9000
) {

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      timeoutMs
    );

  try {

    const response =
      await fetch(
        url,
        {
          method: 'GET',

          headers: {
            Accept:
              'application/json',

            'User-Agent':
              'MyEvent/53.15 (nearby and venue search)'
          },

          signal:
            controller.signal
        }
      );

    if (!response.ok) {
      throw new Error(
        'Photon HTTP ' +
        response.status
      );
    }

    const data =
      await response.json();

    if (
      !data ||
      !Array.isArray(data.features)
    ) {
      throw new Error(
        'Réponse Photon invalide'
      );
    }

    return data;

  } finally {

    clearTimeout(timer);
  }
}


module.exports =
  async function handler(req, res) {

    if (req.method !== 'GET') {

      res.setHeader(
        'Allow',
        'GET'
      );

      return send(
        res,
        405,
        {
          error:
            'Méthode non autorisée.'
        }
      );
    }

    const mode =
      String(
        req.query.mode ||
        'nearby'
      ).toLowerCase();

    const lat =
      number(req.query.lat);

    const lon =
      number(req.query.lon);

    const radius =
      number(req.query.radius) ??
      (
        mode === 'hall'
          ? 5
          : 3
      );

    const minCapacity =
      number(
        req.query.minCapacity
      );

    const maxBudget =
      number(
        req.query.maxBudget
      );


    if (
      !Object.prototype.hasOwnProperty.call(
        MODE_FILTERS,
        mode
      )
    ) {

      return send(
        res,
        400,
        {
          error:
            'Mode de recherche invalide.'
        }
      );
    }


    if (
      lat === null ||
      lon === null ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {

      return send(
        res,
        400,
        {
          error:
            'Coordonnées invalides.'
        }
      );
    }


    if (
      mode === 'hall' &&
      ![3, 5, 10, 20].includes(
        radius
      )
    ) {

      return send(
        res,
        400,
        {
          error:
            'Rayon invalide.'
        }
      );
    }


    if (
      mode === 'nearby' &&
      (
        radius < 1 ||
        radius > 20
      )
    ) {

      return send(
        res,
        400,
        {
          error:
            'Rayon de proximité invalide.'
        }
      );
    }


    /*
     * On demande beaucoup plus de résultats
     * à Photon.
     */
    const limit =
      mode === 'hall'
        ? 150
        : 200;


    const url =
      buildPhotonUrl(
        mode,
        lat,
        lon,
        radius,
        limit
      );


    let data;


    try {

      data =
        await fetchPhoton(url);

    } catch (error) {

      console.error(
        '[MyEvent V53.15] Photon failure:',
        error?.message ||
        error
      );

      return send(
        res,
        503,
        {
          error:
            'Le service OpenStreetMap est temporairement indisponible.',

          detail:
            error?.message ||
            'Photon indisponible'
        }
      );
    }


    const seen =
      new Set();

    const results =
      [];


    for (
      let i = 0;
      i < data.features.length;
      i += 1
    ) {

      const item =
        normalizeFeature(
          data.features[i],
          i
        );


      if (
        !item ||
        !item.name
      ) {
        continue;
      }


      const key =
        `${item.name}|${item.lat.toFixed(5)}|${item.lon.toFixed(5)}`
          .toLowerCase();


      if (
        seen.has(key)
      ) {
        continue;
      }


      seen.add(key);


      item.distance =
        distanceKm(
          lat,
          lon,
          item.lat,
          item.lon
        );


      if (
        item.distance >
        radius
      ) {
        continue;
      }


      if (
        mode === 'hall' &&
        minCapacity !== null &&
        minCapacity > 0 &&
        item.capacity !== null &&
        item.capacity <
          minCapacity
      ) {
        continue;
      }


      if (
        mode === 'hall' &&
        maxBudget !== null &&
        maxBudget > 0 &&
        item.price !== null &&
        item.price >
          maxBudget
      ) {
        continue;
      }


      results.push(item);
    }


    /*
     * Plus proches en premier.
     */
    results.sort(
      (a, b) =>
        a.distance -
        b.distance
    );


    /*
     * Jusqu'à 150 lieux utilisables
     * pour la recherche générale.
     */
    const finalResults =
      results.slice(
        0,
        mode === 'hall'
          ? 100
          : 150
      );


    return send(
      res,
      200,
      {
        mode,

        results:
          finalResults,

        count:
          results.length,

        radius,

        minCapacity:
          mode === 'hall'
            ? (
                minCapacity ||
                null
              )
            : null,

        maxBudget:
          mode === 'hall'
            ? (
                maxBudget ||
                null
              )
            : null,

        source:
          'OpenStreetMap / Photon via MyEvent API'
      }
    );
  };
