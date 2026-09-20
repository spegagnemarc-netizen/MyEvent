/* ===== original inline script 18 ===== */
/* V58.2 — Transport partagé, intégré au planning de l’événement. */
const V58_TRANSPORT_MARKER='[[MYEVENT_TRANSPORT]]';
function v58TransportLabel(type){
  const map={car:'🚗 Voiture',carpool:'👥 Covoiturage',train:'🚆 Train',plane:'✈️ Avion',bus:'🚌 Bus',taxi:'🚕 Taxi / VTC',transfer:'🚐 Transfert',other:'🧭 Autre'};
  return map[String(type||'other').toLowerCase()]||map.other;
}
function v58TransportEsc(v){return esc(v??'');}
async function getEventTransports(eventId){
  if(!eventId)return [];
  try{
    const r=await sb.from('messages').select('id,content,created_at,user_id').eq('event_id',eventId).like('content',V58_TRANSPORT_MARKER+'%').order('created_at',{ascending:true});
    if(r.error)return [];
    return (r.data||[]).map(m=>{
      try{return {...JSON.parse(String(m.content).slice(V58_TRANSPORT_MARKER.length)),_message_id:m.id,_created_at:m.created_at,_user_id:m.user_id};}catch(_){return null;}
    }).filter(Boolean);
  }catch(_){return []}
}
async function renderEventTransport(box,eventObj){
  if(!box||!eventObj)return;
  const old=box.querySelector('#eventTransport'); if(old)old.remove();
  const wrap=document.createElement('div'); wrap.className='inlineEventTransport'; wrap.id='eventTransport';
  wrap.innerHTML='<div class="inlineEventTransportTitle">🚗 Transport</div>'+
    '<div class="inlineEventTransportSub">Ajoute les trajets nécessaires : départ, arrivée, horaires, participants, coût et réservation. Chaque trajet devient une étape du planning.</div>'+
    '<div class="inlineEventTransportList" id="eventTransportList"></div>'+
    '<div class="inlineEventTransportActions"><button type="button" class="secondary" id="eventTransportAddBtn">➕ Ajouter un trajet</button></div>'+
    '<div class="inlineEventTransportForm" id="eventTransportForm" style="display:none">'+
      '<label>Type<select id="eventTransportType"><option value="car">🚗 Voiture</option><option value="carpool">👥 Covoiturage</option><option value="train">🚆 Train</option><option value="plane">✈️ Avion</option><option value="bus">🚌 Bus</option><option value="taxi">🚕 Taxi / VTC</option><option value="transfer">🚐 Transfert</option><option value="other">🧭 Autre</option></select></label>'+
      '<label>Départ<input id="eventTransportFrom" placeholder="Ex. Paris Gare de Lyon"></label>'+
      '<label>Destination<input id="eventTransportTo" placeholder="Ex. Lyon Part-Dieu"></label>'+
      '<label>Départ — date et heure<input type="datetime-local" id="eventTransportDeparture"></label>'+
      '<label>Arrivée — date et heure<input type="datetime-local" id="eventTransportArrival"></label>'+
      '<label>Participants / conducteur<input id="eventTransportPeople" placeholder="Ex. Marc, Julie + 3 passagers"></label>'+
      '<label>Coût total (€)<input type="number" min="0" step="0.01" id="eventTransportCost" inputmode="decimal" placeholder="0"></label>'+
      '<label>Réservation / référence<input id="eventTransportBooking" placeholder="Ex. SNCF 8F3K2 ou lien de réservation"></label>'+
      '<label>Note<textarea id="eventTransportNote" rows="2" placeholder="Ex. billets à récupérer, bagages, heure de rendez-vous…"></textarea></label>'+
      '<div class="inlineEventTransportActions"><button type="button" class="secondary" id="eventTransportSaveBtn">💾 Ajouter au planning</button><button type="button" class="secondary" id="eventTransportCancelBtn">Annuler</button></div>'+
    '</div>';
  box.appendChild(wrap);
  const list=wrap.querySelector('#eventTransportList');
  const transports=await getEventTransports(eventObj.id);
  if(!transports.length){list.innerHTML='<div class="inlineEventTransportEmpty">Aucun transport n’est encore défini.</div>'}
  else{
    list.innerHTML=transports.map((t,i)=>{
      const dep=t.departure?new Date(t.departure):null, arr=t.arrival?new Date(t.arrival):null;
      const fmt=d=>d&&!Number.isNaN(d.getTime())?d.toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';
      const route=[t.from,t.to].filter(Boolean).join(' → ');
      const schedule=[dep&&fmt(dep)?'🕐 Départ '+fmt(dep):'',arr&&fmt(arr)?'Arrivée '+fmt(arr):''].filter(Boolean).join(' · ');
      const cost=Number.isFinite(Number(t.cost))&&Number(t.cost)>0?' · 💶 '+eur(Number(t.cost)):'';
      return '<div class="inlineEventTransportItem"><div class="inlineEventTransportHead"><div class="inlineEventTransportName">'+v58TransportEsc(v58TransportLabel(t.type))+(route?' · '+v58TransportEsc(route):'')+'</div></div>'+
        (schedule||t.people||cost?'<div class="inlineEventTransportMeta">'+v58TransportEsc([schedule,t.people?'👥 '+t.people:'',cost].filter(Boolean).join(' · '))+'</div>':'')+
        (t.booking?'<div class="inlineEventTransportMeta">🎫 '+v58TransportEsc(t.booking)+'</div>':'')+
        (t.note?'<div class="inlineEventTransportMeta">📝 '+v58TransportEsc(t.note)+'</div>':'')+'<div class="inlineEventTransportActions"><button type="button" class="secondary" data-v58-edit-transport="'+i+'">✏️ Modifier</button><button type="button" class="secondary" data-v58-delete-transport="'+i+'">🗑️ Supprimer</button></div></div>';
    }).join('');
  }
  const form=wrap.querySelector('#eventTransportForm');
  const fillTransportForm=(t)=>{
    $('eventTransportType').value=t.type||'other';$('eventTransportFrom').value=t.from||'';$('eventTransportTo').value=t.to||'';
    $('eventTransportDeparture').value=t.departure?String(t.departure).slice(0,16):'';$('eventTransportArrival').value=t.arrival?String(t.arrival).slice(0,16):'';
    $('eventTransportPeople').value=t.people||'';$('eventTransportCost').value=Number(t.cost||0)||'';$('eventTransportBooking').value=t.booking||'';$('eventTransportNote').value=t.note||'';
    form.style.display='grid';form.dataset.editId=t._message_id||'';form.dataset.editIndex='';wrap.querySelector('#eventTransportSaveBtn').textContent='💾 Enregistrer les modifications';$('eventTransportFrom')?.focus();
  };
  wrap.querySelectorAll('[data-v58-edit-transport]').forEach(b=>b.addEventListener('click',()=>fillTransportForm(transports[Number(b.dataset.v58EditTransport)])));
  wrap.querySelectorAll('[data-v58-delete-transport]').forEach(b=>b.addEventListener('click',async()=>{
    const t=transports[Number(b.dataset.v58DeleteTransport)];if(!t?._message_id)return;
    if(!user||eventObj.creator_id!==user.id){alert('Seul l’organisateur peut supprimer un transport.');return;}
    if(!confirm('Supprimer ce trajet du planning ?'))return;
    const r=await sb.from('messages').delete().eq('id',t._message_id);if(r.error){alert('Impossible de supprimer le trajet : '+r.error.message);return;}
    await renderEventTransport(box,eventObj);const oldTimeline=box.querySelector('#eventPlanningTimeline');if(oldTimeline)oldTimeline.remove();try{await renderEventPlanningTimeline(box,eventObj,'manual',null,null,[])}catch(_){ }
  }));
  wrap.querySelector('#eventTransportAddBtn').addEventListener('click',()=>{form.style.display='grid';wrap.querySelector('#eventTransportFrom')?.focus()});
  wrap.querySelector('#eventTransportCancelBtn').addEventListener('click',()=>{form.style.display='none'});
  wrap.querySelector('#eventTransportSaveBtn').addEventListener('click',async()=>{
    if(!user||eventObj.creator_id!==user.id){alert('Seul l’organisateur peut ajouter un transport au planning.');return}
    const from=$('eventTransportFrom')?.value.trim()||'',to=$('eventTransportTo')?.value.trim()||'';
    const departure=$('eventTransportDeparture')?.value||'',arrival=$('eventTransportArrival')?.value||'';
    if(!from||!to||!departure){alert('Indique au minimum le départ, la destination et la date/heure de départ.');return}
    const cost=Number($('eventTransportCost')?.value||0);
    const payload={type:$('eventTransportType')?.value||'other',from,to,departure,arrival,people:$('eventTransportPeople')?.value.trim()||'',cost:Number.isFinite(cost)?cost:0,booking:$('eventTransportBooking')?.value.trim()||'',note:$('eventTransportNote')?.value.trim()||'',title:(from+' → '+to).trim()};
    const btn=wrap.querySelector('#eventTransportSaveBtn'); btn.disabled=true; btn.textContent='⏳ Enregistrement…';
    try{
      const editId=form.dataset.editId||'';
      let r;
      if(editId){
        r=await sb.from('messages').update({content:V58_TRANSPORT_MARKER+JSON.stringify(payload)}).eq('id',editId).select('id').single();
      }else{
        r=await sb.from('messages').insert({event_id:eventObj.id,user_id:user.id,content:V58_TRANSPORT_MARKER+JSON.stringify(payload)}).select('id').single();
      }
      if(r.error)throw r.error;
      if(!editId)rememberLocalCreated('messages',r.data?.id);
      form.dataset.editId='';btn.textContent='💾 Ajouter au planning';
      await renderEventTransport(box,eventObj);
      const oldTimeline=box.querySelector('#eventPlanningTimeline');
      if(oldTimeline)oldTimeline.remove();
      try{await renderEventPlanningTimeline(box,eventObj,'manual',null,null,[])}catch(_){ }
    }catch(e){alert('Impossible d’ajouter le transport : '+(e.message||String(e)));btn.disabled=false;btn.textContent='💾 Ajouter au planning';}
  });
}

