module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      from,
      to,
      date,
      time = '06:00',
      passengers = 1,
      mode = 'all'
    } = req.body || {};

    if (!from || !to || !date) {
      return res.status(400).json({
        error: 'Départ, destination et date sont obligatoires.'
      });
    }

    const wanted = String(mode).toLowerCase();
    const results = [];
    const warnings = [];

    // =========================
    // 🚆 SNCF
    // =========================

    if (
      (wanted === 'all' || wanted === 'train') &&
      process.env.SNCF_API_TOKEN
    ) {
      const auth = Buffer
        .from(process.env.SNCF_API_TOKEN + ':')
        .toString('base64');

      const headers = {
        Authorization: 'Basic ' + auth,
        Accept: 'application/json'
      };

      async function places(query) {
        const url =
          'https://api.sncf.com/v1/coverage/sncf/places?q=' +
          encodeURIComponent(query);

        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new Error('SNCF places ' + response.status);
        }

        return response.json();
      }

      async function findPlace(query) {
        const data = await places(query);
        const list = Array.isArray(data.places)
          ? data.places
          : [];

        return (
          list.find(
            p =>
              p.embedded_type === 'stop_area' ||
              String(p.id || '').includes('stop_area')
          ) ||
          list[0] ||
          null
        );
      }

      try {
        const [departurePlace, arrivalPlace] =
          await Promise.all([
            findPlace(from),
            findPlace(to)
          ]);

        if (!departurePlace || !arrivalPlace) {
          throw new Error(
            'Gare introuvable pour le départ ou la destination.'
          );
        }

        const departureId = departurePlace.id;
        const arrivalId = arrivalPlace.id;

        const cleanTime = String(time || '06:00')
          .replace(':', '');

        const dateTime =
          String(date).replace(/-/g, '') +
          'T' +
          cleanTime.padEnd(6, '0');

        const url =
          'https://api.sncf.com/v1/coverage/sncf/journeys?' +
          'from=' +
          encodeURIComponent(departureId) +
          '&to=' +
          encodeURIComponent(arrivalId) +
          '&datetime=' +
          dateTime +
          '&datetime_represents=departure' +
          '&count=8';

        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new Error(
            'SNCF journeys ' + response.status
          );
        }

        const data = await response.json();

        for (const journey of data.journeys || []) {
          const sections = (journey.sections || []).filter(
            section =>
              section.type === 'public_transport' ||
              section.type === 'on_demand_transport'
          );

          const main = sections[0];

          const departure =
            journey.departure_date_time ||
            main?.departure_date_time;

          const arrival =
            journey.arrival_date_time ||
            main?.arrival_date_time;

          const transportName =
            main?.display_informations?.commercial_mode ||
            main?.display_informations?.label ||
            'Train';

          results.push({
            kind: 'train',
            provider: 'SNCF',

            id:
              'sncf:' +
              (journey.id ||
                Math.random()
                  .toString(36)
                  .slice(2)),

            title:
              transportName +
              ' · ' +
              (departurePlace.name || from) +
              ' → ' +
              (arrivalPlace.name || to),

            from:
              departurePlace.name || from,

            to:
              arrivalPlace.name || to,

            departure:
              departure
                ? normalizeSncfDate(departure)
                : '',

            arrival:
              arrival
                ? normalizeSncfDate(arrival)
                : '',

            duration_minutes:
              Number(journey.duration || 0)
                ? Math.round(
                    Number(journey.duration) / 60
                  )
                : null,

            price: null,

            currency: 'EUR',

            passengers:
              Number(passengers) || 1,

            booking_url:
              'https://www.sncf-connect.com/',

            source_url:
              'https://numerique.sncf.com/startup/api/'
          });
        }

      } catch (error) {
        warnings.push(
          'SNCF : ' + error.message
        );
      }

    } else if (
      wanted === 'all' ||
      wanted === 'train'
    ) {
      warnings.push(
        'Recherche train indisponible : ajoutez SNCF_API_TOKEN dans Vercel.'
      );
    }

    // =========================
    // ✈️ AMADEUS — AVION
    // =========================

    if (
      (wanted === 'all' || wanted === 'plane') &&
      process.env.AMADEUS_CLIENT_ID &&
      process.env.AMADEUS_CLIENT_SECRET
    ) {
      try {
        const token = await amadeusToken();

        const [departureCity, arrivalCity] =
          await Promise.all([
            amadeusCity(token, from),
            amadeusCity(token, to)
          ]);

        if (!departureCity || !arrivalCity) {
          throw new Error(
            'Ville ou aéroport introuvable.'
          );
        }

        const params = new URLSearchParams({
          originLocationCode:
            departureCity.iataCode,

          destinationLocationCode:
            arrivalCity.iataCode,

          departureDate: date,

          adults: String(
            Math.min(
              9,
              Math.max(
                1,
                Number(passengers) || 1
              )
            )
          ),

          currencyCode: 'EUR',

          max: '10'
        });

        const response = await fetch(
          'https://api.amadeus.com/v2/shopping/flight-offers?' +
          params.toString(),
          {
            headers: {
              Authorization:
                'Bearer ' + token,

              Accept:
                'application/json'
            }
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.errors?.[0]?.detail ||
            'Amadeus ' + response.status
          );
        }

        for (const flight of data.data || []) {
          const itinerary =
            flight.itineraries?.[0];

          const lastSegment =
            itinerary?.segments?.[
              itinerary.segments.length - 1
            ];

          const firstSegment =
            itinerary?.segments?.[0];

          results.push({
            kind: 'plane',

            provider: 'Amadeus',

            id:
              'amadeus:' +
              flight.id,

            title:
              (firstSegment?.carrierCode || '') +
              (
                firstSegment?.number
                  ? ' ' + firstSegment.number
                  : ''
              ) +
              ' · ' +
              departureCity.name +
              ' → ' +
              arrivalCity.name,

            from:
              firstSegment?.departure?.iataCode ||
              departureCity.iataCode,

            to:
              lastSegment?.arrival?.iataCode ||
              arrivalCity.iataCode,

            departure:
              firstSegment?.departure?.at ||
              '',

            arrival:
              lastSegment?.arrival?.at ||
              '',

            duration_minutes:
              parseDuration(
                itinerary?.duration
              ),

            price:
              Number(
                flight.price?.grandTotal ||
                flight.price?.total ||
                0
              ) || null,

            currency:
              flight.price?.currency ||
              'EUR',

            passengers:
              Number(passengers) || 1,

            booking_url:
              'https://www.amadeus.com/',

            source_url:
              'https://developers.amadeus.com/'
          });
        }

      } catch (error) {
        warnings.push(
          'Avion : ' + error.message
        );
      }

    } else if (
      wanted === 'all' ||
      wanted === 'plane'
    ) {
      warnings.push(
        'Recherche avion indisponible : ajoutez AMADEUS_CLIENT_ID et AMADEUS_CLIENT_SECRET dans Vercel.'
      );
    }

    // =========================
    // 🚌 BUS / 🚗 COVOITURAGE
    // =========================

    if (
      wanted === 'bus' ||
      wanted === 'carpool'
    ) {
      warnings.push(
        'Bus et covoiturage : aucun fournisseur temps réel n’est encore connecté à MyEvent pour ce mode.'
      );
    }

    if (
      wanted === 'all' &&
      !results.length &&
      !warnings.length
    ) {
      warnings.push('Aucun résultat.');
    }

    results.sort(
      (a, b) =>
        new Date(a.departure || 0) -
        new Date(b.departure || 0)
    );

    return res.status(200).json({
      results: results.slice(0, 20),
      warnings
    });

  } catch (error) {

    return res.status(500).json({
      error:
        error.message ||
        'Erreur de recherche transport.'
    });
  }
};


