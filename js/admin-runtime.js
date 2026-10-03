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
}
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
