/* ===== original inline script 6 ===== */
let outingResultsData=[], outingFilter='all', outingSearch='', outingSelected=null;

// V54.7 — Un nouvel événement ne doit jamais être considéré comme ayant
// une sortie « Sortie / Activité » créée automatiquement sans informations réelles.
function isPlaceholderSelectedOuting(data){
  if(!data)return false;
  const name=String(data.name||'').trim().toLowerCase();
  // Une sortie générique ne peut jamais être considérée comme une vraie
  // sélection : elle ne doit ni alimenter le planning ni créer une réservation.
  const genericNames=new Set(['sortie','activité','activite','activity','outing']);
  if(genericNames.has(name))return true;
  return false;
}
function validSelectedOuting(data){
  return data && !isPlaceholderSelectedOuting(data) ? data : null;
}

// V54.11 — Un nouvel événement doit ouvrir le module Sorties/Activités vierge.
// Aucun choix, résultat ou réservation de l'événement précédent ne doit rester en mémoire.
function resetAiModuleState(){
  // V54.12 — un changement d'événement ne doit jamais réutiliser
  // le planning IA, ses réservations ou son état en mémoire.
  aiPlanLoadToken++;
  aiOutingPlanData=null;
  window.__myeventAiCurrentPlan=null;
  window.__myeventAiReservationPlan=null;
  window.__myeventAiReservationItems=null;
  if(typeof aiPlanReservationsCache!=='undefined') aiPlanReservationsCache=[];
}

/* V54.22 — La ligne retournée par save_event_outing est la source fraîche de la sélection. */

/* V54.13 — Lecture strictement isolée par event_id.
   On ne fait plus confiance à une éventuelle ligne renvoyée par une RPC
   si elle n'appartient pas explicitement à l'événement actuellement ouvert. */
function outingLocalKey(eventId){ return user&&eventId ? 'myevent_selected_outing_'+user.id+'_'+eventId : ''; }
function reservationLocalKey(eventId){ return user&&eventId ? 'myevent_event_reservation_'+user.id+'_'+eventId : ''; }
function saveLocalOutingSnapshot(data){ try{ const k=outingLocalKey(event?.id); if(k&&data) localStorage.setItem(k,JSON.stringify(data)); }catch(_){} }
function loadLocalOutingSnapshot(eventId){ try{ const k=outingLocalKey(eventId); const raw=k?localStorage.getItem(k):null; if(!raw)return null; const data=JSON.parse(raw); if(!data || String(data.event_id||eventId)!==String(eventId))return null; return validSelectedOuting(data); }catch(_){ return null; } }
function clearLocalOutingSnapshot(eventId){ try{ const k=outingLocalKey(eventId); if(k)localStorage.removeItem(k); }catch(_){} }
function saveLocalReservationSnapshot(data){ try{ const k=reservationLocalKey(event?.id); if(k&&data) localStorage.setItem(k,JSON.stringify(data)); }catch(_){} }
function loadLocalReservationSnapshot(eventId){ try{ const k=reservationLocalKey(eventId); const raw=k?localStorage.getItem(k):null; if(!raw)return null; const data=JSON.parse(raw); if(!data || (data.event_id && String(data.event_id)!==String(eventId)))return null; if(data.status==='cancelled')return null; return data; }catch(_){ return null; } }
function clearLocalReservationSnapshot(eventId){ try{ const k=reservationLocalKey(eventId); if(k)localStorage.removeItem(k); }catch(_){} }

async function getScopedEventOuting(eventId){
  if(!eventId||!sb)return null;

  // V54.20 — lire toutes les lignes de CET événement et retenir la plus
  // récente vraie sortie. Ne pas utiliser limit(1) : une ancienne ligne peut
  // sinon masquer la sortie réellement choisie.
  try{
    const direct=await sb.from('event_outings')
      .select('*')
      .eq('event_id',eventId);
    if(!direct.error){
      const rows=Array.isArray(direct.data)?direct.data:[];
      const validRows=rows
        .filter(row=>String(row?.event_id||'')===String(eventId))
        .filter(row=>validSelectedOuting(row));
      // Prendre la ligne la plus récente si plusieurs sélections historiques
      // existent pour le même événement.
      validRows.sort((a,b)=>{
        const da=new Date(a?.updated_at||a?.created_at||0).getTime();
        const db=new Date(b?.updated_at||b?.created_at||0).getTime();
        return db-da;
      });
      return validRows[0]||null;
    }
  }catch(_){ }

  // Secours uniquement si la lecture directe échoue (RLS / schéma ancien).
  try{
    const rpc=await sb.rpc('get_event_outing',{p_event_id:eventId});
    if(rpc.error)return null;
    const rows=Array.isArray(rpc.data)?rpc.data:[];
    const data=Array.isArray(rpc.data)
      ? (rows.find(row=>!row?.event_id||String(row.event_id)===String(eventId))||null)
      : rpc.data;
    // Une RPC ne doit jamais pouvoir injecter la sortie d'un autre événement.
    if(data?.event_id && String(data.event_id)!==String(eventId))return null;
    return validSelectedOuting(data);
  }catch(_){ }

  // V54.27 — secours local strictement lié à l'événement actif.
  return loadLocalOutingSnapshot(eventId);
}

function resetOutingModuleState(){
  outingStateVersion++;
  outingSearchVersion++;
  outingSelected=null;
  outingResultsData=[];
  outingFilter='all';
  outingSearch='';
  currentReservation=null;

  const selectedBox=$('outingSelectedBox');
  if(selectedBox){
    selectedBox.classList.add('hidden');
    selectedBox.innerHTML='';
  }

  const results=$('outingResults');
  if(results){
    results.innerHTML='<div class="outingEmpty">Appuie sur « Rechercher » pour trouver des restaurants et activités autour de l’événement.</div>';
  }

  const search=$('outingSearch');
  if(search)search.value='';

  const budget=$('outingMaxBudget');
  if(budget)budget.value='';

  const radius=$('outingRadius');
  if(radius)radius.value='5';

  const people=$('outingPeople');
  if(people)people.value='10';

  document.querySelectorAll('.outingFilter').forEach(b=>{
    b.classList.toggle('active',b.dataset.outingFilter==='all');
  });
}

/* V53.24 — protection contre les courses async :
   une ancienne lecture Supabase ne peut plus recréer une sortie
   après une suppression ou une nouvelle action. */
let outingStateVersion=0;
let outingSearchVersion=0;

function outingCategory(type){
  type=String(type||'').toLowerCase();
  if(['restaurant','fast_food'].includes(type))return 'restaurant';
  if(['museum','gallery','theatre','cinema','arts_centre','attraction'].includes(type))return 'culture';
  if(['park','playground','beach','viewpoint'].includes(type))return 'nature';
  return 'activity';
}

function isSelectedOuting(p){
  if(!outingSelected)return false;
  const sameName=
    String(p.name||'').trim().toLowerCase()===
    String(outingSelected.name||'').trim().toLowerCase();
  const sameCoords=
    Number.isFinite(Number(p.lat))&&
    Number.isFinite(Number(p.lon))&&
    Number.isFinite(Number(outingSelected.lat))&&
    Number.isFinite(Number(outingSelected.lon))&&
    Math.abs(Number(p.lat)-Number(outingSelected.lat))<0.00005&&
    Math.abs(Number(p.lon)-Number(outingSelected.lon))<0.00005;
  return sameName||sameCoords;
}

function renderOutingResults(){
  const el=$('outingResults'); if(!el)return;
  const q=outingSearch.trim().toLowerCase();
  const max=Number($('outingMaxBudget')?.value||0)||0;

  const arr=outingResultsData.filter(p=>{
    const cat=outingCategory(p.type);
    const okCat=outingFilter==='all'||cat===outingFilter;
    const hay=(String(p.name||'')+' '+String(p.type||'')+' '+String(p.address||'')).toLowerCase();
    const okQ=!q||hay.includes(q);
    const price=Number(p.price);
    const okBudget=!max||!Number.isFinite(price)||price<=max;
    return okCat&&okQ&&okBudget;
  });

  const status=$('outingMsg');
  if(status)status.textContent=arr.length+' résultat'+(arr.length>1?'s':'');

  el.innerHTML=arr.slice(0,30).map(p=>{
    const price=Number.isFinite(Number(p.price))&&Number(p.price)>0?eur(Number(p.price)):'Tarif à vérifier';
    const cat=outingCategory(p.type);
    const typeLabel=cat==='restaurant'?'Restaurant':cat==='culture'?'Culture':cat==='nature'?'Nature':'Activité';
    const selected=isSelectedOuting(p);

    return '<div class="outingCard '+(selected?'outingCardSelected':'')+'">'+
      '<div class="outingCardTop"><div class="outingName">'+
        (locationIcons[p.type]||'🎯')+' '+esc(p.name)+
        (selected?' <span class="outingSelectedBadge">⭐ Sélectionnée</span>':'')+
      '</div><div class="outingDistance">'+(p.distance!=null?Number(p.distance).toFixed(1)+' km':'')+'</div></div>'+
      '<div class="outingMeta"><span class="outingChip">'+typeLabel+'</span>'+
        '<span class="outingChip">💶 '+price+(Number.isFinite(Number(p.price))&&Number(p.price)>0?' / pers.':'')+'</span>'+
        '<span class="outingChip">👥 '+esc(String($('outingPeople')?.value||'1'))+' pers.</span></div>'+
      '<div class="outingAddress">📍 '+esc(p.address||'Adresse non disponible')+'</div>'+
      '<div class="outingActionsRow">'+
        '<button type="button" '+(selected?'class="secondary"':'')+' data-outing-select="'+esc(p.id||((p.lat||'')+'|'+(p.lon||'')))+'">'+
          (selected?'🔄 Changer de sortie':'⭐ Ajouter à l’événement')+
        '</button>'+
        (p.lat&&p.lon?'<button type="button" class="secondary" data-outing-map="'+p.lat+'|'+p.lon+'" data-outing-name="'+esc(p.name)+'">📍 Voir</button>':'')+
        (p.website?'<a class="secondary" style="display:grid;place-items:center;text-decoration:none" href="'+esc(p.website)+'" target="_blank" rel="noopener">↗️ Site</a>':'')+
      '</div></div>';
  }).join('')||'<div class="outingEmpty">Aucun lieu ne correspond à tes critères.</div>';
}

function renderSelectedOutingBox(data){
  const box=$('outingSelectedBox');
  if(!box||!data)return;
  const lat=data.lat!=null&&Number.isFinite(Number(data.lat))?Number(data.lat):null;
  const lon=data.lon!=null&&Number.isFinite(Number(data.lon))?Number(data.lon):null;
  const coords=(lat!=null&&lon!=null)
    ? '<div class="muted" style="margin-top:5px">🧭 Coordonnées : '+lat.toFixed(6)+' , '+lon.toFixed(6)+'</div>'
    : '';
  box.classList.remove('hidden');
  box.innerHTML=
    '<div>⭐ <b>Sortie sélectionnée</b></div>'+
    '<div style="margin-top:5px"><b>'+esc(data.name)+'</b></div>'+
    '<div class="outingMeta">'+
      (data.outing_type?'<span class="outingChip">'+esc(data.outing_type)+'</span>':'')+
      (data.price_per_person!=null?'<span class="outingChip">💶 '+eur(data.price_per_person)+' / pers.</span>':'')+
    '</div>'+coords+
    (data.address?'<div class="outingAddress">📍 '+esc(data.address)+'</div>':'')+
    (data.phone?'<div class="muted" style="margin-top:4px">📞 '+esc(data.phone)+'</div>':'')+
    '<div class="outingActionsRow">'+
      (lat!=null&&lon!=null?'<button type="button" class="secondary" data-outing-selected-map="'+lat+'|'+lon+'" data-outing-selected-name="'+esc(data.name)+'">📍 Voir la localisation</button>':'')+
      (data.website?'<a class="secondary" style="display:grid;place-items:center;text-decoration:none" href="'+esc(data.website)+'" target="_blank" rel="noopener">↗️ Site</a>':'')+
      '<button type="button" class="secondary" id="outingReservationBtn">📅 Réserver</button>'+
      '<button type="button" class="secondary" id="outingUnselectBtn">✕ Retirer</button>'+
    '</div><div id="outingReservationHost"></div>';
}

