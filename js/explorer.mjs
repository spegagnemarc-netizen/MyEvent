const $=id=>document.getElementById(id),api=window.MyEventReservationLink,personal=window.MyEventPersonalReservations;
const labels={restaurant:'Restaurants',accommodation:'Hébergements',transport:'Transports',activity:'Activités et loisirs',ticket:'Spectacles et billetterie',nearby:'Autour de moi'};
let client,account,store,rows=[],events=[],editing=null,map,layer,category='accommodation',generation=0;
const releases=new Set();
function clear(){generation++;rows=[];events=[];editing=null;for(const release of releases)release();releases.clear();$('bookings').replaceChildren();$('bookingDialog').close();$('bookingForm').reset();}
function error(e){$('account').textContent=e.message||String(e);}
function element(tag,text){const el=document.createElement(tag);el.textContent=text;return el;}
function button(text,fn){const b=element('button',text);b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){error(e);}finally{b.disabled=false;}};return b;}
async function load(){
 const current=account?.id,run=++generation;if(!current)return;
 const [bookings,eventResult]=await Promise.all([store.list(),client.from('events').select('id,name,creator_id')]);
 if(account?.id!==current||run!==generation)return;
 if(eventResult.error)throw eventResult.error;
 const managed=[];
 for(const event of eventResult.data||[]){if(event.creator_id===current)managed.push(event);else {const r=await client.from('event_members').select('role').eq('event_id',event.id).eq('user_id',current).maybeSingle();if(r.data?.role==='coorganizer')managed.push(event);}}
 if(account?.id!==current||run!==generation)return;rows=bookings;events=managed;render();
}
function render(){
 const host=$('bookings');host.replaceChildren();if(!rows.length)host.append(element('p','Aucune réservation personnelle.'));
 for(const row of rows){const d=row.details,card=element('article','');card.append(element('h3',d.name),element('p',`${labels[row.kind]} · ${d.destination} · ${d.checkin||d.departure||''}`),element('p',d.reservation_status==='confirmed'?'Réservation confirmée (déclarée par vous)':'Ajouté · réservation à vérifier'));
  const link=element('a','Ouvrir le lien original');try{api.url(d.original_url);link.href=d.original_url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);}catch(_){}
  card.append(element('p',row.event_id?'Partagée avec un événement · lien, informations et justificatif visibles par ses membres.':'Personnelle · visible uniquement par toi.'));
  const actions=element('div','');actions.className='actions';actions.append(button('Modifier',()=>open(row)));
  if(d.proof)actions.append(button('Télécharger le justificatif',async()=>{
   const uid=account?.id;if(!uid)throw Error('Connexion requise.');const r=await client.from('personal_reservations').select('details').eq('id',row.id).eq('owner_id',uid).single();if(r.error||account?.id!==uid)throw Error('Justificatif inaccessible.');const p=r.data.details.proof;
   if(!p||!['application/pdf','image/jpeg','image/png'].includes(p.type)||p.base64.length>280000)throw Error('Justificatif invalide.');
   const href=URL.createObjectURL(new Blob([Uint8Array.from(atob(p.base64),c=>c.charCodeAt(0))],{type:p.type})),a=element('a','Enregistrer le justificatif');a.href=href;a.download=p.name.replace(/[^\p{L}\p{N}._ -]/gu,'_');actions.append(a);a.onclick=e=>{if(account?.id!==uid)e.preventDefault();};a.click();const release=()=>{URL.revokeObjectURL(href);a.remove();releases.delete(release);};releases.add(release);setTimeout(release,60000);
  }));
  card.append(actions);
  if(row.event_id)card.append(button('Retirer de l’événement',async()=>{await store.attach(row.id,null);await load();}));
  else if(events.length){const select=element('select','');select.setAttribute('aria-label','Événement pour '+d.name);select.append(new Option('Choisir un événement',''));for(const e of events)select.append(new Option(e.name,e.id));card.append(select,button('Partager avec cet événement',async()=>{if(!select.value)throw Error('Choisis un événement.');await store.attach(row.id,select.value);await load();}));}
  host.append(card);
 }
}
function open(row=null){
 if(!account){error(Error('Connecte-toi dans MyEvent pour enregistrer tes réservations.'));return;}
 editing=row;$('bookingForm').reset();$('formNotice').textContent='';$('existingProof').textContent=row?.details.proof?'Justificatif conservé : '+row.details.proof.name:'';
 const f=$('bookingForm').elements,d=row?.details;
 if(d){for(const key of ['original_url','name','destination','from','reference','note','address'])f.namedItem(key).value=d[key]||'';f.kind.value=row.kind;f.start.value=(d.checkin||d.departure||'').slice(0,10);f.end.value=(d.checkout||d.arrival||'').slice(0,10);f.travelers.value=d.people_count||'';f.status.value=d.reservation_status;f.confirmed_by_user.checked=d.confirmation_source==='user_declared';if(api.reliableGeo(d.geo)){f.lat.value=d.geo.lat;f.lon.value=d.geo.lon;f.geo_verified.checked=true;}}
 else if(category!=='nearby')f.kind.value=category;
 $('formTitle').textContent=row?'Modifier ma réservation':'Ajouter une réservation';$('bookingDialog').showModal();
}
$('add').onclick=()=>open();$('cancel').onclick=()=>{$('bookingDialog').close();editing=null;};
$('extract').onclick=()=>{try{const f=$('bookingForm').elements,d=api.extract(f.original_url.value.trim());for(const key of ['name','destination','from','start','end','travelers'])f.namedItem(key).value=d[key]||'';if(['Hotels.com','Expedia','Abritel','Omio'].includes(d.provider)||['transport','accommodation'].includes(f.kind.value))f.kind.value=d.kind;$('provider').textContent=`${d.provider} · seules les informations présentes dans le lien sont reprises.`;}catch(e){$('formNotice').textContent=e.message;}};
$('bookingForm').onsubmit=async e=>{
 e.preventDefault();const uid=account?.id;if(!uid)return;const f=e.target.elements,id=editing?.id,old=editing?.details;$('save').disabled=true;
 try{if(!f.consent.checked)throw Error('Confirme les informations.');const input=Object.fromEntries(new FormData(e.target));input.geo_verified=f.geo_verified.checked;input.confirmed_by_user=f.confirmed_by_user.checked;input.kind=f.kind.value==='transport'?'transport':'accommodation';
  // Date-only edits preserve previously entered times unless that date was changed.
  for(const [key,value] of [['start',old?.checkin||old?.departure],['end',old?.checkout||old?.arrival]])if(value?.includes('T')&&value.slice(0,10)===input[key])input[key]=value;
  input.photo=old?.photo||'';const details=api.payload(input);details.proof=f.remove_proof.checked?null:await personal.proof(f.proof.files[0])||old?.proof||null;
  if(account?.id!==uid)throw Error('Le compte a changé.');await store.save(f.kind.value,details,id);if(account?.id!==uid)return;$('bookingDialog').close();editing=null;await load();
 }catch(e){$('formNotice').textContent=e.message;}finally{$('save').disabled=false;}
};
const frames=new Map();
for(const b of document.querySelectorAll('[data-category]'))b.onclick=()=>{
 category=b.dataset.category;for(const other of document.querySelectorAll('[data-category]'))other.setAttribute('aria-pressed',String(other===b));$('search').hidden=false;$('categoryTitle').textContent=labels[category];
 $('nearbyControls').hidden=['accommodation','transport','ticket'].includes(category);$('partnerHost').hidden=!$('nearbyControls').hidden;
 for(const frame of frames.values())frame.hidden=true;
 if($('nearbyControls').hidden){if(!frames.has(category)){const frame=document.createElement('iframe');frame.title=labels[category]+' · partenaires';frame.src='explorer-partners.html?kind='+category;$('partnerHost').append(frame);frames.set(category,frame);}frames.get(category).hidden=false;}
 $('search').scrollIntoView({behavior:'smooth'});
};
let searchRun=0;
$('locate').onclick=async()=>{
 const run=++searchRun,mode=category,requested=Number($('radius').value);$('locate').disabled=true;$('searchNotice').textContent='Recherche de ta position…';$('places').replaceChildren();if(layer)layer.clearLayers();
 try{const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{timeout:15000,maximumAge:60000})),lat=pos.coords.latitude,lon=pos.coords.longitude;
  let partnerFallback=false;async function query(radius){const r=await fetch(`/api/search-places?mode=${mode==='activity'?'viator':'nearby'}&lat=${lat}&lon=${lon}&radius=${radius}`,{credentials:'same-origin',signal:AbortSignal.timeout(25000)});const d=await r.json();if(!r.ok)throw Error(d.error||'Recherche indisponible.');partnerFallback=!!d.fallbackUsed;return (d.results||[]).filter(p=>p.lat!=null&&p.lon!=null&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&(mode!=='restaurant'||/restaurant|cafe|fast_food/i.test(p.type||p.category||'')));}
  let radius=requested,places=await query(radius);if(!places.length&&radius<20){radius=Math.min(20,radius*2);places=await query(radius);}if(run!==searchRun||mode!==category)return;
  if(!map){$('explorerMap').hidden=false;map=L.map('explorerMap');L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);layer=L.layerGroup().addTo(map);}map.setView([lat,lon],13);map.invalidateSize();layer.clearLayers();
  $('searchNotice').textContent=`${places.length} résultat(s) · rayon demandé ${radius} km${radius!==requested||partnerFallback?' · recherche élargie : certains résultats peuvent être hors du rayon initial':''}. Distances à vol d’oiseau, pas des distances routières.`;
  for(const p of places){const a=Number(p.lat),o=Number(p.lon);if(Math.abs(a)>90||Math.abs(o)>180)continue;const card=element('article','');card.append(element('h3',p.name||'Lieu'),element('p',p.address||''));const r=Math.PI/180,x=(a-lat)*r,y=(o-lon)*r,k=Math.sin(x/2)**2+Math.cos(lat*r)*Math.cos(a*r)*Math.sin(y/2)**2,distance=6371*2*Math.asin(Math.sqrt(Math.min(1,k)));card.append(element('p',p.locationApproximate?'Localisation indicative du secteur · aucun repère exact sur la carte.':distance.toFixed(1)+' km à vol d’oiseau'));
   if(p.website){try{api.url(p.website);const link=element('a',mode==='activity'?'Voir chez le partenaire':'Site du lieu · vérifier les réservations');link.href=p.website;link.target='_blank';link.rel='noopener noreferrer';card.append(link);}catch(_){}}
   if(!p.locationApproximate){const title=element('strong',p.name||'Lieu');L.marker([a,o]).addTo(layer).bindPopup(title);}card.append(button('Ajouter ma réservation',()=>{open();const f=$('bookingForm').elements;f.name.value=p.name||'';f.destination.value=p.address||p.name||'';if(p.website)try{api.url(p.website);f.original_url.value=p.website;}catch(_){}f.address.value=p.address||'';/* POI center is not a booking-confirmed location. Verification stays explicit. */}));$('places').append(card);
  }
 }catch(e){if(run===searchRun)$('searchNotice').textContent=e.message||'Position ou recherche indisponible.';}finally{if(run===searchRun)$('locate').disabled=false;}
};
try{const config=await window.myeventRuntime.ready;client=window.supabase.createClient(config.url,config.publishableKey,{auth:{storageKey:config.authStorageKey}});async function session(next){if(account?.id!==next?.id)clear();account=next;store=account?personal.create(client,account.id):null;$('account').textContent=account?'Connecté · tes réservations sont privées jusqu’au partage.':'Recherche libre. Connecte-toi dans MyEvent pour enregistrer une réservation.';if(account)await load().catch(error);}
 const auth=await client.auth.getUser();await session(auth.data.user);client.auth.onAuthStateChange((_event,s)=>{setTimeout(()=>session(s?.user).catch(error),0);});
}catch(e){error(e);$('add').disabled=true;}
