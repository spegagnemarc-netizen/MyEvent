(function(root){
  'use strict';
  async function fetchInformation(website,{signal,catalog,identity}={}){
    if(catalog?.information)return catalog.information;
    if(!website)return {status:'unavailable',opening_hours:[],prices:[],menus:[],booking_links:[],sources:[],checked_at:null,notice:'Information non disponible : site officiel non renseigné.'};
    const response=await fetch('/api/integration-venues?mode=restaurant-information',{
      method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({url:website,venue:identity}),signal
    });
    if(!response.ok)throw Error('Information non disponible');
    return response.json();
  }
  // Shared bounded scheduler: list hydration and detailed sheets reuse the same request.
  const cache=new Map(),pending=new Map(),queue=[];let active=0;
  function drain(){while(active<2&&queue.length){active++;const job=queue.shift();job().finally(()=>{active--;drain();});}}
  async function load(website,{signal,catalog,venue,identity}={}){
    if(venue)return enrich(venue);
    if(catalog?.information)return catalog.information;
    if(!website)return fetchInformation(null);
    let key;try{const u=new URL(website);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error();u.hash='';key=u.href+'|'+JSON.stringify(identity||{});}catch{return fetchInformation(null);}
    const hit=cache.get(key);if(hit&&hit.expires>Date.now())return hit.value;
    // Caller cancellation must not abort a request shared by other visible cards.
    if(!pending.has(key)){
      if(pending.size>=20)return {status:'unavailable',notice:'Consultation différée : limite atteinte.'};
      const promise=new Promise(resolve=>{queue.push(async()=>{
        let value;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
        try{value=await fetchInformation(website,{signal:controller.signal,identity});}catch{value={status:'unavailable',sources:[],warnings:[],notice:'Source indisponible ; données de recherche conservées.'};}finally{clearTimeout(timer);}
        if(cache.size>=100)cache.delete(cache.keys().next().value);
        cache.set(key,{value,expires:Date.now()+(value.status==='available'?6*3600000:5*60000)});pending.delete(key);resolve(value);
      });drain();});pending.set(key,promise);
    }
    return pending.get(key);
  }
  const discoveryPending=new Map();
  const storageKey='orevami-restaurant-discovery-v4';
  function readStored(){try{const raw=root.localStorage?.getItem(storageKey);return raw&&raw.length<1000000?JSON.parse(raw):{};}catch{return {};}}
  async function enrich(venue){
    if(!venue||typeof venue.name!=='string'||!Number.isFinite(venue.lat)||!Number.isFinite(venue.lon))return load(venue?.website,{catalog:venue?.restaurant_catalog});
    const key=JSON.stringify([venue.name,venue.lat,venue.lon,venue.address||'',venue.city||'',venue.website||'']);
    const stored=readStored(),hit=stored[key];if(hit&&Number.isFinite(hit.expires)&&hit.expires>Date.now())return hit.value;
    if(discoveryPending.has(key))return discoveryPending.get(key);
    if(discoveryPending.size>=2)return load(venue.website,{catalog:venue.restaurant_catalog});
    const task=(async()=>{let discovery={photos:[],sources:[]};const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
      try{const r=await fetch('/api/integration-venues?mode=restaurant-discovery',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:venue.name,lat:venue.lat,lon:venue.lon}),signal:controller.signal});if(r.ok)discovery=await r.json();}catch{}finally{clearTimeout(timer);}
      const website=venue.website||discovery.website;
      const checked=await load(website,{catalog:venue.restaurant_catalog?.website_verified===true?venue.restaurant_catalog:null,identity:venue});
      const base=venue.restaurant_catalog?.information?{...venue.restaurant_catalog.information,website_verified:checked.website_verified}:checked;
      const verified=venue.website_verified===true&&venue.website===website||venue.restaurant_catalog?.website_verified===true&&!!venue.restaurant_catalog?.information?.website&&venue.restaurant_catalog.information.website===website||base.website_verified===true;
      const value={...base,website:verified?website:null,website_verified:verified,authorized_photos:(discovery.photos||[]).filter(p=>root.MyEventPlaceCard?.photoAllowed(p)),sources:[...(base.sources||[]),...(discovery.sources||[])]};
      // Cache successful, sourced facts for 6 h, including provenance. Negative results 5 min.
      if(value.authorized_photos.length)value.status='available';
      const current=readStored();current[key]={value,expires:Date.now()+(value.status==='available'?21600000:300000)};
      try{const rows=Object.entries(current).filter(([,v])=>v.expires>Date.now()).slice(-100);root.localStorage?.setItem(storageKey,JSON.stringify(Object.fromEntries(rows)));}catch{}
      return value;
    })().finally(()=>discoveryPending.delete(key));discoveryPending.set(key,task);return task;
  }
  function applyInformation(venue,info){
    if(info.status!=='available')return venue;
    return {...venue,website:info.website_verified===true?info.website:venue.restaurant_catalog?.information?.website||null,website_verified:info.website_verified===true,authorized_photos:info.authorized_photos?.length?info.authorized_photos:venue.authorized_photos,restaurant_information:info,sources:info.sources||venue.sources,
      phone:venue.phone||info.phone||null,
      opening_hours:(info.opening_hours||[]).map(h=>h.heading+' : '+h.text).join(' · ')||venue.opening_hours,
      prices:(info.prices||[]).map(p=>p.text).join(' · ')||venue.prices,
      menu_url:info.menus?.[0]?.url||venue.menu_url,
      booking_url:info.booking_links?.[0]?.url||venue.booking_url,booking_verified:false};
  }
  let observed=0;
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
    for(const entry of entries){if(!entry.isIntersecting)continue;const button=entry.target;observer.unobserve(button);if(observed>=12)continue;observed++;
      let venue;try{venue=JSON.parse(button.dataset.restaurantDetails);}catch{continue;}
      enrich(venue).then(info=>{if(!button.isConnected)return;const updated=applyInformation(venue,info);const cardNode=button.closest('.restaurantMini');if(updated.website&&root.MyEventPlaceCard?.websiteAllowed(updated)&&!cardNode?.querySelector('[data-restaurant-website]')){const a=document.createElement('a');a.dataset.restaurantWebsite='';a.textContent='Site web ↗';a.href=updated.website;a.target='_blank';a.rel='noopener noreferrer';cardNode?.querySelector('.restaurantMiniActions')?.append(a);}button.dataset.restaurantDetails=JSON.stringify(updated);const card=button.closest('.restaurantMini');const cover=card?.querySelector('.restaurantMiniCover');const photo=updated.authorized_photos?.find(p=>root.MyEventPlaceCard?.photoAllowed(p));if(photo&&cover){const image=document.createElement('img');image.src=photo.url;image.alt=photo.alt||venue.name;image.loading='lazy';const credit=document.createElement('small');credit.textContent=photo.credit+' · '+photo.changes;cover.replaceChildren(image,credit);const links=document.createElement('div');for(const [label,url] of [['Source photo',photo.source_url],[photo.license||'Licence',photo.license_url]]){const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}card.append(links);}});
    }
  },{rootMargin:'100px'}):null;
  function observe(){const list=document.getElementById('outingResults');if(!list)return;observed=0;for(const button of list.querySelectorAll('.restaurantMiniOpenButton'))observer?.observe(button);}
  // Observe result replacements, not the whole page or unrelated providers.
  function start(){const list=document.getElementById('outingResults');if(!list)return;new MutationObserver(observe).observe(list,{childList:true});observe();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  document.addEventListener('toggle',async event=>{
    const accordion=event.target;if(!accordion.matches?.('[data-restaurant-accordion]')||!accordion.open||accordion.dataset.loaded)return;
    accordion.dataset.loaded='loading';const body=accordion.querySelector('.restaurantAccordionBody'),status=document.createElement('p');status.textContent='Chargement des informations…';body.append(status);
    try{
      const venue=JSON.parse(accordion.dataset.restaurantAccordion),info=await load(venue.website,{catalog:venue.restaurant_catalog});
      const fragment=document.createDocumentFragment(),line=text=>{const p=document.createElement('p');p.textContent=text;fragment.append(p);};
      const link=(label,value)=>{let u;try{u=new URL(value);}catch{return;}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return;const p=document.createElement('p'),a=document.createElement('a');a.textContent=label;a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';p.append(a);fragment.append(p);};
      line('Horaires : '+((info.opening_hours||[]).map(h=>h.heading+' : '+h.text).join(' · ')||'Information non disponible'));
      line('Tarifs : '+((info.prices||[]).map(p=>p.text).join(' · ')||'Information non disponible'));
      if(!info.menus?.length)line('Menu : Information non disponible');
      for(const m of info.menus||[])link(m.label||'Carte / menu',m.url);
      if(!info.booking_links?.length)line('Réservation : Information non disponible');
      for(const b of info.booking_links||[])link('Consulter la réservation · site déclaré',b.url);
      line(info.notice||'Aucune disponibilité ni réservation confirmée.');
      for(const warning of info.warnings||[])line('À confirmer : '+warning);
      for(const source of info.sources||[]){link(source.type||'Source',source.url);const date=Date.parse(source.checked_at);line('Consulté : '+(Number.isFinite(date)?new Date(date).toLocaleDateString('fr-FR'):'date non disponible'));}
      const actions=[...body.querySelectorAll('[data-restaurant-details]')];body.replaceChildren(fragment,...actions);accordion.dataset.loaded='true';
    }catch{status.textContent='Information non disponible. Les liens existants restent accessibles.';delete accordion.dataset.loaded;}
  },true);
  let sheet;
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-restaurant-details]');
    if(!button||!root.OrevamiVenueSheet)return;
    try{
      const venue=JSON.parse(button.dataset.restaurantDetails);
      if(!sheet)sheet=root.OrevamiVenueSheet.create({host:document.body,readOnly:true});
      sheet.open(venue);
    }catch{button.textContent='Information non disponible';}
  });
  root.OrevamiRestaurantInformation=Object.freeze({load,enrich,applyInformation});
})(window);
