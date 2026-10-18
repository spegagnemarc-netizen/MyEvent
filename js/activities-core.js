/* Shared, side-effect-free activity presentation and validation. */
(function(root){
'use strict';
const categories={restaurant:'Restaurant',randonnee:'Randonnée',cinema:'Cinéma',bowling:'Bowling',sport:'Sport',jeux:'Jeux',culture:'Culture',famille:'Famille',autres:'Autres'};
function distance(a,b){if(!a||!b)return null;const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlon=(b.lon-a.lon)*r;return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlon/2)**2)));}
function weekend(now=new Date()){
 const start=new Date(now);start.setHours(0,0,0,0);const day=start.getDay();start.setDate(start.getDate()+(day===0?-1:(6-day+7)%7));const end=new Date(start);end.setDate(end.getDate()+2);return {start,end};
}
function filter(rows,f={},now=new Date()){
 const range=weekend(now),q=String(f.city||'').trim().toLocaleLowerCase('fr');
 return rows.filter(a=>{
  const t=new Date(a.starts_at),d=distance(f.position,a.position);
  return (f.mine||a.status==='open')&&(f.mine||t>=now)&&(!q||String(a.city).toLocaleLowerCase('fr').includes(q))&&(!f.category||a.category===f.category)&&(!f.free||a.cost_mode==='free')&&(!f.available||a.remaining>0)&&(!f.date||localDate(t)===f.date)&&(!f.weekend||(t>=range.start&&t<range.end))&&(!f.position||(d!=null&&d<=Number(f.radius||20)))&&(!f.mine||a.is_owner||['accepted','pending'].includes(a.membership));
 });
}
function localDate(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function validate(a,now=new Date()){
 if(!String(a.title||'').trim()||a.title.trim().length>120)throw Error('Titre requis, 120 caractères maximum.');
 if(!categories[a.category])throw Error('Choisis une catégorie.');
 if(!a.description?.trim()||a.description.length>4000)throw Error('Description requise, 4 000 caractères maximum.');
 if(!Number.isFinite(Date.parse(a.starts_at))||new Date(a.starts_at)<=now)throw Error('Choisis une date future.');
 if(!Number.isInteger(a.capacity)||a.capacity<2||a.capacity>100)throw Error('Prévois entre 2 et 100 personnes, organisateur inclus.');
 if(!a.city?.trim()||a.city.length>100)throw Error('Indique une ville (100 caractères maximum).');
 if(!['public','friends'].includes(a.visibility)||!['direct','approval'].includes(a.join_mode)||!['free','on_site'].includes(a.cost_mode))throw Error('Paramètres invalides.');
 if((a.conditions||'').length>2000||(a.address||'').length>300||(a.venue||'').length>200)throw Error('Les informations pratiques sont trop longues.');
 if(a.cost_mode==='on_site'&&(!Number.isFinite(a.cost_amount)||a.cost_amount<=0||a.cost_amount>10000))throw Error('Indique les frais à régler sur place (maximum 10 000 €).');
 const lat=a.latitude,lon=a.longitude;
 if((lat!=null||lon!=null)&&(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180))throw Error('Coordonnées GPS invalides.');
 return a;
}
const api=Object.freeze({categories,distance,weekend,filter,validate,localDate});root.OrevamiActivitiesCore=api;
if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis==='undefined'?window:globalThis);