/* ===== original inline script 19 ===== */
/* V58.4 — Déplacements locaux entre les étapes du planning. */
/* V54.43 — calcul automatique des déplacements entre les étapes + correction du chargement des listes. */
const V58_LOCAL_TRAVEL_MARKER='[[MYEVENT_LOCAL_TRAVEL]]';
function v58LocalTravelModeLabel(mode){
  const map={walk:'🚶 À pied',bike:'🚲 Vélo',car:'🚗 Voiture',carpool:'👥 Covoiturage',bus:'🚌 Bus',taxi:'🚕 Taxi / VTC',transfer:'🚐 Transfert',other:'🧭 Autre'};
  return map[String(mode||'other').toLowerCase()]||map.other;
}
async function getEventLocalTravels(eventId){
  if(!eventId)return [];
  try{
    const r=await sb.from('messages').select('id,content,created_at,user_id').eq('event_id',eventId).like('content',V58_LOCAL_TRAVEL_MARKER+'%').order('created_at',{ascending:true});
    if(r.error)return [];
    return (r.data||[]).map(m=>{
      try{return {...JSON.parse(String(m.content).slice(V58_LOCAL_TRAVEL_MARKER.length)),_message_id:m.id,_created_at:m.created_at,_user_id:m.user_id};}catch(_){return null;}
    }).filter(Boolean);
  }catch(_){return []}
}
async function renderEventLocalTravel(box,eventObj,choice,outing,aiPlan,aiItems){
  if(!box||!eventObj)return;
  const old=box.querySelector('#eventLocalTravel'); if(old)old.remove();
  const wrap=document.createElement('div'); wrap.className='inlineEventLocalTravel'; wrap.id='eventLocalTravel';
  const available=[];
  if(choice==='ai'&&Array.isArray(aiItems))aiItems.forEach(x=>{if(x?.name)available.push(x.name)});
  if(choice!=='ai'&&outing?.name)available.push(outing.name);
  const travels=await getEventLocalTravels(eventObj.id);
  wrap.innerHTML=`<div class="inlineEventLocalTravelTitle">🧭 Déplacements locaux</div>
    <div class="inlineEventLocalTravelSub">Gère les trajets entre les étapes : mode, distance, durée, horaires, participants et coût. Chaque déplacement devient une étape du planning.</div>
    <div class="inlineEventLocalTravelList" id="eventLocalTravelList"></div>
    <div class="inlineEventLocalTravelActions"><button type="button" class="secondary" id="eventLocalTravelAddBtn">➕ Ajouter un déplacement</button></div>
    <div class="inlineEventLocalTravelForm" id="eventLocalTravelForm" style="display:none">
      <label>Départ<input id="eventLocalTravelFrom" list="eventLocalTravelPlaces" placeholder="Ex. Hôtel du Parc"></label>
      <label>Destination<input id="eventLocalTravelTo" list="eventLocalTravelPlaces" placeholder="Ex. La Cantina GG"></label>
      <datalist id="eventLocalTravelPlaces">${available.map(x=>'<option value="'+escAttr(x)+'"></option>').join('')}</datalist>
      <label>Mode<select id="eventLocalTravelMode"><option value="walk">🚶 À pied</option><option value="bike">🚲 Vélo</option><option value="car">🚗 Voiture</option><option value="carpool">👥 Covoiturage</option><option value="bus">🚌 Bus</option><option value="taxi">🚕 Taxi / VTC</option><option value="transfer">🚐 Transfert</option><option value="other">🧭 Autre</option></select></label>
      <label>Distance (km)<input type="number" min="0" step="0.1" id="eventLocalTravelDistance" inputmode="decimal" placeholder="Ex. 2,4"></label>
      <label>Durée estimée (minutes)<input type="number" min="1" step="1" id="eventLocalTravelDuration" inputmode="numeric" placeholder="Ex. 12"></label>
      <label>Départ — date et heure<input type="datetime-local" id="eventLocalTravelDeparture"></label>
      <label>Arrivée — date et heure<input type="datetime-local" id="eventLocalTravelArrival"></label>
      <label>Participants / conducteur<input id="eventLocalTravelPeople" placeholder="Ex. 4 personnes, Marc conducteur"></label>
      <label>Coût total (€)<input type="number" min="0" step="0.01" id="eventLocalTravelCost" inputmode="decimal" placeholder="0"></label>
      <label>Note<textarea id="eventLocalTravelNote" rows="2" placeholder="Ex. point de rendez-vous, parking…"></textarea></label>
      <div class="inlineEventLocalTravelActions"><button type="button" class="secondary" id="eventLocalTravelSaveBtn">💾 Ajouter au planning</button><button type="button" class="secondary" id="eventLocalTravelCancelBtn">Annuler</button></div>
    </div>`;
  box.appendChild(wrap);
  const list=wrap.querySelector('#eventLocalTravelList');
  if(!travels.length)list.innerHTML='<div class="inlineEventLocalTravelEmpty">Aucun déplacement local n’est encore défini.</div>';
  else list.innerHTML=travels.map(t=>'<div class="inlineEventLocalTravelItem"><div class="inlineEventLocalTravelName">'+esc([t.from,t.to].filter(Boolean).join(' → ')||'Déplacement local')+'</div><div class="inlineEventLocalTravelMeta">'+esc(v58LocalTravelModeLabel(t.mode))+(t.distance!=null&&Number(t.distance)>0?' · 📏 '+String(t.distance).replace('.',',')+' km':'')+(t.duration_minutes!=null&&Number(t.duration_minutes)>0?' · ⏱️ '+Number(t.duration_minutes)+' min':'')+(t.people?' · 👥 '+esc(t.people):'')+(Number(t.cost)>0?' · 💶 '+eur(Number(t.cost)):'')+'</div>'+(t.departure?'<div class="inlineEventLocalTravelMeta">🕐 '+esc(new Date(t.departure).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}))+(t.arrival?' → '+esc(new Date(t.arrival).toLocaleString('fr-FR',{hour:'2-digit',minute:'2-digit'})):'')+'</div>':'')+(t.note?'<div class="inlineEventLocalTravelMeta">📝 '+esc(t.note)+'</div>':'')+'</div>').join('');
  const form=wrap.querySelector('#eventLocalTravelForm');
  wrap.querySelector('#eventLocalTravelAddBtn').addEventListener('click',()=>{form.style.display='grid';wrap.querySelector('#eventLocalTravelFrom')?.focus()});
  wrap.querySelector('#eventLocalTravelCancelBtn').addEventListener('click',()=>{form.style.display='none'});
  wrap.querySelector('#eventLocalTravelSaveBtn').addEventListener('click',async()=>{
    if(!user||eventObj.creator_id!==user.id){alert('Seul l’organisateur peut ajouter un déplacement au planning.');return}
    const from=$('eventLocalTravelFrom')?.value.trim()||'',to=$('eventLocalTravelTo')?.value.trim()||'';
    const departure=$('eventLocalTravelDeparture')?.value||'',arrival=$('eventLocalTravelArrival')?.value||'';
    if(!from||!to||!departure){alert('Indique au minimum le départ, la destination et la date/heure de départ.');return}
    const distance=Number($('eventLocalTravelDistance')?.value||0),duration=Number($('eventLocalTravelDuration')?.value||0),cost=Number($('eventLocalTravelCost')?.value||0);
    const payload={from,to,mode:$('eventLocalTravelMode')?.value||'other',distance_km:Number.isFinite(distance)?distance:0,duration_minutes:Number.isFinite(duration)?duration:0,departure,arrival,people:$('eventLocalTravelPeople')?.value.trim()||'',people_count:(String($('eventLocalTravelPeople')?.value||'').match(/\d+/)?.[0]?Number(String($('eventLocalTravelPeople')?.value||'').match(/\d+/)[0]):Number(aiPlan?.people||1)),cost:Number.isFinite(cost)?cost:0,note:$('eventLocalTravelNote')?.value.trim()||'',title:(from+' → '+to).trim()};
    const btn=wrap.querySelector('#eventLocalTravelSaveBtn'); btn.disabled=true; btn.textContent='⏳ Enregistrement…';
    try{
      const r=await sb.from('messages').insert({event_id:eventObj.id,user_id:user.id,content:V58_LOCAL_TRAVEL_MARKER+JSON.stringify(payload)}).select('id').single();
      if(r.error)throw r.error;
      rememberLocalCreated('messages',r.data?.id);
      await renderEventLocalTravel(box,eventObj,choice,outing,aiPlan,aiItems);
      const oldTimeline=box.querySelector('#eventPlanningTimeline'); if(oldTimeline)oldTimeline.remove();
      try{await renderEventPlanningTimeline(box,eventObj,choice,outing,aiPlan,aiItems)}catch(_){ }
    }catch(e){alert('Impossible d’ajouter le déplacement : '+(e.message||String(e)));btn.disabled=false;btn.textContent='💾 Ajouter au planning';}
  });
}

