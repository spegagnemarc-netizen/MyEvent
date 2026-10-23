(function(){
  const host=document.getElementById('ticketmasterDiscovery');
  if(!host)return;
  const form=host.querySelector('form'),status=host.querySelector('[role="status"]'),results=host.querySelector('[data-results]'),button=form.querySelector('button');
  function element(tag,value){const el=document.createElement(tag);el.textContent=value;return el;}
  form.addEventListener('submit',async event=>{
    event.preventDefault();button.disabled=true;results.replaceChildren();status.textContent='Recherche en France…';
    const params=new URLSearchParams({q:form.elements.q.value.trim(),city:form.elements.city.value.trim()});
    try{
      const response=await fetch('/api/search-ticketmaster?'+params,{signal:AbortSignal.timeout(15000)});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||'Recherche temporairement indisponible.');
      status.textContent=data.results.length?'Événements en France · jusqu’à 20 résultats.':'Aucun événement trouvé. Essaie une autre ville ou un autre artiste.';
      for(const item of data.results){
        const url=new URL(item.url);
        if(url.protocol!=='https:'||!/(^|\.)ticketmaster\.(fr|com)$/.test(url.hostname))continue;
        const card=element('article','');card.append(element('h4',item.name));
        const date=/^\d{4}-\d{2}-\d{2}$/.test(item.date)?item.date.split('-').reverse().join('/'):'Date à confirmer';
        card.append(element('p',[date,item.time?.slice(0,5),item.venue,item.city].filter(Boolean).join(' · ')));
        const link=element('a','Voir les billets sur Ticketmaster');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';card.append(link);results.append(card);
      }
    }catch(error){status.textContent=error.name==='TimeoutError'?'La recherche prend trop de temps. Réessaie.':error.message||'Recherche temporairement indisponible.';}
    finally{button.disabled=false;}
  });
})();
