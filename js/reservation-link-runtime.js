(function(){
  'use strict';
  const api=window.MyEventReservationLink;
  const $=id=>document.getElementById(id);
  let dialog,context,working=false,previousFocus;
  const markers=[];
  const current=()=>typeof event!=='undefined'?event:null;
  const viewer=()=>typeof user!=='undefined'?user:null;
  const same=ctx=>ctx&&current()?.id===ctx.eventId&&viewer()?.id===ctx.userId;
  const allowed=()=>current()&&viewer()&&typeof v58IsEventManager==='function'&&v58IsEventManager(current());
  function close(){if(working)return;dialog?.close();context=null;previousFocus?.focus();}
  function error(e){$('reservationLinkMessage').textContent=e.message||String(e);}
  function field(id,label,type='text'){return '<label>'+label+'<input id="rl'+id+'" type="'+type+'" maxlength="'+(type==='url'?8192:500)+'"></label>';}
  function setup(){
    dialog=document.createElement('dialog');dialog.id='reservationLinkDialog';dialog.className='reservationLinkDialog';
    dialog.setAttribute('aria-labelledby','reservationLinkTitle');
    dialog.innerHTML='<form id="reservationLinkForm"><h2 id="reservationLinkTitle">Ajouter ma réservation par lien</h2><p>Les dates et voyageurs du lien sont des critères de recherche à vérifier. Aucun lien ne prouve une réservation.</p>'+field('URL','Lien de l’annonce ou du trajet','url')+'<button type="button" class="secondary" id="rlExtract">Préremplir depuis le lien</button><p id="rlProvider" role="status"></p><div id="rlDetails" hidden><label>Type<select id="rlKind"><option value="accommodation">Hébergement</option><option value="transport">Transport</option></select></label>'+field('Name','Nom de l’hébergement ou du trajet')+field('Destination','Destination')+field('From','Lieu de départ (transport)')+field('Start','Arrivée ou départ du trajet','date')+field('End','Fin du séjour ou arrivée du trajet (facultatif)','date')+'<label>Heure de début (facultatif)<input id="rlStartTime" type="time"></label><label>Heure de fin (facultatif)<input id="rlEndTime" type="time"></label>'+field('Travelers','Nombre de voyageurs (facultatif)','number')+field('Address','Adresse exacte (facultatif)')+field('Photo','Lien HTTPS d’une photo autorisée (facultatif)','url')+'<details><summary>Localisation vérifiée pour la carte (facultatif)</summary><p>Indique uniquement les coordonnées exactes du lieu. Le centre d’une ville ou d’une recherche ne convient pas.</p>'+field('Lat','Latitude','number')+field('Lon','Longitude','number')+'<label class="rlCheck"><input id="rlGeoVerified" type="checkbox">J’ai vérifié ces coordonnées avec l’adresse exacte.</label></details><label>Statut<select id="rlStatus"><option value="added">Ajouté · réservation à vérifier</option><option value="confirmed">Réservation confirmée auprès du prestataire</option></select></label><label class="rlCheck"><input id="rlConfirmed" type="checkbox">J’ai réellement réservé. La confirmation est ma déclaration, sans vérification automatique.</label>'+field('Reference','Référence de confirmation (facultatif)')+'<label>Note (facultatif)<textarea id="rlNote" maxlength="1500"></textarea></label><label>Justificatif facultatif · PDF, JPEG ou PNG, 200 Ko maximum<input id="rlProof" type="file" accept="application/pdf,image/jpeg,image/png"></label><p>Les informations et le justificatif seront partagés avec les membres de cet événement.</p><label class="rlCheck"><input id="rlConsent" type="checkbox" required>J’ai vérifié les informations et je souhaite les ajouter au planning.</label><button type="submit" id="rlSave">Confirmer et ajouter au planning</button></div><p id="reservationLinkMessage" role="alert" aria-live="polite"></p><button type="button" class="secondary" id="rlCancel">Annuler</button></form>';
    document.body.appendChild(dialog);
    for(const id of ['Travelers','Lat','Lon'])$('rl'+id).step=id==='Travelers'?'1':'any';
    $('rlTravelers').min='1';$('rlTravelers').max='99';
    $('rlCancel').addEventListener('click',close);
    dialog.addEventListener('cancel',e=>{if(working)e.preventDefault();else context=null;});
    $('rlExtract').addEventListener('click',()=>{try{
      if(!same(context))throw Error('L’événement a changé. Ferme puis rouvre le formulaire.');
      const data=api.extract($('rlURL').value.trim());
      for(const [key,name] of [['name','Name'],['destination','Destination'],['from','From'],['start','Start'],['end','End'],['travelers','Travelers']])$('rl'+name).value=data[key];
      $('rlKind').value=context.kind||data.kind;$('rlProvider').textContent='Fournisseur : '+data.provider+' · seules les informations présentes dans le lien sont reprises.';
      $('rlDetails').hidden=false;$('reservationLinkMessage').textContent='Complète les champs manquants. Nom, photo et adresse sont souvent absents du lien.';
      $('rlName').focus();
    }catch(e){error(e);}});
    $('reservationLinkForm').addEventListener('submit',save);
  }
  function open(kind){
    if(!allowed()){alert('Sélectionne un événement dont tu es organisateur ou coorganisateur.');return;}
    if(!dialog)setup();if(working)return;
    previousFocus=document.activeElement;$('reservationLinkForm').reset();$('rlDetails').hidden=true;$('reservationLinkMessage').textContent='';$('rlProvider').textContent='';
    context={eventId:current().id,userId:viewer().id,kind:kind==='accommodation'||kind==='transport'?kind:null};
    dialog.showModal();$('rlURL').focus();
  }
  async function verifyAccess(ctx){
    if(!same(ctx))throw Error('L’événement ou le compte a changé. Aucun ajout effectué.');
    const result=await sb.from('events').select('id,creator_id').eq('id',ctx.eventId).single();
    if(result.error||!result.data)throw Error('Événement inaccessible.');
    if(result.data.creator_id!==ctx.userId){
      const membership=await sb.from('event_members').select('role').eq('event_id',ctx.eventId).eq('user_id',ctx.userId).single();
      if(membership.error||membership.data?.role!=='coorganizer')throw Error('Seul l’organisateur ou un coorganisateur peut ajouter une réservation.');
    }
    if(!same(ctx))throw Error('L’événement ou le compte a changé. Aucun ajout effectué.');
  }
  async function proof(file){
    if(!file)return null;
    const types=['application/pdf','image/jpeg','image/png'];
    if(!types.includes(file.type)||file.size>200*1024||file.size===0)throw Error('Justificatif : PDF, JPEG ou PNG, de 1 octet à 200 Ko.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    const valid=file.type==='application/pdf'?String.fromCharCode(...bytes.slice(0,5))==='%PDF-':file.type==='image/png'?[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n):bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    if(!valid)throw Error('Le contenu du justificatif ne correspond pas à son type.');
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.slice(i,i+8192));
    return {name:file.name.slice(0,150),type:file.type,size:file.size,base64:btoa(binary)};
  }
  async function save(e){
    e.preventDefault();if(working)return;
    const ctx=context;
    try{
      if(!$('rlConsent').checked)throw Error('Vérifie les informations puis confirme l’ajout.');
      const v=name=>$('rl'+name).value;
      const input={original_url:v('URL'),kind:v('Kind'),name:v('Name'),destination:v('Destination'),from:v('From'),start:v('Start')+(v('StartTime')?'T'+v('StartTime'):''),end:v('End')+(v('EndTime')?'T'+v('EndTime'):''),travelers:v('Travelers'),address:v('Address'),photo:v('Photo'),lat:v('Lat'),lon:v('Lon'),geo_verified:$('rlGeoVerified').checked,status:v('Status'),confirmed_by_user:$('rlConfirmed').checked,reference:v('Reference'),note:v('Note')};
      const data=api.payload(input);working=true;$('rlSave').disabled=true;
      await verifyAccess(ctx);
      data.proof=await proof($('rlProof').files?.[0]);
      await verifyAccess(ctx);
      const marker=input.kind==='transport'?V58_TRANSPORT_MARKER:V58_ACCOMMODATION_MARKER;
      const result=await sb.from('messages').insert({event_id:ctx.eventId,user_id:ctx.userId,content:marker+JSON.stringify(data)}).select('id').single();
      if(result.error)throw result.error;
      if(typeof rememberLocalCreated==='function')rememberLocalCreated('messages',result.data.id);
      working=false;close();
      if(same(ctx)){
        await v58LoadModuleLists();
        if(typeof renderInlineSelectedEvent==='function')await renderInlineSelectedEvent();
        if(typeof loadEventLocations==='function'&&document.querySelector('[data-panel="locations"]')?.open)await loadEventLocations();
      }
    }catch(e){error(e);}finally{working=false;if($('rlSave'))$('rlSave').disabled=false;}
  }
  function actions(parent,item,kind){
    if(!parent||!item?.link_import)return;
    const row=document.createElement('div');row.className='reservationLinkActions';
    const status=document.createElement('p');status.textContent=api.statusLabel(item,kind);row.append(status);
    if(item.reference){const reference=document.createElement('p');reference.textContent='Référence : '+item.reference;row.append(reference);}
    try{api.url(item.original_url);const link=document.createElement('a');link.href=item.original_url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Rouvrir l’annonce · '+item.provider;row.append(link);}catch(_){}
    if(item.photo){try{api.url(item.photo);const link=document.createElement('a');link.href=item.photo;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Voir la photo';row.append(link);}catch(_){}}
    if(item.proof){const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='Télécharger le justificatif';button.addEventListener('click',async()=>{
      try{
        const eventId=current()?.id;if(!eventId||!viewer())throw Error('Connecte-toi à cet événement.');
        const r=await sb.from('messages').select('content').eq('event_id',eventId).eq('id',item._message_id).single();
        if(r.error||!r.data||current()?.id!==eventId)throw Error('Justificatif inaccessible.');
        const p=JSON.parse(r.data.content.slice(r.data.content.indexOf(']]')+2)).proof;
        if(!p||!['application/pdf','image/png','image/jpeg'].includes(p.type)||p.base64.length>280000)throw Error('Justificatif non valide.');
        const bytes=Uint8Array.from(atob(p.base64),c=>c.charCodeAt(0)),blob=new Blob([bytes],{type:p.type}),href=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=href;a.download=p.name.replace(/[^\p{L}\p{N}._ -]/gu,'_');a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
      }catch(e){alert(e.message);}
    });row.append(button);}
    parent.append(row);
  }
  function cardDecorate(items,kind){
    const selector=kind==='transport'?'#m58TransportList':'#m58AccommodationList';
    document.querySelectorAll(selector+' .m58ModuleCard').forEach((card,i)=>{
      const item=items[i];if(!item?.link_import)return;actions(card,item,kind);
      const dates=[item.checkin||item.departure,item.checkout||item.arrival].filter(Boolean);
      if(dates.length&&dates.every(v=>/^\d{4}-\d{2}-\d{2}$/.test(v))){const meta=card.querySelector('.m58ModuleCardMeta');if(meta)meta.textContent=dates.map(v=>new Date(v+'T12:00:00').toLocaleDateString('fr-FR')).join(' → ')+' · heures à préciser'+(item.people?' · '+item.people:'');}
      // Imported records never use the legacy first-result geocoder or destructive editor.
      card.querySelectorAll('[data-m58-transport-map],[data-m58-accommodation-map],[data-m58-transport-edit]').forEach(b=>b.remove());
      if(api.reliableGeo(item.geo)){const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='Voir le lieu vérifié sur la carte';button.addEventListener('click',()=>v58OpenLocationPoint(item.geo.lat,item.geo.lon,item.name,kind==='transport'?'🚆':'🏨'));card.append(button);}
      else {const hint=document.createElement('p');hint.textContent='Localisation exacte non renseignée · aucun repère sur la carte.';card.append(hint);}
    });
  }
  let mapGeneration=0;
  function clearMap(){mapGeneration++;for(const marker of markers)marker.remove();markers.length=0;}
  async function map(){
    clearMap();const generation=mapGeneration;
    if(!current()||!viewer()||typeof locationMap==='undefined'||!locationMap||!window.L)return;
    const eventId=current().id;
    const [ts,as]=await Promise.all([getEventTransports(eventId),getEventAccommodations(eventId)]);
    if(current()?.id!==eventId||generation!==mapGeneration)return;
    for(const item of [...ts,...as])if(item.link_import&&api.reliableGeo(item.geo)){
      const content=document.createElement('div');const title=document.createElement('strong');title.textContent=item.name;content.append(title);
      actions(content,item,item.checkin?'accommodation':'transport');
      markers.push(L.marker([item.geo.lat,item.geo.lon],{icon:makeLocationIcon(item.checkin?'🏨':'🚆','#278cff')}).addTo(locationMap).bindPopup(content));
    }
  }
  window.MyEventReservationLinkUI={open,actions,cardDecorate,map,clearMap,proof,verifyAccess};
  document.addEventListener('click',e=>{const button=e.target.closest('[data-reservation-link-add]');if(button)open(button.dataset.reservationLinkAdd);});
  const originalAccommodation=v58RenderAccommodationModule,originalTransport=v58RenderTransportModule;
  v58RenderAccommodationModule=function(items){originalAccommodation(items);cardDecorate(items,'accommodation');};
  v58RenderTransportModule=function(items){originalTransport(items);cardDecorate(items,'transport');};
  function entryPoints(){
    for(const [id,kind] of [['accommodationPanel','accommodation'],['transportPanel','transport']]){
      const panel=$(id)||document.querySelector('[data-panel="'+kind+'"]');if(!panel)continue;
      const button=document.createElement('button');button.type='button';button.className='secondary';button.dataset.reservationLinkAdd=kind;button.textContent='Ajouter ma réservation par lien';
      const summary=panel.querySelector('summary');if(summary)summary.after(button);else panel.prepend(button);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',entryPoints,{once:true});else entryPoints();
})();
