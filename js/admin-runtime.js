/* MyEvent Admin V1 — membership is verified by server-side Supabase RPC, never email/localStorage. */
(function(){
'use strict';
const entry=document.getElementById('myeventAdminEntry');
const panel=document.getElementById('myeventAdminPanel');
const close=document.getElementById('myeventAdminClose');
const refresh=document.getElementById('myeventAdminRefresh');
const message=document.getElementById('myeventAdminMessage');
if(!entry||!panel||!close||!refresh||!message)return;
let currentId=null,checking=false,authorized=false;
function hide(){panel.hidden=true;document.body.classList.remove('myeventAdminOpen');}
function reset(){authorized=false;entry.hidden=true;hide();document.getElementById('myeventAdminStats').replaceChildren();}
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
 message.textContent='Chargement des données…';
 const {data,error}=await sb.rpc('myevent_admin_overview');
 if(error){message.textContent='Accès refusé ou migration Supabase non appliquée.';reset();return;}
 const stats=document.getElementById('myeventAdminStats');
 stats.replaceChildren();
 for(const [label,value] of [['Utilisateurs',data.users],['Événements',data.events]]){
  const item=document.createElement('div');item.className='myeventAdminStat';
  const name=document.createElement('span');name.textContent=label;
  const number=document.createElement('strong');number.textContent=Number(value||0).toLocaleString('fr-FR');
  item.append(name,number);stats.appendChild(item);
 }
 message.textContent='Données actualisées · '+new Date(data.generated_at).toLocaleString('fr-FR');
 await loadContent();
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
  edit.addEventListener('click',()=>{for(const key of ['title','kind','city','external_id','affiliate_url','campaign'])contentForm.elements.namedItem(key).value=item[key]||'';contentForm.elements.namedItem('enabled').checked=item.enabled;contentForm.dataset.editId=item.id;contentForm.scrollIntoView({behavior:'smooth'});});
  line.append(label,edit);contentList.append(line);
 }
}
contentForm?.addEventListener('submit',async e=>{
 e.preventDefault();await check();if(!authorized){message.textContent='Accès refusé.';return;}
 const fd=new FormData(contentForm);
 const args={p_provider:'getyourguide',p_kind:fd.get('kind'),p_title:fd.get('title'),p_city:fd.get('city'),p_external_id:fd.get('external_id'),p_affiliate_url:fd.get('affiliate_url'),p_campaign:fd.get('campaign'),p_enabled:fd.has('enabled'),p_id:contentForm.dataset.editId||null};
 const submit=contentForm.querySelector('[type=submit]');submit.disabled=true;
 try{const {error}=await sb.rpc('myevent_admin_partner_content_save',args);if(error)throw error;contentForm.reset();delete contentForm.dataset.editId;message.textContent='Contenu enregistré.';await loadContent();}
 catch(err){message.textContent='Enregistrement impossible : '+(err.message||'Erreur');}
 finally{submit.disabled=false;}
});
entry.addEventListener('click',async()=>{await check();if(!authorized)return;panel.hidden=false;document.body.classList.add('myeventAdminOpen');await load();});
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
