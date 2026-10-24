(function(root){
  'use strict';
  async function load(website,{signal}={}){
    if(!website)return {status:'unavailable',opening_hours:[],prices:[],menus:[],booking_links:[],sources:[],checked_at:null,notice:'Information non disponible : site officiel non renseigné.'};
    const response=await fetch('/api/integration-venues?mode=restaurant-information',{
      method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({url:website}),signal
    });
    if(!response.ok)throw Error('Information non disponible');
    return response.json();
  }
  document.addEventListener('toggle',async event=>{
    const accordion=event.target;if(!accordion.matches?.('[data-restaurant-accordion]')||!accordion.open||accordion.dataset.loaded)return;
    accordion.dataset.loaded='loading';const body=accordion.querySelector('.restaurantAccordionBody'),status=document.createElement('p');status.textContent='Chargement des informations…';body.append(status);
    try{
      const venue=JSON.parse(accordion.dataset.restaurantAccordion),info=await load(venue.website);
      const fragment=document.createDocumentFragment(),line=text=>{const p=document.createElement('p');p.textContent=text;fragment.append(p);};
      const link=(label,value)=>{let u;try{u=new URL(value);}catch{return;}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return;const p=document.createElement('p'),a=document.createElement('a');a.textContent=label;a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';p.append(a);fragment.append(p);};
      line('Horaires : '+((info.opening_hours||[]).map(h=>h.heading+' : '+h.text).join(' · ')||'Information non disponible'));
      line('Tarifs : '+((info.prices||[]).map(p=>p.text).join(' · ')||'Information non disponible'));
      if(!info.menus?.length)line('Menu : Information non disponible');
      for(const m of info.menus||[])link(m.label||'Carte / menu',m.url);
      if(!info.booking_links?.length)line('Réservation : Information non disponible');
      for(const b of info.booking_links||[])link('Consulter la réservation · site déclaré',b.url);
      line(info.notice||'Aucune disponibilité ni réservation confirmée.');
      for(const source of info.sources||[]){link('Source',source.url);const date=Date.parse(source.checked_at);line('Consulté : '+(Number.isFinite(date)?new Date(date).toLocaleDateString('fr-FR'):'date non disponible'));}
      const actions=[...body.querySelectorAll('[data-restaurant-details]')];body.replaceChildren(fragment,...actions);accordion.dataset.loaded='true';
    }catch{status.textContent='Information non disponible. Les liens existants restent accessibles.';delete accordion.dataset.loaded;}
  },true);
  let sheet;
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-restaurant-details]');
    if(!button||!root.OrevamiVenueSheet)return;
    try{
      const venue=JSON.parse(button.dataset.restaurantDetails);
      if(!sheet)sheet=root.OrevamiVenueSheet.create({host:document.body,readOnly:true});
      sheet.open(venue);
    }catch{button.textContent='Information non disponible';}
  });
  root.OrevamiRestaurantInformation=Object.freeze({load});
})(window);
