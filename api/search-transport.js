module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

    // =========================================================
    // 🚆 SNCF
    // =========================================================

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

      async function places(q) {
        const u =
          'https://api.sncf.com/v1/coverage/sncf/places?q=' +
          encodeURIComponent(q);

        const r = await fetch(u, { headers });

        if (!r.ok) {
          throw new Error('SNCF places ' + r.status);
        }

        return r.json();
      }

      async function findPlace(q) {
        const d = await places(q);
        const arr = Array.isArray(d.places) ? d.places : [];

        return (
          arr.find(
            p =>
              p.embedded_type === 'stop_area' ||
              String(p.id || '').includes('stop_area')
          ) ||
          arr[0] ||
          null
        );
      }

      try {
        const [a, b] = await Promise.all([
          findPlace(from),
          findPlace(to)
        ]);

        if (!a || !b) {
          throw new Error(
            'Gare introuvable pour le départ ou la destination.'
          );
        }

        const fromId = a.id;
        const toId = b.id;

        const hm = String(time || '06:00').replace(':', '');

        const dt =
          String(date).replace(/-/g, '') +
          'T' +
          hm.padEnd(6, '0');

        const url =
          'https://api.sncf.com/v1/coverage/sncf/journeys?' +
          'from=' +
          encodeURIComponent(fromId) +
          '&to=' +
          encodeURIComponent(toId) +
          '&datetime=' +
          dt +
          '&datetime_represents=departure' +
          '&count=8';

        const r = await fetch(url, { headers });

        if (!r.ok) {
          throw new Error('SNCF journeys ' + r.status);
        }

        const d = await r.json();

        for (const j of d.journeys || []) {
          const sections = (j.sections || []).filter(
            s =>
              s.type === 'public_transport' ||
              s.type === 'on_demand_transport'
          );

          const main = sections[0];

          const dep =
            j.departure_date_time ||
            main?.departure_date_time;

          const arr =
            j.arrival_date_time ||
            main?.arrival_date_time;

          const modeName =
            main?.display_informations?.commercial_mode ||
            main?.display_informations?.label ||
            'Train';

          const trainNumber =
            main?.display_informations?.number ||
            main?.display_informations?.trip_short_name ||
            '';

          results.push({
            kind: 'train',
            provider: 'SNCF',

            id:
              'sncf:' +
              (j.id ||
                Math.random().toString(36).slice(2)),

            title:
              modeName +
              ' · ' +
              (a.name || from) +
              ' → ' +
              (b.name || to),

            from: a.name || from,
            to: b.name || to,

            departure: dep
              ? normalizeSncfDate(dep)
              : '',

            arrival: arr
              ? normalizeSncfDate(arr)
              : '',

            duration_minutes:
              Number(j.duration || 0)
                ? Math.round(Number(j.duration) / 60)
                : null,

            price: null,
            currency: 'EUR',

            passengers:
              Number(passengers) || 1,

            booking_url:
              'https://www.sncf-connect.com/app/home/search',

            source_url:
              'https://numerique.sncf.com/startup/api/',

            train_number: trainNumber
          });
        }

      } catch (e) {
        warnings.push('SNCF : ' + e.message);
      }

    } else if (
      wanted === 'all' ||
      wanted === 'train'
    ) {
      warnings.push(
        'Recherche train indisponible : ajoutez SNCF_API_TOKEN dans Vercel.'
      );
    }

    // =========================================================
    // ✈️ AVION
    // =========================================================

    if (
      (wanted === 'all' || wanted === 'plane') &&
      process.env.AMADEUS_CLIENT_ID &&
      process.env.AMADEUS_CLIENT_SECRET
    ) {
      try {
        const token = await amadeusToken();

        const [a, b] = await Promise.all([
          amadeusCity(token, from),
          amadeusCity(token, to)
        ]);

        if (!a || !b) {
          throw new Error(
            'Ville/aéroport introuvable.'
          );
        }

        const params = new URLSearchParams({
          originLocationCode: a.iataCode,
          destinationLocationCode: b.iataCode,
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

        const r = await fetch(
          'https://api.amadeus.com/v2/shopping/flight-offers?' +
          params.toString(),
          {
            headers: {
              Authorization:
                'Bearer ' + token,
              Accept: 'application/json'
            }
          }
        );

        const d = await r.json();

        if (!r.ok) {
          throw new Error(
            d?.errors?.[0]?.detail ||
            'Amadeus ' + r.status
          );
        }

        for (const f of d.data || []) {
          const first =
            f.itineraries?.[0];

          const last =
            first?.segments?.[
              first.segments.length - 1
            ];

          const seg0 =
            first?.segments?.[0];

          results.push({
            kind: 'plane',
            provider: 'Avion',

            id:
              'plane:' + f.id,

            title:
              (seg0?.carrierCode || '') +
              (seg0?.number
                ? ' ' + seg0.number
                : '') +
              ' · ' +
              a.name +
              ' → ' +
              b.name,

            from:
              seg0?.departure?.iataCode ||
              a.iataCode,

            to:
              last?.arrival?.iataCode ||
              b.iataCode,

            departure:
              seg0?.departure?.at || '',

            arrival:
              last?.arrival?.at || '',

            duration_minutes:
              parseDuration(
                first?.duration
              ),

            price:
              Number(
                f.price?.grandTotal ||
                f.price?.total ||
                0
              ) || null,

            currency:
              f.price?.currency ||
              'EUR',

            passengers:
              Number(passengers) || 1,

            booking_url:
              'https://www.amadeus.com/',

            source_url:
              'https://developers.amadeus.com/'
          });
        }

      } catch (e) {
        warnings.push(
          'Avion : ' + e.message
        );
      }

    } else if (
      wanted === 'all' ||
      wanted === 'plane'
    ) {
      warnings.push(
        'ℹ️ La recherche de vols sera bientôt disponible dans MyEvent.'
      );
    }

    // =========================================================
    // 🚌 BLABLACAR BUS
    // =========================================================

    if (
      wanted === 'bus' ||
      wanted === 'all'
    ) {
      results.push({
        kind: 'bus',
        provider: 'BlaBlaCar Bus',

        id:
          'blablacar:bus:' +
          v58Slug(from) +
          ':' +
          v58Slug(to),

        title:
          'Bus ' +
          from +
          ' → ' +
          to,

        from,
        to,

        departure: '',
        arrival: '',

        duration_minutes: null,
        price: null,
        currency: 'EUR',

        passengers:
          Number(passengers) || 1,

        booking_url:
          'https://www.blablacar.fr/bus',

        source_url:
          'https://bus-api.blablacar.com/',

        external_only: true
      });
    }

    // =========================================================
    // 🚗 BLABLACAR COVOITURAGE
    // =========================================================

    if (
      wanted === 'carpool' ||
      wanted === 'all'
    ) {
      results.push({
        kind: 'carpool',
        provider: 'BlaBlaCar',

        id:
          'blablacar:carpool:' +
          v58Slug(from) +
          ':' +
          v58Slug(to),

        title:
          'Covoiturage ' +
          from +
          ' → ' +
          to,

        from,
        to,

        departure: '',
        arrival: '',

        duration_minutes: null,
        price: null,
        currency: 'EUR',

        passengers:
          Number(passengers) || 1,

        booking_url:
          'https://www.blablacar.fr/carpool/routes/' +
          v58Slug(from) +
          '/' +
          v58Slug(to),

        source_url:
          'https://blog.fr.blablacar.be/about-us/partenaires',

        external_only: true
      });
    }

    if (
      wanted === 'bus' ||
      wanted === 'carpool' ||
      wanted === 'all'
    ) {
      warnings.push(
        'ℹ️ BlaBlaCar et BlaBlaCar Bus : recherche officielle à ouvrir. Les offres intégrées directement nécessitent un accès partenaire/API.'
      );
    }

    // =========================================================
    // 🚕 TAXI / VTC
    // =========================================================

    if (
      wanted === 'taxi' ||
      wanted === 'all'
    ) {
      results.push({
        kind: 'taxi',
        provider: 'Uber',

        id:
          'uber:taxi:' +
          v58Slug(from) +
          ':' +
          v58Slug(to),

        title:
          'Taxi / VTC ' +
          from +
          ' → ' +
          to,

        from,
        to,

        departure: '',
        arrival: '',

        duration_minutes: null,
        price: null,
        currency: 'EUR',

        passengers:
          Number(passengers) || 1,

        booking_url:
          'https://m.uber.com/',

        source_url:
          'https://developer.uber.com/docs/riders/ride-requests/tutorials/api/introduction',

        external_only: true
      });

      warnings.push(
        'ℹ️ Taxi / VTC : MyEvent ouvre actuellement Uber. Les tarifs et disponibilités en temps réel seront intégrés avec un accès partenaire/API approprié.'
      );
    }

    // =========================================================
    // 📊 RÉPONSE
    // =========================================================

    if (
      wanted === 'all' &&
      !results.length &&
      !warnings.length
    ) {
      warnings.push('Aucun résultat.');
    }

    results.sort(
      (x, y) =>
        new Date(x.departure || 0) -
        new Date(y.departure || 0)
    );

    return res.status(200).json({
      results: results.slice(0, 20),
      warnings
    });

  } catch (e) {
    return res.status(500).json({
      error:
        e.message ||
        'Erreur de recherche transport.'
    });
  }
};