async function attachSelectedOutingActions(data){
  const box=$('outingSelectedBox');
  if(!box||!data)return;

  // V54.25 — Le bouton « Réserver » de la sortie sélectionnée doit être
  // branché directement sur le même formulaire que Salle/Planning.
  // Le handler délégué global peut être court-circuité par d'autres handlers
  // tactiles : on sécurise donc ici le bouton réellement affiché.
  const reserveBtn=$('outingReservationBtn');
  if(reserveBtn && reserveBtn.dataset.reservationBound!=='1'){
    reserveBtn.dataset.reservationBound='1';
    reserveBtn.addEventListener('click',async ev=>{
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if(!event||!outingSelected)return;
      reserveBtn.disabled=true;
      try{
        await refreshReservationBoxes();
        await openReservationForm('outing');
      }catch(err){
        console.error('outingReservationBtn',err);
        alert('Impossible d’ouvrir la réservation : '+(err?.message||err));
      }finally{
        reserveBtn.disabled=false;
      }
    },true);
  }

  $('outingUnselectBtn')?.addEventListener('click',async()=>{
    if(!event)return;
    outingStateVersion++;
    outingSelected=null;
    box.classList.add('hidden'); box.innerHTML=''; renderOutingResults();
    const deleteVersion=outingStateVersion;
    const d=await sb.rpc('delete_event_outing',{p_event_id:event.id});
    if(deleteVersion!==outingStateVersion)return;
    if(d.error){msg('outingMsg','Erreur : '+d.error.message,'err');await loadSelectedOuting();return;}
    outingSelected=null; box.classList.add('hidden'); box.innerHTML=''; renderOutingResults();
    try{await renderInlineSelectedEvent(); if(typeof refreshReservationBoxes==='function')await refreshReservationBoxes();}catch(_){ }
    msg('outingMsg','Sortie retirée de l’événement.','ok');
  });
}

async function loadSelectedOuting(){
  const box=$('outingSelectedBox'); if(!box||!event)return;

  const version=++outingStateVersion;

  let data=await getScopedEventOuting(event.id);
  if(version!==outingStateVersion)return;

  // Ne jamais afficher une sortie générique/placeholder comme une sortie choisie.
  // Si une ancienne ligne générique existe malgré tout dans Supabase, on la supprime
  // afin qu'elle ne puisse pas réapparaître au prochain chargement.
  if(isPlaceholderSelectedOuting(data)){
    try{ await sb.from('event_outings').delete().eq('event_id',event.id); }catch(_){}
    data=null;
  }else{
    data=validSelectedOuting(data);
  }

  if(!data){
    data=loadLocalOutingSnapshot(event.id);
  }
  if(!data){
    outingSelected=null;
    box.classList.add('hidden');
    box.innerHTML='';
    renderOutingResults();
    return;
  }

  outingSelected=data;
  renderSelectedOutingBox(data);
  await attachSelectedOutingActions(data);

  renderOutingResults();

  $('outingUnselectBtn')?.addEventListener('click',async()=>{
    if(!event)return;

    /* Invalidation immédiate de toutes les lectures en cours. */
    outingStateVersion++;
    outingSelected=null;
    box.classList.add('hidden');
    box.innerHTML='';
    renderOutingResults();

    const deleteVersion=outingStateVersion;
    const d=await sb.rpc('delete_event_outing',{p_event_id:event.id});

    if(deleteVersion!==outingStateVersion)return;

    if(d.error){
      msg('outingMsg','Erreur : '+d.error.message,'err');
      await loadSelectedOuting();
      return;
    }

    outingSelected=null;
    clearLocalOutingSnapshot(event.id);
    clearLocalReservationSnapshot(event.id);
    box.classList.add('hidden');
    box.innerHTML='';
    renderOutingResults();
    msg('outingMsg','Sortie retirée de l’événement.','ok');
  });
}

async function selectOuting(id){
  const p=outingResultsData.find(x=>
    String(x.id)===String(id)||
    String((x.lat||'')+'|'+(x.lon||''))===String(id)
  );
  if(!p||!event||!user)return;

  const version=++outingStateVersion;

  const payload={
    p_event_id:event.id,
    p_name:p.name,
    p_address:p.address||null,
    p_lat:Number(p.lat)||null,
    p_lon:Number(p.lon)||null,
    p_outing_type:outingCategory(p.type),
    p_price_per_person:Number.isFinite(Number(p.price))?Number(p.price):null,
    p_website:p.website||null,
    p_phone:p.phone||null,
    p_source:'openstreetmap'
  };

  const r=await sb.rpc('save_event_outing',payload);
  if(version!==outingStateVersion)return;

  if(r.error){
    msg('outingMsg','Erreur de sauvegarde : '+r.error.message,'err');
    return;
  }

  if(r.data){
    // V54.22 — La RPC save_event_outing vient de confirmer l'enregistrement.
    // On utilise d'abord la ligne qu'elle vient de retourner, au lieu de faire
    // immédiatement une seconde lecture qui peut être bloquée/retardée par RLS.
    // Cela garantit que la sélection fraîche alimente aussi le Planning.
    let savedOuting=Array.isArray(r.data)?(r.data[0]||null):r.data;
    if(savedOuting && savedOuting.event_id && String(savedOuting.event_id)!==String(event.id)) savedOuting=null;
    outingSelected=validSelectedOuting(savedOuting);
    if(!outingSelected) outingSelected=await getScopedEventOuting(event.id);
    if(outingSelected) saveLocalOutingSnapshot(outingSelected);
    if(version!==outingStateVersion)return;
    const box=$('outingSelectedBox');

    if(box&&outingSelected){
      renderSelectedOutingBox(outingSelected);
      await attachSelectedOutingActions(outingSelected);
    }
    renderOutingResults();

    // V54.14 — Le planning de l'accueil est rendu à partir d'un snapshot
    // chargé par renderInlineSelectedEvent(). Après une nouvelle sélection,
    // ce snapshot est forcément obsolète : on force donc un rendu complet
    // depuis Supabase pour que la sortie apparaisse immédiatement dans le
    // Planning, avec sa réservation éventuelle.
    try{
      await renderInlineSelectedEvent();
      if(typeof refreshReservationBoxes==='function') await refreshReservationBoxes();
    }catch(e){
      console.error('V54.14 refresh planning after outing selection',e);
    }
  }else{
    await loadSelectedOuting();
    try{
      await renderInlineSelectedEvent();
      if(typeof refreshReservationBoxes==='function') await refreshReservationBoxes();
    }catch(e){
      console.error('V54.14 refresh planning after outing load',e);
    }
  }

  msg('outingMsg','⭐ Sortie sélectionnée et enregistrée dans ton événement.','ok');
}

async function searchOutings(){
  if(!event)return;

  const el=$('outingResults');
  if(el)el.innerHTML='<div class="outingEmpty">🔎 Recherche autour du centre de recherche 🎯…</div>';

  const searchVersion=++outingSearchVersion;
  const geo=await getActivitySearchCenter();

  if(searchVersion!==outingSearchVersion)return;

  if(!geo){
    if(el)el.innerHTML='<div class="outingEmpty">Ajoute une adresse ou un lieu à l’événement pour définir le centre de recherche.</div>';
    return;
  }

  const km=Number($('outingRadius')?.value||5);
  const api='/api/search-places?mode=nearby&lat='+encodeURIComponent(geo.lat)+'&lon='+encodeURIComponent(geo.lon)+'&radius='+encodeURIComponent(km);

  try{
    const r=await fetch(api,{headers:{Accept:'application/json'}});
    const d=await r.json().catch(()=>null);

    if(searchVersion!==outingSearchVersion)return;
    if(!r.ok||!d)throw new Error(d?.error||'Recherche indisponible');

    outingResultsData=(d.results||[])
      .map(x=>({...x,lat:+x.lat,lon:+x.lon,distance:Number(x.distance),price:x.price!=null?Number(x.price):null}))
      .filter(x=>x.name&&Number.isFinite(x.lat)&&Number.isFinite(x.lon));

    renderOutingResults();

    if(searchVersion!==outingSearchVersion)return;
    await loadSelectedOuting();

  }catch(e){
    if(searchVersion!==outingSearchVersion)return;
    if(el)el.innerHTML='<div class="outingEmpty">La recherche est momentanément indisponible. Réessaie dans un instant.</div>';
    msg('outingMsg',e.message||String(e),'err');
  }
}

(function(){
  const bind=()=>{
    $('outingSearchBtn')?.addEventListener('click',searchOutings);

    $('outingResetBtn')?.addEventListener('click',()=>{
      outingSearch='';
      outingFilter='all';
      if($('outingSearch'))$('outingSearch').value='';
      if($('outingMaxBudget'))$('outingMaxBudget').value='';
      document.querySelectorAll('.outingFilter').forEach(b=>
        b.classList.toggle('active',b.dataset.outingFilter==='all')
      );
      renderOutingResults();
    });

    $('outingSearch')?.addEventListener('input',e=>{
      outingSearch=e.target.value||'';
      renderOutingResults();
    });

    $('outingMaxBudget')?.addEventListener('input',renderOutingResults);

    $('outingRadius')?.addEventListener('change',()=>{
      if(event)searchOutings();
    });

    document.addEventListener('click',e=>{
      const f=e.target.closest('.outingFilter');
      if(f){
        outingFilter=f.dataset.outingFilter||'all';
        document.querySelectorAll('.outingFilter').forEach(b=>
          b.classList.toggle('active',b===f)
        );
        renderOutingResults();
        return;
      }

      const s=e.target.closest('[data-outing-select]');
      if(s){
        selectOuting(s.dataset.outingSelect);
        return;
      }

      const sm=e.target.closest('[data-outing-selected-map]');
      if(sm){
        const [lat,lon]=sm.dataset.outingSelectedMap.split('|').map(Number);
        if(Number.isFinite(lat)&&Number.isFinite(lon)){
          showEventTab('locations',true);
          setTimeout(()=>{
            if(typeof setLocationMapView==='function')setLocationMapView(lat,lon,17);
            if(locationMap){
              if(locationOutingMarker)locationMap.removeLayer(locationOutingMarker);
              locationOutingMarker=L.marker([lat,lon],{icon:makeLocationIcon('🍽️','#278cff')})
                .addTo(locationMap)
                .bindPopup('<b>🍽️ '+esc(sm.dataset.outingSelectedName||'Sortie sélectionnée')+'</b>')
                .openPopup();
            }
            $('locationMap')?.scrollIntoView({behavior:'smooth',block:'center'});
          },180);
        }
        return;
      }

      const m=e.target.closest('[data-outing-map]');
      if(m){
        const [lat,lon]=m.dataset.outingMap.split('|').map(Number);
        if(Number.isFinite(lat)&&Number.isFinite(lon)){
          showEventTab('locations',true);
          setTimeout(()=>{
            if(typeof setLocationMapView==='function')setLocationMapView(lat,lon,17);
            if(locationMap){
              if(locationOutingMarker)locationMap.removeLayer(locationOutingMarker);
              locationOutingMarker=L.marker([lat,lon],{icon:makeLocationIcon('🍽️','#278cff')})
                .addTo(locationMap)
                .bindPopup('<b>🍽️ '+esc(m.dataset.outingName||'Sortie')+'</b>')
                .openPopup();
            }
            $('locationMap')?.scrollIntoView({behavior:'smooth',block:'center'});
          },180);
        }
        return;
      }
    });
  };

  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',bind,{once:true});
  else
    bind();
})();

