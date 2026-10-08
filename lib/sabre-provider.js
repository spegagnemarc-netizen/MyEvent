// CERT discovery adapter only. No PriceCheck, booking, PNR or payment operation.
const {distanceKm}=require('./geoapify-restaurants');
const distance=(a,b)=>distanceKm(a.lat,a.lon,b.lat,b.lon);
const tokens=new Map();
async function accessToken(env,fetcher,base,force=false){
 const key=require('node:crypto').createHash('sha256').update(base+'|'+env.SABRE_USERNAME+'|'+env.SABRE_PASSWORD).digest('hex');
 if(!force&&tokens.get(key)?.expires>Date.now())return tokens.get(key).token;
 const auth=Buffer.from(Buffer.from(env.SABRE_USERNAME).toString('base64')+':'+Buffer.from(env.SABRE_PASSWORD).toString('base64')).toString('base64');
 const response=await fetcher(base+'/v2/auth/token',{method:'POST',redirect:'error',headers:{Authorization:'Basic '+auth,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('Authentification Sabre CERT refusée (HTTP '+response.status+').');
 const data=await response.json();if(typeof data.access_token!=='string'||!data.access_token)throw Error('Jeton Sabre CERT absent.');
 if(tokens.size>20)tokens.clear();tokens.set(key,{token:data.access_token,expires:Date.now()+Math.max(0,Math.min(Number(data.expires_in)||0,604800)-60)*1000});return data.access_token;
}
const array=v=>Array.isArray(v)?v:v?[v]:[];
const clean=v=>typeof v==='string'?v.slice(0,1000):'';
const numeric=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const safeUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
function normalize(row,center){
 const h=row.HotelInfo||{},loc=h.LocationInfo||{},addr=loc.Address||{},lat=numeric(loc.Latitude),lon=numeric(loc.Longitude);
 const rates=row.HotelRateInfo?.RateInfos||{},converted=array(rates.ConvertedRateInfo),original=array(rates.RateInfo);
 // Compare only rates in the same currency; never guess a currency or convert locally.
 const pool=converted.length?converted:original,group=pool.find(r=>r.CurrencyCode)?.CurrencyCode;
 const priced=pool.filter(r=>/^[A-Z]{3}$/.test(group||'')&&r.CurrencyCode===group&&numeric(r.AmountAfterTax)!==null&&Number(r.AmountAfterTax)>=0).sort((a,b)=>Number(a.AmountAfterTax)-Number(b.AmountAfterTax));
 const rate=priced[0],price=rate?Number(rate.AmountAfterTax):null;
 const conditions=array(rate?.CancelPenalties?.CancelPenalty).map(p=>({refundable:typeof p.Refundable==='boolean'?p.Refundable:null,text:clean(p.PenaltyDescription?.Text)}));
 const result={id:typeof h.HotelCode==='number'&&Number.isFinite(h.HotelCode)?String(h.HotelCode):clean(h.HotelCode),name:clean(h.HotelName),type:'hotel',source:'sabre-cert',address:[addr.AddressLine1,addr.AddressLine2,addr.AddressLine3,addr.PostalCode,addr.CityName?.CityName,addr.CountryName?.CountryName].filter(v=>typeof v==='string'&&v).join(', '),lat,lon,price,currency:clean(rate?.CurrencyCode),priceBasis:'total-stay',conditions,taxInclusive:rate?.TaxInclusive===true,feesInclusive:rate?.AdditionalFeesInclusive===true,availability:pool.length?'Tarif retourné par Sabre CERT · à revérifier':'Disponibilité non fournie',image:safeUrl(array(row.HotelImageInfo?.ImageItem)[0]?.Image?.Url),equipment:array(h.Amenities?.Amenity).map(a=>clean(a.Description)).filter(Boolean),bookingAvailable:false};
 if(lat!==null&&lon!==null&&Math.abs(lat)<=90&&Math.abs(lon)<=180)result.distance=distance(center,{lat,lon});else{result.lat=null;result.lon=null;}
 return result;
}
function request(q,center){
 if(q.guests%q.rooms)throw Error('Pour cette recherche Sabre, indique le même nombre d’adultes par chambre.');
 return {GetHotelAvailRQ:{SearchCriteria:{OffSet:Number.isInteger(q.offset)?q.offset:1,SortBy:'DistanceFrom',SortOrder:'ASC',PageSize:40,RateDetailsInd:false,GeoSearch:{GeoRef:{Radius:20,UOM:'KM',GeoCode:{Latitude:center.lat,Longitude:center.lon}}},RateInfoRef:{CurrencyCode:'EUR',BestOnly:'1',ConvertedRateInfoOnly:false,StayDateTimeRange:{StartDate:q.checkIn,EndDate:q.checkOut},Rooms:{Room:Array.from({length:q.rooms},(_,i)=>({Index:i+1,Adults:q.guests/q.rooms}))}},ImageRef:{Type:'MEDIUM'}}}};
}
function createSabreProvider({env=process.env,fetcher=fetch}={}){
 return {id:'sabre-cert',async search(q){
  if(env.VERCEL_ENV==='production'||!env.SABRE_USERNAME||!env.SABRE_PASSWORD)return {status:'unavailable',results:[],warnings:['Sabre CERT n’est pas configuré pour cette Preview. Les partenaires affiliés restent disponibles.']};
  if(q.type!=='all'&&q.type!=='hotel')return {status:'unavailable',results:[],warnings:['Sabre recherche des hôtels. Utilise les partenaires pour les autres hébergements.']};
  const base=env.SABRE_API_BASE_URL||'https://api.cert.platform.sabre.com';
  if(!['https://api.cert.platform.sabre.com','https://api-crt.cert.havail.sabre.com','https://api-crt.cert.sabre.com'].includes(base))throw Error('Configuration Sabre CERT invalide.');
  let center={lat:numeric(q.lat),lon:numeric(q.lon)};
  if(center.lat===null||center.lon===null){
   const r=await fetcher('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(q.destination.split(',')[0].trim())+'&count=1&language=fr&format=json',{signal:AbortSignal.timeout(8000)});
   if(!r.ok)throw Error('Localisation indisponible.');const location=(await r.json()).results?.[0];if(!location)throw Error('Destination introuvable.');center={lat:location.latitude,lon:location.longitude};
  }
  if(Math.abs(center.lat)>90||Math.abs(center.lon)>180)throw Error('Coordonnées invalides.');
  if(q.guests%q.rooms)return {status:'unavailable',results:[],warnings:['Sabre exige actuellement le même nombre d’adultes par chambre. Ajuste les voyageurs/chambres ou utilise les partenaires.']};
  if(q.offset!==undefined&&(!Number.isInteger(q.offset)||q.offset<1||q.offset>1000))throw Error('Pagination invalide.');
  const payload=request(q,center);
  let token=await accessToken(env,fetcher,base);
  let response=await fetcher(base+'/v5/get/hotelavail',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
  if(response.status===401){token=await accessToken(env,fetcher,base,true);response=await fetcher(base+'/v5/get/hotelavail',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});}
  if(!response.ok)throw Error('Disponibilité Sabre CERT refusée (HTTP '+response.status+').');
  const data=await response.json(),result=data.GetHotelAvailRS;
  if(result?.ApplicationResults?.status!=='Complete')throw Error('Sabre n’a pas confirmé la recherche.');
  const rows=array(result.HotelAvailInfos?.HotelAvailInfo),seen=new Set();
  const results=rows.map(row=>normalize(row,center)).filter(r=>{if(!r.id||!r.name||seen.has(r.id))return false;seen.add(r.id);return true;});
  const offset=Number(result.HotelAvailInfos?.OffSet)||q.offset||1,total=numeric(result.HotelAvailInfos?.MaxSearchResults);
  const nextOffset=rows.length===40&&total!==null&&offset*40<total?offset+1:null;
  return {status:results.length?'ok':'empty',results,supplierCount:rows.length,nextOffset,total,environment:'cert',bookingAvailable:false,warnings:['Environnement Sabre CERT : tarifs de test, aucun achat ni réservation possible dans MyEvent.','Tarifs pour le séjour ; taxes et frais selon les informations du fournisseur. Les liens affiliés effectuent une recherche séparée.']};
 }};
}
module.exports={createSabreProvider,normalize,request,accessToken};