// =========================================================
// ✈️ AMADEUS
// =========================================================

async function amadeusToken() {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',

    client_id:
      process.env.AMADEUS_CLIENT_ID,

    client_secret:
      process.env.AMADEUS_CLIENT_SECRET
  });

  const r = await fetch(
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

  const d = await r.json();

  if (!r.ok) {
    throw new Error(
      d?.error_description ||
      'Authentification Amadeus impossible.'
    );
  }

  return d.access_token;
}


async function amadeusCity(token, text) {
  const p = new URLSearchParams({
    subType: 'CITY,AIRPORT',
    keyword:
      String(text).slice(0, 10)
  });

  const r = await fetch(
    'https://api.amadeus.com/v1/reference-data/locations?' +
    p.toString(),
    {
      headers: {
        Authorization:
          'Bearer ' + token
      }
    }
  );

  const d = await r.json();

  if (!r.ok) {
    throw new Error(
      d?.errors?.[0]?.detail ||
      'Recherche ville Amadeus impossible.'
    );
  }

  return (
    d.data || []
  ).find(x => x.iataCode) || null;
}


// =========================================================
// 🔧 OUTILS
// =========================================================

function v58Slug(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9]+/g,
      '-'
    )
    .replace(
      /^-+|-+$/g,
      '');
}


function normalizeSncfDate(v) {
  const s = String(v);

  return s.length >= 15
    ? s.slice(0, 4) +
      '-' +
      s.slice(4, 6) +
      '-' +
      s.slice(6, 8) +
      'T' +
      s.slice(9, 11) +
      ':' +
      s.slice(11, 13) +
      ':' +
      s.slice(13, 15)
    : s;
}


function parseDuration(v) {
  const m = String(v || '')
    .match(
      /PT(?:(\d+)H)?(?:(\d+)M)?/
    );

  return m
    ? (
        Number(m[1] || 0) * 60 +
        Number(m[2] || 0)
      )
    : null;
}
