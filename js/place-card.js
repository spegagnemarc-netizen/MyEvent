(function(root){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function url(v){try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch(_){return '';}}
  function content(p){
    const image=url(p.image),website=url(p.website);
    const fields=[['Cuisine',p.cuisine],['Horaires',p.opening_hours],['Téléphone',p.phone],['Accessibilité fauteuil',p.wheelchair],['Terrasse',p.terrace],['Végétarien',p.vegetarian],['Végan',p.vegan]].filter(([,v])=>v!==null&&v!==undefined&&v!=='');
    let price='';if(p.price!==null&&p.price!==undefined&&Number.isFinite(Number(p.price))){try{price=p.currency?new Intl.NumberFormat('fr-FR',{style:'currency',currency:p.currency}).format(Number(p.price)):String(p.price)+' (devise non fournie)';}catch(_){price=String(p.price)+' '+(p.currency||'');}}
    return (image?'<img src="'+esc(image)+'" alt="" loading="lazy" style="width:100%;height:150px;object-fit:cover;border-radius:12px">':'')+'<h3>'+esc(p.name)+'</h3>'+(p.address?'<p>'+esc(p.address)+'</p>':'')+(p.locationApproximate?'<p>Localisation indicative du secteur · aucun repère exact sur la carte.</p>':p.distance!=null?'<p>'+Number(p.distance).toFixed(1)+' km à vol d’oiseau</p>':'')+(price?'<p>À partir de '+esc(price)+'</p>':'')+(p.description?'<p>'+esc(p.description)+'</p>':'')+fields.map(([k,v])=>'<p>'+k+' : '+esc(typeof v==='boolean'?(v?'oui':'non'):v)+'</p>').join('')+'<p>Source : '+esc(p.source==='geoapify'?'Geoapify / OpenStreetMap':p.source||'')+'</p>'+(website?'<a href="'+esc(website)+'" target="_blank" rel="noopener noreferrer">'+(p.source==='viator'?'Voir chez Viator':p.source==='getyourguide'?'Voir chez GetYourGuide':'Site du restaurant · vérifier les réservations')+'</a>':'');
  }
  const api={content,url};if(typeof module==='object')module.exports=api;else root.MyEventPlaceCard=api;
})(typeof window==='object'?window:this);
