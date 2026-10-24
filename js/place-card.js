(function(root){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function url(v){try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch(_){return '';}}
  function officialDetails(p){
    if(!p.official_restaurant)return '';
    const link=(label,value)=>url(value)?'<p><a href="'+esc(url(value))+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a></p>':'';
    const date=String(p.official_restaurant.checked_at||'').split('-').reverse().join('/');
    return '<section aria-label="Informations du site officiel"><p>'+esc(p.prices)+'</p>'+link('Consulter la carte complète · site officiel',p.menu_url)+link('Demander une réservation · site officiel',p.booking_url)+'<p>Aucune disponibilité fournie. Demande soumise à la confirmation du restaurant ; aucune réservation effectuée dans ORÉVAMI.</p>'+(p.sources||[]).map(s=>link(s.type,s.url)).join('')+'<p>Consulté le '+esc(date)+' · horaires et prix publiés, à reconfirmer.</p></section>';
  }
  function detailsButton(p){
    const restaurant=p.type==='restaurant'||p.category==='restaurant';
    return restaurant?'<button type="button" data-restaurant-details="'+esc(JSON.stringify({...Object.fromEntries(['id','name','city','address','lat','lon','website','phone','opening_hours','source','source_url','retrieved_at'].map(k=>[k,p[k]])),category:'restaurant'}))+'">Voir horaires, carte et réservations</button>':'';
  }
  function accordion(p){
    if(!['restaurant','fast_food'].includes(p.type||p.category))return '';
    const data=esc(JSON.stringify(Object.fromEntries(['id','name','city','address','lat','lon','website','phone','opening_hours','source','source_url','retrieved_at'].map(k=>[k,p[k]]))));
    return '<details class="restaurantAccordion" data-restaurant-accordion="'+data+'"><summary>Horaires, menus et réservation <span aria-hidden="true">⌄</span></summary><div class="restaurantAccordionBody">'+(p.opening_hours?'<p>Horaires : '+esc(p.opening_hours)+'</p>':'')+officialDetails(p)+detailsButton(p)+'</div></details>';
  }
  function content(p){
    const image=url(p.image),website=url(p.website);
    const details=detailsButton(p);
    const fields=[['Cuisine',p.cuisine],['Horaires',p.opening_hours],['Téléphone',p.phone],['Accessibilité fauteuil',p.wheelchair],['Terrasse',p.terrace],['Végétarien',p.vegetarian],['Végan',p.vegan]].filter(([,v])=>v!==null&&v!==undefined&&v!=='');
    let price='';if(p.price!==null&&p.price!==undefined&&Number.isFinite(Number(p.price))){try{price=p.currency?new Intl.NumberFormat('fr-FR',{style:'currency',currency:p.currency}).format(Number(p.price)):String(p.price)+' (devise non fournie)';}catch(_){price=String(p.price)+' '+(p.currency||'');}}
    return (image?'<img src="'+esc(image)+'" alt="" loading="lazy" style="width:100%;height:150px;object-fit:cover;border-radius:12px">':'')+'<h3>'+esc(p.name)+'</h3>'+(p.address?'<p>'+esc(p.address)+'</p>':'')+(p.locationApproximate?'<p>Localisation indicative du secteur · aucun repère exact sur la carte.</p>':p.distance!=null?'<p>'+Number(p.distance).toFixed(1)+' km à vol d’oiseau</p>':'')+(price?'<p>À partir de '+esc(price)+(p.priceBasis==='total-stay'?' · total du séjour':'')+'</p>':'')+(p.description?'<p>'+esc(p.description)+'</p>':'')+(['restaurant','fast_food'].includes(p.type||p.category)?accordion(p):fields.map(([k,v])=>'<p>'+k+' : '+esc(typeof v==='boolean'?(v?'oui':'non'):v)+'</p>').join('')+officialDetails(p)+details)+'<p>Source : '+esc(p.source==='geoapify'?'Geoapify / OpenStreetMap':p.source||'')+'</p>'+(website?'<a href="'+esc(website)+'" target="_blank" rel="noopener noreferrer">'+(p.source==='viator'?'Voir chez Viator':p.source==='getyourguide'?'Voir chez GetYourGuide':'Site du restaurant · vérifier les réservations')+'</a>':'');
  }
  const api={content,url,officialDetails,detailsButton,accordion};if(typeof module==='object')module.exports=api;else root.MyEventPlaceCard=api;
})(typeof window==='object'?window:this);