/* ===== original inline script 7 ===== */
let currentReservation=null;
function reservationDefaultDate(){
  if(!event?.event_date)return '';
  const d=new Date(event.event_date);
  if(Number.isNaN(d.getTime()))return '';
  const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,16);
}
function reservationFormHtml(prefix){
  const dt=reservationDefaultDate();
  const datePart=dt?dt.slice(0,10):'';
  const timePart=dt?dt.slice(11,16):'';
  const people=Math.max(1,Number($('outingPeople')?.value||10)||10);
  return '<div class="reservationBox reservationFormActive" id="'+prefix+'ReservationForm"><div class="reservationTitle">📅 Préparer la réservation</div>'+
    '<div class="reservationGrid">'+
    '<label>Date<input id="'+prefix+'ReservationDate" type="date" value="'+datePart+'" autocomplete="off"></label>'+
    '<label>Heure<input id="'+prefix+'ReservationTime" type="time" value="'+timePart+'" autocomplete="off"></label>'+
    '<label>Personnes<input id="'+prefix+'ReservationPeople" type="number" min="1" step="1" value="'+people+'" inputmode="numeric" autocomplete="off"></label>'+
    '<label class="reservationFull">Note pour la réservation<textarea id="'+prefix+'ReservationNote" placeholder="Ex. table à l’intérieur, anniversaire…"></textarea></label>'+
    '</div><div class="reservationActions"><button type="button" class="secondary" id="'+prefix+'ReservationSave">💾 Enregistrer</button><button type="button" class="secondary" id="'+prefix+'ReservationCancel">Annuler</button></div></div>';
}
async function loadEventReservation(){
  if(!event)return null;
  const r=await sb.rpc('get_event_reservation',{p_event_id:event.id});
  if(r.error){
    console.error('get_event_reservation:', r.error);
    currentReservation=null;
    return null;
  }
  currentReservation=Array.isArray(r.data)?(r.data[0]||null):r.data;
  // V54.13 : une réservation retournée pour un autre événement ne peut jamais
  // être réutilisée par l'événement courant.
  if(currentReservation?.event_id && String(currentReservation.event_id)!==String(event.id))currentReservation=null;
  // V53.13 FIX : une réservation annulée ne doit plus rester affichée
  // dans le bloc de la sortie ni être considérée comme une réservation active.
  if(currentReservation?.status==='cancelled')currentReservation=null;
  if(!currentReservation) currentReservation=loadLocalReservationSnapshot(event.id);
  return currentReservation;
}
async function saveEventReservation(outingId,prefix){
  if(!event||!outingSelected)return;
  const date=$(prefix+'ReservationDate')?.value||'';
  const time=$(prefix+'ReservationTime')?.value||'';
  const people=Math.max(1,Number($(prefix+'ReservationPeople')?.value||1)||1);
  const note=$(prefix+'ReservationNote')?.value||null;
  if(!date||!time){alert('Choisis une date et une heure.');return;}
  const localDate=new Date(date+'T'+time);
  if(Number.isNaN(localDate.getTime())){alert('La date ou l’heure est invalide.');return;}
  const r=await sb.rpc('save_event_reservation',{p_event_id:event.id,p_outing_id:outingId||selected.id,p_reserved_at:localDate.toISOString(),p_party_size:people,p_note:note});
  if(r.error){alert('Impossible d’enregistrer la réservation : '+r.error.message);return;}
  currentReservation=Array.isArray(r.data)?(r.data[0]||null):r.data;
  document.getElementById(prefix+'ReservationForm')?.remove();
  refreshReservationBoxes();
  msg('outingMsg','📅 Réservation préparée et enregistrée dans ton événement.','ok');
}
function reservationStatusLabel(r){
  if(!r)return 'Aucune réservation enregistrée.';
  const d=r.reserved_at?new Date(r.reserved_at):null;
  const when=d&&!Number.isNaN(d.getTime())?d.toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'}):'';
  const status=r.status==='confirmed'?'confirmée':r.status==='cancelled'?'annulée':'à confirmer';
  return '📅 Réservation <b>'+status+'</b>'+(when?' · '+esc(when):'')+' · '+esc(String(r.party_size||1))+' pers.';
}
function reservationBoxHtml(prefix){
  if(!currentReservation)return '<div class="reservationBox"><div class="reservationTitle">📅 Réservation</div><div class="muted">Aucune réservation enregistrée.</div><button type="button" class="secondary" id="'+prefix+'ReservationOpen">📅 Préparer la réservation</button><div id="'+prefix+'ReservationHost"></div></div>';
  return '<div class="reservationBox"><div class="reservationTitle">📅 Réservation</div><div class="reservationStatus '+(currentReservation.status==='cancelled'?'cancelled':'pending')+'">'+reservationStatusLabel(currentReservation)+'</div><div class="reservationActions"><button type="button" class="secondary" id="'+prefix+'ReservationOpen">✏️ Modifier</button><button type="button" class="secondary" id="'+prefix+'ReservationDelete">✕ Annuler</button></div><div id="'+prefix+'ReservationHost"></div></div>';
}
async function openReservationForm(prefix){
  document.getElementById(prefix+'ReservationForm')?.remove();
  let host=document.getElementById(prefix+'ReservationHost');
  if(!host){
    const box=document.getElementById(prefix+'ReservationBox') || document.getElementById(prefix+'ReservationHost')?.parentElement || document.getElementById('homeReservationBox');
    if(box){
      host=document.createElement('div');
      host.id=prefix+'ReservationHost';
      box.appendChild(host);
    }
  }
  if(!host)return;
  host.insertAdjacentHTML('beforeend',reservationFormHtml(prefix));
  if(currentReservation){
    const d=currentReservation.reserved_at?new Date(currentReservation.reserved_at):null;
    if(d&&!Number.isNaN(d.getTime())){
      const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
      $(prefix+'ReservationDate').value=local.toISOString().slice(0,10);
      $(prefix+'ReservationTime').value=local.toISOString().slice(11,16);
    }
    $(prefix+'ReservationPeople').value=currentReservation.party_size||1;
    $(prefix+'ReservationNote').value=currentReservation.note||'';
  }
  $(prefix+'ReservationCancel')?.addEventListener('click',()=>document.getElementById(prefix+'ReservationForm')?.remove());
  $(prefix+'ReservationSave')?.addEventListener('click',()=>saveEventReservation(outingSelected?.id,prefix));
}
async function refreshReservationBoxes(){
  // V54.7 : aucune réservation ne doit apparaître sur un événement sans sortie réelle.
  const selected=validSelectedOuting(outingSelected);
  if(!selected){
    outingSelected=null;
    currentReservation=null;
  }else{
    await loadEventReservation();
    // Une ancienne réservation liée à une autre sortie ne doit pas être recyclée.
    if(currentReservation?.outing_id && selected.id && String(currentReservation.outing_id)!==String(selected.id)){
      currentReservation=null;
    }
  }
  const choiceKey=user&&event?'myevent_event_planning_choice_'+user.id+'_'+event.id:'';
  let planningChoice='manual';
  try{ const saved=choiceKey?localStorage.getItem(choiceKey):null; if(saved==='ai')planningChoice='ai'; }catch(_){ }
  const host=$('outingReservationHost'); if(host)host.innerHTML=reservationBoxHtml('outing');
  const home=$('homeReservationBox');
  if(home){
    home.style.display=planningChoice==='manual'?'block':'none';
    home.innerHTML=planningChoice==='manual'?reservationBoxHtml('home'):'';
  }
  $('outingReservationOpen')?.addEventListener('click',()=>openReservationForm('outing'));
  $('homeReservationOpen')?.addEventListener('click',()=>openReservationForm('home'));
  $('outingReservationDelete')?.addEventListener('click',cancelEventReservation);
  $('homeReservationDelete')?.addEventListener('click',cancelEventReservation);
  $('homeReserve')?.addEventListener('click',()=>openReservationForm('home'));
}
async function cancelEventReservation(){
  if(!event)return;
  const r=await sb.rpc('cancel_event_reservation',{p_event_id:event.id});
  if(r.error){alert('Impossible d’annuler : '+r.error.message);return;}
  currentReservation=null;
  clearLocalReservationSnapshot(event.id);
  const host=$('outingReservationHost');
  if(host)host.innerHTML=reservationBoxHtml('outing');
  const home=$('homeReservationBox');
  if(home)home.innerHTML=reservationBoxHtml('home');
  $('outingReservationOpen')?.addEventListener('click',()=>openReservationForm('outing'));
  $('homeReservationOpen')?.addEventListener('click',()=>openReservationForm('home'));
  msg('outingMsg','Réservation annulée.','ok');
}
function mountOutingReservationHost(){
  const box=$('outingSelectedBox'); if(!box||!outingSelected)return;
  let host=$('outingReservationHost');
  if(!host){host=document.createElement('div');host.id='outingReservationHost';box.appendChild(host);}
  refreshReservationBoxes();
}
// V53 : branchement sur les boutons de réservation déjà injectés dans les cartes sélectionnées.
document.addEventListener('click',e=>{
  const b=e.target.closest('#outingReservationBtn');
  if(b){e.preventDefault();mountOutingReservationHost();setTimeout(()=>openReservationForm('outing'),30);}
  const h=e.target.closest('[data-home-reserve]');
  if(h){e.preventDefault();openReservationForm('home');}
});
// Après changement/sélection, actualise les informations de réservation.
const oldSelectOutingV53=selectOuting;
selectOuting=async function(id){
  await oldSelectOutingV53(id);
  setTimeout(()=>{mountOutingReservationHost();refreshReservationBoxes();},60);
};
const oldLoadSelectedOutingV53=loadSelectedOuting;
loadSelectedOuting=async function(){
  await oldLoadSelectedOutingV53();
  setTimeout(()=>{if(outingSelected){mountOutingReservationHost();refreshReservationBoxes();}},60);
};

