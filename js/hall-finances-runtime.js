/* ===== original inline script 15 ===== */
// V51.5 — Salle : sélection persistante, détails éditables, carte et cagnotte
let hallResultsData=[];
let hallSelectedId=null;
let hallSelectedFundExpenseId=null;
function hallIsOrganizer(){ return !!(event&&user&&event.creator_id===user.id); }
function hallOpenManualForm(open){ $('hallManualForm')?.classList.toggle('hidden',!open); if(!open && $('hallManualMsg'))$('hallManualMsg').textContent=''; }
function hallEscapeUrl(u){ return /^https?:\/\//i.test(String(u||'')) ? String(u) : ''; }
function hallSelected(){ return hallResultsData.find(x=>x.id===hallSelectedId)||null; }
function hallPerPerson(price){
  const n=Number(price); if(!Number.isFinite(n)||n<=0)return null;
  const count=Number($('fundMemberTrackingSummary')?.dataset?.memberCount||0);
  return count>0 ? n/count : null;
}
function renderHallSelected(){
  const box=$('hallSelectedBox'); if(!box)return;
  const h=hallSelected();
  if(!h){box.classList.add('hidden');box.innerHTML='';return;}
  box.classList.remove('hidden');
  const canEdit=hallIsOrganizer();
  const per=hallPerPerson(h.price);
  box.innerHTML='<div>🏢 <b>Salle sélectionnée</b></div><div style="margin-top:5px"><b>'+esc(h.name)+'</b></div>'+    '<div class="hallMeta">'+(h.capacity?'<span class="hallChip">👥 '+esc(String(h.capacity))+' pers.</span>':'<span class="hallChip">👥 Capacité à vérifier</span>')+(h.price!=null?'<span class="hallChip">💶 '+eur(h.price)+'</span>':'<span class="hallChip">💶 Tarif à demander</span>')+(h.distance!=null?'<span class="hallChip">📍 '+h.distance.toFixed(1)+' km</span>':'')+(per!=null?'<span class="hallChip">👤 '+eur(per)+' / personne</span>':'')+'</div>'+    '<div class="hallEquipment">'+esc(h.equipment||h.typeLabel||'Informations à compléter')+'</div>'+    (h.address?'<div class="muted" style="margin-top:6px">📍 '+esc(h.address)+'</div>':'')+    (h.phone?'<div class="muted" style="margin-top:4px">📞 '+esc(h.phone)+'</div>':'')+    '<div class="hallCardActions">'+    (h.lat&&h.lon?'<button type="button" class="secondary" data-hall-selected-map="'+h.lat+'|'+h.lon+'">📍 Voir</button>':'')+    (h.website?'<a class="secondary" style="display:grid;place-items:center;text-decoration:none" href="'+esc(h.website)+'" target="_blank" rel="noopener">↗️ Site</a>':'')+    (canEdit?'<button type="button" class="secondary" data-hall-edit>✏️ Modifier</button>':'')+    '<button type="button" class="secondary" data-hall-unselect>✕ Désélectionner</button></div>'+    (canEdit && h.price!=null && Number(h.price)>0 ? '<button type="button" id="hallFundBtn" style="margin-top:10px" '+(hallSelectedFundExpenseId?'disabled':'')+'>'+      (hallSelectedFundExpenseId?'✅ Prix ajouté à la cagnotte':'💰 Ajouter le prix à la cagnotte')+'</button>' : '')+    (canEdit?'<div id="hallEditForm" class="editEventBox hidden" style="margin-top:10px">'+      '<input id="hallEditName" placeholder="Nom de la salle"><input id="hallEditAddress" placeholder="Adresse / ville">'+      '<div class="fieldRow"><input id="hallEditCapacity" type="number" min="0" placeholder="Capacité"><input id="hallEditPrice" type="number" min="0" step="0.01" placeholder="Prix (€)"></div>'+      '<input id="hallEditEquipment" placeholder="Équipements"><input id="hallEditWebsite" placeholder="Site / lien de réservation"><input id="hallEditPhone" placeholder="Téléphone">'+      '<button type="button" id="hallSaveEditBtn">💾 Enregistrer</button><button type="button" id="hallCancelEditBtn" class="secondary">Annuler</button><p id="hallEditMsg" class="muted"></p></div>':'');
}
function renderHallResults(){
  const el=$('hallResults'); if(!el)return;
  const min=Math.max(0,Number($('hallMinCapacity')?.value||0)); const max=Number($('hallMaxPrice')?.value||0);
  const arr=hallResultsData.filter(h=>(!min||!h.capacity||h.capacity>=min)&&(!max||h.price==null||h.price<=max));
  if(!arr.length){el.innerHTML='<div class="hallEmpty">Aucune salle ne correspond aux critères. Essaie un rayon plus large ou ajoute une salle manuellement.</div>';return;}
  el.innerHTML=arr.map(h=>'<div class="hallCard"><div class="hallCardTop"><div class="hallCardName">🏢 '+esc(h.name)+'</div><div class="hallDistance">'+(h.distance!=null?h.distance.toFixed(1)+' km':'')+'</div></div><div class="muted" style="margin-top:3px">'+esc(h.address||'Adresse non disponible')+'</div><div class="hallMeta">'+(h.capacity?'<span class="hallChip">👥 '+esc(String(h.capacity))+' pers.</span>':'<span class="hallChip">👥 Capacité à vérifier</span>')+(h.price!=null?'<span class="hallChip">💶 '+eur(h.price)+'</span>':'<span class="hallChip">💶 Tarif à demander</span>')+'</div><div class="hallEquipment">'+esc(h.equipment||h.typeLabel||'Salle / lieu événementiel trouvé sur OpenStreetMap')+'</div><div class="hallCardActions"><button type="button" data-hall-select="'+esc(h.id)+'">⭐ Sélectionner</button>'+(h.lat&&h.lon?'<button type="button" class="secondary" data-hall-map="'+h.lat+'|'+h.lon+'">📍 Voir</button>':'')+(h.website?'<a class="secondary" style="display:grid;place-items:center;text-decoration:none" href="'+esc(h.website)+'" target="_blank" rel="noopener">↗️ Site</a>':'')+'</div></div>').join('');
}
async function saveHallSelection(h){
  hallSelectedId=h.id; hallSelectedFundExpenseId=null; renderHallSelected();
  if(event&&user){
    const payload={event_id:event.id,selected_hall_name:h.name,selected_hall_address:h.address||null,selected_hall_lat:h.lat||null,selected_hall_lon:h.lon||null,selected_hall_capacity:h.capacity||null,selected_hall_price:h.price??null,selected_hall_equipment:h.equipment||null,selected_hall_website:h.website||null,selected_hall_phone:h.phone||null,updated_by:user.id,updated_at:new Date().toISOString()};
    const r=await sb.from('event_hall_settings').upsert(payload,{onConflict:'event_id'});
    if(r.error){msg('hallMsg','Salle sélectionnée localement, mais sauvegarde impossible : '+r.error.message,'err');return;}
    msg('hallMsg','Salle sélectionnée et enregistrée.','ok');
  }
}
async function loadHall(){
  if(!event)return;
  const r=await sb.from('event_hall_settings').select('*').eq('event_id',event.id).maybeSingle();
  if(!r.error&&r.data){
    $('hallRadius').value=String(r.data.radius_km||5); $('hallMinCapacity').value=r.data.min_capacity||''; $('hallMaxPrice').value=r.data.max_budget||'';
    hallSelectedFundExpenseId=r.data.fund_expense_entry_id||null;
    if(r.data.selected_hall_name){
      const h={id:'selected',name:r.data.selected_hall_name,address:r.data.selected_hall_address,lat:r.data.selected_hall_lat,lon:r.data.selected_hall_lon,capacity:r.data.selected_hall_capacity,price:r.data.selected_hall_price,equipment:r.data.selected_hall_equipment,website:r.data.selected_hall_website,phone:r.data.selected_hall_phone,distance:null};
      hallResultsData=[h]; hallSelectedId='selected'; renderHallSelected();
    }
  }
}
async function saveHallCriteria(){
  if(!event||!user||!hallIsOrganizer())return;
  const radius=Number($('hallRadius')?.value||5), min=Math.max(0,Number($('hallMinCapacity')?.value||0)), max=Math.max(0,Number($('hallMaxPrice')?.value||0));
  const r=await sb.from('event_hall_settings').upsert({event_id:event.id,radius_km:radius,min_capacity:min||null,max_budget:max||null,updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:'event_id'});
  if(r.error)console.warn('Critères salle:',r.error.message);
}
async function searchHalls(){
  if(!event)return;
  const results=$('hallResults'); results.innerHTML='<div class="hallLoading">🔎 Recherche de salles autour de l’événement…</div>'; msg('hallMsg',''); await saveHallCriteria();
  const geo=await geocodeEventLocation(); if(!geo){results.innerHTML='<div class="hallEmpty">Impossible de localiser le lieu de l’événement. Vérifie son adresse dans l’événement.</div>';return;}
  const km=Number($('hallRadius').value||5); const minCapacity=Math.max(0,Number($('hallMinCapacity').value||0)); const maxBudget=Math.max(0,Number($('hallMaxPrice').value||0));
  const api='/api/search-places?mode=hall&lat='+encodeURIComponent(geo.lat)+'&lon='+encodeURIComponent(geo.lon)+'&radius='+encodeURIComponent(km)+'&minCapacity='+encodeURIComponent(minCapacity)+'&maxBudget='+encodeURIComponent(maxBudget);
  try{ const r=await fetch(api,{headers:{Accept:'application/json'}}); const d=await r.json().catch(()=>null); if(!r.ok||!d)throw new Error(d?.error||'Recherche indisponible'); hallResultsData=(d.results||[]).map(h=>({...h,distance:Number(h.distance)})); renderHallResults(); msg('hallMsg',hallResultsData.length+' lieu'+(hallResultsData.length>1?'x':'')+' trouvé'+(hallResultsData.length>1?'s':'')+'.','ok'); }
  catch(e){hallResultsData=[];results.innerHTML='<div class="hallEmpty">La recherche est momentanément indisponible. Réessaie dans quelques instants.</div>';msg('hallMsg',e.message||'Erreur de recherche.','err');}
}
async function addManualHall(){
  if(!hallIsOrganizer()){msg('hallManualMsg','Seul l’organisateur peut ajouter une salle manuellement.','err');return;}
  const name=String($('hallNameInput').value||'').trim(); if(!name){msg('hallManualMsg','Indique le nom de la salle.','err');return;}
  const h={id:'manual-'+Date.now(),name,address:String($('hallAddressInput').value||'').trim(),capacity:Number($('hallCapacityInput').value||0)||null,price:$('hallPriceInput').value!==''?Number($('hallPriceInput').value):null,equipment:String($('hallEquipmentInput').value||'').trim(),website:hallEscapeUrl($('hallWebsiteInput').value.trim()),phone:String($('hallPhoneInput').value||'').trim(),distance:null,typeLabel:'Salle ajoutée manuellement'};
  hallResultsData=[...hallResultsData,h]; renderHallResults(); hallOpenManualForm(false); ['hallNameInput','hallAddressInput','hallCapacityInput','hallPriceInput','hallEquipmentInput','hallWebsiteInput','hallPhoneInput'].forEach(id=>{if($(id))$(id).value='';}); msg('hallMsg','Salle ajoutée à la comparaison.','ok');
}
async function openHallEdit(){
  const h=hallSelected(); if(!h)return; $('hallEditName').value=h.name||''; $('hallEditAddress').value=h.address||''; $('hallEditCapacity').value=h.capacity??''; $('hallEditPrice').value=h.price??''; $('hallEditEquipment').value=h.equipment||''; $('hallEditWebsite').value=h.website||''; $('hallEditPhone').value=h.phone||''; $('hallEditForm').classList.remove('hidden');
}
async function saveHallEdit(){
  const h=hallSelected(); if(!h||!hallIsOrganizer()||!event||!user)return;
  const name=String($('hallEditName').value||'').trim(); if(!name){msg('hallEditMsg','Indique le nom de la salle.','err');return;}
  const next={...h,name,address:String($('hallEditAddress').value||'').trim(),capacity:Number($('hallEditCapacity').value||0)||null,price:$('hallEditPrice').value!==''?Number($('hallEditPrice').value):null,equipment:String($('hallEditEquipment').value||'').trim(),website:hallEscapeUrl($('hallEditWebsite').value.trim()),phone:String($('hallEditPhone').value||'').trim()};
  const payload={event_id:event.id,selected_hall_name:next.name,selected_hall_address:next.address||null,selected_hall_lat:next.lat||null,selected_hall_lon:next.lon||null,selected_hall_capacity:next.capacity||null,selected_hall_price:next.price??null,selected_hall_equipment:next.equipment||null,selected_hall_website:next.website||null,selected_hall_phone:next.phone||null,updated_by:user.id,updated_at:new Date().toISOString()};
  const r=await sb.from('event_hall_settings').upsert(payload,{onConflict:'event_id'}); if(r.error){msg('hallEditMsg','Erreur : '+r.error.message,'err');return;}
  hallResultsData=hallResultsData.map(x=>x.id===h.id?{...next}:x); hallSelectedId=h.id; $('hallEditForm').classList.add('hidden'); renderHallSelected(); msg('hallMsg','Informations de la salle mises à jour.','ok');
}
async function addHallPriceToFund(){
  const h=hallSelected(); if(!h||!event||!user||!hallIsOrganizer()||!(Number(h.price)>0))return;
  if(hallSelectedFundExpenseId){msg('hallMsg','Le prix de cette salle est déjà dans la cagnotte.','ok');return;}
  const label='Salle — '+h.name;
  const r=await sb.from('event_fund_entries').insert({event_id:event.id,user_id:user.id,entry_type:'expense',amount:Number(h.price),label,note:'Prix de la salle sélectionnée',status:'confirmed'}).select('id').single();
  if(r.error){msg('hallMsg','Impossible d’ajouter le prix à la cagnotte : '+r.error.message,'err');return;}
  hallSelectedFundExpenseId=r.data?.id||null;
  const up=await sb.from('event_hall_settings').update({fund_expense_entry_id:hallSelectedFundExpenseId,updated_by:user.id,updated_at:new Date().toISOString()}).eq('event_id',event.id);
  if(up.error){msg('hallMsg','Dépense ajoutée, mais liaison avec la salle impossible : '+up.error.message,'err');return;}
  renderHallSelected(); msg('hallMsg','Le prix de la salle a été ajouté à la cagnotte.','ok');
  if(typeof loadFund==='function')await loadFund();
}
document.addEventListener('click',e=>{
  const sel=e.target.closest('[data-hall-select]'); if(sel){const h=hallResultsData.find(x=>x.id===sel.dataset.hallSelect);if(h)saveHallSelection(h);return;}
  if(e.target.closest('[data-hall-unselect]')){hallSelectedId=null;hallSelectedFundExpenseId=null;renderHallSelected();msg('hallMsg','Sélection retirée.');return;}
  if(e.target.closest('[data-hall-edit]')){openHallEdit();return;}
  if(e.target.closest('#hallSaveEditBtn')){saveHallEdit();return;}
  if(e.target.closest('#hallCancelEditBtn')){$('hallEditForm')?.classList.add('hidden');return;}
  if(e.target.closest('#hallFundBtn')){addHallPriceToFund();return;}
  const selectedMap=e.target.closest('[data-hall-selected-map]');
  if(selectedMap){const [lat,lon]=selectedMap.dataset.hallSelectedMap.split('|').map(Number); if(Number.isFinite(lat)&&Number.isFinite(lon)){showEventTab('locations',true); setTimeout(()=>{if(typeof setLocationMapView==='function')setLocationMapView(lat,lon,17); if(locationMap){if(locationHallMarker)locationMap.removeLayer(locationHallMarker); locationHallMarker=L.marker([lat,lon],{icon:makeLocationIcon('🏢','#278cff')}).addTo(locationMap).bindPopup('<b>🏢 Salle sélectionnée</b>').openPopup();} $('locationMap')?.scrollIntoView({behavior:'smooth',block:'center'});},180);}return;}
  const mp=e.target.closest('[data-hall-map]'); if(mp){const [lat,lon]=mp.dataset.hallMap.split('|').map(Number); if(Number.isFinite(lat)&&Number.isFinite(lon)){showEventTab('locations',true); setTimeout(()=>{if(typeof setLocationMapView==='function')setLocationMapView(lat,lon,17); if(locationMap){if(locationHallMarker)locationMap.removeLayer(locationHallMarker); locationHallMarker=L.marker([lat,lon],{icon:makeLocationIcon('🏢','#278cff')}).addTo(locationMap).bindPopup('<b>🏢 Salle</b>').openPopup();} $('locationMap')?.scrollIntoView({behavior:'smooth',block:'center'});},180);}return;}
});
// V51.8 — Assistant IA matériel + liste compacte
// V51.6 — Qui amène quoi ?
let suppliesData=[];
let supplyProfiles=[];
function supplyIsOrganizer(){ return !!(event&&user&&event.creator_id===user.id); }
function supplyStatusLabel(status){ return status==='brought'?'🟢 Apporté':status==='reserved'?'🔵 Réservé':'🟠 À prévoir'; }
function supplyStatusClass(status){ return status==='brought'?'supplyStatusBrought':status==='reserved'?'supplyStatusReserved':'supplyStatusPlanned'; }
function supplyMemberName(id){
  if(!id)return 'Personne';
  const p=supplyProfiles.find(x=>x.id===id);
  return p?.display_name||p?.username||'Membre';
}
async function loadSupplies(){
  if(!event||!user)return;
  const list=$('suppliesList'); if(!list)return;
  list.innerHTML='<p class="muted">Chargement…</p>';
  const r=await sb.from('event_supplies').select('*').eq('event_id',event.id).order('created_at',{ascending:true});
  if(r.error){list.innerHTML='<p class="muted">Impossible de charger la liste : '+esc(r.error.message)+'</p>';return;}
  suppliesData=r.data||[];
  const ids=[...new Set(suppliesData.map(x=>x.assigned_user_id).filter(Boolean))];
  if(ids.length){const pr=await sb.from('profiles').select('id,display_name,username').in('id',ids); if(!pr.error)supplyProfiles=pr.data||[];}
  const mr=await sb.from('event_members').select('user_id,nickname').eq('event_id',event.id).order('joined_at',{ascending:true});
  const mids=(mr.data||[]).map(x=>x.user_id).filter(Boolean);
  if(mids.length){const pr=await sb.from('profiles').select('id,display_name,username').in('id',mids); if(!pr.error){const map=new Map((pr.data||[]).map(x=>[x.id,x])); supplyProfiles=[...map.values()];}}
  renderSupplies();
}
function renderSupplies(){
  const list=$('suppliesList'); if(!list)return;
  const summary=$('suppliesSummary');
  const counts={planned:0,reserved:0,brought:0}; suppliesData.forEach(x=>{counts[x.status]=(counts[x.status]||0)+1;});
  if(summary) summary.innerHTML='<span class="supplyChip">🎒 '+suppliesData.length+' élément'+(suppliesData.length>1?'s':'')+'</span><span class="supplyChip supplyStatusPlanned">🟠 '+counts.planned+' à prévoir</span><span class="supplyChip supplyStatusReserved">🔵 '+counts.reserved+' réservés</span><span class="supplyChip supplyStatusBrought">🟢 '+counts.brought+' apportés</span>';
  if(!suppliesData.length){list.innerHTML='<div class="hallEmpty">Aucun élément pour le moment. Ajoute le premier objet à apporter ou demande une proposition à l’IA.</div>';return;}
  const canManage=supplyIsOrganizer();
  const memberOptions='<option value="">— Personne —</option>'+supplyProfiles.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.display_name||p.username||'Membre')+'</option>').join('');
  list.innerHTML=suppliesData.map(x=>{
    const mine=x.assigned_user_id===user?.id;
    const canEdit=canManage||mine||x.created_by===user?.id;
    return '<div class="supplyCard" data-supply-id="'+esc(x.id)+'"><div class="supplyCompactMain"><div class="supplyCompactLeft"><div class="supplyCompactTitle">'+esc(x.title)+'</div><div class="supplyCompactMeta"><span class="supplyChip">🔢 '+esc(String(x.quantity||1))+'</span><span class="supplyChip '+supplyStatusClass(x.status)+'">'+supplyStatusLabel(x.status)+'</span><span class="supplyChip">👤 '+esc(supplyMemberName(x.assigned_user_id))+'</span></div></div></div>'+(x.note?'<div class="muted" style="margin-top:5px;font-size:12px">'+esc(x.note)+'</div>':'')+(canManage?'<div class="supplyAssign"><select data-supply-assign="'+esc(x.id)+'">'+memberOptions+'</select></div>':'')+'<div class="supplyCompactActions">'+(!x.assigned_user_id&&!canManage?'<button type="button" data-supply-me="'+esc(x.id)+'">🙋 Je m’en occupe</button>':'')+'<button type="button" class="secondary" data-supply-status="'+esc(x.id)+'">'+supplyStatusLabel(x.status)+'</button>'+(canEdit?'<button type="button" class="secondary" data-supply-edit="'+esc(x.id)+'">✏️ Modifier</button>':'')+(canEdit?'<button type="button" class="secondary" data-supply-delete="'+esc(x.id)+'">🗑️ Supprimer</button>':'')+'</div></div>';
  }).join('');
  suppliesData.forEach(x=>{const sel=list.querySelector('[data-supply-assign="'+CSS.escape(x.id)+'"]');if(sel)sel.value=x.assigned_user_id||'';});
}

