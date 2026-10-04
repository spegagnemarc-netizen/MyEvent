async function v58SearchAccommodation(){
  const out=$('m58AccommodationSearchResult'),btn=$('m58AccommodationSearchLaunch');
  const q={destination:$('m58AccommodationDestination').value.trim(),checkIn:$('m58AccommodationCheckin').value,checkOut:$('m58AccommodationCheckout').value,guests:Number($('m58AccommodationGuests').value),rooms:Number($('m58AccommodationRooms').value),type:$('m58AccommodationType').value};
  let error;try{error=MyEventAccommodation.validate(q);}catch(_){error='Indique des dates valides.';}
  out.replaceChildren();if(error){out.textContent='⚠️ '+error;return;}
  function showExternalAlternative(){
    out.textContent='La recherche intégrée d’hébergements est indisponible : aucun fournisseur hôtelier autorisé n’est activé. Aucun prix ni disponibilité n’est confirmé. Tu peux rechercher sur un site externe, puis ajouter ton hébergement au planning.';
    const query=['hébergement',q.destination,q.checkIn,q.checkOut,q.guests+' voyageurs',q.rooms+' chambres',q.type==='all'?'':q.type].filter(Boolean).join(' ');
    const link=document.createElement('a');link.href='https://www.google.com/search?q='+encodeURIComponent(query);link.target='_blank';link.rel='noopener noreferrer';link.textContent='Rechercher sur Google — site externe, sans affiliation';out.append(document.createElement('br'),link);
  }
  // The server's provider is deliberately unavailable. A browser request to
  // the protected Preview cannot improve this result and may fail in Safari.
  if(!MyEventAccommodation.integratedSearchEnabled){showExternalAlternative();return;}
  btn.disabled=true;out.setAttribute('aria-busy','true');out.textContent='Recherche en cours…';
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch('/api/search-accommodation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(q),signal:controller.signal});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Recherche indisponible.');
    if(data.status==='unavailable'){showExternalAlternative();return;}
    out.textContent='Aucun hébergement confirmé n’est disponible pour cette recherche.';
  }catch(e){out.textContent=e.name==='AbortError'?'La recherche a pris trop de temps. Réessaie.':'Impossible de rechercher. Réessaie ou ajoute un hébergement manuellement.';}
  finally{clearTimeout(timeout);btn.disabled=false;out.setAttribute('aria-busy','false');}
}
