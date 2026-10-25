(function(){
 'use strict';let dialog,catalog=[],busy=false;
 const labels={pending:'En attente du restaurant',confirmed:'Acceptée par le restaurant',rejected:'Refusée par le restaurant',cancelled:'Annulée'};
 const node=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 async function api(method='GET',id){
  const session=(await sb.auth.getSession()).data.session;if(!session)throw Error('Connecte-toi pour réserver.');
  const r=await fetch('/api/orevami-restaurants'+(method==='GET'&&id?'?id='+encodeURIComponent(id):''),{method,headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify({id})}:{})});
  const j=await r.json();if(!r.ok)throw Error(j.error||'Connexion indisponible.');return j.data;
 }
 async function open(){
  if(!dialog){dialog=node('dialog');dialog.style.cssText='max-width:640px;width:90%;max-height:85vh;overflow:auto';document.body.append(dialog);}
  dialog.replaceChildren(node('h2','Restaurants ORÉVAMI · Preview TEST'));
  const close=node('button','Fermer');close.onclick=()=>{if(!busy)dialog.close();};dialog.append(close);
  const message=node('p');message.setAttribute('role','status');dialog.append(message);
  const search=node('input');search.placeholder='Rechercher un restaurant ou une adresse';search.setAttribute('aria-label',search.placeholder);dialog.append(search);
  const results=node('div'),history=node('div');dialog.append(results,history);if(!dialog.open)dialog.showModal();
  const notice=e=>{message.textContent=e.message||String(e);};
  async function action(fn){if(busy)return;busy=true;try{await fn();}catch(e){notice(e);}finally{busy=false;}}
  async function refresh(){
   const session=(await sb.auth.getUser()).data.user;if(!session)throw Error('Connecte-toi.');
   const r=await sb.from('personal_reservations').select('*').eq('owner_id',session.id).eq('kind','restaurant').order('created_at',{ascending:false});if(r.error)throw r.error;
   history.replaceChildren(node('h3','Mes demandes restaurant'));
   for(const row of r.data.filter(x=>x.details?.api_request)){
    const card=node('section'),status=node('p',labels[row.details.api_status]||'Envoi à terminer');card.append(node('strong',row.details.name),status);
    const update=node('button',row.details.api_booking_id?'Actualiser le statut':'Reprendre l’envoi');
    update.onclick=()=>action(async()=>{const b=await api(row.details.api_booking_id?'GET':'POST',row.id);status.textContent=labels[b.status]||b.status;await refresh();});
    card.append(update);history.append(card);
   }
  }
  function render(){
   results.replaceChildren();const q=search.value.toLocaleLowerCase('fr');
   for(const item of catalog.filter(x=>(x.establishment.name+' '+x.establishment.address).toLocaleLowerCase('fr').includes(q))){
    const card=node('section');card.append(node('h3',item.establishment.name),node('p',item.establishment.address),node('p',item.offer.title));
    const slots=node('select');slots.setAttribute('aria-label','Créneau disponible');
    for(const slot of item.slots.filter(x=>x.available>0)){const o=node('option',new Date(slot.startsAt).toLocaleString('fr-FR',{timeZone:item.establishment.timezone})+' · '+slot.available+' places');o.value=slot.id;slots.append(o);}
    const quantity=node('input');quantity.type='number';quantity.min='1';quantity.max=String(item.offer.maxPartySize);quantity.value='2';quantity.setAttribute('aria-label','Nombre de personnes');
    const reserve=node('button','Demander la réservation');reserve.disabled=!slots.options.length;
    reserve.onclick=()=>action(async()=>{
     const slot=item.slots.find(s=>s.id===slots.value),n=Number(quantity.value);if(!Number.isInteger(n)||n<1||n>Math.min(slot.available,item.offer.maxPartySize))throw Error('Choisis un nombre de personnes disponible.');
     const owner=(await sb.auth.getUser()).data.user;if(!owner)throw Error('Connecte-toi.');
     const details={name:item.establishment.name,provider:'ORÉVAMI',original_url:'https://orevami-api-staging.onrender.com/pro',reservation_status:'added',api_request:{vertical:'restaurant',resourceId:item.offer.id,slotId:slot.id,startsAt:slot.startsAt,endsAt:slot.endsAt,quantity:n}};
     const r=await sb.from('personal_reservations').insert({owner_id:owner.id,kind:'restaurant',details,event_id:null}).select('id').single();if(r.error)throw r.error;
     reserve.disabled=true;
     try{const b=await api('POST',r.data.id);message.textContent=labels[b.status]||b.status;}finally{await refresh();}
    });
    card.append(slots,quantity,reserve);results.append(card);
   }
   if(!results.children.length)results.append(node('p','Aucun restaurant disponible pour cette recherche.'));
  }
  search.oninput=render;
  await action(async()=>{await refresh();catalog=await api();render();});
 }
 const button=node('button','🍽️ Restaurants ORÉVAMI · réserver et suivre');button.type='button';button.onclick=open;
 fetch('/api/runtime-config').then(r=>r.ok?r.json():null).then(config=>{const host=document.getElementById('outingResults');if(config?.environment==='preview'&&config.isTest&&host)host.before(button);}).catch(()=>{});
 window.MyEventOrevamiRestaurants={open};
})();