let materialAiItems=[];
function materialAiContext(){
  const h=(typeof hallSelected==='function'?hallSelected():null);
  return {event_name:event?.name||'',event_type:event?.event_type||'',people:Math.max(1,Number($('materialAiPeople')?.value||30)),meal:String($('materialAiMeal')?.value||'').trim(),details:String($('materialAiDetails')?.value||'').trim(),hall:h?{name:h.name||'',capacity:h.capacity||null,equipment:h.equipment||''}:null};
}
function renderMaterialAiResults(){
  const box=$('materialAiResults'); if(!box)return;
  if(!materialAiItems.length){box.innerHTML='';return;}
  box.innerHTML='<div class="muted">🤖 Proposition — '+materialAiItems.length+' éléments. Modifie les noms ou quantités avant de les ajouter.</div>'+materialAiItems.map((x,i)=>'<label class="materialAiItem"><input type="checkbox" data-ai-check="'+i+'" checked><input data-ai-title="'+i+'" value="'+esc(x.title||'')+'" aria-label="Nom"><input data-ai-qty="'+i+'" type="number" min="1" value="'+esc(String(Math.max(1,Number(x.quantity)||1)))+'" aria-label="Quantité"><button type="button" class="secondary" data-ai-remove="'+i+'">✕</button>'+(x.note?'<input class="aiNote" data-ai-note="'+i+'" value="'+esc(x.note)+'" aria-label="Note">':'<input class="aiNote" data-ai-note="'+i+'" placeholder="Note (optionnel)" aria-label="Note">')+'</label>').join('')+'<button type="button" class="materialAiAdd" id="materialAiAddBtn">✅ Ajouter la sélection à mon événement</button>';
}
async function generateMaterialAi(){
  const msgEl=$('materialAiMsg'); const btn=$('materialAiGenerateBtn'); if(!event||!user)return;
  const ctx=materialAiContext(); if(!ctx.meal&& !ctx.details){msg('materialAiMsg','Indique au moins le type de repas ou quelques précisions.','err');return;}
  btn.disabled=true; msg('materialAiMsg','🤖 L’IA prépare une liste adaptée…'); $('materialAiResults').innerHTML='';
  try{
    const session=await sb.auth.getSession(); const token=session.data?.session?.access_token||'';
    const r=await fetch('/api/generate-materials',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(ctx)});
    const data=await r.json().catch(()=>({})); if(!r.ok)throw new Error(data.error||'Service IA indisponible.');
    materialAiItems=Array.isArray(data.items)?data.items:[]; renderMaterialAiResults(); msg('materialAiMsg',materialAiItems.length?'Liste générée. Tu peux maintenant la modifier.':'Aucun élément proposé.','ok');
  }catch(e){msg('materialAiMsg',e.message||'Impossible de générer la liste.','err');}
  finally{btn.disabled=false;}
}
async function addSelectedAiMaterials(){
  const rows=[...document.querySelectorAll('.materialAiItem')]; if(!rows.length)return;
  const selected=rows.filter((row,i)=>row.querySelector('[data-ai-check]')?.checked).map(row=>{const i=Number(row.querySelector('[data-ai-check]')?.dataset.aiCheck);return {title:String(row.querySelector('[data-ai-title]')?.value||materialAiItems[i]?.title||'').trim(),quantity:Math.max(1,Number(row.querySelector('[data-ai-qty]')?.value||1)),note:String(row.querySelector('[data-ai-note]')?.value||'').trim()||null};}).filter(x=>x.title);
  if(!selected.length){msg('materialAiMsg','Sélectionne au moins un élément.','err');return;}
  const btn=$('materialAiAddBtn'); if(btn)btn.disabled=true;
  const payload=selected.map(x=>({event_id:event.id,title:x.title,quantity:x.quantity,status:'planned',note:x.note,created_by:user.id,assigned_user_id:null}));
  const r=await sb.from('event_supplies').insert(payload).select('*');
  if(r.error){msg('materialAiMsg','Impossible d’ajouter la liste : '+r.error.message,'err');if(btn)btn.disabled=false;return;}
  suppliesData=[...suppliesData,...(r.data||[])]; materialAiItems=[]; $('materialAiResults').innerHTML=''; msg('materialAiMsg','✅ '+(r.data?.length||selected.length)+' éléments ajoutés à ton événement.','ok'); $('materialAiForm')?.classList.add('hidden'); $('materialAiBox')?.classList.add('collapsed'); renderSupplies(); if(btn)btn.disabled=false;
}
document.addEventListener('input',e=>{
  const i=e.target.dataset?.aiTitle; if(i!==undefined&&materialAiItems[i])materialAiItems[i].title=e.target.value;
  const q=e.target.dataset?.aiQty; if(q!==undefined&&materialAiItems[q])materialAiItems[q].quantity=Math.max(1,Number(e.target.value)||1);
  const n=e.target.dataset?.aiNote; if(n!==undefined&&materialAiItems[n])materialAiItems[n].note=e.target.value;
});
document.addEventListener('click',e=>{
  if(e.target.closest('#materialAiOpenBtn')){$('materialAiBox')?.classList.remove('collapsed'); $('materialAiForm')?.classList.remove('hidden'); $('materialAiPeople').value=30; if(!$('materialAiMeal').value)$('materialAiMeal').value='Buffet dînatoire'; $('materialAiMeal')?.focus();return;}
  if(e.target.closest('#materialAiCancelBtn')){$('materialAiForm')?.classList.add('hidden');return;}
  if(e.target.closest('#materialAiGenerateBtn')){generateMaterialAi();return;}
  const rm=e.target.closest('[data-ai-remove]'); if(rm){materialAiItems.splice(Number(rm.dataset.aiRemove),1);renderMaterialAiResults();return;}
  if(e.target.closest('#materialAiAddBtn')){addSelectedAiMaterials();return;}
});
function supplyOpenForm(open){$('supplyForm')?.classList.toggle('hidden',!open);if(!open){$('supplyTitle').value='';$('supplyQty').value='1';$('supplyStatus').value='planned';$('supplyNote').value='';}}
async function addSupply(){
  if(!event||!user)return;
  const title=String($('supplyTitle')?.value||'').trim(); if(!title){msg('suppliesMsg','Indique ce qu’il faut apporter.','err');return;}
  const quantity=Math.max(1,Number($('supplyQty')?.value||1)); const status=$('supplyStatus')?.value||'planned'; const note=String($('supplyNote')?.value||'').trim();
  const r=await sb.from('event_supplies').insert({event_id:event.id,title,quantity,status,note:note||null,created_by:user.id,assigned_user_id:null}).select('*').single();
  if(r.error){msg('suppliesMsg','Impossible d’ajouter : '+r.error.message,'err');return;}
  suppliesData.push(r.data); supplyOpenForm(false); msg('suppliesMsg','Élément ajouté.','ok'); renderSupplies();
}
async function updateSupply(id,patch){
  const x=suppliesData.find(v=>v.id===id); if(!x)return;
  const can=supplyIsOrganizer()||x.assigned_user_id===user?.id||x.created_by===user?.id; if(!can){msg('suppliesMsg','Tu ne peux pas modifier cet élément.','err');return;}
  const r=await sb.from('event_supplies').update({...patch,updated_at:new Date().toISOString()}).eq('id',id).eq('event_id',event.id);
  if(r.error){msg('suppliesMsg','Erreur : '+r.error.message,'err');return;}
  Object.assign(x,patch); msg('suppliesMsg','Liste mise à jour.','ok'); renderSupplies();
}
async function deleteSupply(id){
  const x=suppliesData.find(v=>v.id===id); if(!x)return;
  const can=supplyIsOrganizer()||x.created_by===user?.id; if(!can){msg('suppliesMsg','Seul le créateur ou l’organisateur peut supprimer cet élément.','err');return;}
  if(!confirm('Supprimer « '+x.title+' » ?'))return;
  const r=await sb.from('event_supplies').delete().eq('id',id).eq('event_id',event.id); if(r.error){msg('suppliesMsg','Erreur : '+r.error.message,'err');return;}
  suppliesData=suppliesData.filter(v=>v.id!==id); msg('suppliesMsg','Élément supprimé.','ok'); renderSupplies();
}
async function editSupply(id){
  const x=suppliesData.find(v=>v.id===id); if(!x)return;
  const title=prompt('Que faut-il apporter ?',x.title); if(title===null)return;
  const qty=prompt('Quantité ?',String(x.quantity||1)); if(qty===null)return;
  const note=prompt('Note (optionnel) :',x.note||''); if(note===null)return;
  await updateSupply(id,{title:title.trim()||x.title,quantity:Math.max(1,Number(qty)||1),note:note.trim()||null});
}
document.addEventListener('change',e=>{
  const a=e.target.closest('[data-supply-assign]'); if(a){updateSupply(a.dataset.supplyAssign,{assigned_user_id:a.value||null});return;}
});
document.addEventListener('click',e=>{
  const me=e.target.closest('[data-supply-me]'); if(me){updateSupply(me.dataset.supplyMe,{assigned_user_id:user.id,status:'reserved'});return;}
  const st=e.target.closest('[data-supply-status]'); if(st){const x=suppliesData.find(v=>v.id===st.dataset.supplyStatus);if(x){const next=x.status==='planned'?'reserved':x.status==='reserved'?'brought':'planned';updateSupply(x.id,{status:next});}return;}
  const ed=e.target.closest('[data-supply-edit]'); if(ed){editSupply(ed.dataset.supplyEdit);return;}
  const del=e.target.closest('[data-supply-delete]'); if(del){deleteSupply(del.dataset.supplyDelete);return;}
});
(function(){const bindSup=()=>{ $('supplyAddBtn')?.addEventListener('click',()=>supplyOpenForm(true)); $('supplyCancelBtn')?.addEventListener('click',()=>supplyOpenForm(false)); $('supplySaveBtn')?.addEventListener('click',addSupply); }; if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindSup,{once:true});else bindSup();})();
(function(){const bind=()=>{ $('hallSuppliesBtn')?.addEventListener('click',()=>showEventTab('supplies',true)); $('hallSearchBtn')?.addEventListener('click',searchHalls); $('hallAddBtn')?.addEventListener('click',()=>hallOpenManualForm(true)); $('hallCancelManualBtn')?.addEventListener('click',()=>hallOpenManualForm(false)); $('hallSaveManualBtn')?.addEventListener('click',addManualHall); ['hallRadius','hallMinCapacity','hallMaxPrice'].forEach(id=>$(id)?.addEventListener('change',saveHallCriteria)); }; if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();})();