/* ===== original inline script 8 ===== */
/* V53.3 — Formulaire réservation iPhone : champs pilotés par boutons + éditeur tactile */
(function(){
  function reservationStateFromCurrent(prefix){
    const dt=reservationDefaultDate();
    let date=dt?dt.slice(0,10):'';
    let time=dt?dt.slice(11,16):'';
    let people=Math.max(1,Number($( 'outingPeople')?.value||10)||10);
    let note='';
    if(currentReservation){
      const d=currentReservation.reserved_at?new Date(currentReservation.reserved_at):null;
      if(d&&!Number.isNaN(d.getTime())){
        const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
        date=local.toISOString().slice(0,10); time=local.toISOString().slice(11,16);
      }
      people=Math.max(1,Number(currentReservation.party_size||people)||people);
      note=currentReservation.note||'';
    }
    return {date,time,people,note,prefix};
  }
  function escAttr(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
  function fieldButton(id,label,value,field){
    return '<button type="button" class="secondary reservationFieldButton" id="'+id+'" data-res-field="'+field+'"><span class="reservationFieldLabel">'+label+'</span><strong>'+escAttr(value||'À renseigner')+'</strong></button>';
  }
  window.reservationFormHtml=function(prefix){
    const st=reservationStateFromCurrent(prefix);
    return '<div class="reservationBox reservationFormActive" id="'+prefix+'ReservationForm">'+
      '<div class="reservationTitle">📅 Préparer la réservation</div>'+
      '<div class="reservationTouchHint">Appuie sur chaque champ pour le compléter.</div>'+
      '<div class="reservationTouchGrid">'+
      fieldButton(prefix+'ReservationDateBtn','📅 Date',st.date,'date')+
      fieldButton(prefix+'ReservationTimeBtn','🕐 Heure',st.time,'time')+
      fieldButton(prefix+'ReservationPeopleBtn','👥 Personnes',String(st.people),'people')+
      fieldButton(prefix+'ReservationNoteBtn','📝 Note',st.note||'Aucune note','note')+
      '</div>'+
      '<div class="reservationActions"><button type="button" class="secondary" id="'+prefix+'ReservationSave">💾 Enregistrer</button><button type="button" class="secondary" id="'+prefix+'ReservationCancel">Annuler</button></div>'+
      '<div id="'+prefix+'ReservationDraft" data-date="'+escAttr(st.date)+'" data-time="'+escAttr(st.time)+'" data-people="'+escAttr(st.people)+'" data-note="'+escAttr(st.note)+'"></div>'+
      '</div>';
  };
  function draftEl(prefix){return $(prefix+'ReservationDraft');}
  function updateBtn(prefix,field,value){
    const map={date:'Date',time:'Heure',people:'Personnes',note:'Note'};
    const b=document.querySelector('#'+prefix+'ReservationForm [data-res-field="'+field+'"]');
    if(b){const strong=b.querySelector('strong'); if(strong)strong.textContent=value|| (field==='note'?'Aucune note':'À renseigner');}
  }
  function openEditor(prefix,field){
    const d=draftEl(prefix); if(!d)return;
    let current=d.dataset[field]||'';
    const labels={date:'Choisis la date (AAAA-MM-JJ)',time:'Choisis l’heure (HH:MM)',people:'Nombre de personnes',note:'Note pour la réservation'};
    const types={date:'date',time:'time',people:'number',note:'textarea'};
    let val=current;
    const wrap=document.createElement('div');
    wrap.className='reservationEditOverlay';
    wrap.innerHTML='<div class="reservationEditCard"><div class="reservationTitle">'+labels[field]+'</div><div class="reservationEditBody"></div><div class="reservationActions"><button type="button" class="secondary" data-edit-ok>Valider</button><button type="button" class="secondary" data-edit-cancel>Annuler</button></div></div>';
    const body=wrap.querySelector('.reservationEditBody');
    let control;
    if(types[field]==='textarea'){
      control=document.createElement('textarea'); control.value=val; control.placeholder='Ex. table à l’intérieur, anniversaire…';
    }else{
      control=document.createElement('input'); control.type=types[field]; control.value=val; control.inputMode=field==='people'?'numeric':undefined;
      if(field==='people'){control.min='1';control.step='1';}
    }
    control.className='reservationEditControl';
    body.appendChild(control); document.body.appendChild(wrap);
    setTimeout(()=>{control.focus(); if(control.select)control.select();},80);
    const close=()=>wrap.remove();
    wrap.querySelector('[data-edit-cancel]').addEventListener('click',close);
    wrap.querySelector('[data-edit-ok]').addEventListener('click',()=>{
      let x=control.value||'';
      if(field==='people')x=String(Math.max(1,parseInt(x,10)||1));
      d.dataset[field]=x; updateBtn(prefix,field,x); close();
    });
  }
  window.openReservationForm=function(prefix){
    document.getElementById(prefix+'ReservationForm')?.remove();
    let host=document.getElementById(prefix+'ReservationHost');
    if(!host){
      const box=document.getElementById(prefix+'ReservationBox') || document.getElementById('homeReservationBox');
      if(box){host=document.createElement('div');host.id=prefix+'ReservationHost';box.appendChild(host);}
    }
    if(!host)return;
    host.insertAdjacentHTML('beforeend',reservationFormHtml(prefix));
    const form=$(prefix+'ReservationForm');
    form.addEventListener('click',e=>{
      const f=e.target.closest('[data-res-field]');
      if(f){e.preventDefault();e.stopPropagation();openEditor(prefix,f.dataset.resField);}
    },true);
    $(prefix+'ReservationCancel')?.addEventListener('click',()=>form.remove());
    $(prefix+'ReservationSave')?.addEventListener('click',()=>saveEventReservation(outingSelected?.id,prefix));
    form.scrollIntoView({behavior:'smooth',block:'center'});
  };
  window.saveEventReservation=async function(outingId,prefix){
    if(!event){alert('Aucun événement sélectionné.');return;}
    if(!sb){alert('Connexion à Supabase indisponible. Recharge la page puis réessaie.');return;}
    let selected=validSelectedOuting(outingSelected);
    if(!selected){try{await loadSelectedOuting();selected=validSelectedOuting(outingSelected);}catch(e){console.error(e);}}
    if(!selected){
      try{selected=await getScopedEventOuting(event.id); if(selected)outingSelected=selected;}catch(e){console.error(e);}
    }
    if(!selected){alert('Aucune sortie sélectionnée. Sélectionne d’abord une sortie.');return;}
    const d=draftEl(prefix); if(!d){alert('Formulaire introuvable.');return;}
    const date=d.dataset.date||''; const time=d.dataset.time||'';
    const people=Math.max(1,parseInt(d.dataset.people||'1',10)||1); const note=d.dataset.note||null;
    if(!date||!time){alert('Choisis une date et une heure.');return;}
    const localDate=new Date(date+'T'+time);
    if(Number.isNaN(localDate.getTime())){alert('La date ou l’heure est invalide.');return;}
    const saveBtn=document.getElementById(prefix+'ReservationSave');
    if(saveBtn){if(saveBtn.dataset.saving==='1')return;saveBtn.dataset.saving='1';saveBtn.disabled=true;saveBtn.textContent='⏳ Enregistrement…';}
    try{
      const r=await sb.rpc('save_event_reservation',{p_event_id:event.id,p_outing_id:outingId||outingSelected.id,p_reserved_at:localDate.toISOString(),p_party_size:people,p_note:note});
      if(r.error){
        console.error('save_event_reservation',r.error);
        alert('Impossible d’enregistrer la réservation.\n\n'+r.error.message+'\n\nSi la fonction V53 n’a pas encore été créée dans Supabase, exécute le SQL V53.');
        return;
      }
      currentReservation=Array.isArray(r.data)?(r.data[0]||null):r.data;
      if(!currentReservation){alert('La réservation n’a pas été retournée par Supabase.');return;}
      saveLocalReservationSnapshot(currentReservation);
      document.getElementById(prefix+'ReservationForm')?.remove();
      await refreshReservationBoxes();
      msg('outingMsg','📅 Réservation préparée et enregistrée dans ton événement.','ok');
    }catch(err){
      console.error(err);
      alert('Erreur pendant l’enregistrement : '+(err?.message||err));
    }finally{
      if(saveBtn){saveBtn.disabled=false;saveBtn.dataset.saving='';saveBtn.textContent='💾 Enregistrer';}
    }
  };
  // V53.5 : secours tactile iPhone pour le bouton Enregistrer.
  document.addEventListener('click',function(e){
    const b=e.target.closest('[id$="ReservationSave"]');
    if(!b || b.dataset.saving==='1')return;
    const prefix=b.id.replace(/ReservationSave$/,'');
    window.saveEventReservation(outingSelected?.id,prefix);
  },true);
})();

/* ===== original inline script 9 ===== */
/* V54.26 — persistance stricte de la sélection et de la réservation sur l’événement actif. */

/* ===== original inline script 10 ===== */
/* V54.25 — bouton Réserver Sorties branché directement */

/* ===== original inline script 11 ===== */
/* V53.6 — Confirmation de réservation par l'organisateur */
(function(){
  function isOrganizer(){ return !!(event && user && event.creator_id === user.id); }
  async function confirmEventReservation(){
    if(!event)return;
    if(!isOrganizer()){ alert('Seul l’organisateur peut confirmer la réservation.'); return; }
    // V54.24 : relecture obligatoire juste avant confirmation pour éviter
    // qu'un bloc Planning affiche une réservation devenue obsolète.
    try{
      const freshOuting=await getScopedEventOuting(event.id);
      if(freshOuting)outingSelected=freshOuting;
      await loadEventReservation();
    }catch(e){ console.error('refresh avant confirmation',e); }
    const selected=validSelectedOuting(outingSelected);
    if(!selected){
      await refreshReservationBoxes();
      alert('Impossible de confirmer la réservation : aucune sortie sélectionnée pour cet événement.');
      return;
    }
    if(!currentReservation){
      await refreshReservationBoxes();
      alert('Impossible de confirmer la réservation : aucune réservation à confirmer.');
      return;
    }
    if(currentReservation.event_id && String(currentReservation.event_id)!==String(event.id)){
      currentReservation=null;
      await refreshReservationBoxes();
      alert('Impossible de confirmer la réservation : la réservation appartient à un autre événement.');
      return;
    }
    if(currentReservation.outing_id && selected.id && String(currentReservation.outing_id)!==String(selected.id)){
      currentReservation=null;
      await refreshReservationBoxes();
      alert('Impossible de confirmer la réservation : la réservation ne correspond pas à la sortie sélectionnée.');
      return;
    }
    if(currentReservation.status!=='pending'){
      await refreshReservationBoxes();
      alert('Cette réservation n’est plus à confirmer.');
      return;
    }
    const r=await sb.rpc('confirm_event_reservation',{p_event_id:event.id});
    if(r.error){
      console.error('confirm_event_reservation',r.error);
      await refreshReservationBoxes();
      alert('Impossible de confirmer la réservation : '+r.error.message);
      return;
    }
    currentReservation=Array.isArray(r.data)?(r.data[0]||null):r.data;
    await refreshReservationBoxes();
    msg('outingMsg','✅ Réservation confirmée.','ok');
  }
  window.confirmEventReservationV536=confirmEventReservation;
  const oldReservationBoxHtmlV536=reservationBoxHtml;
  reservationBoxHtml=function(prefix){
    if(!currentReservation) return oldReservationBoxHtmlV536(prefix);
    const cancelled=currentReservation.status==='cancelled';
    const confirmed=currentReservation.status==='confirmed';
    const cls=cancelled?'cancelled':confirmed?'confirmed':'pending';
    const confirmBtn=(!cancelled&&!confirmed&&isOrganizer())
      ? '<button type="button" class="secondary reservationConfirmBtn" id="'+prefix+'ReservationConfirm">✅ Confirmer la réservation</button>' : '';
    return '<div class="reservationBox"><div class="reservationTitle">📅 Réservation</div>'+
      '<div class="reservationStatus '+cls+'">'+reservationStatusLabel(currentReservation)+'</div>'+
      confirmBtn+
      '<div class="reservationActions"><button type="button" class="secondary" id="'+prefix+'ReservationOpen">✏️ Modifier</button>'+
      (cancelled?'':'<button type="button" class="secondary" id="'+prefix+'ReservationDelete">✕ Annuler</button>')+
      '</div><div id="'+prefix+'ReservationHost"></div></div>';
  };
  const oldRefreshReservationBoxesV536=refreshReservationBoxes;
  refreshReservationBoxes=async function(){
    await oldRefreshReservationBoxesV536();
    $('outingReservationConfirm')?.addEventListener('click',confirmEventReservation);
    $('homeReservationConfirm')?.addEventListener('click',confirmEventReservation);
  };
})();

/* ===== original inline script 12 ===== */
let aiOutingPlanData=null;

// V54.6 : helper global unique pour les valeurs injectées dans les attributs HTML.
// Important : ne pas créer un wrapper qui rappelle window.escAttr, car une
// déclaration globale function escAttr() référence elle-même window.escAttr
// et provoque une récursion infinie sur iOS.
function escAttr(v){
  return String(v??'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/\"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
window.escAttr=escAttr;

function ensureAiPlanEditorModal(){
  if($('aiPlanEditorModal'))return;
  const wrap=document.createElement('div');
  wrap.id='aiPlanEditorModal';
  wrap.className='aiPlanModal';
  wrap.setAttribute('aria-hidden','true');
  wrap.innerHTML='<div class="aiPlanPanel" role="dialog" aria-modal="true" aria-labelledby="aiPlanEditorTitle">'+
    '<div class="aiPlanHeader"><h3 id="aiPlanEditorTitle">✏️ Modifier le planning IA</h3><button type="button" class="secondary aiPlanClose" id="aiPlanEditorClose">✕</button></div>'+
    '<div class="aiPlanIntro">Modifie directement les étapes du planning actuel. Aucun appel à l’IA n’est nécessaire.</div>'+
    '<div id="aiPlanEditorStatus" class="aiPlanStatus"></div><div id="aiPlanEditorSteps"></div>'+
    '<div class="aiPlanActions"><button type="button" id="aiPlanEditorSave">💾 Enregistrer les modifications</button><button type="button" class="secondary" id="aiPlanEditorRegenerate">✨ Régénérer avec l’IA</button></div>'+
    '<button type="button" class="secondary" id="aiPlanEditorCancel" style="width:100%;margin-top:8px">Annuler</button>'+
    '</div>';
  document.body.appendChild(wrap);
  $('aiPlanEditorClose')?.addEventListener('click',closeAiPlanEditor);
  $('aiPlanEditorCancel')?.addEventListener('click',closeAiPlanEditor);
  $('aiPlanEditorRegenerate')?.addEventListener('click',()=>{const current=window.__myeventAiCurrentPlan||{};closeAiPlanEditor();openAiOutingPlanner(true);});
  $('aiPlanEditorSave')?.addEventListener('click',saveAiPlanEdits);
  wrap.addEventListener('click',e=>{if(e.target===wrap)closeAiPlanEditor();});
}
window.__myeventOpenAiPlanEditor=function(){
  try{ openAiPlanEditor(); }catch(e){ console.error('[MyEvent V54.6] openAiPlanEditor:',e); alert('Impossible d’ouvrir la modification du planning : '+(e.message||String(e))); }
};
function openAiPlanEditor(){
  ensureAiPlanEditorModal();
  const current=window.__myeventAiCurrentPlan;
  if(!current?.plan||!Array.isArray(current.items)||!current.items.length){
    alert('Le planning IA actuel n’est pas disponible pour modification.');
    return;
  }
  const box=$('aiPlanEditorSteps');
  box.innerHTML=current.items.map((item,i)=>{
    const step=i+1;
    const type=String(item.outing_type||item.type||'activity');
    return '<div class="aiPlanOption" style="margin-top:10px">'+
      '<div class="aiPlanOptionTitle">'+step+'. '+esc(item.name||'Étape')+'</div>'+
      '<div class="aiPlanGrid" style="margin-top:8px">'+
      '<label>Nom<input id="aiEditName'+step+'" value="'+escAttr(item.name||'')+'"></label>'+ 
      '<label>Type<select id="aiEditType'+step+'"><option value="activity" '+(type==='activity'?'selected':'')+'>🎯 Activité</option><option value="restaurant" '+(type==='restaurant'?'selected':'')+'>🍽️ Restaurant</option><option value="culture" '+(type==='culture'?'selected':'')+'>🏛️ Culture</option><option value="nature" '+(type==='nature'?'selected':'')+'>🌳 Nature</option></select></label>'+ 
      '<label>Heure<input id="aiEditTime'+step+'" type="time" value="'+escAttr(String(item.start_time||'').slice(0,5))+'"></label>'+ 
      '<label>Durée (min)<input id="aiEditDuration'+step+'" type="number" min="0" step="5" value="'+escAttr(item.duration_minutes!=null?String(item.duration_minutes):'')+'"></label>'+ 
      '<label class="aiPlanFull">Adresse<input id="aiEditAddress'+step+'" value="'+escAttr(item.address||'')+'"></label>'+ 
      '</div></div>';
  }).join('');
  $('aiPlanEditorStatus').textContent='';
  const m=$('aiPlanEditorModal');m.classList.add('open');m.setAttribute('aria-hidden','false');
}
function closeAiPlanEditor(){
  const m=$('aiPlanEditorModal');if(!m)return;
  m.classList.remove('open');m.setAttribute('aria-hidden','true');
}
let aiPlanEditingSaving=false;
async function saveAiPlanEdits(){
  const current=window.__myeventAiCurrentPlan;
  if(!current?.plan?.id||!Array.isArray(current.items)||!current.items.length||aiPlanEditingSaving)return;
  aiPlanEditingSaving=true;
  const btn=$('aiPlanEditorSave');if(btn){btn.disabled=true;btn.textContent='⏳ Enregistrement…';}
  const status=$('aiPlanEditorStatus');
  try{
    const items=current.items.map((old,i)=>{
      const step=i+1;
      const durationVal=$('aiEditDuration'+step)?.value||'';
      return {...old,
        plan_id:current.plan.id,event_id:event.id,step_order:step,
        outing_type:String($('aiEditType'+step)?.value||old.outing_type||old.type||'activity'),
        name:String($('aiEditName'+step)?.value||'Étape').trim().slice(0,180),
        start_time:String($('aiEditTime'+step)?.value||'').trim()||null,
        duration_minutes:durationVal!==''?Math.max(0,Number(durationVal)||0):null,
        address:String($('aiEditAddress'+step)?.value||'').trim()||null,
        created_by:old.created_by||user.id
      };
    });
    if(items.some(x=>!x.name))throw new Error('Chaque étape doit avoir un nom.');
    const clean=items.map(x=>({plan_id:x.plan_id,event_id:x.event_id,step_order:x.step_order,outing_type:x.outing_type,name:x.name,address:x.address,lat:x.lat??null,lon:x.lon??null,price_per_person:x.price_per_person??null,start_time:x.start_time,duration_minutes:x.duration_minutes,website:x.website??null,phone:x.phone??null,source:x.source||'ai',created_by:x.created_by}));
    const r=await sb.from('event_outing_plan_items').upsert(clean,{onConflict:'plan_id,step_order'});
    if(r.error)throw new Error(r.error.message);
    current.items=clean;
    window.__myeventAiCurrentPlan=current;
    aiOutingPlanData={...(aiOutingPlanData||{}),title:current.plan.title,people:Number(current.plan.people)||1,budget_per_person:current.plan.budget_per_person,request:current.plan.request||'',items:clean};
    try{
      const key='myevent_ai_plan_'+user.id+'_'+event.id;
      const oldLocal=JSON.parse(localStorage.getItem(key)||'{}');
      localStorage.setItem(key,JSON.stringify({...oldLocal,plan_id:current.plan.id,event_id:event.id,title:current.plan.title,request:current.plan.request||'',people:Number(current.plan.people)||1,budget_per_person:current.plan.budget_per_person,saved_at:Date.now(),items:clean}));
    }catch(_){ }
    closeAiPlanEditor();
    const box=$('aiPlanPanelBox');
    if(box){
      box.innerHTML='<div class="aiPlanSaved"><div class="aiPlanSavedTitle">✨ Planning IA sélectionné</div><div class="muted">'+esc(current.plan.title||'Sortie complète')+' · '+esc(String(current.plan.people||1))+' pers.</div>'+clean.map((x,i)=>'<div class="aiPlanSavedStep"><b>'+(i+1)+'. '+esc(x.name)+'</b> <span>· '+aiPlanCandidateLabel(x.outing_type)+(x.start_time?' · '+esc(x.start_time):'')+(x.price_per_person!=null?' · '+(x.source==='ai_estimate'?'≈ 💶 ':'💶 ')+aiPlanFormatPrice(x.price_per_person)+(x.source==='ai_estimate'?' (estimé)':''):'')+'</span></div>').join('')+'<div class="planningActions" style="margin-top:9px"><button type="button" class="secondary" data-ai-plan-edit="1">✏️ Modifier la proposition</button><button type="button" class="secondary" data-ai-plan-remove="1">✕ Retirer la proposition</button></div></div>';
      box.querySelector('[data-ai-plan-edit]')?.addEventListener('click',openAiPlanEditor);
    }
    if(typeof renderAiPlanReservations==='function')await renderAiPlanReservations(current.plan,clean);
    alert('✅ Modifications du planning IA enregistrées.');
  }catch(e){
    if(status)status.textContent='Impossible d’enregistrer : '+(e.message||String(e));
    if(status)status.className='aiPlanStatus err';
  }finally{
    aiPlanEditingSaving=false;
    if(btn){btn.disabled=false;btn.textContent='💾 Enregistrer les modifications';}
  }
}
async function openAiOutingPlanner(editMode=false){
  if(!event){alert('Choisis d’abord un événement.');return;}
  const m=$('aiPlanModal'); if(!m)return;
  let existing=null;
  if(editMode&&user){
    // V54.2 : en modification, charger d'abord le planning actuellement
    // sélectionné depuis Supabase. Le localStorage sert de secours.
    try{ existing=JSON.parse(localStorage.getItem('myevent_ai_plan_'+user.id+'_'+event.id)||'null'); }catch(_){existing=null;}
    try{
      const pr=await sb.from('event_outing_plans')
        .select('*').eq('event_id',event.id).order('created_at',{ascending:false}).limit(1);
      if(!pr.error && Array.isArray(pr.data) && pr.data[0]){
        const dbPlan=pr.data[0];
        const ir=await sb.from('event_outing_plan_items')
          .select('*').eq('plan_id',dbPlan.id).order('step_order',{ascending:true});
        if(!ir.error){
          existing={
            event_id:event.id,
            title:dbPlan.title||'',
            request:dbPlan.request||'',
            people:dbPlan.people||10,
            budget_per_person:dbPlan.budget_per_person,
            items:Array.isArray(ir.data)?ir.data:[]
          };
          try{localStorage.setItem('myevent_ai_plan_'+user.id+'_'+event.id,JSON.stringify(existing));}catch(_){}
        }
      }
    }catch(_){}
  }
  $('aiPlanPeople').value=Math.max(1,Number(existing?.people||$('outingPeople')?.value||10)||10);
  if($('aiPlanBudget'))$('aiPlanBudget').value=existing?.budget_per_person!=null?existing.budget_per_person:'';
  if($('aiPlanRadius'))$('aiPlanRadius').value=String(existing?.radius||5);
  if($('aiPlanSteps'))$('aiPlanSteps').value=String(Math.min(5,Math.max(2,Number(existing?.items?.length||3)||3)));
  if($('aiPlanStartTime'))$('aiPlanStartTime').value=existing?.start_time||existing?.items?.[0]?.start_time||'';
  if($('aiPlanMealType')){
    const restaurantItem=Array.isArray(existing?.items)&&existing.items.find(x=>String(x.outing_type||x.type||'').toLowerCase()==='restaurant');
    $('aiPlanMealType').value=restaurantItem?'dinner':'none';
  }
  if($('aiPlanMealTime')){
    const restaurantItem=Array.isArray(existing?.items)&&existing.items.find(x=>String(x.outing_type||x.type||'').toLowerCase()==='restaurant');
    $('aiPlanMealTime').value=restaurantItem?.start_time||'';
  }
  syncAiMealTime();
  $('aiPlanResults').innerHTML='';
  $('aiPlanStatus').textContent=editMode&&existing?'✏️ Modification du planning IA existant. Génère une nouvelle proposition pour le remplacer.':'';
  $('aiPlanModal').classList.add('open');
  $('aiPlanModal').setAttribute('aria-hidden','false');
  $('aiPlanPrompt').value=existing?.request||'';
  $('aiPlanPrompt')?.focus();
}
function closeAiOutingPlanner(){
  const m=$('aiPlanModal'); if(!m)return;
  m.classList.remove('open'); m.setAttribute('aria-hidden','true');
}
function aiPlanCandidateType(p){
  const c=outingCategory(p.type);
  return c==='restaurant'?'restaurant':(c==='culture'?'culture':(c==='nature'?'nature':'activity'));
}
function aiPlanCandidateLabel(t){
  return t==='restaurant'?'🍽️ Restaurant':t==='culture'?'🏛️ Culture':t==='nature'?'🌳 Nature':'🎯 Activité';
}
function aiPlanFormatPrice(v){
  return Number.isFinite(Number(v))&&Number(v)>0?eur(Number(v))+' / pers.':'Tarif à vérifier';
}
function syncAiMealTime(){
  const type=$('aiPlanMealType')?.value||'none';
  const sel=$('aiPlanMealTime');
  if(!sel)return;
  sel.disabled=type==='none';
  const values=type==='lunch'
    ? ['','12:00','12:30','13:00','13:30','14:00']
    : type==='dinner'
      ? ['','19:00','19:30','20:00','20:30','21:00']
      : [''];
  Array.from(sel.options).forEach(o=>{
    o.hidden=!values.includes(o.value);
  });
  if(!values.includes(sel.value))sel.value='';
}
async function generateAiOutingPlan(){
  if(!event||!user)return;
  const btn=$('aiPlanGenerate'); if(btn?.disabled)return;
  const people=Math.max(1,Number($('aiPlanPeople')?.value||10)||10);
  const budget=Math.max(0,Number($('aiPlanBudget')?.value||0)||0);
  const radius=Number($('aiPlanRadius')?.value||5);
  const steps=Math.min(5,Math.max(2,Number($('aiPlanSteps')?.value||3)||3));
  const startTime=String($('aiPlanStartTime')?.value||'').trim();
  const mealType=String($('aiPlanMealType')?.value||'none');
  const mealTime=String($('aiPlanMealTime')?.value||'').trim();
  const prompt=String($('aiPlanPrompt')?.value||'').trim();
  btn.disabled=true;
  $('aiPlanResults').innerHTML='';
  $('aiPlanStatus').textContent='📍 Recherche des restaurants et activités autour du centre 🎯…';
  try{
    const geo=await getActivitySearchCenter();
    if(!geo)throw new Error('Ajoute une adresse ou un lieu à l’événement pour définir le centre de recherche.');
    const r=await fetch('/api/search-places?mode=nearby&lat='+encodeURIComponent(geo.lat)+'&lon='+encodeURIComponent(geo.lon)+'&radius='+encodeURIComponent(radius),{headers:{Accept:'application/json'}});
    const d=await r.json().catch(()=>null);
    if(!r.ok||!d)throw new Error(d?.error||'Recherche des lieux indisponible.');
    const candidates=(d.results||[]).map((p,i)=>({
      id:String(p.id||('candidate-'+i)),
      name:String(p.name||'').trim(),
      type:aiPlanCandidateType(p),
      address:String(p.address||'').trim(),
      lat:Number(p.lat),lon:Number(p.lon),
      price_per_person:Number.isFinite(Number(p.price))&&Number(p.price)>0?Number(p.price):null,
      price_is_estimate:false,
      website:p.website||null,phone:p.phone||null,
      distance_km:Number.isFinite(Number(p.distance))?Number(p.distance):null
    })).filter(p=>p.name&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)).slice(0,120);
    const restaurants=candidates.filter(x=>x.type==='restaurant');
    const activities=candidates.filter(x=>x.type!=='restaurant');
    if(!restaurants.length||!activities.length)throw new Error('Je ne trouve pas assez de lieux pour composer restaurant + activité dans ce rayon. Essaie un rayon plus large.');
    $('aiPlanStatus').textContent='🤖 L’IA compose plusieurs parcours à partir des lieux trouvés…';
    const token=(await sb.auth.getSession()).data?.session?.access_token||'';
    const ar=await fetch('/api/generate-outing-plan',{
      method:'POST',
      headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
      body:JSON.stringify({
        event_name:event.name||'Événement',
        event_date:event.event_date||null,
        event_location:event.location||'',
        people,budget_per_person:budget||null,
        requested_steps:steps,
        start_time:startTime||null,
        meal_type:mealType,
        meal_time:mealTime||null,
        request:prompt,
        candidates
      })
    });
    const data=await ar.json().catch(()=>({}));
    if(!ar.ok)throw new Error(data.error||'Le service IA est indisponible.');
    aiOutingPlanData=data;
    renderAiOutingPlans(data);
    $('aiPlanStatus').textContent=(data.options||[]).length?'Choisis une proposition pour l’enregistrer dans le planning ('+(data.options||[]).length+' propositions).':'Aucune proposition adaptée.';
  }catch(e){
    $('aiPlanStatus').textContent=e.message||'Impossible de générer le planning.';
    $('aiPlanStatus').className='aiPlanStatus err';
  }finally{btn.disabled=false;}
}
function renderAiOutingPlans(data){
  const box=$('aiPlanResults'); if(!box)return;
  const opts=Array.isArray(data?.options)?data.options:[];
  if(!opts.length){box.innerHTML='<div class="planningEmpty">Aucune combinaison trouvée. Essaie avec un rayon ou un budget différent.</div>';return;}
  box.innerHTML=opts.map((o,oi)=>{
    const steps=Array.isArray(o.steps)?o.steps:[];
    const total=o.total_estimated_per_person!=null?'<div class="aiPlanOptionMeta">💶 Environ '+esc(String(o.total_estimated_per_person))+' € / pers.</div>':'';
    return '<div class="aiPlanOption"><div class="aiPlanOptionTitle">'+esc(o.title||('Proposition '+(oi+1)))+'</div>'+
      '<div class="aiPlanOptionMeta">'+esc(o.summary||'Sortie complète')+'</div>'+total+
      steps.map((s,si)=>'<div class="aiPlanStep"><div class="aiPlanStepNum">'+(si+1)+'</div><div><div class="aiPlanStepName">'+esc(s.name||'Étape')+'</div><div class="aiPlanStepMeta">'+aiPlanCandidateLabel(String(s.type||'activity'))+(s.start_time?' · 🕐 '+esc(s.start_time):'')+(s.duration_minutes?' · '+esc(String(s.duration_minutes))+' min':'')+(s.address?' · 📍 '+esc(s.address):'')+(s.price_per_person!=null?' · '+(s.source==='ai_estimate'?'≈ 💶 ':'💶 ')+aiPlanFormatPrice(s.price_per_person)+(s.source==='ai_estimate'?' (estimé)':''):'')+'</div></div></div>').join('')+
      '<button type="button" class="aiPlanChoose" data-ai-plan-index="'+oi+'">✅ Choisir cette proposition</button></div>';
  }).join('');
}
let aiPlanSaving=false;
async function saveAiOutingPlan(index){
  const o=aiOutingPlanData?.options?.[Number(index)];
  if(!o||!event||!user||aiPlanSaving)return;
  aiPlanSaving=true;
  const btn=document.querySelector('[data-ai-plan-index="'+index+'"]'); if(btn)btn.disabled=true;
  try{
    const planPayload={
      event_id:event.id,
      title:String(o.title||'Sortie organisée avec l’IA').slice(0,180),
      request:String(aiOutingPlanData.request||$('aiPlanPrompt')?.value||'').slice(0,2000),
      people:Math.max(1,Number(aiOutingPlanData.people)||1),
      budget_per_person:aiOutingPlanData.budget_per_person!=null?Number(aiOutingPlanData.budget_per_person):null,
      status:'selected',
      created_by:user.id
    };
    const pr=await sb.from('event_outing_plans').upsert(planPayload,{onConflict:'event_id'}).select('*').single();
    if(pr.error)throw new Error(pr.error.message);

    const items=(o.steps||[]).map((s,i)=>({
      plan_id:pr.data.id,event_id:event.id,step_order:i+1,
      outing_type:String(s.type||'activity'),
      name:String(s.name||'Étape'),
      address:s.address||null,lat:Number.isFinite(Number(s.lat))?Number(s.lat):null,lon:Number.isFinite(Number(s.lon))?Number(s.lon):null,
      price_per_person:s.price_per_person!=null?Number(s.price_per_person):null,
      start_time:s.start_time||null,duration_minutes:s.duration_minutes!=null?Number(s.duration_minutes):null,
      website:s.website||null,phone:s.phone||null,source:s.source||'ai',
      created_by:user.id
    }));
    if(!items.length)throw new Error('La proposition ne contient aucune étape.');


    // V53.13 FIX : la contrainte SQL est UNIQUE(plan_id, step_order).
    // On met à jour les étapes existantes au lieu de les supprimer puis de les réinsérer.
    const ir=await sb.from('event_outing_plan_items')
      .upsert(items,{onConflict:'plan_id,step_order'})
      .select('*');
    if(ir.error)throw new Error(ir.error.message);

    // Si la nouvelle proposition comporte moins d’étapes, supprimer les anciennes en trop.
    const dr=await sb.from('event_outing_plan_items')
      .delete()
      .eq('plan_id',pr.data.id)
      .gt('step_order',items.length);
    if(dr.error)throw new Error(dr.error.message);

    // V54.1 — le dernier planning choisi devient la référence locale de cet événement.
    // On conserve aussi l'id Supabase du planning pour retrouver ses réservations après actualisation.
    try{
      localStorage.setItem(
        'myevent_ai_plan_'+user.id+'_'+event.id,
        JSON.stringify({
          plan_id:pr.data.id,
          event_id:event.id,
          title:planPayload.title,
          request:planPayload.request,
          people:planPayload.people,
          budget_per_person:planPayload.budget_per_person,
          saved_at:Date.now(),
          items
        })
      );
    }catch(_){ }

    window.__myeventAiCurrentPlan={plan:pr.data,items};
    closeAiOutingPlanner();
    showEventTab('aioutings',true);
    // V54 : le planning IA vit dans son propre onglet et ne dépend plus
    // de la sortie individuelle sélectionnée.
    await renderInlineSelectedEvent();
    // V53.13 FIX 2 : afficher immédiatement le planning qui vient d'être enregistré.
    // Cela évite de dépendre d'un second SELECT Supabase au moment du rendu.
    const savedBox=$('aiPlanPanelBox');
    if(savedBox){
      savedBox.innerHTML='<div class="aiPlanSaved"><div class="aiPlanSavedTitle">✨ Planning IA sélectionné</div>'+
        '<div class="muted">'+esc(o.title||'Sortie complète')+' · '+esc(String(aiOutingPlanData.people||1))+' pers.</div>'+
        items.map((x,i)=>'<div class="aiPlanSavedStep"><b>'+(i+1)+'. '+esc(x.name||'Étape')+'</b> <span>· '+aiPlanCandidateLabel(x.outing_type)+(x.start_time?' · '+esc(x.start_time):'')+(x.price_per_person!=null?' · '+(x.source==='ai_estimate'?'≈ 💶 ':'💶 ')+aiPlanFormatPrice(x.price_per_person)+(x.source==='ai_estimate'?' (estimé)':''):'')+'</span></div>').join('')+
        '<button type="button" class="secondary" style="margin-top:9px;width:100%" data-ai-plan-edit="1" onclick="event.preventDefault();event.stopPropagation();window.__myeventOpenAiPlanEditor();return false;">✏️ Modifier le planning IA</button></div>';
      savedBox.querySelector('[data-ai-plan-edit]')?.addEventListener('click',openAiPlanEditor);
      savedBox.querySelector('[data-ai-plan-remove]')?.addEventListener('click',removeAiOutingPlan);
    }
    if(typeof renderAiPlanReservations==='function') await renderAiPlanReservations(pr.data,items);
    await refreshReservationBoxes();
    alert('✅ Planning IA enregistré : '+items.length+' étapes.');
  }catch(e){
    $('aiPlanStatus').textContent='Impossible d’enregistrer : '+(e.message||String(e));
    $('aiPlanStatus').className='aiPlanStatus err';
    if(btn)btn.disabled=false;
  }finally{
    aiPlanSaving=false;
  }
}
let aiPlanLoadToken=0;

// V54.28 — même logique que la sortie manuelle : le planning IA peut être proposé puis retiré.
async function removeAiOutingPlan(){
  if(!event||!user||!sb)return;
  if(!confirm('Retirer la proposition du planning IA de cet événement ?'))return;
  try{
    const eventId=event.id;
    const planId=window.__myeventAiCurrentPlan?.plan?.id||window.__myeventAiReservationPlan?.id||null;
    if(planId){
      try{ await sb.from('event_outing_plan_reservations').delete().eq('plan_id',planId); }catch(_){}
      try{ await sb.from('event_outing_plan_items').delete().eq('plan_id',planId); }catch(_){}
    }
    const dr=await sb.from('event_outing_plans').delete().eq('event_id',eventId);
    if(dr.error)throw dr.error;
    try{
      localStorage.removeItem('myevent_ai_plan_'+user.id+'_'+eventId);
      localStorage.removeItem('myevent_event_planning_choice_'+user.id+'_'+eventId);
    }catch(_){}
    aiOutingPlanData=null;
    aiPlanReservationsCache=[];
    window.__myeventAiCurrentPlan=null;
    window.__myeventAiReservationPlan=null;
    window.__myeventAiReservationItems=null;
    await renderInlineSelectedEvent();
    if(typeof loadAiOutingPlan==='function')await loadAiOutingPlan();
    if(typeof refreshReservationBoxes==='function')await refreshReservationBoxes();
    alert('✅ Proposition du planning IA retirée.');
  }catch(e){
    alert('Impossible de retirer la proposition IA : '+(e.message||String(e)));
  }
}
window.__myeventRemoveAiOutingPlan=removeAiOutingPlan;

async function loadAiOutingPlan(){
  const box=$('aiPlanPanelBox');
  if(!box||!event)return;

  const loadToken=++aiPlanLoadToken;
  const eventId=event.id;
  const localKey=user ? 'myevent_ai_plan_'+user.id+'_'+eventId : '';

  box.innerHTML='<div class="planningEmpty">✨ Chargement du planning IA…</div>';

  try{
    let plans=[];
    let lastError=null;

    // V54.10 — un planning IA n'est affiché que s'il a été explicitement
    // sélectionné/généré pour cet événement. Un nouvel événement reste vierge.
    let savedPlanningChoice=null;
    try{
      savedPlanningChoice=localStorage.getItem('myevent_event_planning_choice_'+user.id+'_'+eventId);
    }catch(_){ }

    if(savedPlanningChoice!=='ai'){
      aiOutingPlanData=null;
      window.__myeventAiCurrentPlan=null;
      window.__myeventAiReservationPlan=null;
      window.__myeventAiReservationItems=null;
      box.innerHTML='<div class="planningEmpty">Aucun planning IA n’est encore créé.</div>'+
        '<div class="planningActions"><button type="button" class="secondary" data-open-ai-planning="1">✨ Organiser une sortie avec l’IA</button></div>';
      return;
    }

    // Lecture Supabase avec plusieurs tentatives.
    for(let attempt=0;attempt<8;attempt++){
      const q=await sb.from('event_outing_plans')
        .select('*')
        .eq('event_id',eventId)
        .order('created_at',{ascending:false});

      if(loadToken!==aiPlanLoadToken||event?.id!==eventId)return;

      if(!q.error){
        plans=Array.isArray(q.data)?q.data:[];
        if(plans.length)break;
      }else{
        lastError=q.error;
      }

      if(attempt<7)await new Promise(resolve=>setTimeout(resolve,800));
    }

    if(loadToken!==aiPlanLoadToken||event?.id!==eventId)return;

    let p=null;
    let items=[];
    let localPlan=null;

    // V54.1 — la dernière proposition choisie sur cet appareil est prioritaire.
    // Cela évite qu'un ancien enregistrement Supabase reprenne la main après actualisation.
    if(localKey){
      try{
        const raw=localStorage.getItem(localKey);
        localPlan=raw?JSON.parse(raw):null;
      }catch(_){localPlan=null;}
    }

    if(localPlan?.event_id===eventId&&Array.isArray(localPlan.items)&&localPlan.items.length){
      p={
        id:localPlan.plan_id||null,
        event_id:eventId,
        title:localPlan.title||'Sortie organisée avec l’IA',
        request:localPlan.request||'',
        people:Number(localPlan.people)||1,
        budget_per_person:localPlan.budget_per_person
      };
      items=localPlan.items;
    }else{
      // Aucun secours local : utiliser Supabase.
      p=plans[0]||null;
    }

    // Si le planning local n'a pas encore d'id Supabase, tenter de le synchroniser.
    if(p&&items.length&&localPlan&&!localPlan.plan_id&&user){
      try{
        const rp=await sb.from('event_outing_plans').upsert({
          event_id:eventId,title:p.title,request:p.request,people:p.people,
          budget_per_person:p.budget_per_person,status:'selected',created_by:user.id
        },{onConflict:'event_id'}).select('*').single();
        if(!rp.error&&rp.data){
          p=rp.data;
          const ri=await sb.from('event_outing_plan_items').upsert(
            items.map((s,i)=>({plan_id:p.id,event_id:eventId,step_order:i+1,
              outing_type:String(s.outing_type||s.type||'activity'),name:String(s.name||'Étape'),
              address:s.address||null,lat:Number.isFinite(Number(s.lat))?Number(s.lat):null,
              lon:Number.isFinite(Number(s.lon))?Number(s.lon):null,
              price_per_person:s.price_per_person!=null?Number(s.price_per_person):null,
              start_time:s.start_time||null,duration_minutes:s.duration_minutes!=null?Number(s.duration_minutes):null,
              website:s.website||null,phone:s.phone||null,source:s.source||'ai',created_by:user.id
            })),{onConflict:'plan_id,step_order'});
          if(!ri.error){
            try{localPlan.plan_id=p.id;localStorage.setItem(localKey,JSON.stringify(localPlan));}catch(_){ }
          }
        }
      }catch(_){ }
    }

    if(!p){
      if(lastError)throw new Error(lastError.message||'Lecture Supabase impossible.');
      box.innerHTML='';
      return;
    }

    // Si le planning vient de Supabase, charger ses étapes.
    if(!items.length&&p.id){
      const ir=await sb.from('event_outing_plan_items')
        .select('*')
        .eq('plan_id',p.id)
        .order('step_order',{ascending:true});

      if(loadToken!==aiPlanLoadToken||event?.id!==eventId)return;

      if(ir.error){
        // V53.26 : si les étapes Supabase sont momentanément illisibles,
        // revenir à la copie locale plutôt que d'effacer le planning.
        if(localKey){
          try{
            const raw=localStorage.getItem(localKey);
            const localPlan=raw?JSON.parse(raw):null;
            if(localPlan?.event_id===eventId&&Array.isArray(localPlan.items)&&localPlan.items.length){
              items=localPlan.items;
              p={...p, title:localPlan.title||p.title, request:localPlan.request||p.request, people:Number(localPlan.people)||Number(p.people)||1, budget_per_person:localPlan.budget_per_person};
            }
          }catch(_){}
        }
        if(!items.length)throw new Error(ir.error.message||'Impossible de lire les étapes du planning IA.');
      }else{
        items=Array.isArray(ir.data)?ir.data:[];
        // V53.26 : une ligne de planning sans étapes n'est pas considérée
        // comme une preuve que le planning a disparu. Utiliser le secours local.
        if(!items.length&&localKey){
          try{
            const raw=localStorage.getItem(localKey);
            const localPlan=raw?JSON.parse(raw):null;
            if(localPlan?.event_id===eventId&&Array.isArray(localPlan.items)&&localPlan.items.length){
              items=localPlan.items;
              p={...p, title:localPlan.title||p.title, request:localPlan.request||p.request, people:Number(localPlan.people)||Number(p.people)||1, budget_per_person:localPlan.budget_per_person};
            }
          }catch(_){}
        }
      }
    }

    if(!items.length){
      box.innerHTML='<div class="planningEmpty">⚠️ Le planning IA est enregistré mais ses étapes sont introuvables.</div>';
      return;
    }

    aiOutingPlanData={
      ...(aiOutingPlanData||{}),
      title:p.title||'Sortie organisée avec l’IA',
      people:Number(p.people)||1,
      budget_per_person:p.budget_per_person,
      request:p.request||''
    };
    window.__myeventAiCurrentPlan={plan:p,items:items};

    if(loadToken!==aiPlanLoadToken||event?.id!==eventId)return;

    box.innerHTML='<div class="aiPlanSaved">'+
      '<div class="aiPlanSavedTitle">✨ Proposition IA sélectionnée</div>'+
      '<div class="muted">'+esc(p.title||'Sortie complète')+' · '+esc(String(p.people||1))+' pers.</div>'+
      items.map((x,i)=>
        '<div class="aiPlanSavedStep"><b>'+
        (i+1)+'. '+esc(x.name||'Étape')+
        '</b> <span>· '+
        aiPlanCandidateLabel(x.outing_type||x.type||'activity')+
        (x.start_time?' · '+esc(x.start_time):'')+
        (x.price_per_person!=null?' · 💶 '+aiPlanFormatPrice(x.price_per_person):'')+
        '</span></div>'
      ).join('')+
      '<button type="button" class="secondary" style="margin-top:9px;width:100%" data-ai-plan-edit="1" onclick="event.preventDefault();event.stopPropagation();window.__myeventOpenAiPlanEditor();return false;">✏️ Modifier le planning IA</button>'+
      '</div>';

    box.querySelector('[data-ai-plan-edit]')?.addEventListener('click',openAiPlanEditor);

    if(typeof renderAiPlanReservations==='function'){
      await renderAiPlanReservations(p,items);
    }

  }catch(e){
    if(loadToken!==aiPlanLoadToken)return;
    console.error('[MyEvent V53.25] loadAiOutingPlan:',e);
    box.innerHTML=
      '<div class="planningEmpty">⚠️ Impossible de charger le planning IA : '+
      esc(e.message||String(e))+
      '</div>';
  }
}
document.addEventListener('click',e=>{
  if(e.target.closest('#aiOutingOpenBtn')){openAiOutingPlanner();return;}
  if(e.target.closest('#aiPlanClose')||e.target.closest('#aiPlanCancel')){closeAiOutingPlanner();return;}
  if(e.target.closest('#aiPlanGenerate')){generateAiOutingPlan();return;}
  const c=e.target.closest('[data-ai-plan-index]'); if(c){saveAiOutingPlan(c.dataset.aiPlanIndex);return;}
});
document.addEventListener('change',e=>{
  if(e.target.id==='aiPlanMealType')syncAiMealTime();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeAiPlanEditor();closeAiOutingPlanner();}});
document.addEventListener('click',e=>{
  if(e.target.id==='aiPlanModal')closeAiOutingPlanner();
});

/* ===== original inline script 13 ===== */
/* V53.21 — Fiche réservation complète : prestataire, statut, référence, coût et paiement. */
(function(){
  const META_PREFIX='[[MYEVENT_RESERVATION_META]]';
  const STATUS={pending:{label:'À confirmer',icon:'🟡'},sent:{label:'Demande envoyée',icon:'🔵'},confirmed:{label:'Confirmée',icon:'🟢'},refused:{label:'Refusée',icon:'🔴'},cancelled:{label:'Annulée',icon:'⚫'}};
  function parseMeta(note){
    const raw=String(note||'');
    if(!raw.startsWith(META_PREFIX))return {note:raw,status:'pending'};
    try{const m=JSON.parse(raw.slice(META_PREFIX.length));return {...m,note:String(m.note||''),status:STATUS[m.status]?m.status:'pending'};}catch(_){return {note:raw,status:'pending'};}
  }
  function packMeta(data){return META_PREFIX+JSON.stringify({note:String(data.note||''),status:STATUS[data.status]?data.status:'pending',provider:String(data.provider||''),phone:String(data.phone||''),website:String(data.website||''),reference:String(data.reference||''),total_cost:data.total_cost===''||data.total_cost==null?null:Number(data.total_cost),price_per_person:data.price_per_person===''||data.price_per_person==null?null:Number(data.price_per_person),payment_method:String(data.payment_method||'')} );}
  function money(v){const n=Number(v);return Number.isFinite(n)&&n>0?n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €':'';}
  function statusText(r){
    if(!r)return STATUS.pending.icon+' '+STATUS.pending.label;
    const m=parseMeta(r.note);
    const key=r.status==='confirmed'?'confirmed':r.status==='cancelled'?'cancelled':m.status||'pending';
    return (STATUS[key]||STATUS.pending).icon+' '+(STATUS[key]||STATUS.pending).label;
  }
  function statusClass(r){const m=parseMeta(r?.note);const key=r?.status==='confirmed'?'confirmed':r?.status==='cancelled'?'cancelled':m.status||'pending';return key;}
  function metaSummary(r){
    if(!r)return '';
    const m=parseMeta(r.note), bits=[];
    if(m.provider)bits.push('🏪 '+esc(m.provider));
    if(m.reference)bits.push('🔖 '+esc(m.reference));
    if(m.total_cost!=null&&Number(m.total_cost)>0)bits.push('💶 '+money(m.total_cost));
    else if(m.price_per_person!=null&&Number(m.price_per_person)>0)bits.push('💶 '+money(m.price_per_person)+' / pers.');
    if(m.payment_method)bits.push('💳 '+esc(m.payment_method));
    if(m.phone)bits.push('📞 '+esc(m.phone));
    return bits.length?'<div class="v53ResSummary">'+bits.join(' · ')+'</div>':'';
  }
  function formHtml(plan,item,step,existing){
    const m=parseMeta(existing?.note), dt=aiReservationDateTimeValue(existing?.reserved_at) || (item.start_time&&event?.event_date?String(event.event_date).slice(0,10)+'T'+String(item.start_time).slice(0,5):'');
    const people=Math.max(1,Number(existing?.party_size||aiOutingPlanData?.people||$('outingPeople')?.value||10)||10);
    const selected=existing?.status==='confirmed'?'confirmed':existing?.status==='cancelled'?'cancelled':(m.status||'pending');
    const opts=Object.entries(STATUS).map(([k,v])=>'<option value="'+k+'"'+(selected===k?' selected':'')+'>'+v.icon+' '+v.label+'</option>').join('');
    return '<div class="aiPlanReservationEdit v53Details" id="aiResForm'+step+'">'+
      '<div class="v53ResSection"><div class="v53ResSectionTitle">📅 Réservation</div><div class="v53ResGrid">'+
      '<label>Date et heure<input type="datetime-local" id="aiResDate'+step+'" value="'+escAttr(dt)+'"></label>'+
      '<label>Personnes<input type="number" min="1" step="1" id="aiResPeople'+step+'" value="'+people+'" inputmode="numeric"></label>'+
      '<label class="v53ResFull">Statut<select id="aiResStatus'+step+'">'+opts+'</select></label>'+
      '</div></div>'+
      '<div class="v53ResSection"><div class="v53ResSectionTitle">🏪 Prestataire</div><div class="v53ResGrid">'+
      '<label>Nom du prestataire<input id="aiResProvider'+step+'" value="'+escAttr(m.provider)+'" placeholder="Ex. La Cantina GG"></label>'+
      '<label>Téléphone<input id="aiResPhone'+step+'" type="tel" value="'+escAttr(m.phone)+'" placeholder="Ex. 04 00 00 00 00"></label>'+
      '<label class="v53ResFull">Site web<input id="aiResWebsite'+step+'" type="url" value="'+escAttr(m.website)+'" placeholder="https://..."></label>'+
      '<label>Référence<input id="aiResReference'+step+'" value="'+escAttr(m.reference)+'" placeholder="N° réservation"></label>'+
      '</div></div>'+
      '<div class="v53ResSection"><div class="v53ResSectionTitle">💶 Coût & paiement</div><div class="v53ResGrid">'+
      '<label>Prix total (€)<input id="aiResTotal'+step+'" type="number" min="0" step="0.01" value="'+(m.total_cost!=null?escAttr(m.total_cost):'')+'" placeholder="Ex. 250"></label>'+
      '<label>Prix / personne (€)<input id="aiResPerPerson'+step+'" type="number" min="0" step="0.01" value="'+(m.price_per_person!=null?escAttr(m.price_per_person):'')+'" placeholder="Ex. 25"></label>'+
      '<label class="v53ResFull">Mode de paiement<select id="aiResPayment'+step+'"><option value="">À définir</option><option value="Sur place"'+(m.payment_method==='Sur place'?' selected':'')+'>Sur place</option><option value="En ligne"'+(m.payment_method==='En ligne'?' selected':'')+'>En ligne</option><option value="Virement"'+(m.payment_method==='Virement'?' selected':'')+'>Virement</option><option value="Espèces"'+(m.payment_method==='Espèces'?' selected':'')+'>Espèces</option><option value="Carte"'+(m.payment_method==='Carte'?' selected':'')+'>Carte</option></select></label>'+
      '</div></div>'+
      '<div class="v53ResSection"><div class="v53ResSectionTitle">📝 Note</div><textarea id="aiResNote'+step+'" placeholder="Ex. table intérieure, anniversaire…">'+esc(m.note)+'</textarea></div>'+
      '<div class="reservationActions"><button type="button" class="secondary" data-ai-res-save="'+step+'">💾 Enregistrer</button><button type="button" class="secondary" data-ai-res-cancel="'+step+'">Annuler</button></div></div>';
  }
  window.__myeventV53ParseMeta=parseMeta;
  window.__myeventV53StatusText=statusText;
  window.__myeventV53StatusClass=statusClass;
  window.__myeventV53MetaSummary=metaSummary;
  const oldOpen=openAiPlanReservationForm;
  window.openAiPlanReservationForm=function(plan,items,step){
    const item=items.find((x,i)=>i+1===step); if(!item)return;
    const host=$('aiResHost'+step); if(!host)return;
    const existing=aiPlanReservationsCache.find(x=>Number(x.step_order)===step)||null;
    host.innerHTML=formHtml(plan,item,step,existing);
    host.querySelector('[data-ai-res-cancel]')?.addEventListener('click',()=>{host.innerHTML='';});
    host.querySelector('[data-ai-res-save]')?.addEventListener('click',()=>saveV53AiReservation(plan,item,step));
  };
  async function saveV53AiReservation(plan,item,step){
    const dateTime=$('aiResDate'+step)?.value||'', people=Math.max(1,Number($('aiResPeople'+step)?.value||1)||1), status=$('aiResStatus'+step)?.value||'pending';
    if(!dateTime){alert('Choisis une date et une heure.');return;}
    const d=new Date(dateTime); if(Number.isNaN(d.getTime())){alert('La date ou l’heure est invalide.');return;}
    const total=$('aiResTotal'+step)?.value||'', per=$('aiResPerPerson'+step)?.value||'';
    const note=$('aiResNote'+step)?.value||'';
    const meta={note,status,provider:$('aiResProvider'+step)?.value||'',phone:$('aiResPhone'+step)?.value||'',website:$('aiResWebsite'+step)?.value||'',reference:$('aiResReference'+step)?.value||'',total_cost:total,price_per_person:per,payment_method:$('aiResPayment'+step)?.value||''};
    const btn=document.querySelector('[data-ai-res-save="'+step+'"]'); if(btn){btn.disabled=true;btn.textContent='⏳ Enregistrement…';}
    try{
      const payload={plan_id:plan.id,event_id:event.id,step_order:step,reserved_at:d.toISOString(),party_size:people,note:packMeta(meta),status:(status==='confirmed'?'confirmed':status==='cancelled'?'cancelled':'pending'),created_by:user?.id||null};
      const r=await sb.from('event_outing_plan_reservations').upsert(payload,{onConflict:'plan_id,step_order'}).select('*').single(); if(r.error)throw new Error(r.error.message);
      const ir=await sb.from('event_outing_plan_items').select('*').eq('plan_id',plan.id).order('step_order',{ascending:true}); if(ir.error)throw new Error(ir.error.message);
      await renderAiPlanReservations(plan,ir.data||[]);
    }catch(e){alert('Impossible d’enregistrer la réservation : '+(e.message||String(e)));if(btn){btn.disabled=false;btn.textContent='💾 Enregistrer';}}
  }
  const oldRender=renderAiPlanReservations;
  renderAiPlanReservations=async function(plan,items,targetId){
    await oldRender(plan,items,targetId);
    const box=$(targetId||'aiPlanReservationPanelBox'); if(!box)return;
    box.querySelectorAll('.aiPlanReservationRow').forEach(row=>{
      const step=Number(row.dataset.aiResStep), r=aiPlanReservationsCache.find(x=>Number(x.step_order)===step); if(!r)return;
      const main=row.querySelector('.aiPlanReservationMain'); if(!main)return;
      const line=main.querySelector('.muted'); if(line){line.innerHTML=esc(aiPlanCandidateLabel(String(items[step-1]?.outing_type||'activity')))+(items[step-1]?.start_time?' · 🕐 '+esc(items[step-1].start_time):'')+' · <span class="v53ResStatusBadge '+statusClass(r)+'">'+esc(statusText(r))+'</span>'+metaSummary(r);}
    });
  };
})();

/* ===== original inline script 14 ===== */
(function(){
  const a=(id)=>document.getElementById(id);
  a('socialHeaderMessagesBtnTop')?.addEventListener('click',()=>a('socialHeaderMessagesBtn')?.click());
  a('socialHeaderNotificationsBtnTop')?.addEventListener('click',()=>a('socialHeaderNotificationsBtn')?.click());
})();
