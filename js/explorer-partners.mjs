// Reuse the canonical partner markup, including every existing affiliate identifier.
const type=new URLSearchParams(location.search).get('kind'),host=document.getElementById('partners');
function script(source){return new Promise((resolve,reject)=>{const el=document.createElement('script');if(source.src){el.src=source.src;el.onload=resolve;el.onerror=reject;}else {el.textContent=source.textContent;resolve();}document.body.append(el);});}
try{
 const response=await fetch('index.html',{credentials:'same-origin'});if(!response.ok)throw Error('Partenaires indisponibles.');
 const source=new DOMParser().parseFromString(await response.text(),'text/html');
 const selectors={accommodation:['#m58AccommodationSearchBox'],transport:['#myeventOmioSection','#myeventExpediaFlightsSection'],ticket:['.tnSearchWidget']}[type];
 if(!selectors)throw Error('Catégorie de partenaire inconnue.');
 for(const selector of selectors){const node=source.querySelector(selector);if(!node)throw Error('Intégration partenaire indisponible.');host.append(document.importNode(node,true));}
 if(type==='ticket'){
  for(const s of host.querySelectorAll('script'))await script(s);
  const search=Array.from(source.scripts).find(s=>s.textContent.startsWith('function tn_SubmitSearch_'));if(search)await script(search);
 }else{
  await script({src:'js/accommodation-search-runtime.js'});
  const eg=source.querySelector('script.eg-widgets-script');if(eg)await script(eg).catch(()=>window.MyEventAccommodationWidget?.fail());
  if(type==='transport'){const omio=Array.from(source.scripts).find(s=>s.textContent.includes('function addOmioWidget'));if(omio)await script(omio);}
 }
 document.getElementById('notice').textContent='Recherche et réservation chez le partenaire.';
}catch(error){document.getElementById('notice').textContent=error.message;}