// ======================================
// ✈️ AUTHENTIFICATION AMADEUS
// ======================================

async function amadeusToken() {

  const body = new URLSearchParams({
    grant_type:
      'client_credentials',

    client_id:
      process.env.AMADEUS_CLIENT_ID,

    client_secret:
      process.env.AMADEUS_CLIENT_SECRET
  });

  const response = await fetch(
    'https://api.amadeus.com/v1/security/oauth2/token',
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded'
      },

      body
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error_description ||
      'Authentification Amadeus impossible.'
    );
  }

  return data.access_token;
}


// ======================================
// ✈️ RECHERCHE VILLE / AÉROPORT
// ======================================

async function amadeusCity(token, text) {

  const params = new URLSearchParams({
    subType: 'CITY,AIRPORT',
    keyword: String(text).slice(0, 10)
  });

  const response = await fetch(
    'https://api.amadeus.com/v1/reference-data/locations?' +
    params.toString(),
    {
      headers: {
        Authorization:
          'Bearer ' + token
      }
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.errors?.[0]?.detail ||
      'Recherche ville Amadeus impossible.'
    );
  }

  return (
    data.data || []
  ).find(
    item => item.iataCode
  ) || null;
}


// ======================================
// 🚆 FORMAT DATE SNCF
// ======================================

function normalizeSncfDate(value) {

  const text = String(value);

  return text.length >= 15
    ? text.slice(0, 4) +
      '-' +
      text.slice(4, 6) +
      '-' +
      text.slice(6, 8) +
      'T' +
      text.slice(9, 11) +
      ':' +
      text.slice(11, 13) +
      ':' +
      text.slice(13, 15)
    : text;
}


// ======================================
// ⏱️ DURÉE VOL
// ======================================

function parseDuration(value) {

  const match =
    String(value || '')
      .match(
        /PT(?:(\d+)H)?(?:(\d+)M)?/
      );

  return match
    ? Number(match[1] || 0) * 60 +
      Number(match[2] || 0)
    : null;
}