/* ===== original inline script 20 ===== */
/* V58.3 — Hébergement partagé, intégré au planning de l’événement. */
const V58_ACCOMMODATION_MARKER='[[MYEVENT_ACCOMMODATION]]';
function v58AccommodationLabel(type){
  const map={hotel:'🏨 Hôtel',apartment:'🏠 Appartement / maison',camping:'⛺ Camping',other:'🛏️ Autre'};
  return map[String(type||'other').toLowerCase()]||map.other;
}
async function getEventAccommodations(eventId){
  if(!eventId)return [];
  try{
    const r=await sb.from('messages').select('id,content,created_at,user_id').eq('event_id',eventId).like('content',V58_ACCOMMODATION_MARKER+'%').order('created_at',{ascending:true});
    if(r.error)return [];
    return (r.data||[]).map(m=>{
      try{return {...JSON.parse(String(m.content).slice(V58_ACCOMMODATION_MARKER.length)),_message_id:m.id,_created_at:m.created_at,_user_id:m.user_id};}catch(_){return null;}
    }).filter(Boolean);
  }catch(_){return []}
}
function v58AccommodationDate(value,withTime=false){
  if(!value)return '';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return String(value);
  return d.toLocaleString('fr-FR',withTime?{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}:{day:'2-digit',month:'2-digit',year:'numeric'});
}
async function renderEventAccommodation(box,eventObj){
  if(!box||!eventObj)return;
  const old=box.querySelector('#eventAccommodation'); if(old)old.remove();
  const wrap=document.createElement('div'); wrap.className='inlineEventAccommodation'; wrap.id='eventAccommodation';
  wrap.innerHTML='<div class="inlineEventAccommodationTitle">🏨 Hébergement</div>'+
    '<div class="inlineEventAccommodationSub">Ajoute les hébergements nécessaires : dates, participants, chambres, capacité, coût, adresse et réservation. L’hébergement est intégré au planning de l’événement.</div>'+
    '<div class="inlineEventAccommodationList" id="eventAccommodationList"></div>'+
    '<div class="inlineEventAccommodationActions"><button type="button" class="secondary" id="eventAccommodationAddBtn">➕ Ajouter un hébergement</button></div>'+
    '<div class="inlineEventAccommodationForm" id="eventAccommodationForm" style="display:none">'+
      '<label>Type<select id="eventAccommodationType"><option value="hotel">🏨 Hôtel</option><option value="apartment">🏠 Appartement / maison</option><option value="camping">⛺ Camping</option><option value="other">🛏️ Autre</option></select></label>'+
      '<label>Nom de l’hébergement<input id="eventAccommodationName" placeholder="Ex. Hôtel du Parc"></label>'+
      '<label>Adresse<input id="eventAccommodationAddress" placeholder="Ex. 12 rue des Alpes, Gap"></label>'+
      '<label>Arrivée — date et heure<input type="datetime-local" id="eventAccommodationCheckin"></label>'+
      '<label>Départ — date et heure<input type="datetime-local" id="eventAccommodationCheckout"></label>'+
      '<label>Participants<input id="eventAccommodationPeople" placeholder="Ex. 10 personnes"></label>'+
      '<label>Chambres / logements<input id="eventAccommodationRooms" placeholder="Ex. 4 chambres"></label>'+
      '<label>Capacité par logement<input type="number" min="1" step="1" id="eventAccommodationCapacity" inputmode="numeric" placeholder="2"></label>'+ 
      '<label>Prix / nuit (€)<input type="number" min="0" step="0.01" id="eventAccommodationNightPrice" inputmode="decimal" placeholder="0"></label>'+ 
      '<label>Coût total (€)<input type="number" min="0" step="0.01" id="eventAccommodationTotalCost" inputmode="decimal" placeholder="0"></label>'+ 
      '<label>Réservation / référence<input id="eventAccommodationBooking" placeholder="Ex. Booking ABC123 ou lien de réservation"></label>'+ 
      '<label>Note<textarea id="eventAccommodationNote" rows="2" placeholder="Ex. petit-déjeuner, arrivée tardive, répartition des chambres…"></textarea></label>'+ 
      '<div class="inlineEventAccommodationActions"><button type="button" class="secondary" id="eventAccommodationSaveBtn">💾 Ajouter au planning</button><button type="button" class="secondary" id="eventAccommodationCancelBtn">Annuler</button></div>'+ 
    '</div>';
  box.appendChild(wrap);
  const list=wrap.querySelector('#eventAccommodationList');
  const localTravels=await getEventLocalTravels(eventObj.id);
  if(localTravels.length){
    localTravels.forEach((t,i)=>steps.push({
      order:15000+i,
      name:[t.from,t.to].filter(Boolean).join(' → ')||'Déplacement local',
      type:'local_travel',
      time:t.departure||'',
      duration:Number(t.duration_minutes)>0?Number(t.duration_minutes):null,
      address:t.to||'',
      price:Number(t.cost)>0?(Number(t.cost)/Math.max(1,Number(t.people_count||aiPlan?.people||1))):null,
      source:'local_travel',
      fullDate:t.departure||'',
      distance:t.distance_km,
      mode:t.mode||''
    }));
  }

  const accommodations=await getEventAccommodations(eventObj.id);
  if(!accommodations.length){list.innerHTML='<div class="inlineEventAccommodationEmpty">Aucun hébergement n’est encore défini.</div>'}
  else{
    list.innerHTML=accommodations.map(a=>{
      const dates=[a.checkin?'🛬 Arrivée '+v58AccommodationDate(a.checkin,true):'',a.checkout?'🛫 Départ '+v58AccommodationDate(a.checkout,true):''].filter(Boolean).join(' · ');
      const people=a.people?'👥 '+a.people:'';
      const rooms=a.rooms?'🛏️ '+a.rooms:'';
      const cap=Number(a.capacity)>0?'👤 '+Number(a.capacity)+' pers./logement':'';
      const night=Number(a.price_per_night)>0?'💶 '+eur(Number(a.price_per_night))+' / nuit':'';
      const total=Number(a.total_cost)>0?'💰 Total '+eur(Number(a.total_cost)):'';
      return '<div class="inlineEventAccommodationItem">'+
        '<div class="inlineEventAccommodationName">'+v58AccommodationLabel(a.type)+(a.name?' · '+esc(a.name):'')+'</div>'+
        (a.address?'<div class="inlineEventAccommodationMeta">📍 '+esc(a.address)+'</div>':'')+
        (dates?'<div class="inlineEventAccommodationMeta">'+esc(dates)+'</div>':'')+
        ((people||rooms||cap)?'<div class="inlineEventAccommodationMeta">'+esc([people,rooms,cap].filter(Boolean).join(' · '))+'</div>':'')+
        ((night||total)?'<div class="inlineEventAccommodationMeta">'+esc([night,total].filter(Boolean).join(' · '))+'</div>':'')+
        (a.booking?'<div class="inlineEventAccommodationMeta">🎫 '+esc(a.booking)+'</div>':'')+
        (a.note?'<div class="inlineEventAccommodationMeta">📝 '+esc(a.note)+'</div>':'')+
        '</div>';
    }).join('');
  }
  const form=wrap.querySelector('#eventAccommodationForm');
  wrap.querySelector('#eventAccommodationAddBtn').addEventListener('click',()=>{form.style.display='grid';wrap.querySelector('#eventAccommodationName')?.focus()});
  wrap.querySelector('#eventAccommodationCancelBtn').addEventListener('click',()=>{form.style.display='none'});
  wrap.querySelector('#eventAccommodationSaveBtn').addEventListener('click',async()=>{
    if(!user||eventObj.creator_id!==user.id){alert('Seul l’organisateur peut ajouter un hébergement au planning.');return}
    const name=$('eventAccommodationName')?.value.trim()||'',address=$('eventAccommodationAddress')?.value.trim()||'';
    const checkin=$('eventAccommodationCheckin')?.value||'',checkout=$('eventAccommodationCheckout')?.value||'';
    if(!name||!checkin||!checkout){alert('Indique au minimum le nom, la date/heure d’arrivée et la date/heure de départ.');return}
    if(new Date(checkout)<=new Date(checkin)){alert('La date de départ doit être après la date d’arrivée.');return}
    const payload={
      type:$('eventAccommodationType')?.value||'other',name,address,checkin,checkout,
      people:$('eventAccommodationPeople')?.value.trim()||'',rooms:$('eventAccommodationRooms')?.value.trim()||'',
      capacity:Number($('eventAccommodationCapacity')?.value||0),
      price_per_night:Number($('eventAccommodationNightPrice')?.value||0),
      total_cost:Number($('eventAccommodationTotalCost')?.value||0),
      booking:$('eventAccommodationBooking')?.value.trim()||'',note:$('eventAccommodationNote')?.value.trim()||''
    };
    payload.capacity=Number.isFinite(payload.capacity)?payload.capacity:0;
    payload.price_per_night=Number.isFinite(payload.price_per_night)?payload.price_per_night:0;
    payload.total_cost=Number.isFinite(payload.total_cost)?payload.total_cost:0;
    const btn=wrap.querySelector('#eventAccommodationSaveBtn'); btn.disabled=true; btn.textContent='⏳ Enregistrement…';
    try{
      const r=await sb.from('messages').insert({event_id:eventObj.id,user_id:user.id,content:V58_ACCOMMODATION_MARKER+JSON.stringify(payload)}).select('id').single();
      if(r.error)throw r.error;
      rememberLocalCreated('messages',r.data?.id);
      await renderEventAccommodation(box,eventObj);
      const oldTimeline=box.querySelector('#eventPlanningTimeline'); if(oldTimeline)oldTimeline.remove();
      try{
        const choice=localStorage.getItem('myevent_event_planning_choice_'+user.id+'_'+eventObj.id)||'manual';
        await renderEventPlanningTimeline(box,eventObj,choice,null,null,[]);
      }catch(_){ }
    }catch(e){alert('Impossible d’ajouter l’hébergement : '+(e.message||String(e)));btn.disabled=false;btn.textContent='💾 Ajouter au planning';}
  });
}

