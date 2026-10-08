const PHOTON_ENDPOINTS = [
  'https://photon.komoot.io/reverse'
];

function send(res, status, body) {
  res.status(status);
  res.setHeader(
    'Cache-Control',
    status>=400?'no-store':'s-maxage=180, stale-while-revalidate=600'
  );
  return res.json(body);
}

function number(value) {
  if(value===null||value===undefined||String(value).trim()==='')return null;
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


async function fetchNearbyOverpass(lat,lon,radius,timeoutMs=22000){
  const meters=Math.round(radius*1000);
  const clauses=[
    'nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub|cinema|theatre|arts_centre|bowling_alley|community_centre)$"]',
    'nwr["leisure"~"^(sports_centre|fitness_centre|sports_hall|swimming_pool|golf_course|miniature_golf|park|playground|garden|stadium|track|pitch|ice_rink|bowling_alley|water_park)$"]',
    'nwr["tourism"~"^(museum|gallery|attraction|viewpoint|theme_park|zoo|aquarium)$"]',
    'nwr["sport"]'
  ];
  const query='[out:json][timeout:18];('+clauses.map(x=>x+'(around:'+meters+','+lat+','+lon+');').join('')+');out center 350;';
  const response=await fetch('https://overpass.kumi.systems/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok)throw new Error('Overpass HTTP '+response.status);
  const data=await response.json();
  return {features:(data.elements||[]).map(el=>{
    const p=el.tags||{},a=el.lat??el.center?.lat,b=el.lon??el.center?.lon;
    return {geometry:{coordinates:[b,a]},properties:{name:p.name||p['name:fr']||'',osm_key:p.amenity?'amenity':p.leisure?'leisure':p.tourism?'tourism':'sport',osm_value:p.amenity||p.leisure||p.tourism||(p.sport?'sport':'attraction'),extra:p}};
  })};
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



// Viator Affiliate API shares this existing serverless route so MyEvent stays
// within Vercel Hobby's serverless-function limit.
const VIATOR_ACCEPT = 'application/json;version=2.0';
let viatorDestinationCache = { base: null, expiresAt: 0, items: [] };

function viatorBestImage(images) {
  const variants = (Array.isArray(images) ? images : [])
    .flatMap(image => Array.isArray(image?.variants) ? image.variants : [])
    .filter(v => v?.url)
    .sort((a,b)=>(Number(b.width)||0)-(Number(a.width)||0));
  return variants.find(v=>Number(v.width)<=720)?.url || variants[0]?.url || '';
}
function viatorReviewSummary(reviews) {
  const sources=Array.isArray(reviews?.sources)?reviews.sources:[];
  const total=number(reviews?.totalReviews) ?? sources.reduce((sum,x)=>sum+(number(x?.totalCount)||0),0);
  const rating=number(reviews?.combinedAverageRating) ??
    number(sources.find(x=>String(x?.provider||'').toUpperCase()==='VIATOR')?.averageRating) ??
    number(sources[0]?.averageRating);
  return {rating,reviewCount:total};
}
async function viatorFetch(base,path,key,options={}) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try {
    const response=await fetch(base+path,{
      ...options,
      headers:{Accept:VIATOR_ACCEPT,'Accept-Language':'fr','Content-Type':VIATOR_ACCEPT,'exp-api-key':key,...(options.headers||{})},
      signal:controller.signal
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok){const err=new Error('Viator HTTP '+response.status+' ('+path+')');err.status=response.status;throw err;}
    return data;
  } finally { clearTimeout(timer); }
}
async function viatorDestinations(base,key) {
  if(viatorDestinationCache.base===base&&viatorDestinationCache.expiresAt>Date.now()&&viatorDestinationCache.items.length)return viatorDestinationCache.items;
  const data=await viatorFetch(base,'/destinations',key,{method:'GET'});
  const items=Array.isArray(data?.destinations)?data.destinations:(Array.isArray(data)?data:[]);
  viatorDestinationCache={base,expiresAt:Date.now()+6*60*60*1000,items};
  return items;
}
function nearestViatorDestination(destinations,lat,lon) {
  return destinations.map(d=>{
    const dLat=number(d?.center?.latitude),dLon=number(d?.center?.longitude);
    if(dLat===null||dLon===null||d?.destinationId==null)return null;
    return {...d,_distance:distanceKm(lat,lon,dLat,dLon)};
  }).filter(Boolean).sort((a,b)=>a._distance-b._distance)[0]||null;
}
function viatorLocationRefs(product) {
  const refs=[];
  const add=value=>{
    const ref=String(value||'').trim();
    if(ref.startsWith('LOC-')&&!refs.includes(ref))refs.push(ref);
  };
  const itinerary=product?.itinerary||{};
  add(itinerary?.activityInfo?.location?.ref);
  (Array.isArray(itinerary?.itineraryItems)?itinerary.itineraryItems:[]).forEach(item=>{
    add(item?.pointOfInterestLocation?.location?.ref);
    add(item?.pointOfInterestLocation?.ref);
  });
  (Array.isArray(itinerary?.pointOfInterestLocations)?itinerary.pointOfInterestLocations:[]).forEach(item=>add(item?.location?.ref||item?.ref));
  (Array.isArray(itinerary?.pointsOfInterest)?itinerary.pointsOfInterest:[]).forEach(item=>add(item?.location?.ref||item?.ref));
  (Array.isArray(itinerary?.routes)?itinerary.routes:[]).forEach(route=>{
    (Array.isArray(route?.stops)?route.stops:[]).forEach(stop=>add(stop?.stopLocation?.ref||stop?.location?.ref||stop?.ref));
    (Array.isArray(route?.pointsOfInterest)?route.pointsOfInterest:[]).forEach(item=>add(item?.location?.ref||item?.ref));
  });
  (Array.isArray(product?.logistics?.start)?product.logistics.start:[]).forEach(item=>add(item?.location?.ref||item?.ref));
  return refs;
}

async function viatorResolveLocations(base,key,products) {
  const refs=[...new Set(products.flatMap(viatorLocationRefs))];
  if(!refs.length)return new Map();
  const data=await viatorFetch(base,'/locations/bulk',key,{method:'POST',body:JSON.stringify({locations:refs})});
  const map=new Map();
  for(const location of (Array.isArray(data?.locations)?data.locations:[])){
    const lat=number(location?.center?.latitude),lon=number(location?.center?.longitude);
    if(lat!==null&&lon!==null&&location?.reference){
      map.set(String(location.reference),{lat,lon,name:location?.name||'',address:location?.address||null});
    }
  }
  return map;
}

function viatorProductLocation(product,locations) {
  for(const ref of viatorLocationRefs(product)){
    const location=locations.get(ref);
    if(location)return location;
  }
  return null;
}

async function searchViator(req,lat,lon) {
  const production=String(process.env.VIATOR_API_ENV||'').trim().toLowerCase()==='production';
  const key=production ? process.env.VIATOR_API_KEY : (process.env.VIATOR_API_KEY_SANDBOX||process.env.VIATOR_API_KEY);
  if(!key)throw new Error('Viator n’est pas encore configuré sur le serveur.');
  const base=production?'https://api.viator.com/partner':'https://api.sandbox.viator.com/partner';
  const destinations=await viatorDestinations(base,key);
  const rankedDestinations=destinations.map(d=>{
    const dLat=number(d?.center?.latitude),dLon=number(d?.center?.longitude);
    if(dLat===null||dLon===null||d?.destinationId==null)return null;
    return {...d,_distance:distanceKm(lat,lon,dLat,dLon)};
  }).filter(Boolean).sort((a,b)=>a._distance-b._distance);
  const destination=rankedDestinations[0]||null;
  if(!destination)return {results:[],destination:null,environment:production?'production':'sandbox'};

  const radius=Math.min(200,Math.max(1,number(req.query.radius)??5));
  const maxPrice=number(req.query.maxPrice);
  const requestedCount=Math.min(100,Math.max(1,Math.round(number(req.query.count)||60)));

  // Viator search is destination-based rather than a true radial query. Search
  // several surrounding destinations, then merge/dedupe and rank using each
  // product's resolved coordinates so coverage is 360 degrees around MyEvent.
  const searchLimit=Math.max(radius,150);
  const candidates=rankedDestinations.filter(d=>d._distance<=searchLimit).slice(0,8);
  if(!candidates.some(d=>String(d.destinationId)===String(destination.destinationId)))candidates.unshift(destination);

  const responses=await Promise.all(candidates.map(async d=>{
    const filtering={destination:String(d.destinationId)};
    if(maxPrice!==null&&maxPrice>0)filtering.highestPrice=maxPrice;
    try {
      const data=await viatorFetch(base,'/products/search',key,{method:'POST',body:JSON.stringify({
        filtering,sorting:{sort:'DEFAULT'},pagination:{start:1,count:Math.min(30,requestedCount)},currency:'EUR'
      })});
      return {destination:d,data};
    } catch(error) {
      console.warn('[MyEvent Viator] destination '+d.destinationId+' skipped:',error?.message||error);
      return null;
    }
  }));

  const productMap=new Map();
  let totalCount=0;
  for(const response of responses.filter(Boolean)){
    totalCount+=(number(response?.data?.totalCount)||0);
    for(const product of (Array.isArray(response?.data?.products)?response.data.products:[])){
      const code=String(product?.productCode||'');
      if(code&&!productMap.has(code))productMap.set(code,product);
    }
  }
  const products=[...productMap.values()];
  const locations=await viatorResolveLocations(base,key,products);
  const destinationById=new Map(destinations.map(item=>[String(item?.destinationId),item]));

  const results=products.map(product=>{
    const reviews=viatorReviewSummary(product?.reviews);
    let location=viatorProductLocation(product,locations);
    if(!location){
      const refs=Array.isArray(product?.destinations)?product.destinations:[];
      const primary=refs.find(item=>item?.primary) || refs[0];
      const productDestination=primary ? destinationById.get(String(primary.ref)) : null;
      const fallbackLat=number(productDestination?.center?.latitude);
      const fallbackLon=number(productDestination?.center?.longitude);
      if(fallbackLat!==null&&fallbackLon!==null){
        location={lat:fallbackLat,lon:fallbackLon,name:productDestination?.name||'',address:null,approximate:true};
      }
    }
    if(!location)return null;
    const distance=distanceKm(lat,lon,location.lat,location.lon);
    const addressParts=location.address&&typeof location.address==='object'
      ? [location.address.street,location.address.administrativeArea,location.address.postcode,location.address.country].filter(Boolean)
      : [];
    return {
      id:'viator-'+String(product?.productCode||''),productCode:product?.productCode||'',
      name:product?.title||'Activité Viator',description:product?.description||'',type:'viator_activity',
      typeLabel:'Activité réservable',address:addressParts.join(', ')||location.name||destination?.name||'',
      lat:location.lat,lon:location.lon,distance,locationApproximate:!!location.approximate,
      price:toNumber(product?.pricing?.summary?.fromPrice)??toNumber(product?.pricing?.fromPrice),
      currency:product?.pricing?.currency||product?.pricing?.summary?.currency||'EUR',
      image:viatorBestImage(product?.images),rating:reviews.rating,reviewCount:reviews.reviewCount,
      productUrl:product?.productUrl||'',website:product?.productUrl||'',flags:Array.isArray(product?.flags)?product.flags:[],
      tags:Array.isArray(product?.tags)?product.tags:[],source:'viator'
    };
  }).filter(x=>x&&x.productCode&&x.name&&x.website).sort((a,b)=>a.distance-b.distance);

  const inRadius=results.filter(x=>x.distance<=radius);
  const fallbackUsed=inRadius.length===0&&results.length>0;
  // Diversify the final list geographically: a dense tourist hub must not
  // monopolise the search. Group nearby activities into ~15 km clusters and
  // keep at most 10 products per cluster before filling from the next zones.
  const sourceResults=fallbackUsed?results:inRadius;
  const clusters=[];
  const diversified=[];
  for(const item of sourceResults){
    let cluster=clusters.find(group=>distanceKm(item.lat,item.lon,group.lat,group.lon)<=15);
    if(!cluster){
      cluster={lat:item.lat,lon:item.lon,count:0};
      clusters.push(cluster);
    }
    if(cluster.count>=10)continue;
    cluster.count++;
    diversified.push(item);
    if(diversified.length>=requestedCount)break;
  }
  const finalResults=diversified;
  return {
    results:finalResults,totalCount,radius,fallbackUsed,
    searchedDestinations:candidates.length,
    destination:{id:destination.destinationId,name:destination.name,type:destination.type,distanceKm:Number(destination._distance.toFixed(1))},
    environment:production?'production':'sandbox'
  };
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

    if (mode === 'outings') {
      const lat=number(req.query.lat),lon=number(req.query.lon),radius=number(req.query.radius)??5;
      if(lat===null||lon===null||Math.abs(lat)>90||Math.abs(lon)>180||![5,20,50,100].includes(radius))return send(res,400,{error:'Coordonnées ou rayon invalide.'});
      const {searchRestaurants}=require('../lib/geoapify-restaurants');
      async function osmActivities(){
        let data;
        try{data=await fetchNearbyOverpass(lat,lon,Math.min(radius,20),6500);}catch(_){data=await fetchNearbyOverpass(lat,lon,Math.min(radius,20),6500);}
        return {results:data.features.map(normalizeFeature).filter(p=>p&&p.name&&!['restaurant','cafe','fast_food','bar','pub'].includes(p.type)).map(p=>({...p,distance:distanceKm(lat,lon,p.lat,p.lon),source:'openstreetmap'}))};
      }
      async function bounded(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Provider timeout')),18000);})]);}finally{clearTimeout(timer);}}
      const sources=await Promise.allSettled([searchRestaurants({lat,lon,radius}),bounded(searchViator(req,lat,lon)),osmActivities()]);
      const buckets=sources.map(s=>s.status==='fulfilled'?s.value.results:[]),results=[];
      for(let i=0;i<Math.max(...buckets.map(b=>b.length));i++)for(const bucket of buckets)if(bucket[i])results.push(bucket[i]);
      const warnings=sources.flatMap((s,i)=>s.status==='rejected'?[['Restaurants','Activités Viator','Lieux OpenStreetMap'][i]+' temporairement indisponibles.']:[]);
      return send(res,sources.every(s=>s.status==='rejected')?503:200,{results,count:results.length,radius,warnings,partial:warnings.length>0,fallbackUsed:sources.some(s=>s.status==='fulfilled'&&s.value.fallbackUsed)});
    }

    if (mode === 'restaurant') {
      const {searchRestaurants}=require('../lib/geoapify-restaurants');
      try { return send(res,200,await searchRestaurants({lat:number(req.query.lat),lon:number(req.query.lon),radius:number(req.query.radius)??5})); }
      catch(error){return send(res,error.status||502,{error:error.message});}
    }

    if (mode === 'viator') {
      const lat = number(req.query.lat);
      const lon = number(req.query.lon);
      if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return send(res, 400, { error: 'Coordonnées invalides.' });
      }
      try {
        const result = await searchViator(req, lat, lon);
        return send(res, 200, { ...result, count: result.results.length, source: 'Viator Affiliate API' });
      } catch (error) {
        console.error('[MyEvent Viator]', error?.message || error);
        const status = [401,403,429].includes(error?.status) ? error.status : 502;
        return send(res, status, { error: error?.message || 'Viator est temporairement indisponible.' });
      }
    }

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

      data = mode === 'nearby' ? await fetchNearbyOverpass(lat,lon,radius) : await fetchPhoton(url);

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
          mode === 'nearby' ? 'OpenStreetMap / Overpass via MyEvent API' : 'OpenStreetMap / Photon via MyEvent API'
      }
    );
  };
