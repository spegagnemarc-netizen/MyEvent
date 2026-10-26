if(window.top!==window.self){document.body.replaceChildren(document.createTextNode('Cette zone publique doit être ouverte dans un document indépendant.'));return;}
const catalog = document.getElementById('catalog');
const categories = ['Tout','Nature','Restaurants','Culture','Jeux','Rencontres','Concerts'];
let selected='Tout', demo=false, paused=false, operatorSuspended=false, lazyObserver=null;
const settings=normalizeSettings({enabled:false,feed_enabled:true,spacing:5,max_slots:2});
const preferenceKey='orevami.publicDiscovery.adsRefused';
const el=(tag,text,cls)=>{const item=document.createElement(tag);if(text!=null)item.textContent=text;if(cls)item.className=cls;return item;};
function hasRefused(){try{return localStorage.getItem(preferenceKey)==='1';}catch{return true;}}
function showDialog(id){const d=document.getElementById(id);if(!d.open)d.showModal();}
function openItem(item){
 document.getElementById('detailTitle').textContent=item.title;
 document.getElementById('detailPlace').textContent=item.place+' · '+item.moment;
 document.getElementById('detailDescription').textContent=item.description;
 showDialog('detail');
}
function cardFor(item){
 const card=el('article',null,'card');card.dataset.publicExample=item.id;
 const art=el('div',null,'cardArt '+item.tone);art.setAttribute('aria-hidden','true');
 art.append(el('span',item.symbol),el('small',item.category,'cardTag'),el('small','EXEMPLE FICTIF','demoTag'));
 card.append(art,el('div',item.place,'cardMeta'),el('h3',item.title),el('p',item.description));
 const action=el('button','Découvrir cette idée ↗');action.type='button';action.addEventListener('click',()=>openItem(item));card.append(action);return card;
}
function simulation(kind){
 const slot=el('aside',null,'simulation');slot.dataset.kind=kind;slot.setAttribute('aria-label',kind==='sponsored'?'Sponsorisé · simulation locale':'Publicité · simulation locale');
 slot.append(el('small',kind==='sponsored'?'SPONSORISÉ · EXEMPLE FICTIF':'PUBLICITÉ · SIMULATION LOCALE'),el('h3',kind==='sponsored'?'Une campagne directe aurait la priorité ici.':'Une annonce automatique pourrait occuper cet espace.'),el('p','Aucune campagne achetée. Aucun fournisseur, traceur ou revenu.'));
 return slot;
}
function render(){
 const query=document.getElementById('search').value.trim().toLocaleLowerCase('fr');
 const rows=ITEMS.filter(item=>(selected==='Tout'||item.category===selected)&&[item.title,item.category,item.description].join(' ').toLocaleLowerCase('fr').includes(query));
 lazyObserver?.disconnect();catalog.replaceChildren();document.getElementById('empty').hidden=rows.length>0;
 document.getElementById('resultCount').textContent=rows.length+' idée'+(rows.length>1?'s':'')+' fictive'+(rows.length>1?'s':'')+' pour explorer le parcours';
 const positions=demo&&!paused&&!operatorSuspended&&rows.length>=settings.spacing?[settings.spacing]:[];
 const automatic=demo&&!paused&&!operatorSuspended?planSlots(rows.length,settings,positions):[];
 const placements=new Map();
 lazyObserver='IntersectionObserver' in window?new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting||!entry.target.isConnected||!demo||paused||operatorSuspended)continue;const kind=placements.get(entry.target);if(!kind)continue;lazyObserver.unobserve(entry.target);placements.delete(entry.target);entry.target.after(simulation(kind));}},{rootMargin:'150px'}):null;
 rows.forEach((item,index)=>{
  const card=cardFor(item);catalog.append(card);const position=index+1;
  const kind=positions.includes(position)?'sponsored':automatic.includes(position)?'automatic':null;
  if(kind&&lazyObserver){placements.set(card,kind);lazyObserver.observe(card);}
 });
 const count=positions.length+automatic.length;
 document.getElementById('demoStatus').textContent=operatorSuspended?'Simulation suspendue par le contrôle serveur. Aucun emplacement affiché.':paused?'Simulation suspendue. Aucun emplacement affiché.':demo?count+' emplacement(s) simulé(s), maximum 2. Sponsorisé prioritaire. Aucune annonce réelle.':'Publicités désactivées. Aucun emplacement vide.';
 document.getElementById('demoAds').textContent=demo?'Masquer les emplacements TEST':'Voir les emplacements TEST';
}
categories.forEach(category=>{const b=el('button',category);b.type='button';b.setAttribute('aria-pressed',String(category===selected));b.addEventListener('click',()=>{selected=category;document.querySelectorAll('#categories button').forEach(button=>button.setAttribute('aria-pressed',String(button===b)));render();});document.getElementById('categories').append(b);});
document.getElementById('search').addEventListener('input',render);
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.close).close()));
document.getElementById('demoAds').addEventListener('click',()=>{demo=!demo;paused=false;render();});
document.getElementById('pauseAds').addEventListener('click',()=>{paused=true;render();});
document.getElementById('spacing').addEventListener('change',event=>{settings.spacing=Number(event.target.value);render();});
const cmp=createTcfConsentBridge({onChange:state=>{
 // A CMP signal can update information; it cannot load any provider in this build.
 document.getElementById('consentStatus').textContent=state.accepted?'Signal CMP reçu. Régie toujours absente de cet aperçu.':'Consentement absent ou refusé. Aucune régie chargée.';
}});
function preferences(){
 cmp.initialize();
 if(cmp.openPreferences())return;
 document.getElementById('consentStatus').textContent=hasRefused()?'Votre refus est enregistré sur cette origine publique.':'CMP non configurée. Aucune acceptation enregistrée.';
 showDialog('privacy');
}
document.getElementById('preferences').addEventListener('click',preferences);
document.getElementById('footerPreferences').addEventListener('click',preferences);
document.getElementById('refuse').addEventListener('click',()=>{
 let saved=false;try{localStorage.setItem(preferenceKey,'1');saved=true;}catch{}
 demo=false;paused=true;render();
 document.getElementById('consentStatus').textContent=saved?'Refus enregistré. Aucune publicité ni régie chargée.':'Publicités refusées pour cette page. Le navigateur ne permet pas de mémoriser ce choix.';
});
window.addEventListener('storage',event=>{if(event.key===preferenceKey&&event.newValue==='1'){demo=false;paused=true;render();}});
window.addEventListener('pagehide',()=>cmp.destroy(),{once:true});
render();

// Public, read-only operator signal. Contains no identity, private data or credentials.
if((location.protocol==='http:'||location.protocol==='https:')&&document.body.dataset.hosting!=='static-preview'){
 operatorSuspended=true;render();
 const channel=new EventSource('/control-events');
 channel.onmessage=event=>{try{const data=JSON.parse(event.data);operatorSuspended=typeof data.suspended==='boolean'&&data.adsEnabled===false?data.suspended:true;}catch{operatorSuspended=true;}render();};
 channel.onerror=()=>{operatorSuspended=true;render();};
 window.addEventListener('pagehide',()=>channel.close(),{once:true});
}

if(document.body.dataset.hosting==='static-preview'){document.getElementById('demoStatus').textContent='Preview statique : simulation locale uniquement ; administration non raccordée. Aucune régie chargée.';}
