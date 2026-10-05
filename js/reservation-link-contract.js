(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MyEventReservationLink=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const providers=[['Hotels.com',['hotels.com']],['Expedia',['expedia.fr','expedia.com','expedia.co.uk']],['Abritel',['abritel.fr','vrbo.com']],['Omio',['omio.fr','omio.com']]];
  function url(value){
    if(typeof value!=='string'||value.length>8192||/[\u0000-\u0020\u007f\\]/.test(value))throw Error('Colle un lien HTTPS complet, sans espaces.');
    let u;try{u=new URL(value);}catch(_){throw Error('Ce lien n’est pas une URL valide.');}
    const host=u.hostname.toLowerCase().replace(/\.$/,'');
    if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443'))throw Error('Utilise un lien HTTPS sans identifiants ni port personnalisé.');
    if(!host.includes('.')||host.includes(':')||/^[\d.]+$/.test(host)||/(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host)||host.endsWith('.localdomain'))throw Error('Les adresses locales et les adresses IP ne sont pas acceptées.');
    return u;
  }
  function date(v){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return '';
    const [y,m,d]=v.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d));
    return y>=1900&&y<=2200&&dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d?v:'';
  }
  function dateTime(v){if(date(v))return v;if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v||''))return '';return date(v.slice(0,10))&&+v.slice(11,13)<24&&+v.slice(14,16)<60?v:'';}
  function extract(original){
    const u=url(original),host=u.hostname.toLowerCase().replace(/\.$/,'');
    const provider=providers.find(([,domains])=>domains.some(d=>host===d||host.endsWith('.'+d)))?.[0]||host;
    const known=providers.some(([name])=>name===provider),p=u.searchParams;
    const text=(keys)=>known?keys.map(k=>p.get(k)).find(v=>v&&v.length<=250)||'':'';
    const day=keys=>date(text(keys));
    const count=text(['adults','guests','travelers']),travelers=/^[1-9]\d?$/.test(count)?count:'';
    let start=day(['checkin','checkIn','chkin','startDate','d1','departureDate']),end=day(['checkout','checkOut','chkout','endDate','d2','returnDate']);
    if(start&&end&&end<start)end='';
    // latLong belongs to the search area. It is never a property location.
    return {original_url:original,provider,kind:provider==='Omio'||/\/Flights-Search/i.test(u.pathname)?'transport':'accommodation',name:text(['hotelName','propertyName']),destination:text(['destination','to']),from:text(['origin','from']),start,end,travelers,address:'',photo:'',geo:null,status:'added',reference:'',provenance:'url_parameters'};
  }
  function geo(lat,lon,verified,address){
    if(!verified||!address?.trim()||lat===''||lon===''||lat==null||lon==null)return null;
    const a=Number(lat),b=Number(lon);
    if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a)>90||Math.abs(b)>180)throw Error('Les coordonnées sont hors limites.');
    return {lat:a,lon:b,source:'user_verified'};
  }
  function reliableGeo(value){return !!value&&value.source==='user_verified'&&typeof value.lat==='number'&&typeof value.lon==='number'&&Number.isFinite(value.lat)&&Number.isFinite(value.lon)&&Math.abs(value.lat)<=90&&Math.abs(value.lon)<=180;}
  function payload(input){
    const original_url=String(input.original_url||'').trim(),detected=extract(original_url);
    const trim=(key,max=500)=>String(input[key]||'').trim().slice(0,max);
    const kind=input.kind==='transport'?'transport':'accommodation',name=trim('name',250),destination=trim('destination',250),from=trim('from',250);
    if(!name||!destination)throw Error('Renseigne le nom et la destination.');
    const start=dateTime(input.start),end=dateTime(input.end);
    if(!start||input.end&&!end||end&&(end.slice(0,10)<start.slice(0,10)||end.slice(0,10)===start.slice(0,10)&&end.includes('T')&&start.includes('T')&&end<start))throw Error('Vérifie les dates et leur ordre.');
    if(kind==='transport'&&!from)throw Error('Renseigne le lieu de départ.');
    const people=String(input.travelers||'').trim();if(people&&!/^[1-9]\d?$/.test(people))throw Error('Indique entre 1 et 99 voyageurs.');
    if(input.photo)url(input.photo);
    const address=trim('address'),coordinates=geo(input.lat,input.lon,input.geo_verified,address);
    if(input.geo_verified&&!coordinates)throw Error('Renseigne l’adresse exacte et les deux coordonnées vérifiées.');
    const status=input.status==='confirmed'?'confirmed':'added';
    if(status==='confirmed'&&!input.confirmed_by_user)throw Error('Confirme que tu as réellement réservé auprès du prestataire.');
    const booking={link_import:true,original_url,provider:detected.provider,reservation_status:status,confirmation_source:status==='confirmed'?'user_declared':null,reference:trim('reference',100),destination,address,photo:trim('photo',8192),geo:coordinates,name,title:name,people:people?people+' voyageur(s)':'',people_count:people?Number(people):null,booking:original_url,note:trim('note',1500)};
    return kind==='accommodation'?{...booking,type:'other',checkin:start,checkout:end,total_cost:0}:{...booking,type:'other',from,to:destination,departure:start,arrival:end,cost:0};
  }
  function statusLabel(value,kind){return value.reservation_status==='confirmed'?'Réservation confirmée (déclarée par vous)':({transport:'Transport ajouté',restaurant:'Restaurant ajouté',activity:'Activité ajoutée',ticket:'Billet ajouté'}[value._kind||kind]||'Hébergement ajouté')+' · réservation à vérifier';}
  return {url,date,dateTime,extract,payload,geo,reliableGeo,statusLabel};
});
