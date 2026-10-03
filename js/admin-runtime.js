/* MyEvent Admin V1 — membership is verified by server-side Supabase RPC, never email/localStorage. */
(function(){
'use strict';
const entry=document.getElementById('myeventAdminEntry');
const panel=document.getElementById('myeventAdminPanel');
const close=document.getElementById('myeventAdminClose');
const refresh=document.getElementById('myeventAdminRefresh');
const message=document.getElementById('myeventAdminMessage');
const nav=document.getElementById('myeventAdminNav');
const cancelEdit=document.getElementById('myeventAdminContentCancel');
let activeTab="overview",generation=0;
function tab(name){
 activeTab=name;
 for(const button of nav.querySelectorAll('[data-admin-tab]')){
  if(button.dataset.adminTab===name)button.setAttribute('aria-current','page');
  else button.removeAttribute('aria-current');
 }
 for(const view of panel.querySelectorAll('[data-admin-view]'))view.hidden=view.dataset.adminView!==name;
 panel.scrollTop=0;
 if(authorized&&name!=="overview")loadTab(name);
}
nav?.addEventListener('click',e=>{const button=e.target.closest('[data-admin-tab]');if(button)tab(button.dataset.adminTab);});
if(!entry||!panel||!close||!refresh||!message)return;
let currentId=null,checking=false,authorized=false;
function hide(){panel.hidden=true;document.body.classList.remove('myeventAdminOpen');generation++;}
function reset(){authorized=false;entry.hidden=true;hide();document.getElementById('myeventAdminStats').replaceChildren();panel.querySelectorAll('.adminList').forEach(el=>el.replaceChildren());}
async function check(){
 if(checking||typeof sb==='undefined'||!sb)return;
 checking=true;
 try{
  const {data:{user:account},error:sessionError}=await sb.auth.getUser();
  if(sessionError||!account){currentId=null;reset();return;}
  if(currentId!==account.id){currentId=account.id;reset();}
  const {data,error}=await sb.rpc('myevent_is_admin');
  if(error||data!==true){reset();return;}
  authorized=true;entry.hidden=false;
 }catch(_){reset();}
 finally{checking=false;}
}
async function load(){
 if(!authorized)return;
 notify('Chargement des données…','loading');
 const {data,error}=await sb.rpc('myevent_admin_overview');
 if(error){notify('Statistiques indisponibles : '+(error.message||'migration manquante'),'error');return;}
 const stats=document.getElementById('myeventAdminStats');
 stats.replaceChildren();
 for(const [label,value] of [['Utilisateurs',data.users],['Événements',data.events],['Annonces',data.marketplace],['Comptes suspendus',data.suspended],['Signalements ouverts',data.open_reports]]){
  const item=document.createElement('div');item.className='myeventAdminStat';
  const name=document.createElement('span');name.textContent=label;
  const number=document.createElement('strong');number.textContent=Number(value||0).toLocaleString('fr-FR');
  item.append(name,number);stats.appendChild(item);
 }
 notify('Données actualisées · '+new Date(data.generated_at).toLocaleString('fr-FR'),'success');
 await loadTab(activeTab);
}
const contentForm=document.getElementById('myeventAdminContentForm');
const contentList=document.getElementById('myeventAdminContentList');
async function loadContent(){
 if(!authorized||!contentList)return;
 const {data,error}=await sb.rpc('myevent_admin_partner_content_list');
 contentList.replaceChildren();
 if(error){contentList.textContent='Catalogue indisponible : appliquer la migration 202610030002.';return;}
 for(const item of data||[]){
  const line=document.createElement('div');
  line.style.cssText='padding:12px;border-bottom:1px solid #ffffff33;display:flex;justify-content:space-between;gap:12px;align-items:center';
  const label=document.createElement('span');
  label.textContent=item.title+' · '+item.kind+' · '+(item.city||'—')+' · '+(item.enabled?'Actif':'Inactif');
  const edit=document.createElement('button');edit.type='button';edit.textContent='Modifier';
  edit.addEventListener('click',()=>{for(const key of ['title','kind','city','external_id','affiliate_url','campaign'])contentForm.elements.namedItem(key).value=item[key]||'';contentForm.elements.namedItem('enabled').checked=item.enabled;contentForm.dataset.editId=item.id;cancelEdit.hidden=false;tab('content');contentForm.scrollIntoView({behavior:'smooth'});});
  line.append(label,edit);contentList.append(line);
 }
}
contentForm?.addEventListener('submit',async e=>{
 e.preventDefault();await check();if(!authorized){message.textContent='Accès refusé.';return;}
 const fd=new FormData(contentForm);
 const args={p_provider:'getyourguide',p_kind:fd.get('kind'),p_title:fd.get('title'),p_city:fd.get('city'),p_external_id:fd.get('external_id'),p_affiliate_url:fd.get('affiliate_url'),p_campaign:fd.get('campaign'),p_enabled:fd.has('enabled'),p_id:contentForm.dataset.editId||null};
 const submit=contentForm.querySelector('[type=submit]');submit.disabled=true;
 try{const {error}=await sb.rpc('myevent_admin_partner_content_save',args);if(error)throw error;contentForm.reset();delete contentForm.dataset.editId;cancelEdit.hidden=true;message.textContent='Contenu enregistré.';await loadContent();}
 catch(err){message.textContent='Enregistrement impossible : '+(err.message||'Erreur');}
 finally{submit.disabled=false;}
});
cancelEdit?.addEventListener('click',()=>{contentForm.reset();delete contentForm.dataset.editId;cancelEdit.hidden=true;});
function notify(value,state='success'){message.textContent=value;message.dataset.state=state;}
function item(tag,content,className){const el=document.createElement(tag);if(content!=null)el.textContent=String(content);if(className)el.className=className;return el;}
function stamp(value){return value?new Date(value).toLocaleString('fr-FR'):'—';}
function actionButton(label,onClick,danger=false){const button=item('button',label,danger?'adminDanger':'');button.type='button';button.addEventListener('click',onClick);return button;}
async function adminList(kind,query=''){
 const {data,error}=await sb.rpc('myevent_admin_list',{p_kind:kind,p_query:query,p_limit:60});
 if(error)throw error;return Array.isArray(data)?data:[];
}
async function perform(kind,id,action,value='',askReason=false){
 let reason='';
 if(askReason){reason=window.prompt('Motif de cette action (10 caractères minimum) :')||'';if(!reason)return;if(reason.trim().length<10){notify('Indiquez un motif de 10 caractères minimum.','error');return;}}
 if(!window.confirm('Confirmer : '+action+' ?'))return;
 notify('Action en cours…','loading');
 try{const {error}=await sb.rpc('myevent_admin_action',{p_kind:kind,p_id:id,p_action:action,p_value:value,p_reason:reason});if(error)throw error;notify('Action enregistrée dans le journal.','success');await loadTab(activeTab);}
 catch(error){notify('Action refusée : '+error.message,'error');}
}
function renderUsers(rows,target){
 for(const user of rows){const card=item('article',null,'adminCard');
  if(user.avatar&&/^https:\/\//.test(user.avatar)){const img=document.createElement('img');img.src=user.avatar;img.alt='';img.className='adminAvatar';card.append(img);}
  else if(user.avatar&&user.avatar.length<12){card.append(item('span',user.avatar,'adminAvatar adminAvatarText'));}
  card.append(item('h4',user.display_name||user.username||'Compte MyEvent'),item('p','@'+(user.username||'—')+' · '+user.id),item('small','Inscrit le '+stamp(user.created_at)+' · '+(user.suspended?'Suspendu':'Actif')+(user.is_admin?' · Administrateur':'')));
  if(!user.is_admin){const actions=item('div',null,'adminActions');actions.append(actionButton(user.suspended?'Réactiver':'Suspendre',()=>perform('user',user.id,user.suspended?'reactivate':'suspend','',!user.suspended),!user.suspended));card.append(actions);}
  target.append(card);
 }
}
function renderEvents(rows,target){for(const event of rows){const card=item('article',null,'adminCard');card.append(item('h4',event.name),item('p',(event.location||'Lieu non renseigné')+' · '+stamp(event.event_date)),item('small','Créateur : '+(event.creator_name||event.creator_id)+' · '+event.visibility+' · '+(event.hidden?'Masqué dans la découverte':'Visible selon sa confidentialité')));
 const actions=item('div',null,'adminActions');actions.append(actionButton(event.hidden?'Réactiver':'Masquer',()=>perform('event',event.id,event.hidden?'restore':'hide','',!event.hidden),!event.hidden));
 const select=document.createElement('select');select.setAttribute('aria-label','Visibilité de '+event.name);for(const value of ['private','friends','public']){const option=item('option',value==='private'?'Privé':value==='friends'?'Amis':'Public');option.value=value;select.append(option);}select.value=event.visibility;select.addEventListener('change',()=>{const value=select.value;select.value=event.visibility;perform('event',event.id,'visibility',value);});actions.append(select);card.append(actions);target.append(card);}}
function renderListings(rows,target){for(const listing of rows){const card=item('article',null,'adminCard');card.append(item('h4',listing.title),item('p',(listing.city||'—')+' · '+(Number(listing.price_cents||0)/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'})),item('small',(listing.owner_name||listing.owner_id)+' · '+listing.status+' · '+(listing.hidden?'Masquée':'Non masquée')));
 const actions=item('div',null,'adminActions');actions.append(actionButton(listing.hidden?'Réactiver':'Masquer',()=>perform('listing',listing.id,listing.hidden?'restore':'hide','',!listing.hidden),!listing.hidden));card.append(actions);target.append(card);}}
function renderReports(rows){for(const kind of ['event','listing']){const target=document.getElementById(kind==='event'?'myeventAdminEventReports':'myeventAdminListingReports');target.replaceChildren();for(const report of rows.filter(r=>r.target_kind===kind)){const card=item('article',null,'adminCard');card.append(item('h4',report.reason),item('small',report.status+' · '+stamp(report.created_at)+' · ID '+report.target_id));const actions=item('div',null,'adminActions');for(const [label,action] of report.status==='open'?[['Résoudre','resolve'],['Classer','dismiss']]:[['Rouvrir','reopen']])actions.append(actionButton(label,()=>perform('report',report.id,action)));card.append(actions);target.append(card);}if(!target.childElementCount)target.append(item('p','Aucun signalement.'));}}
function renderConfig(rows,target,kind){for(const row of rows){const key=kind==='partner'?row.provider:row.key;const card=item('article',null,'adminCard');card.append(item('h4',kind==='partner'?row.label:row.description),item('small',key+' · '+(row.enabled?'Activé':'Désactivé')));
 if(kind==='partner')card.append(item('p',row.notes||'Aucune note · les clés API restent sur le serveur.'));
 const actions=item('div',null,'adminActions');async function saveConfig(enabled,notes){const {error}=await sb.rpc('myevent_admin_config',{p_kind:kind,p_key:key,p_enabled:enabled,p_notes:notes});if(error)notify(error.message,'error');else{notify('Configuration enregistrée.','success');await loadTab(activeTab);}}
 actions.append(actionButton(row.enabled?'Désactiver':'Activer',async()=>{if(!window.confirm('Confirmer le réglage '+key+' ?'))return;await saveConfig(!row.enabled,kind==='partner'?row.notes:'');}));
 if(kind==='partner')actions.append(actionButton('Modifier la note',async()=>{const note=window.prompt('Note interne (aucune clé API ni secret) :',row.notes||'');if(note===null)return;await saveConfig(row.enabled,note);}));
 card.append(actions);target.append(card);}}
async function loadTab(name){if(!authorized||panel.hidden)return;
 const sequence=++generation;let kinds=[];
 if(name==='content'){await loadContent();return;}
 if(name==='users')kinds=['users'];else if(name==='events')kinds=['events','reports'];else if(name==='marketplace')kinds=['listings','reports'];else if(name==='partners')kinds=['partners'];else if(name==='settings')kinds=['settings','audit'];else return;
 const targetIds={users:'myeventAdminUsers',events:'myeventAdminEvents',listings:'myeventAdminListings',partners:'myeventAdminPartners',settings:'myeventAdminSettings',audit:'myeventAdminAudit'};
 for(const kind of kinds){const target=document.getElementById(targetIds[kind]);if(target)target.textContent='Chargement…';}
 try{const query=panel.querySelector('[data-admin-search="'+kinds[0]+'"]')?.value?.trim()||'';
  const batches=await Promise.all(kinds.map(kind=>adminList(kind,kind===kinds[0]?query:'')));
  if(sequence!==generation||!authorized||panel.hidden)return;
  kinds.forEach((kind,i)=>{const rows=batches[i],target=document.getElementById(targetIds[kind]);if(kind==='reports'){renderReports(rows);return;}target.replaceChildren();
   if(kind==='users')renderUsers(rows,target);else if(kind==='events')renderEvents(rows,target);else if(kind==='listings')renderListings(rows,target);else if(kind==='partners'||kind==='settings')renderConfig(rows,target,kind==='partners'?'partner':'module');else for(const row of rows){const card=item('article',null,'adminCard');card.append(item('h4',row.action+' · '+row.target_kind),item('p',JSON.stringify(row.detail)),item('small',stamp(row.created_at)+' · '+row.actor_id));target.append(card);}
   if(!target.childElementCount)target.append(item('p','Aucun résultat.'));
  });
 }catch(error){if(sequence!==generation)return;notify('Chargement impossible : '+error.message,'error');for(const kind of kinds){const target=document.getElementById(targetIds[kind]);if(target)target.textContent='Données indisponibles.';}}
}
let searchTimer;
panel.querySelectorAll('[data-admin-search]').forEach(input=>input.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadTab(activeTab),250);}));
entry.addEventListener('click',async()=>{await check();if(!authorized)return;panel.hidden=false;tab('overview');document.body.classList.add('myeventAdminOpen');await load();});
close.addEventListener('click',hide);
refresh.addEventListener('click',load);
panel.addEventListener('click',e=>{if(e.target===panel)hide();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)hide();});
let initialized=false;
const ready=setInterval(()=>{
 if(typeof sb==='undefined'||!sb)return;
 clearInterval(ready);
 check();
 if(!initialized){initialized=true;sb.auth.onAuthStateChange(()=>{currentId=null;reset();setTimeout(check,0);});}
},400);
})();
