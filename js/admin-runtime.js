/* Admin V2.1: server RPC permissions, session-scoped requests and mobile states. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const entry=$('myeventAdminEntry'),panel=$('myeventAdminPanel'),close=$('myeventAdminClose');
const refresh=$('myeventAdminRefresh'),message=$('myeventAdminMessage'),nav=$('myeventAdminNav');
const contentForm=$('myeventAdminContentForm'),contentList=$('myeventAdminContentList'),cancelEdit=$('myeventAdminContentCancel');
if(!entry||!panel||!close||!refresh||!message||!nav)return;
let activeTab='overview',generation=0,identityEpoch=0,currentId=null,authorized=false;
let checking=null,mutationBusy=false,searchTimer,previousFocus;
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
  for(const [label,value] of [['Utilisateurs',data.users],['Événements',data.events],['Annonces',data.marketplace],['Comptes suspendus',data.suspended],['Signalements ouverts',data.open_reports]]){
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
  if(!user.is_admin&&(!user.suspended||managed)){const actions=item('div',null,'adminActions');actions.append(actionButton(managed?'Réactiver':'Suspendre',()=>perform('user',user.id,managed?'reactivate':'suspend','',!managed),!managed));card.append(actions);}
  target.append(card);
 }
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
async function loadTab(name){
 if(!authorized||panel.hidden)return;
 const sequence=++generation,id=currentId,epoch=identityEpoch;
 if(name==='overview')return load();
 if(name==='content')return loadContent();
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
