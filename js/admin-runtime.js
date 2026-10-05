/* Admin V2.1: server RPC permissions, session-scoped requests and mobile states. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const entry=$('myeventAdminEntry'),panel=$('myeventAdminPanel'),close=$('myeventAdminClose');
const refresh=$('myeventAdminRefresh'),message=$('myeventAdminMessage'),nav=$('myeventAdminNav');
const contentForm=$('myeventAdminContentForm'),contentList=$('myeventAdminContentList'),cancelEdit=$('myeventAdminContentCancel');
if(!entry||!panel||!close||!refresh||!message||!nav)return;
let activeTab='overview',generation=0,identityEpoch=0,currentId=null,authorized=false;
let checking=null,mutationBusy=false,searchTimer,previousFocus,reservationScope='all';
const sameSession=(id,epoch)=>authorized&&currentId===id&&identityEpoch===epoch;
const notify=(text,state='success')=>{message.textContent=text;message.dataset.state=state;};
function item(tag,text,className){const el=document.createElement(tag);if(text!=null)el.textContent=String(text);if(className)el.className=className;return el;}
function stamp(value){return value?new Date(value).toLocaleString('fr-FR'):'—';}
function hide(){panel.hidden=true;generation++;document.body.classList.remove('myeventAdminOpen');if(previousFocus?.isConnected)previousFocus.focus();}
function reset(){
 authorized=false;entry.hidden=true;hide();$('myeventAdminStats').replaceChildren();
 panel.querySelectorAll('.adminList').forEach(el=>el.replaceChildren());contentList?.replaceChildren();
 contentForm?.reset();if(contentForm)delete contentForm.dataset.editId;if(cancelEdit)cancelEdit.hidden=true;
 message.textContent='';delete message.dataset.state;
}
async function check(){
 if(typeof sb==='undefined'||!sb)return false;
 if(checking)return checking;
 const epoch=identityEpoch;
 checking=(async()=>{
  try{
   const response=await sb.auth.getUser();
   if(epoch!==identityEpoch)return false;
   const account=response.data?.user;
   if(response.error||!account){currentId=null;reset();return false;}
   if(currentId!==account.id){reset();currentId=account.id;}
   const {data,error}=await sb.rpc('myevent_is_admin');
   if(epoch!==identityEpoch)return false;
   if(error||data!==true){reset();return false;}
   authorized=true;entry.hidden=false;return true;
  }catch(_){if(epoch===identityEpoch)reset();return false;}
 })();
 try{return await checking;}finally{checking=null;if(epoch!==identityEpoch)setTimeout(check,0);}
}
function tab(name){
 if(!panel.querySelector('[data-admin-view="'+name+'"]'))return;
 activeTab=name;generation++;
 for(const button of nav.querySelectorAll('[data-admin-tab]')){
  if(button.dataset.adminTab===name)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
 }
 for(const view of panel.querySelectorAll('[data-admin-view]'))view.hidden=view.dataset.adminView!==name;
 panel.scrollTop=0;
 if(authorized&&!panel.hidden)loadTab(name);
}
async function rpc(name,args){const {data,error}=await sb.rpc(name,args);if(error)throw error;return data;}
function errorText(error){return error?.message||'Connexion interrompue. Réessayez.';}
async function load(){
 if(!authorized||panel.hidden)return;
 const id=currentId,epoch=identityEpoch;
 notify('Chargement des données…','loading');refresh.disabled=true;
 try{
  const data=await rpc('myevent_admin_overview');
  if(!sameSession(id,epoch)||panel.hidden)return;
  const stats=$('myeventAdminStats');stats.replaceChildren();
  for(const [label,value] of [['Utilisateurs',data.users],['Nouveaux 24 h',data.new_users_24h],['Nouveaux 7 j',data.new_users_7d],['Nouveaux 30 j',data.new_users_30d],['Événements',data.events],['Réservations perso.',data.personal_reservations],['Réservations événement',data.event_reservations],['Signalements ouverts',data.open_reports],['Actions admin 24 h',data.recent_admin_actions],['Comptes suspendus',data.suspended]]){
   const card=item('div',null,'myeventAdminStat');card.append(item('span',label),item('strong',value==null?'—':Number(value).toLocaleString('fr-FR')));stats.append(card);
  }
  const gate=$('myeventAdminGate');
  if(gate)gate.textContent=data.suspension_gate_ready?'Protection des suspensions configurée · validation Supabase réelle requise.':'Suspensions verrouillées tant que la protection serveur n’est pas activée et vérifiée.';
  notify('Données actualisées · '+stamp(data.generated_at));
  if(activeTab!=='overview')return await loadTab(activeTab);return true;
 }catch(error){if(sameSession(id,epoch))notify('Statistiques indisponibles : '+errorText(error),'error');return false;}
 finally{refresh.disabled=false;}
}
async function loadContent(){
 const id=currentId,epoch=identityEpoch,sequence=generation;
 if(!authorized||!contentList||panel.hidden)return;
 contentList.textContent='Chargement du catalogue…';
 try{
  const rows=await rpc('myevent_admin_partner_content_list');
  if(!sameSession(id,epoch)||sequence!==generation||panel.hidden)return;
  contentList.replaceChildren();
  for(const row of rows||[]){
   const card=item('article',null,'adminCard');card.append(item('h4',row.title),item('p',row.kind+' · '+(row.city||'—')+' · '+(row.enabled?'Actif':'Inactif')));
   const actions=item('div',null,'adminActions');actions.append(actionButton('Modifier',()=>{
    for(const key of ['title','kind','city','external_id','affiliate_url','campaign'])contentForm.elements.namedItem(key).value=row[key]||'';
    contentForm.elements.namedItem('enabled').checked=row.enabled;contentForm.dataset.editId=row.id;cancelEdit.hidden=false;contentForm.scrollIntoView({behavior:'smooth'});
   }));card.append(actions);contentList.append(card);
  }
  if(!contentList.childElementCount)contentList.textContent='Aucun contenu affilié.';
  notify('Catalogue chargé.');return true;
 }catch(error){if(sameSession(id,epoch)&&sequence===generation){contentList.textContent='Catalogue indisponible.';notify(errorText(error),'error');}return false;}
}
function actionButton(label,onClick,danger=false){const button=item('button',label,danger?'adminDanger':'');button.type='button';button.addEventListener('click',onClick);return button;}
async function mutate(callback,success){
 if(mutationBusy)return;
 mutationBusy=true;
 const id=currentId,epoch=identityEpoch;
 const controls=[...panel.querySelectorAll('.adminActions button,.adminActions select,#myeventAdminContentForm button')];
 const disabled=controls.map(el=>el.disabled);controls.forEach(el=>el.disabled=true);panel.setAttribute('aria-busy','true');
 try{
  if(!await check()||!sameSession(id,epoch)){if(epoch===identityEpoch)notify('Accès administrateur refusé.','error');return;}
  notify('Enregistrement…','loading');await callback();
  if(!sameSession(id,epoch))return;
  const refreshed=await loadTab(activeTab);if(sameSession(id,epoch)&&refreshed!==false)notify(success);
 }catch(error){if(sameSession(id,epoch))notify('Action refusée : '+errorText(error),'error');}
 finally{mutationBusy=false;panel.removeAttribute('aria-busy');controls.forEach((el,i)=>el.disabled=disabled[i]);}
}
const actionLabels={suspend:'suspendre ce compte',reactivate:'réactiver ce compte',hide:'masquer ce contenu',restore:'réactiver ce contenu',visibility:'modifier la visibilité',resolve:'résoudre ce signalement',dismiss:'classer ce signalement',reopen:'rouvrir ce signalement'};
async function perform(kind,id,action,value='',askReason=false){
 if(mutationBusy)return;
 let reason='';
 if(askReason){const answer=window.prompt('Motif de cette action (10 à 500 caractères) :');if(answer===null)return;reason=answer.trim();if(reason.length<10||reason.length>500){notify('Indiquez un motif de 10 à 500 caractères.','error');return;}}
 if(!window.confirm('Confirmer : '+(actionLabels[action]||action)+' ?'))return;
 await mutate(()=>rpc('myevent_admin_action',{p_kind:kind,p_id:id,p_action:action,p_value:value,p_reason:reason}),'Action enregistrée dans le journal.');
}
function renderUsers(rows,target){
 for(const user of rows){const card=item('article',null,'adminCard');
  if(user.avatar&&/^https:\/\//.test(user.avatar)){const img=document.createElement('img');img.src=user.avatar;img.alt='';img.className='adminAvatar';card.append(img);}
  else if(user.avatar&&user.avatar.length<12)card.append(item('span',user.avatar,'adminAvatar adminAvatarText'));
  const managed=user.managed_suspension===true;
  card.append(item('h4',user.display_name||user.username||'Compte MyEvent'),item('p','@'+(user.username||'—')+' · '+user.id),item('small','Inscrit le '+stamp(user.created_at)+' · '+(user.suspended?(managed?'Suspendu par MyEvent':'Bannissement externe protégé'):'Actif')+(user.is_admin?' · Administrateur':'')));
  const actions=item('div',null,'adminActions');
  actions.append(actionButton('Voir la fiche',()=>showUserDetail(user.id)));
  if(!user.is_admin&&(!user.suspended||managed))actions.append(actionButton(managed?'Réactiver':'Suspendre',()=>perform('user',user.id,managed?'reactivate':'suspend','',!managed),!managed));
  card.append(actions);target.append(card);
 }
}
async function showUserDetail(userId){
 if(!authorized||mutationBusy)return;
 const box=$('myeventAdminUserDetail'),body=$('myeventAdminUserDetailBody');
 if(!box||!body)return;
 notify('Chargement de la fiche utilisateur…','loading');box.hidden=false;body.textContent='Chargement…';
 try{
  const user=await rpc('myevent_admin_user_detail',{p_user:userId});
  body.replaceChildren();
  const identity=item('div',null,'adminUserIdentity');
  if(user.avatar&&/^https:\/\//.test(user.avatar)){const img=document.createElement('img');img.src=user.avatar;img.alt='';img.className='adminAvatar';identity.append(img);}
  identity.append(item('h4',user.display_name||user.username||'Compte MyEvent'),item('p','@'+(user.username||'—')),item('small','UUID · '+user.id));
  body.append(identity);
  const facts=item('div',null,'adminUserFacts');
  for(const [label,value] of [
   ['État',user.is_admin?'Administrateur protégé':(user.suspended?'Suspendu':'Actif')],
   ['Inscription',stamp(user.created_at)],
   ['Événements créés',Number(user.events_created||0).toLocaleString('fr-FR')],
   ['Dernière action admin',stamp(user.last_admin_action)]
  ]){const row=item('div',null,'adminUserFact');row.append(item('span',label),item('strong',value));facts.append(row);}
  body.append(facts);
  const note=item('p',user.is_admin?'Ce compte administrateur est protégé contre la suspension depuis MyEvent Admin.':'Les actions sensibles restent confirmées et journalisées.','adminMobileHint');body.append(note);
  const actions=item('div',null,'adminActions');
  if(!user.is_admin)actions.append(actionButton(user.suspended?'Réactiver':'Suspendre',()=>perform('user',user.id,user.suspended?'reactivate':'suspend','',!user.suspended),!user.suspended));
  body.append(actions);box.scrollIntoView({behavior:'smooth',block:'start'});notify('Fiche utilisateur chargée.');
 }catch(error){body.textContent='Fiche indisponible.';notify('Fiche indisponible : '+errorText(error),'error');}
}
function renderReservations(rows,target){
 for(const row of rows){
  const card=item('article',null,'adminCard');
  const scope=row.event_id?'Événement':'Personnelle';
  card.append(item('h4',row.destination||row.provider||'Réservation MyEvent'),
   item('p',scope+' · '+(row.kind||'—')+' · '+(row.reservation_status==='confirmed'?'Confirmée':'Ajoutée / à vérifier')),
   item('small','Utilisateur : '+(row.owner_name||row.owner_id)+(row.event_name?' · Événement : '+row.event_name:'')+' · '+stamp(row.created_at)));
  if(row.provider)card.append(item('p','Partenaire / source : '+row.provider));
  if(row.has_proof)card.append(item('small','Justificatif présent · contenu privé non affiché dans l’administration.'));
  target.append(card);
 }
}
async function loadReservations(){
 const sequence=++generation,id=currentId,epoch=identityEpoch,target=$('myeventAdminReservations');
 if(!target||!authorized||panel.hidden)return;
 target.textContent='Chargement…';notify('Chargement des réservations…','loading');
 try{
  const query=panel.querySelector('[data-admin-search="reservations"]')?.value?.trim()||'';
  const rows=await rpc('myevent_admin_reservations',{p_scope:reservationScope,p_query:query,p_limit:60});
  if(!sameSession(id,epoch)||sequence!==generation||panel.hidden)return;
  target.replaceChildren();renderReservations(rows||[],target);
  if(!target.childElementCount)target.append(item('p','Aucune réservation pour ce filtre.'));
  notify('Réservations actualisées · '+new Date().toLocaleTimeString('fr-FR'));return true;
 }catch(error){if(sameSession(id,epoch)&&sequence===generation){target.textContent='Réservations indisponibles.';notify(errorText(error),'error');}return false;}
}
function renderEvents(rows,target){for(const event of rows){
 const card=item('article',null,'adminCard');card.append(item('h4',event.name),item('p',(event.location||'Lieu non renseigné')+' · '+stamp(event.event_date)),item('small','Créateur : '+(event.creator_name||event.creator_id)+' · '+event.visibility+' · '+(event.hidden?'Masqué dans la découverte':'Visible selon sa confidentialité')));
 const actions=item('div',null,'adminActions');actions.append(actionButton(event.hidden?'Réactiver':'Masquer',()=>perform('event',event.id,event.hidden?'restore':'hide','',!event.hidden),!event.hidden));
 const select=document.createElement('select');select.setAttribute('aria-label','Visibilité de '+event.name);
 for(const value of ['private','friends','public']){const option=item('option',value==='private'?'Privé':value==='friends'?'Amis':'Public');option.value=value;select.append(option);}
 select.value=event.visibility;select.addEventListener('change',()=>{const value=select.value;select.value=event.visibility;perform('event',event.id,'visibility',value);});actions.append(select);card.append(actions);target.append(card);
}}
function renderListings(rows,target){for(const listing of rows){
 const card=item('article',null,'adminCard');card.append(item('h4',listing.title),item('p',(listing.city||'—')+' · '+(Number(listing.price_cents||0)/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'})),item('small',(listing.owner_name||listing.owner_id)+' · '+listing.status+' · '+(listing.hidden?'Masquée':'Non masquée')));
 const actions=item('div',null,'adminActions');actions.append(actionButton(listing.hidden?'Réactiver':'Masquer',()=>perform('listing',listing.id,listing.hidden?'restore':'hide','',!listing.hidden),!listing.hidden));card.append(actions);target.append(card);
}}
function renderReports(rows){for(const kind of ['event','listing']){
 const target=$(kind==='event'?'myeventAdminEventReports':'myeventAdminListingReports');target.replaceChildren();
 for(const report of rows.filter(r=>r.target_kind===kind)){const card=item('article',null,'adminCard');card.append(item('h4',report.reason),item('small',report.status+' · '+stamp(report.created_at)+' · ID '+report.target_id));const actions=item('div',null,'adminActions');
  for(const [label,action] of report.status==='open'?[['Résoudre','resolve'],['Classer','dismiss']]:[['Rouvrir','reopen']])actions.append(actionButton(label,()=>perform('report',report.id,action)));
  card.append(actions);target.append(card);
 }if(!target.childElementCount)target.append(item('p','Aucun signalement.'));
}}
function renderConfig(rows,target,kind){for(const row of rows){
 const key=kind==='partner'?row.provider:row.key,card=item('article',null,'adminCard');card.append(item('h4',kind==='partner'?row.label:row.description),item('small',key+' · '+(row.enabled?'Activé':'Désactivé')));
 if(kind==='partner')card.append(item('p',row.notes||'Aucune note · les clés API restent sur le serveur.'));
 const actions=item('div',null,'adminActions');
 const save=(enabled,notes)=>mutate(()=>rpc('myevent_admin_config',{p_kind:kind,p_key:key,p_enabled:enabled,p_notes:notes}),'Configuration enregistrée dans le journal.');
 actions.append(actionButton(row.enabled?'Désactiver':'Activer',async()=>{if(!mutationBusy&&window.confirm('Confirmer le réglage '+key+' ?'))await save(!row.enabled,kind==='partner'?row.notes:'');}));
 if(kind==='partner')actions.append(actionButton('Modifier la note',async()=>{if(mutationBusy)return;const note=window.prompt('Note interne (aucune clé API ni secret, 500 caractères maximum) :',row.notes||'');if(note===null)return;if(note.length>500){notify('La note dépasse 500 caractères.','error');return;}if(window.confirm('Enregistrer la note de '+row.label+' ?'))await save(row.enabled,note);}));
 card.append(actions);target.append(card);
}}
const targetIds={users:'myeventAdminUsers',events:'myeventAdminEvents',listings:'myeventAdminListings',partners:'myeventAdminPartners',settings:'myeventAdminSettings',audit:'myeventAdminAudit'};
function renderCentralReports(rows,target){
 for(const report of rows){
  const card=item('article',null,'adminCard');
  const type=report.target_kind==='event'?'Événement':'Annonce';
  card.append(item('h4',type+' · '+report.reason),item('small',report.status+' · '+stamp(report.created_at)+' · ID '+report.target_id));
  const actions=item('div',null,'adminActions');
  for(const [label,action] of report.status==='open'?[['Résoudre','resolve'],['Classer','dismiss']]:[['Rouvrir','reopen']])actions.append(actionButton(label,()=>perform('report',report.id,action)));
  card.append(actions);target.append(card);
 }
}
async function loadReports(){
 const sequence=++generation,id=currentId,epoch=identityEpoch,target=$('myeventAdminReports');
 if(!target||!authorized||panel.hidden)return;
 target.textContent='Chargement…';
 try{
  const rows=await rpc('myevent_admin_list',{p_kind:'reports',p_query:'',p_limit:100});
  if(!sameSession(id,epoch)||sequence!==generation||panel.hidden)return;
  target.replaceChildren();renderCentralReports(rows||[],target);
  if(!target.childElementCount)target.append(item('p','Aucun signalement.'));
  notify('Signalements actualisés.');return true;
 }catch(error){if(sameSession(id,epoch)){target.textContent='Signalements indisponibles.';notify(errorText(error),'error');}return false;}
}
async function loadStatistics(){
 const sequence=++generation,id=currentId,epoch=identityEpoch,target=$('myeventAdminStatistics');
 if(!target||!authorized||panel.hidden)return;
 target.textContent='Chargement…';
 try{
  const data=await rpc('myevent_admin_statistics');
  if(!sameSession(id,epoch)||sequence!==generation||panel.hidden)return;
  target.replaceChildren();
  const rows=[['Utilisateurs',data.users_total],['Nouveaux utilisateurs · 30 j',data.users_30d],['Événements',data.events_total],['Nouveaux événements · 30 j',data.events_30d],['Annonces Marketplace',data.marketplace_total],['Réservations',data.reservations_total],['Réservations · 30 j',data.reservations_30d],['Rattachées à un événement',data.reservations_linked_to_event],['Signalements ouverts',data.reports_open],['Signalements résolus',data.reports_resolved],['Partenaires actifs',data.partners_enabled]];
  for(const [label,value] of rows){const card=item('div',null,'myeventAdminStat');card.append(item('span',label),item('strong',value==null?'—':Number(value).toLocaleString('fr-FR')));target.append(card);}
  notify('Statistiques actualisées · '+stamp(data.generated_at));return true;
 }catch(error){if(sameSession(id,epoch)){target.textContent='Statistiques indisponibles.';notify(errorText(error),'error');}return false;}
}
async function loadTab(name){
 if(!authorized||panel.hidden)return;
 const sequence=++generation,id=currentId,epoch=identityEpoch;
 if(name==='overview')return load();
 if(name==='content')return loadContent();
 if(name==='reservations')return loadReservations();
 if(name==='reports')return loadReports();
 if(name==='statistics')return loadStatistics();
 const kinds={users:['users'],events:['events','reports'],marketplace:['listings','reports'],partners:['partners'],settings:['settings','audit']}[name];if(!kinds)return;
 for(const kind of kinds){const target=$(targetIds[kind]);if(target)target.textContent='Chargement…';}
 notify('Chargement de la rubrique…','loading');
 try{
  const query=panel.querySelector('[data-admin-search="'+kinds[0]+'"]')?.value?.trim()||'';
  const batches=await Promise.all(kinds.map(kind=>rpc('myevent_admin_list',{p_kind:kind,p_query:kind===kinds[0]?query:'',p_limit:60})));
  if(!sameSession(id,epoch)||sequence!==generation||panel.hidden)return;
  kinds.forEach((kind,i)=>{const rows=batches[i]||[],target=$(targetIds[kind]);if(kind==='reports'){renderReports(rows);return;}target.replaceChildren();
   if(kind==='users')renderUsers(rows,target);else if(kind==='events')renderEvents(rows,target);else if(kind==='listings')renderListings(rows,target);else if(kind==='partners'||kind==='settings')renderConfig(rows,target,kind==='partners'?'partner':'module');
   else for(const row of rows){const card=item('article',null,'adminCard');card.append(item('h4',row.action+' · '+row.target_kind),item('p',JSON.stringify(row.detail)),item('small',stamp(row.created_at)+' · '+row.actor_id));target.append(card);}
   if(!target.childElementCount)target.append(item('p','Aucun résultat.'));
  });notify('Rubrique actualisée · '+new Date().toLocaleTimeString('fr-FR'));return true;
 }catch(error){if(!sameSession(id,epoch)||sequence!==generation)return;notify('Chargement impossible : '+errorText(error),'error');for(const kind of kinds){const target=$(targetIds[kind]);if(target)target.textContent='Données indisponibles.';}if(kinds.includes('reports'))for(const id of ['myeventAdminEventReports','myeventAdminListingReports'])$(id).textContent='Signalements indisponibles.';return false;}
}
contentForm?.addEventListener('submit',async e=>{
 e.preventDefault();if(mutationBusy)return;if(!window.confirm('Enregistrer ce contenu affilié ?'))return;
 const fd=new FormData(contentForm),args={p_provider:'getyourguide',p_kind:fd.get('kind'),p_title:fd.get('title'),p_city:fd.get('city'),p_external_id:fd.get('external_id'),p_affiliate_url:fd.get('affiliate_url'),p_campaign:fd.get('campaign'),p_enabled:fd.has('enabled'),p_id:contentForm.dataset.editId||null};
 await mutate(async()=>{await rpc('myevent_admin_partner_content_save',args);contentForm.reset();delete contentForm.dataset.editId;cancelEdit.hidden=true;},'Contenu enregistré dans le journal.');
});
cancelEdit?.addEventListener('click',()=>{contentForm.reset();delete contentForm.dataset.editId;cancelEdit.hidden=true;});
nav.addEventListener('click',e=>{const button=e.target.closest('[data-admin-tab]');if(button)tab(button.dataset.adminTab);});
panel.querySelectorAll('[data-admin-search]').forEach(input=>input.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadTab(activeTab),250);}));
panel.querySelectorAll('[data-admin-reservation-scope]').forEach(button=>button.addEventListener('click',()=>{
 reservationScope=button.dataset.adminReservationScope;
 panel.querySelectorAll('[data-admin-reservation-scope]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 if(activeTab==='reservations')loadReservations();
}));
entry.addEventListener('click',async()=>{if(!await check())return;previousFocus=document.activeElement;panel.hidden=false;document.body.classList.add('myeventAdminOpen');tab('overview');close.focus();});
close.addEventListener('click',hide);refresh.addEventListener('click',load);
document.addEventListener('keydown',e=>{
 if(panel.hidden)return;if(e.key==='Escape'){hide();return;}
 if(e.key==='Tab'){const focusable=[...panel.querySelectorAll('button:not([disabled]),input,select,a[href]')].filter(el=>el.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
});
const ready=setInterval(()=>{
 if(typeof sb==='undefined'||!sb)return;clearInterval(ready);
 sb.auth.onAuthStateChange(()=>{identityEpoch++;currentId=null;reset();setTimeout(check,0);});check();
},400);
// Recheck server permissions when returning to the Profile after installation,
// a temporary network failure, or a Safari page restored from the background.
const profile=$('profileSettingsCard');
if(profile)new MutationObserver(()=>{if(profile.classList.contains('profileSettingsVisible'))check();}).observe(profile,{attributes:true,attributeFilter:['class']});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check();});
window.addEventListener('pageshow',()=>check());
})();

$('myeventAdminUserDetailClose')?.addEventListener('click',()=>{const box=$('myeventAdminUserDetail');if(box)box.hidden=true;});
