async function v58SearchAccommodation(){
  const out=$('m58AccommodationSearchResult'),btn=$('m58AccommodationSearchLaunch');
  const q={destination:$('m58AccommodationDestination').value.trim(),checkIn:$('m58AccommodationCheckin').value,checkOut:$('m58AccommodationCheckout').value,guests:Number($('m58AccommodationGuests').value),rooms:Number($('m58AccommodationRooms').value),type:$('m58AccommodationType').value};
  let error;try{error=MyEventAccommodation.validate(q);}catch(_){error='Indique des dates valides.';}
  out.replaceChildren();if(error){out.textContent='⚠️ '+error;return;}
  btn.disabled=true;out.setAttribute('aria-busy','true');out.textContent='Recherche en cours…';
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch('/api/search-accommodation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(q),signal:controller.signal});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Recherche indisponible.');
    // Supplier integration remains disabled until explicitly authorized.
    out.textContent='La recherche intégrée est indisponible. Aucun prix ni disponibilité n’est confirmé. Tu peux rechercher sur un site externe, puis ajouter ton hébergement au planning.';
    const link=document.createElement('a');link.href='https://www.google.com/search?'+new URLSearchParams({q:['hébergement',q.destination,q.checkIn,q.checkOut,q.guests+' voyageurs',q.rooms+' chambres',q.type==='all'?'':q.type].filter(Boolean).join(' ')});link.target='_blank';link.rel='noopener noreferrer';link.textContent='Rechercher sur Google — site externe, sans affiliation';out.append(document.createElement('br'),link);
  }catch(e){out.textContent=e.name==='AbortError'?'La recherche a pris trop de temps. Réessaie.':'Impossible de rechercher. Réessaie ou ajoute un hébergement manuellement.';}
  finally{clearTimeout(timeout);btn.disabled=false;out.setAttribute('aria-busy','false');}
}
