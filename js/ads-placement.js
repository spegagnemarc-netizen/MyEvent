/* Reserved visual space only. No campaign, provider, tracking or payment calls. */
(()=>{
 'use strict';
 const feed=document.getElementById('socialFeed');
 if(!feed)return;
 const slot=document.createElement('aside');slot.id='orevamiSponsoredPlacement';slot.className='orevamiSponsoredPlacement';slot.setAttribute('aria-label','Espace publicitaire réservé, diffusion inactive');
 const label=document.createElement('span');label.className='orevamiSponsoredLabel';label.textContent='Espace Sponsorisé';
 const title=document.createElement('strong');title.textContent='Un espace pour les professionnels';
 const status=document.createElement('p');status.textContent='Emplacement réservé · aucune campagne diffusée actuellement.';
 slot.append(label,title,status);
 function place(){
  const posts=[...feed.children].filter(node=>node.classList.contains('socialPost'));
  if(posts.length>=5){if(posts[4].nextElementSibling!==slot)posts[4].after(slot);}
  else if(feed.nextElementSibling!==slot)feed.after(slot);
 }
 new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&n.classList.contains('socialPost'))))place();}).observe(feed,{childList:true});
 place();
})();