/* ===== original inline script 21 ===== */
/* V58.1 — Planning central : timeline de l’événement */
function v58TimeMinutes(value){
  const m=String(value||'').match(/^(\d{1,2}):(\d{2})/);
  if(!m)return 9999;
  return Number(m[1])*60+Number(m[2]);
}
function v58TypeLabel(type,name){
  const t=String(type||'').toLowerCase();
  const n=String(name||'').toLowerCase();
  if(t.includes('restaurant')||t.includes('meal')||t.includes('repas')||n.includes('restaurant')||n.includes('dîner')||n.includes('diner')||n.includes('déjeuner')||n.includes('dejeuner'))return '🍽️ Repas';
  if(t.includes('culture'))return '🏛️ Culture';
  if(t.includes('nature'))return '🌳 Nature';
  if(t.includes('local_travel')||t.includes('déplacement local')||t.includes('deplacement local'))return '🧭 Déplacement local';
  if(t.includes('transport')||t.includes('travel')||t.includes('déplacement')||t.includes('deplacement'))return '🚗 Transport';
  if(t.includes('accommodation')||t.includes('hébergement')||t.includes('hebergement')||n.includes('arrivée ·')||n.includes('départ ·'))return '🏨 Hébergement';
  return '🎯 Activité';
}
async function renderEventPlanningTimeline(box,eventObj,choice,outing,aiPlan,aiItems){
  if(!box||!eventObj)return;
  outing=validSelectedOuting(outing);
  const wrap=document.createElement('div');
  wrap.className='inlineEventTimeline';
  wrap.id='eventPlanningTimeline';
  const title=document.createElement('div');
  title.className='inlineEventTimelineTitle';
  title.textContent='📅 Déroulement de l’événement';
  const sub=document.createElement('div');
  sub.className='inlineEventTimelineSub';
  sub.textContent=choice==='ai'?'Timeline issue du planning IA sélectionné':'Timeline du planning manuel';
  wrap.append(title,sub);

  let steps=[];
  // Les trajets V58.2 sont des étapes à part entière de la timeline.
  const transports=await getEventTransports(eventObj.id);
  if(choice==='ai' && Array.isArray(aiItems) && aiItems.length){
    steps=aiItems.map((x,i)=>({
      order:i+1,
      name:x.name||'Étape',
      type:x.outing_type||x.type||'activity',
      time:x.start_time||'',
      duration:x.duration_minutes,
      address:x.address||'',
      price:x.price_per_person,
      source:x.source||'ai'
    }));
  }else if(outing){
    steps=[{
      order:1,
      name:outing.name||'Sortie',
      type:outing.outing_type||'activity',
      time:outing.start_time||outing.time||'',
      duration:outing.duration_minutes,
      address:outing.address||'',
      price:outing.price_per_person,
      source:'manual'
    }];
  }

  if(transports.length){
    transports.forEach((t,i)=>steps.push({
      order:10000+i,
      name:[t.from,t.to].filter(Boolean).join(' → ')||'Trajet',
      type:'transport',
      time:t.departure||'',
      duration:t.departure&&t.arrival?Math.max(0,Math.round((new Date(t.arrival)-new Date(t.departure))/60000)):null,
      address:t.to||'',
      price:Number(t.cost)>0?(Number(t.cost)/Math.max(1,Number(t.people_count||aiPlan?.people||1))):null,
      source:'transport',
      fullDate:t.departure||''
    }));
  }
  const localTravels=await getEventLocalTravels(eventObj.id);
  if(localTravels.length){
    localTravels.forEach((t,i)=>steps.push({
      order:15000+i,
      name:[t.from,t.to].filter(Boolean).join(' → ')||'Déplacement local',
      type:'local_travel',
      time:t.departure||'',
      duration:t.duration_minutes,
      address:t.to||'',
      distance:t.distance_km,
      mode:v58LocalTravelModeLabel(t.mode),
      price:Number(t.cost)>0?(Number(t.cost)/Math.max(1,Number(t.people_count||aiPlan?.people||1))):null,
      source:'local_travel',
      fullDate:t.departure||''
    }));
  }
  const accommodations=await getEventAccommodations(eventObj.id);
  if(accommodations.length){
    accommodations.forEach((a,i)=>{
      const baseName=a.name||'Hébergement';
      const cost=Number(a.total_cost)>0?Number(a.total_cost):0;
      const peopleCount=Number(a.people_count||0)||Number(String(a.people||'').match(/\d+/)?.[0]||0)||Number(aiPlan?.people||0)||1;
      steps.push({order:20000+i*2,name:'Arrivée · '+baseName,type:'accommodation',time:a.checkin||'',duration:null,address:a.address||'',price:cost>0?cost/Math.max(1,peopleCount):null,source:'accommodation',fullDate:a.checkin||''});
      steps.push({order:20001+i*2,name:'Départ · '+baseName,type:'accommodation',time:a.checkout||'',duration:null,address:a.address||'',price:null,source:'accommodation',fullDate:a.checkout||''});
    });
  }
  // V54.41 — tri chronologique réel : une étape avec seulement HH:MM
  // doit être rattachée à la date de l'événement avant de la comparer
  // à un transport qui possède une date ISO complète.
  const timelineDateBase=eventObj.event_date||eventObj.date||'';
  const timelineSortValue=(step)=>{
    const raw=String(step.fullDate||step.time||'').trim();
    if(!raw)return NaN;
    // Date/heure complète (ISO, timestamp, etc.)
    const direct=new Date(raw).getTime();
    if(Number.isFinite(direct))return direct;
    // Heure seule HH:MM : on utilise la date de l'événement.
    const hm=raw.match(/^(\d{1,2}):(\d{2})/);
    if(hm && timelineDateBase){
      const base=new Date(timelineDateBase);
      if(Number.isFinite(base.getTime())){
        base.setHours(Number(hm[1]),Number(hm[2]),0,0);
        return base.getTime();
      }
      const dateOnly=String(timelineDateBase).match(/^(\d{4}-\d{2}-\d{2})/);
      if(dateOnly){
        const d=new Date(dateOnly[1]+'T'+hm[1].padStart(2,'0')+':'+hm[2]+':00');
        if(Number.isFinite(d.getTime()))return d.getTime();
      }
    }
    return NaN;
  };
  steps.sort((a,b)=>{
    const ta=timelineSortValue(a),tb=timelineSortValue(b);
    if(Number.isFinite(ta)&&Number.isFinite(tb))return ta-tb||a.order-b.order;
    if(Number.isFinite(ta))return -1;
    if(Number.isFinite(tb))return 1;
    return v58TimeMinutes(a.time)-v58TimeMinutes(b.time)||a.order-b.order;
  });

  if(!steps.length){
    const empty=document.createElement('div');
    empty.className='inlineEventTimelineEmpty';
    empty.textContent='Aucune étape n’est encore définie dans le planning.';
    wrap.appendChild(empty);
  }else{
    const list=document.createElement('div');
    list.className='inlineEventTimelineList';
    steps.forEach((step,i)=>{
      const row=document.createElement('div');
      row.className='inlineEventTimelineItem';
      const dot=document.createElement('div');
      dot.className='inlineEventTimelineDot';
      dot.textContent=v58TypeLabel(step.type,step.name).slice(0,2);
      const content=document.createElement('div');
      const time=document.createElement('div');
      time.className='inlineEventTimelineTime';
      time.textContent=step.fullDate?(new Date(step.fullDate).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})):((step.time&&/^\d{4}-\d{2}-\d{2}T/.test(String(step.time)))?new Date(step.time).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):(step.time||'Horaire à définir'));
      const name=document.createElement('div');
      name.className='inlineEventTimelineName';
      name.textContent=step.name;
      const meta=document.createElement('div');
      meta.className='inlineEventTimelineMeta';
      const parts=[v58TypeLabel(step.type,step.name)];
      if(step.duration!=null && Number(step.duration)>0)parts.push('⏱️ '+Number(step.duration)+' min');
      if(step.address)parts.push('📍 '+step.address);
      if(step.distance!=null && Number.isFinite(Number(step.distance)) && Number(step.distance)>0)parts.push('📏 '+String(step.distance).replace('.',',')+' km');
      if(step.mode)parts.push(String(step.mode));
      if(step.price!=null && Number.isFinite(Number(step.price)))parts.push('💶 '+eur(Number(step.price))+' / pers.');
      meta.textContent=parts.join(' · ');
      content.append(time,name,meta);
      row.append(dot,content);
      list.appendChild(row);
    });
    wrap.appendChild(list);
  }

  const action=document.createElement('div');
  action.className='inlineEventTimelineAction';
  const openBtn=document.createElement('button');
  openBtn.type='button';
  openBtn.className='secondary';
  openBtn.textContent=choice==='ai'?'✨ Ouvrir le planning IA':'📋 Ouvrir le planning';
  openBtn.addEventListener('click',()=>{
    showEventTab(choice==='ai'?'aioutings':'outings',true);
    document.querySelector('.tabPanel[data-panel="'+(choice==='ai'?'aioutings':'outings')+'"]')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
  action.appendChild(openBtn);
  wrap.appendChild(action);
  box.appendChild(wrap);
}

/* ===== original inline script 22 ===== */
/* V58.43 — Déplacements locaux automatiques avec seuil de distance. */
function v58OpenLocationPoint(lat,lon,label,icon='📍'){
  lat=Number(lat);lon=Number(lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))return;
  showEventTab('locations',true);setTimeout(()=>{if(typeof setLocationMapView==='function')setLocationMapView(lat,lon,16);if(typeof locationMap!=='undefined'&&locationMap){if(window.locationModuleMarker)locationMap.removeLayer(window.locationModuleMarker);const marker=L.marker([lat,lon],{icon:typeof makeLocationIcon==='function'?makeLocationIcon(icon,'#278cff'):undefined}).addTo(locationMap);marker.bindPopup('<b>'+esc(label||'Point')+'</b>').openPopup();window.locationModuleMarker=marker;}$('locationMap')?.scrollIntoView({behavior:'smooth',block:'center'});},180);
}
async function v58GeocodeText(text){const q=String(text||'').trim();if(!q)return null;try{const r=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=fr&q='+encodeURIComponent(q),{headers:{Accept:'application/json'}});const d=await r.json();if(d?.[0])return{lat:+d[0].lat,lon:+d[0].lon,address:d[0].display_name};}catch(_){ }return null;}
function v58ModuleTab(name){showEventTab(name,true);document.querySelector('.tabPanel[data-panel="'+name+'"]')?.scrollIntoView({behavior:'smooth',block:'start'});}
function v58RenderTransportModule(items){const el=$('m58TransportList');if(!el)return;if(!items.length){el.innerHTML='<p class="muted">Aucun trajet enregistré pour cet événement.</p>';return;}const fmt=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});};el.innerHTML=items.map((t,i)=>'<div class="m58ModuleCard"><div class="m58ModuleCardTitle">'+esc(v58TransportLabel(t.type))+' · '+esc([t.from,t.to].filter(Boolean).join(' → ')||'Trajet')+'</div><div class="m58ModuleCardMeta">'+esc([t.departure?'🕐 '+fmt(t.departure):'',t.arrival?'→ '+fmt(t.arrival):'',t.people?'👥 '+t.people:'',Number(t.cost)>0?'💶 '+eur(Number(t.cost)):''].filter(Boolean).join(' · '))+'</div>'+(t.booking?'<div class="m58ModuleCardMeta">🎫 '+esc(t.booking)+'</div>':'')+'<div class="m58ModuleCardActions"><button type="button" class="secondary" data-m58-transport-edit="'+i+'">✏️ Modifier</button><button type="button" class="secondary" data-m58-transport-delete="'+i+'">🗑️ Supprimer</button><button type="button" class="secondary" data-m58-transport-map="'+i+'">📍 Carte</button></div></div>').join('');el.querySelectorAll('[data-m58-transport-edit]').forEach(b=>b.addEventListener('click',()=>{
  v58ModuleTab('transport');setTimeout(()=>{const t=items[Number(b.dataset.m58TransportEdit)];$('m58TransportAddBtn')?.click();setTimeout(()=>{
    $('m58TransportManualFrom').value=t.from||'';$('m58TransportManualTo').value=t.to||'';$('m58TransportManualDeparture').value=t.departure?String(t.departure).slice(0,16):'';$('m58TransportManualArrival').value=t.arrival?String(t.arrival).slice(0,16):'';$('m58TransportManualPeople').value=t.people||'';$('m58TransportManualCost').value=Number(t.cost||0)||'';$('m58TransportManualBooking').value=t.booking||'';$('m58TransportManualNote').value=t.note||'';const f=$('m58TransportForm');if(f)f.dataset.editId=t._message_id||'';const save=$('m58TransportSaveBtn');if(save)save.textContent='💾 Enregistrer les modifications';},100)},120);
}));
el.querySelectorAll('[data-m58-transport-delete]').forEach(b=>b.addEventListener('click',async()=>{const t=items[Number(b.dataset.m58TransportDelete)];if(!t?._message_id)return;if(!user||!event||event.creator_id!==user.id){alert('Seul l’organisateur peut supprimer un transport.');return;}if(!confirm('Supprimer ce trajet du planning ?'))return;const r=await sb.from('messages').delete().eq('id',t._message_id);if(r.error){alert('Impossible de supprimer le trajet : '+r.error.message);return;}await v58LoadModuleLists();}));
el.querySelectorAll('[data-m58-transport-map]').forEach(b=>b.addEventListener('click',async()=>{const t=items[Number(b.dataset.m58TransportMap)];const geo=await v58GeocodeText(t.to||t.from);if(geo)v58OpenLocationPoint(geo.lat,geo.lon,(t.from||'')+' → '+(t.to||''),'🚗');else alert('Impossible de localiser cette destination.');}));}
function v58RenderAccommodationModule(items){const el=$('m58AccommodationList');if(!el)return;if(!items.length){el.innerHTML='<p class="muted">Aucun hébergement enregistré pour cet événement.</p>';return;}const fmt=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});};el.innerHTML=items.map((a,i)=>'<div class="m58ModuleCard"><div class="m58ModuleCardTitle">'+esc(v58AccommodationLabel(a.type))+' · '+esc(a.name||'Hébergement')+'</div>'+(a.address?'<div class="m58ModuleCardMeta">📍 '+esc(a.address)+'</div>':'')+'<div class="m58ModuleCardMeta">'+esc([a.checkin?'🛬 '+fmt(a.checkin):'',a.checkout?'🛫 '+fmt(a.checkout):'',a.people?'👥 '+a.people:'',a.rooms?'🛏️ '+a.rooms:'',Number(a.total_cost)>0?'💰 '+eur(Number(a.total_cost)):''].filter(Boolean).join(' · '))+'</div>'+(a.booking?'<div class="m58ModuleCardMeta">🎫 '+esc(a.booking)+'</div>':'')+'<div class="m58ModuleCardActions"><button type="button" class="secondary" data-m58-accommodation-map="'+i+'">📍 Voir sur la carte</button></div></div>').join('');el.querySelectorAll('[data-m58-accommodation-map]').forEach(b=>b.addEventListener('click',async()=>{const a=items[Number(b.dataset.m58AccommodationMap)];const geo=await v58GeocodeText(a.address||a.name);if(geo)v58OpenLocationPoint(geo.lat,geo.lon,a.name||'Hébergement','🏨');else alert('Impossible de localiser cet hébergement.');}));}
function v58LocalTravelDate(value){if(!value)return '';const d=new Date(value);return Number.isNaN(d.getTime())?String(value):d.toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}
async function v58CalculateLocalRoute(from,to,mode){const a=await v58GeocodeText(from),b=await v58GeocodeText(to);if(!a||!b)throw new Error('Impossible de localiser le départ ou la destination.');const profile=mode==='walk'?'foot':mode==='bike'?'bike':'car';const u='https://router.project-osrm.org/route/v1/'+profile+'/'+a.lon+','+a.lat+';'+b.lon+','+b.lat+'?overview=false&alternatives=false&steps=false';const r=await fetch(u);const d=await r.json();if(!r.ok||d.code!=='Ok'||!d.routes?.[0])throw new Error('Impossible de calculer cet itinéraire.');return{distance_km:Math.round((Number(d.routes[0].distance)/1000)*10)/10,duration_minutes:Math.max(1,Math.round(Number(d.routes[0].duration)/60)),from:a,to:b};}
async function v58AutoCreateLocalTravelsBetweenPlanningSteps(eventObj,choice,outing,aiPlan,aiItems,minDistanceKm=0.5){
  if(!eventObj||!user)return {created:0,skipped:0,message:'Événement introuvable.'};
  if(eventObj.creator_id!==user.id)return {created:0,skipped:0,message:'Seul l’organisateur peut calculer les déplacements automatiquement.'};
  const sourceSteps=[];
  if(choice==='ai'&&Array.isArray(aiItems)){
    aiItems.forEach((x,i)=>{
      if(x?.name&&x?.address)sourceSteps.push({name:String(x.name),address:String(x.address),time:String(x.start_time||''),duration:Number(x.duration_minutes||0),order:i});
    });
  }else if(outing?.name&&outing?.address){
    sourceSteps.push({name:String(outing.name),address:String(outing.address),time:String(outing.start_time||outing.time||''),duration:Number(outing.duration_minutes||0),order:0});
  }
  if(sourceSteps.length<2)return {created:0,skipped:0,message:'Il faut au moins 2 activités avec une adresse pour calculer les déplacements entre les étapes.'};
  const existing=await getEventLocalTravels(eventObj.id);
  const existingKeys=new Set(existing.map(t=>String((t.from||'')+'|'+(t.to||'')).toLowerCase()));
  let created=0,skipped=0;
  const baseRaw=eventObj.event_date||eventObj.date||new Date().toISOString();
  const baseMatch=String(baseRaw).match(/^(\d{4}-\d{2}-\d{2})/);
  const baseDate=baseMatch?baseMatch[1]:new Date(baseRaw).toISOString().slice(0,10);
  const toDateTime=(v)=>{
    const raw=String(v||'').trim();
    if(!raw)return null;
    if(/^\d{4}-\d{2}-\d{2}T/.test(raw))return new Date(raw);
    const hm=raw.match(/^(\d{1,2}):(\d{2})/);
    if(!hm)return null;
    return new Date(baseDate+'T'+hm[1].padStart(2,'0')+':'+hm[2]+':00');
  };
  for(let i=0;i<sourceSteps.length-1;i++){
    const a=sourceSteps[i],b=sourceSteps[i+1];
    const key=(a.address+'|'+b.address).toLowerCase();
    if(existingKeys.has(key)){skipped++;continue;}
    try{
      // Ne créer un déplacement que s'il est réellement utile.
      // Même adresse = aucun déplacement. En dessous du seuil = aucun déplacement.
      if(String(a.address||'').trim().toLowerCase()===String(b.address||'').trim().toLowerCase()){skipped++;continue;}
      const route=await v58CalculateLocalRoute(a.address,b.address,'car');
      if(Number(route.distance_km)<Number(minDistanceKm||0)){skipped++;continue;}
      const nextStart=toDateTime(b.time);
      const prevStart=toDateTime(a.time);
      const prevEnd=prevStart&&a.duration>0?new Date(prevStart.getTime()+a.duration*60000):prevStart;
      let departure=nextStart?new Date(nextStart.getTime()-route.duration_minutes*60000):(prevEnd||new Date());
      let arrival=nextStart||new Date(departure.getTime()+route.duration_minutes*60000);
      let note='Calcul automatique entre les étapes du planning';
      if(prevEnd&&departure<prevEnd){
        note+=' · ⚠️ Temps de trajet potentiellement insuffisant entre les deux étapes.';
      }
      const payload={from:a.address,to:b.address,mode:'car',distance_km:route.distance_km,duration_minutes:route.duration_minutes,departure:departure.toISOString(),arrival:arrival.toISOString(),people:'',people_count:Number(aiPlan?.people||1),cost:0,note,title:a.name+' → '+b.name};
      const r=await sb.from('messages').insert({event_id:eventObj.id,user_id:user.id,content:V58_LOCAL_TRAVEL_MARKER+JSON.stringify(payload)}).select('id').single();
      if(r.error)throw r.error;
      rememberLocalCreated('messages',r.data?.id);existingKeys.add(key);created++;
    }catch(_){skipped++;}
  }
  return {created,skipped,message:created?'Déplacements calculés entre les étapes du planning.':('Aucun nouveau déplacement d’au moins '+String(minDistanceKm).replace('.',',')+' km n’a été créé.')};
}
function v58RenderLocalTravelModule(items){const el=$('m58LocalTravelList');if(!el)return;if(!items.length){el.innerHTML='<p class="muted">Aucun déplacement local enregistré pour cet événement.</p>';return;}el.innerHTML=items.map((t,i)=>'<div class="m58ModuleCard"><div class="m58ModuleCardTitle">'+esc(v58LocalTravelModeLabel(t.mode))+' · '+esc([t.from,t.to].filter(Boolean).join(' → ')||'Déplacement local')+'</div><div class="m58ModuleCardMeta">'+esc([t.departure?'🕐 '+v58LocalTravelDate(t.departure):'',t.arrival?'→ '+v58LocalTravelDate(t.arrival):'',Number(t.distance_km)>0?'📏 '+String(t.distance_km).replace('.',',')+' km':'',Number(t.duration_minutes)>0?'⏱️ '+Number(t.duration_minutes)+' min':'',t.people?'👥 '+t.people:'',Number(t.cost)>0?'💶 '+eur(Number(t.cost)): ''].filter(Boolean).join(' · '))+'</div>'+(t.note?'<div class="m58ModuleCardMeta">📝 '+esc(t.note)+'</div>':'')+'<div class="m58ModuleCardActions"><button type="button" class="secondary" data-m58-local-edit="'+i+'">✏️ Modifier</button><button type="button" class="secondary" data-m58-local-delete="'+i+'">🗑️ Supprimer</button><button type="button" class="secondary" data-m58-local-map="'+i+'">📍 Carte</button></div></div>').join('');el.querySelectorAll('[data-m58-local-edit]').forEach(b=>b.addEventListener('click',()=>{const t=items[Number(b.dataset.m58LocalEdit)];v58ModuleTab('localtravel');setTimeout(()=>{const f=$('m58LocalTravelForm');f?.classList.remove('hidden');if(f)f.dataset.editId=t._message_id||'';$('m58LocalTravelType').value=t.mode||'other';$('m58LocalTravelFrom').value=t.from||'';$('m58LocalTravelTo').value=t.to||'';$('m58LocalTravelDistance').value=Number(t.distance_km||0)||'';$('m58LocalTravelDuration').value=Number(t.duration_minutes||0)||'';$('m58LocalTravelDeparture').value=t.departure?String(t.departure).slice(0,16):'';$('m58LocalTravelArrival').value=t.arrival?String(t.arrival).slice(0,16):'';$('m58LocalTravelPeople').value=t.people||'';$('m58LocalTravelCost').value=Number(t.cost||0)||'';$('m58LocalTravelNote').value=t.note||'';$('m58LocalTravelSaveBtn').textContent='💾 Enregistrer les modifications';},120);}));el.querySelectorAll('[data-m58-local-delete]').forEach(b=>b.addEventListener('click',async()=>{const t=items[Number(b.dataset.m58LocalDelete)];if(!t?._message_id)return;if(!user||!event||event.creator_id!==user.id){alert('Seul l’organisateur peut supprimer un déplacement local.');return;}if(!confirm('Supprimer ce déplacement du planning ?'))return;const r=await sb.from('messages').delete().eq('id',t._message_id);if(r.error){alert('Impossible de supprimer le déplacement : '+r.error.message);return;}await v58LoadModuleLists();}));el.querySelectorAll('[data-m58-local-map]').forEach(b=>b.addEventListener('click',async()=>{const t=items[Number(b.dataset.m58LocalMap)];const geo=await v58GeocodeText(t.to||t.from);if(geo)v58OpenLocationPoint(geo.lat,geo.lon,(t.from||'')+' → '+(t.to||''),'🧭');else alert('Impossible de localiser cette destination.');}));}
async function v58LoadModuleLists(){if(!event)return;const [ts,as,ls]=await Promise.all([getEventTransports(event.id),getEventAccommodations(event.id),getEventLocalTravels(event.id)]);v58RenderTransportModule(ts);v58RenderAccommodationModule(as);v58RenderLocalTravelModule(ls);}
function v58SncfOfferUrl(r){
  if(!r)return '';
  const d=r.departure?new Date(r.departure):null;
  const date=d&&!Number.isNaN(d.getTime())?d.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'';
  const time=d&&!Number.isNaN(d.getTime())?d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'';
  const train=r.train_number?(' train '+r.train_number):'';
  const phrase=[train.trim(),r.from||'',r.to||'',date,time].filter(Boolean).join(' ');
  return 'https://www.sncf-connect.com/app/home/search?userInput='+encodeURIComponent(phrase);
}
function v58RenderAvailabilityCards(container, results, warnings, kind){
  if(!container)return;
  const money=v=>Number(v)>0?eur(Number(v)):'Prix non communiqué';
  const fmt=v=>{if(!v)return '';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});};
  let html='';
  if(warnings?.length) html+='<div class="m58AvailabilityWarnings">'+warnings.map(w=>'⚠️ '+esc(w)).join('<br>')+'</div>';
  if(!results?.length){html+='<div class="m58AvailabilityEmpty">Aucun résultat trouvé pour cette recherche.</div>';container.innerHTML=html;return;}
  const hasExternal=results.some(r=>r.external_only);
  const hasSncf=results.some(r=>r.kind==='train');
  if(hasSncf) html+='<div class="m58AvailabilityWarnings">ℹ️ Les horaires train viennent de l’API horaire SNCF. Ils ne correspondent pas forcément aux offres commerciales affichées par SNCF Connect.</div>';
  if(hasExternal) html+='<div class="m58AvailabilityWarnings">🔗 Pour les services partenaires (BlaBlaCar, BlaBlaCar Bus, Taxi/VTC), MyEvent ouvre actuellement la recherche officielle. L’accès aux offres intégrées directement dans MyEvent dépend encore des accès partenaires/API.</div>';
  html+='<div class="m58AvailabilityCount">'+results.length+' option(s) proposée(s)</div><div class="m58AvailabilityResults">';
  results.forEach((r,i)=>{
    const title=r.kind==='hotel'?(r.name||'Hôtel'):(r.title||'Trajet');
    const route=r.kind==='hotel'?(r.address||''):[r.from,r.to].filter(Boolean).join(' → ');
    const timing=r.kind==='hotel'?('🛬 '+fmt(r.checkin)+' · 🛫 '+fmt(r.checkout)):('🕐 '+fmt(r.departure)+(r.arrival?' → '+fmt(r.arrival):''));
    const meta=[timing,route,r.duration_minutes?('⏱️ '+r.duration_minutes+' min'):'',r.rooms?'🛏️ '+r.rooms+' chambre(s)':'',r.room?'🛏️ '+r.room:'',r.guests?'👥 '+r.guests+' voyageur(s)':'',r.passengers?'👥 '+r.passengers+' voyageur(s)':''].filter(Boolean).join(' · ');
    const offerUrl=r.kind==='train'?v58SncfOfferUrl(r):(r.booking_url||'');
    const providerIcon=r.kind==='hotel'?'🏨':r.kind==='train'?'🚆':r.kind==='bus'?'🚌':r.kind==='carpool'?'🚗':r.kind==='taxi'?'🚕':r.kind==='plane'?'✈️':'🚗';
    const externalLabel=r.kind==='train'?'🔗 Rechercher sur SNCF Connect':r.kind==='bus'?'🔗 Rechercher sur BlaBlaCar Bus':r.kind==='carpool'?'🔗 Rechercher sur BlaBlaCar':r.kind==='taxi'?'🔗 Ouvrir Uber':'🔗 Ouvrir la recherche';
    const addLabel=r.external_only?'➕ Ajouter comme trajet à vérifier':'➕ Ajouter au planning';
    html+='<div class="m58AvailabilityCard"><div class="m58AvailabilityProvider">'+esc(providerIcon+' '+r.provider)+'</div><div class="m58AvailabilityTitle">'+esc(title)+'</div><div class="m58AvailabilityMeta">'+esc(meta)+'</div><div class="m58AvailabilityPrice">'+(r.external_only?'🔎 Recherche en direct à ouvrir':'💶 '+esc(money(r.price))+(r.currency&&Number(r.price)>0?' '+esc(r.currency):''))+'</div><div class="m58ModuleCardActions"><button type="button" class="secondary" data-m58-add-result="'+i+'">'+addLabel+'</button>'+(offerUrl?'<button type="button" class="secondary" data-m58-open-result="'+i+'">'+externalLabel+'</button>':'')+(r.lat&&r.lon?'<button type="button" class="secondary" data-m58-map-result="'+i+'">📍 Carte</button>':'')+'</div></div>';
  });
  html+='</div>';container.innerHTML=html;
  container.querySelectorAll('[data-m58-add-result]').forEach(btn=>btn.addEventListener('click',async()=>{const r=results[Number(btn.dataset.m58AddResult)];await v58SaveSearchResult(r,kind,btn);}));
  container.querySelectorAll('[data-m58-open-result]').forEach(btn=>btn.addEventListener('click',()=>{const r=results[Number(btn.dataset.m58OpenResult)];const u=r.kind==='train'?v58SncfOfferUrl(r):(r.booking_url||'');if(u)window.open(u,'_blank','noopener,noreferrer');}));
  container.querySelectorAll('[data-m58-map-result]').forEach(btn=>btn.addEventListener('click',btn=>{const r=results[Number(btn.currentTarget.dataset.m58MapResult)];v58OpenLocationPoint(Number(r.lat),Number(r.lon),r.name||r.title||'Transport','📍');}));
}
async function v58SaveSearchResult(r,kind,btn){
  if(!user||!event||event.creator_id!==user.id){alert('Seul l’organisateur peut ajouter un résultat au planning.');return;}
  btn.disabled=true;btn.textContent='⏳ Ajout…';
  let payload;
  if(kind==='transport') payload={type:r.kind==='train'?'train':r.kind==='plane'?'plane':r.kind==='bus'?'bus':r.kind==='carpool'?'carpool':r.kind==='taxi'?'taxi':'other',from:r.from||'',to:r.to||'',departure:r.departure||'',arrival:r.arrival||'',people:(r.passengers||1)+' voyageur(s)',cost:Number(r.price||0),booking:r.booking_url||'',note:r.external_only?('Source : '+(r.provider||'fournisseur')+' · Recherche officielle à vérifier lors de la réservation.'):'Source : '+(r.provider||'fournisseur')+' · Horaire API SNCF, à vérifier sur SNCF Connect le '+new Date().toLocaleString('fr-FR'),title:r.title||([r.from,r.to].filter(Boolean).join(' → '))};
  else payload={type:'hotel',name:r.name||'Hébergement',address:r.address||'',checkin:r.checkin||'',checkout:r.checkout||'',people:String(r.guests||1),rooms:String(r.rooms||1),capacity:Number(r.guests||0),price_per_night:0,total_cost:Number(r.price||0),booking:r.booking_url||'',note:'Source : '+(r.provider||'fournisseur')+' · '+(r.room||'')};
  const marker=kind==='transport'?V58_TRANSPORT_MARKER:V58_ACCOMMODATION_MARKER;
  try{const ins=await sb.from('messages').insert({event_id:event.id,user_id:user.id,content:marker+JSON.stringify(payload)}).select('id').single();if(ins.error)throw ins.error;rememberLocalCreated('messages',ins.data?.id);btn.textContent='✅ Ajouté au planning';await v58LoadModuleLists();}catch(e){alert('Impossible d’ajouter ce résultat : '+(e.message||String(e)));btn.disabled=false;btn.textContent='➕ Ajouter au planning';}
}
function v58SetupModuleButtons(){
  const show=id=>$(id)?.classList.remove('hidden'),hide=id=>$(id)?.classList.add('hidden');
  $('m58LocalTravelAddBtn')?.addEventListener('click',()=>{show('m58LocalTravelForm');$('m58LocalTravelFrom')?.focus();const f=$('m58LocalTravelForm');if(f)f.dataset.editId='';$('m58LocalTravelSaveBtn').textContent='💾 Enregistrer';});
  $('m58LocalTravelAutoBtn')?.addEventListener('click',async()=>{if(!event){alert('Sélectionne un événement.');return;}const btn=$('m58LocalTravelAutoBtn');btn.disabled=true;btn.textContent='⏳ Calcul…';try{const choice=localStorage.getItem('myevent_event_planning_choice_'+user.id+'_'+event.id)||'manual';let currentOuting=null,currentAiItems=[];try{currentOuting=await getScopedEventOuting(event.id);}catch(_){}try{const raw=localStorage.getItem('myevent_ai_plan_'+user.id+'_'+event.id);const parsed=raw?JSON.parse(raw):null;currentAiItems=Array.isArray(parsed?.items)?parsed.items:[];}catch(_){}const minDistanceKm=Number($('m58LocalTravelMinDistance')?.value||0.5);const r=await v58AutoCreateLocalTravelsBetweenPlanningSteps(event,choice,currentOuting,null,currentAiItems,minDistanceKm);alert('✨ '+r.message+(r.created?'\n'+r.created+' déplacement(s) créé(s).':''));await v58LoadModuleLists();if(typeof renderInlineSelectedEvent==='function')await renderInlineSelectedEvent();}catch(e){alert('Impossible de calculer les déplacements : '+(e.message||String(e)));}finally{btn.disabled=false;btn.textContent='✨ Calculer entre les étapes';}});
  $('m58LocalTravelCancelBtn')?.addEventListener('click',()=>{hide('m58LocalTravelForm');const f=$('m58LocalTravelForm');if(f)f.dataset.editId='';});
  $('m58LocalTravelRouteBtn')?.addEventListener('click',async()=>{const from=$('m58LocalTravelFrom')?.value.trim(),to=$('m58LocalTravelTo')?.value.trim(),mode=$('m58LocalTravelType')?.value||'other',msg=$('m58LocalTravelMsg');if(!from||!to){msg.textContent='Indique le départ et la destination.';return;}msg.textContent='📏 Calcul de l’itinéraire…';try{const x=await v58CalculateLocalRoute(from,to,mode);$('m58LocalTravelDistance').value=x.distance_km;$('m58LocalTravelDuration').value=x.duration_minutes;msg.textContent='✅ '+String(x.distance_km).replace('.',',')+' km · '+x.duration_minutes+' min';}catch(e){msg.textContent='❌ '+(e.message||String(e));}});
  $('m58TransportSearchBtn')?.addEventListener('click',()=>{show('m58TransportSearchBox');hide('m58TransportForm');$('m58TransportFrom')?.focus()});
  $('m58TransportAddBtn')?.addEventListener('click',()=>{show('m58TransportForm');hide('m58TransportSearchBox');$('m58TransportManualFrom')?.focus()});
  $('m58TransportSearchCancel')?.addEventListener('click',()=>hide('m58TransportSearchBox'));
  $('m58AccommodationSearchBtn')?.addEventListener('click',()=>{show('m58AccommodationSearchBox');hide('m58AccommodationForm');$('m58AccommodationDestination')?.focus()});
  $('m58AccommodationAddBtn')?.addEventListener('click',()=>{show('m58AccommodationForm');hide('m58AccommodationSearchBox');$('m58AccommodationManualName')?.focus()});
  $('m58AccommodationSearchCancel')?.addEventListener('click',()=>hide('m58AccommodationSearchBox'));
  $('m58TransportSearchLaunch')?.addEventListener('click',async()=>{
    const from=$('m58TransportFrom')?.value.trim(),to=$('m58TransportTo')?.value.trim(),date=$('m58TransportDate')?.value,time=$('m58TransportTime')?.value||'06:00',people=Number($('m58TransportPassengers')?.value||1),mode=$('m58TransportMode')?.value||'all',out=$('m58TransportSearchResult');
    if(!from||!to||!date){out.innerHTML='⚠️ Indique le départ, la destination et la date.';return;}
    out.innerHTML='<div class="m58Loading">🔎 Recherche des transports disponibles…</div>';
    try{const r=await fetch('/api/search-transport',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from,to,date,time,passengers:people,mode})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Erreur de recherche');v58RenderAvailabilityCards(out,d.results||[],d.warnings||[],'transport');}catch(e){out.innerHTML='<div class="m58AvailabilityWarnings">❌ '+esc(e.message||String(e))+'</div>';}
  });
  $('m58AccommodationSearchLaunch')?.addEventListener('click',async()=>{
    const destination=$('m58AccommodationDestination')?.value.trim(),checkIn=$('m58AccommodationCheckin')?.value,checkOut=$('m58AccommodationCheckout')?.value,guests=Number($('m58AccommodationGuests')?.value||2),rooms=Number($('m58AccommodationRooms')?.value||1),type=$('m58AccommodationType')?.value||'all',out=$('m58AccommodationSearchResult');
    if(!destination||!checkIn||!checkOut){out.innerHTML='⚠️ Indique la destination, l’arrivée et le départ.';return;}
    if(new Date(checkOut)<=new Date(checkIn)){out.innerHTML='⚠️ Le départ doit être après l’arrivée.';return;}
    out.innerHTML='<div class="m58Loading">🔎 Recherche des hébergements disponibles…</div>';
    try{const r=await fetch('/api/search-accommodation.js',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({destination,checkIn,checkOut,guests,rooms,type})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Erreur de recherche');v58RenderAvailabilityCards(out,d.results||[],d.warnings||[],'accommodation');}catch(e){out.innerHTML='<div class="m58AvailabilityWarnings">❌ '+esc(e.message||String(e))+'</div>';}
  });
  $('m58LocalTravelSaveBtn')?.addEventListener('click',async()=>{if(!user||!event||event.creator_id!==user.id){alert('Seul l’organisateur peut ajouter un déplacement local.');return;}const from=$('m58LocalTravelFrom')?.value.trim()||'',to=$('m58LocalTravelTo')?.value.trim()||'',departure=$('m58LocalTravelDeparture')?.value||'',arrival=$('m58LocalTravelArrival')?.value||'';if(!from||!to||!departure){$('m58LocalTravelMsg').textContent='Indique au minimum le départ, la destination et la date/heure de départ.';return;}if(arrival&&new Date(arrival)<new Date(departure)){$('m58LocalTravelMsg').textContent='❌ L’arrivée doit être après le départ.';return;}const distance=Number($('m58LocalTravelDistance')?.value||0),duration=Number($('m58LocalTravelDuration')?.value||0),cost=Number($('m58LocalTravelCost')?.value||0),peopleText=$('m58LocalTravelPeople')?.value.trim()||'';const payload={from,to,mode:$('m58LocalTravelType')?.value||'other',distance_km:Number.isFinite(distance)?distance:0,duration_minutes:Number.isFinite(duration)?duration:0,departure,arrival,people:peopleText,people_count:Number(peopleText.match(/\d+/)?.[0]||1),cost:Number.isFinite(cost)?cost:0,note:$('m58LocalTravelNote')?.value.trim()||'',title:from+' → '+to};const form=$('m58LocalTravelForm'),editId=form?.dataset.editId||'';const btn=$('m58LocalTravelSaveBtn');btn.disabled=true;btn.textContent='⏳ Enregistrement…';let r;if(editId)r=await sb.from('messages').update({content:V58_LOCAL_TRAVEL_MARKER+JSON.stringify(payload)}).eq('id',editId).select('id').single();else r=await sb.from('messages').insert({event_id:event.id,user_id:user.id,content:V58_LOCAL_TRAVEL_MARKER+JSON.stringify(payload)}).select('id').single();if(r.error){$('m58LocalTravelMsg').textContent='❌ '+(r.error.message||'Erreur');btn.disabled=false;btn.textContent=editId?'💾 Enregistrer les modifications':'💾 Enregistrer';return;}if(!editId)rememberLocalCreated('messages',r.data?.id);if(form)form.dataset.editId='';btn.disabled=false;btn.textContent='💾 Enregistrer';$('m58LocalTravelMsg').textContent=editId?'✅ Déplacement modifié.':'✅ Déplacement enregistré.';hide('m58LocalTravelForm');await v58LoadModuleLists();});
  $('m58TransportCancelBtn')?.addEventListener('click',()=>hide('m58TransportForm'));
  $('m58AccommodationCancelBtn')?.addEventListener('click',()=>hide('m58AccommodationForm'));
  $('m58TransportSaveBtn')?.addEventListener('click',async()=>{if(!user||!event||event.creator_id!==user.id){alert('Seul l’organisateur peut ajouter un transport.');return;}const from=$('m58TransportManualFrom')?.value.trim()||'',to=$('m58TransportManualTo')?.value.trim()||'',departure=$('m58TransportManualDeparture')?.value||'',arrival=$('m58TransportManualArrival')?.value||'';if(!from||!to||!departure){$('m58TransportMsg').textContent='Indique au minimum le départ, la destination et la date/heure de départ.';return;}const cost=Number($('m58TransportManualCost')?.value||0),payload={type:$('m58TransportType')?.value||'other',from,to,departure,arrival,people:$('m58TransportManualPeople')?.value.trim()||'',cost:Number.isFinite(cost)?cost:0,booking:$('m58TransportManualBooking')?.value.trim()||'',note:$('m58TransportManualNote')?.value.trim()||'',title:from+' → '+to};const form=$('m58TransportForm');const editId=form?.dataset.editId||'';let r;if(editId)r=await sb.from('messages').update({content:V58_TRANSPORT_MARKER+JSON.stringify(payload)}).eq('id',editId).select('id').single();else r=await sb.from('messages').insert({event_id:event.id,user_id:user.id,content:V58_TRANSPORT_MARKER+JSON.stringify(payload)}).select('id').single();if(r.error){$('m58TransportMsg').textContent='❌ '+(r.error.message||'Erreur');return;}if(!editId)rememberLocalCreated('messages',r.data?.id);if(form)form.dataset.editId='';$('m58TransportSaveBtn').textContent='💾 Ajouter au planning';$('m58TransportMsg').textContent=editId?'✅ Trajet modifié.':'✅ Trajet enregistré.';hide('m58TransportForm');await v58LoadModuleLists();});
  $('m58AccommodationSaveBtn')?.addEventListener('click',async()=>{if(!user||!event||event.creator_id!==user.id){alert('Seul l’organisateur peut ajouter un hébergement.');return;}const name=$('m58AccommodationManualName')?.value.trim()||'',address=$('m58AccommodationManualAddress')?.value.trim()||'',checkin=$('m58AccommodationManualCheckin')?.value||'',checkout=$('m58AccommodationManualCheckout')?.value||'';if(!name||!checkin||!checkout){$('m58AccommodationMsg').textContent='Indique au minimum le nom et les dates d’arrivée/départ.';return;}if(new Date(checkout)<=new Date(checkin)){$('m58AccommodationMsg').textContent='❌ Le départ doit être après l’arrivée.';return;}const payload={type:$('m58AccommodationManualType')?.value||'other',name,address,checkin,checkout,people:$('m58AccommodationManualPeople')?.value.trim()||'',rooms:$('m58AccommodationManualRooms')?.value.trim()||'',capacity:Number($('m58AccommodationManualCapacity')?.value||0),price_per_night:Number($('m58AccommodationManualNight')?.value||0),total_cost:Number($('m58AccommodationManualTotal')?.value||0),booking:$('m58AccommodationManualBooking')?.value.trim()||'',note:$('m58AccommodationManualNote')?.value.trim()||''};const r=await sb.from('messages').insert({event_id:event.id,user_id:user.id,content:V58_ACCOMMODATION_MARKER+JSON.stringify(payload)}).select('id').single();if(r.error){$('m58AccommodationMsg').textContent='❌ '+(r.error.message||'Erreur');return;}rememberLocalCreated('messages',r.data?.id);$('m58AccommodationMsg').textContent='✅ Hébergement enregistré.';hide('m58AccommodationForm');await v58LoadModuleLists();});
}

document.addEventListener('click',e=>{if(e.target.closest('#eventTransportAddBtn')){e.preventDefault();e.stopImmediatePropagation();v58ModuleTab('transport');setTimeout(()=>$('m58TransportAddBtn')?.click(),120);return;}if(e.target.closest('#eventAccommodationAddBtn')){e.preventDefault();e.stopImmediatePropagation();v58ModuleTab('accommodation');setTimeout(()=>$('m58AccommodationAddBtn')?.click(),120);return;}if(e.target.closest('#eventLocalTravelAddBtn')){e.preventDefault();e.stopImmediatePropagation();v58ModuleTab('localtravel');setTimeout(()=>$('m58LocalTravelAddBtn')?.click(),120);return;}},true);
document.addEventListener('click',e=>{const tab=e.target.closest('.eventTab');if(!tab)return;if(tab.dataset.tab==='transport'||tab.dataset.tab==='accommodation'||tab.dataset.tab==='localtravel')setTimeout(v58LoadModuleLists,80);});
setTimeout(v58SetupModuleButtons,0);
