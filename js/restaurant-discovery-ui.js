/* Shared Geoapify engine and V3/V2 presentation; social actions stay local. */
(function(root){'use strict';
function attach({host,read,onCreate,fetchImpl=(...args)=>fetch(...args)}){
 const section=document.createElement('section'),title=document.createElement('h2'),status=document.createElement('p'),query=document.createElement('input'),budget=document.createElement('input'),searchButton=document.createElement('button'),list=document.createElement('div');
 title.textContent='Restaurants à découvrir';query.type='search';query.placeholder='Nom ou adresse';query.setAttribute('aria-label','Filtrer les restaurants');searchButton.type='button';searchButton.textContent='Rechercher les restaurants';status.setAttribute('role','status');list.className='act-grid';budget.type='number';budget.min='0';budget.placeholder='Budget maximum (€)';budget.setAttribute('aria-label','Budget maximum par personne en euros');section.append(title,query,budget,searchButton,status,list);host.append(section);
 let sheet=null;
 let rows=[],key='',revision=0,controller=null,centerCache=new Map();
 const active=()=>{const f=read();return f.active&&f.tab!=='mine';};
 const signature=f=>JSON.stringify([f.city.trim(),f.position?.lat,f.position?.lon,f.radius]);
 function render(){section.hidden=!active();if(section.hidden)return;const f=read();list.replaceChildren();if(key!==signature(f)){status.textContent='Choisissez une ville ou votre position, puis recherchez les restaurants.';return;}
  const visible=rows.filter(p=>root.MyEventPlaceCard.matchesRestaurant(p,query.value,Number(budget.value)||0));
  // Date, free-group and available-seat filters apply to organised outings below.
  status.textContent=visible.length+' restaurant(s) · Les filtres de date, gratuité et places concernent les sorties à rejoindre.';
  list.innerHTML=visible.map(p=>root.MyEventPlaceCard.restaurantMiniature(p,{context:'social'})).join('');
 }
 async function search(){if(!active())return;const f=read(),next=signature(f);if(key===next){render();return;}controller?.abort();controller=new AbortController();const signal=controller.signal,ticket=++revision;status.textContent='Recherche des restaurants…';list.replaceChildren();
  try{let center=f.position;const city=f.city.trim();if(city){center=centerCache.get(city);if(!center){const response=await fetchImpl('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=fr&q='+encodeURIComponent(city),{signal,headers:{Accept:'application/json'}});if(!response.ok)throw Error('Localisation indisponible.');const data=await response.json();center=data[0]?{lat:Number(data[0].lat),lon:Number(data[0].lon)}:null;if(center)centerCache.set(city,center);}}
   if(!center||!Number.isFinite(center.lat)||!Number.isFinite(center.lon))throw Error('Indiquez une ville ou utilisez votre position.');
   const response=await fetchImpl('/api/search-places?'+new URLSearchParams({mode:'restaurant',lat:center.lat,lon:center.lon,radius:f.radius}),{signal,headers:{Accept:'application/json'}});const data=await response.json();if(!response.ok||!Array.isArray(data.results))throw Error(data.error||'Restaurants temporairement indisponibles.');if(ticket!==revision||next!==signature(read()))return;rows=data.results;key=next;render();if(data.truncated)status.append(' Résultats fournisseur plafonnés à 200 lieux.');
  }catch(error){if(ticket===revision&&error.name!=='AbortError')status.textContent=error.message;}
 }
 list.addEventListener('click',event=>{const detail=event.target.closest('[data-restaurant-details]');if(detail){event.stopPropagation();const venue=JSON.parse(detail.dataset.restaurantDetails);sheet?.destroy();sheet=root.OrevamiRestaurantSheet.create({host:section,onAdd:onCreate,actionLabel:'Créer une sortie ici'});sheet.open(venue);return;}const map=event.target.closest('[data-outing-map]');if(map){const [lat,lon]=map.dataset.outingMap.split('|');root.open('https://www.openstreetmap.org/?mlat='+encodeURIComponent(lat)+'&mlon='+encodeURIComponent(lon),'_blank','noopener,noreferrer');return;}const button=event.target.closest('[data-restaurant-create]');if(!button)return;const venue=rows.find(p=>String(p.id)===button.dataset.restaurantCreate);if(venue)onCreate({...venue,category:'restaurant'});});
 query.addEventListener('input',render);budget.addEventListener('input',render);searchButton.addEventListener('click',search);
 function clear(){sheet?.destroy();sheet=null;revision++;controller?.abort();rows=[];key='';list.replaceChildren();}
 render();return {render,search,clear,element:section};
}
root.OrevamiRestaurantDiscovery=Object.freeze({attach});
})(window);