/* ===== original inline script 16 ===== */
// V50.1 — Responsable de cagnotte + coordonnées de virement
(function(){
  document.addEventListener('click',e=>{
    const c=e.target.closest('[data-fund-confirm]');
    if(c){ updateContributionStatus(c.dataset.fundConfirm,'confirmed'); return; }
    const r=e.target.closest('[data-fund-reject]');
    if(r){ updateContributionStatus(r.dataset.fundReject,'rejected'); return; }
  });
  const bind=()=>{
    $('editFundBtn')?.addEventListener('click',()=>fundSetFormOpen($('fundOrganizerBox').classList.contains('hidden')));
    $('saveFundSettingsBtn')?.addEventListener('click',saveFundSettings);
    $('addContributionBtn')?.addEventListener('click',()=>fundContributionFormOpen(true));
    $('cancelContributionBtn')?.addEventListener('click',()=>fundContributionFormOpen(false));
    $('saveContributionBtn')?.addEventListener('click',saveContribution);
    $('addExpenseBtn')?.addEventListener('click',()=>{if(fundIsOrganizer())fundExpenseFormOpen(true);else alert('Seul l’organisateur peut enregistrer une dépense.');});
    $('cancelExpenseBtn')?.addEventListener('click',()=>fundExpenseFormOpen(false));
    $('saveExpenseBtn')?.addEventListener('click',saveExpense);
    $('fundSmartCalculateBtn')?.addEventListener('click',calculateSmartFund);
    $('fundMyPaymentBtn')?.addEventListener('click',startStripePayment);
    $('fundMyPaymentAmount')?.addEventListener('input',()=>{ const input=$('fundMyPaymentAmount'), box=$('fundMyPaymentMsg'); const max=Number(input?.max||0), val=Number(String(input?.value||'').replace(',','.')); if(box && val>0 && max>0) box.textContent=val>max?'Le montant ne peut pas dépasser '+eur(max)+'.':'Montant sélectionné : '+eur(val)+'.'; });
    $('editFundPaymentBtn')?.addEventListener('click',openFundPaymentForm);
    $('cancelFundPaymentBtn')?.addEventListener('click',()=>fundPaymentFormOpen(false));
    $('saveFundPaymentBtn')?.addEventListener('click',saveFundPayment);
    $('fundMyPaymentBtn')?.addEventListener('click',startStripePayment);
    $('fundIban')?.addEventListener('input',e=>{ const pos=e.target.selectionStart; e.target.value=formatIban(e.target.value); e.target.selectionStart=e.target.selectionEnd=Math.min(e.target.value.length,pos+(e.target.value.length>pos?1:0)); });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
