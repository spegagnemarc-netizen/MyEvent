/* Shared, side-effect-free activity presentation and validation. */
(function(root){
'use strict';
const categories={restaurant:'Restaurant',randonnee:'Randonnée',cinema:'Cinéma',bowling:'Bowling',sport:'Sport',jeux:'Jeux',culture:'Culture',famille:'Famille',autres:'Autres'};
const families=Object.freeze({sports:'Sports et sensations',loisirs:'Loisirs',sorties:'Sorties et rencontres',culture:'Culture et découvertes',famille:'Famille',autre:'Autre'});
const typeRows=[
 ['sports','ski','Ski','⛷️','sport'],['sports','snowboard','Snowboard','🏂','sport'],['sports','piscine','Piscine','🏊','sport'],['sports','patinoire','Patinoire','⛸️','sport'],['sports','karting','Karting','🏎️','sport'],['sports','bowling','Bowling','🎳','bowling'],['sports','escalade','Escalade','🧗','sport'],['sports','laser_game','Laser game','🔦','sport'],['sports','paintball','Paintball','🎯','sport'],['sports','tennis','Tennis','🎾','sport'],['sports','football','Football','⚽','sport'],['sports','velo','Vélo','🚴','sport'],['sports','randonnee','Randonnée','🥾','randonnee'],['sports','accrobranche','Accrobranche','🌳','sport'],
 ['loisirs','cinema','Cinéma','🎬','cinema'],['loisirs','jeux_societe','Jeux de société','🎲','jeux'],['loisirs','escape_game','Escape game','🗝️','jeux'],['loisirs','karaoke','Karaoké','🎤','autres'],['loisirs','billard','Billard','🎱','jeux'],['loisirs','flechettes','Fléchettes','🎯','jeux'],['loisirs','jeux_video','Jeux vidéo','🎮','jeux'],['loisirs','parc_attractions',"Parc d’attractions",'🎢','autres'],
 ['sorties','restaurant','Restaurant','🍽️','restaurant'],['sorties','cafe','Café','☕','restaurant'],['sorties','aperitif','Apéritif','🥂','autres'],['sorties','pique_nique','Pique-nique','🧺','autres'],['sorties','barbecue','Barbecue','🔥','autres'],['sorties','promenade','Promenade','🚶','randonnee'],['sorties','soiree_amis','Soirée entre amis','🫶','autres'],
 ['culture','concert','Concert','🎵','culture'],['culture','spectacle','Spectacle','🎟️','culture'],['culture','musee','Musée','🏛️','culture'],['culture','exposition','Exposition','🖼️','culture'],['culture','theatre','Théâtre','🎭','culture'],['culture','visite_touristique','Visite touristique','🧭','culture'],['culture','atelier_creatif','Atelier créatif','🎨','culture'],
 ['famille','parc','Parc','🌳','famille'],['famille','aire_jeux','Aire de jeux','🛝','famille'],['famille','zoo','Zoo','🦒','famille'],['famille','ferme_pedagogique','Ferme pédagogique','🐐','famille'],['famille','activites_familiales','Activités familiales','👨‍👩‍👧','famille'],['autre','autres','Autre','✨','autres']
];
const activityTypes=Object.freeze(typeRows.map(([family,id,label,icon,category])=>Object.freeze({family,id,label,icon,category})));
const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’'-]/g,' ').trim();
const findType=id=>activityTypes.find(t=>t.id===id)||null;
function searchTypes(query='',family=''){const q=fold(query);return activityTypes.filter(t=>(!family||t.family===family)&&(!q||fold(t.label+' '+families[t.family]).includes(q)));}
function typeMatches(a,id){return !id||a.activity_type===id||(!a.activity_type&&a.category===id);}
function safeLink(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function distance(a,b){if(!a||!b||![a.lat,a.lon,b.lat,b.lon].every(Number.isFinite))return null;const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlon=(b.lon-a.lon)*r;return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlon/2)**2)));}
function weekend(now=new Date()){
 const start=new Date(now);start.setHours(0,0,0,0);const day=start.getDay();start.setDate(start.getDate()+(day===0?-1:(6-day+7)%7));const end=new Date(start);end.setDate(end.getDate()+2);return {start,end};
}
function fees(a){const group=a.cost_mode==='free'?'Groupe : gratuit':`Groupe : ${a.cost_amount} € par personne, à régler sur place`;const venue=a.venue_cost_status==='free'?'Établissement : gratuit':a.venue_cost_status==='on_site'?'Établissement : entrée à régler séparément':'Établissement : tarif non confirmé';return group+' · '+venue+(a.cost_details?' · '+a.cost_details:'');}
function fullyFree(a){return a.cost_mode==='free'&&a.venue_cost_status==='free';}
function recommend(rows,prefs={},position=null){return rows.filter(a=>{if(prefs.freeOnly&&!fullyFree(a))return false;const d=distance(position,a.position);return !position||(d!==null&&d<=Number(prefs.radius||20));}).map((a,index)=>({a,index,score:(prefs.types||[]).includes(a.activity_type)?1:0})).sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.a);}
function filter(rows,f={},now=new Date()){
 const range=weekend(now),q=String(f.city||'').trim().toLocaleLowerCase('fr');
 return rows.filter(a=>{
  const t=new Date(a.starts_at),d=distance(f.position,a.position);
  return (f.mine||a.status==='open')&&(f.mine||t>=now)&&(!q||String(a.city).toLocaleLowerCase('fr').includes(q))&&(!f.category||a.category===f.category)&&typeMatches(a,f.activity_type)&&(!f.free||fullyFree(a))&&(!f.available||a.remaining>0)&&(!f.today||localDate(t)===localDate(now))&&(!f.date||localDate(t)===f.date)&&(!f.weekend||(t>=range.start&&t<range.end))&&(!f.position||(d!=null&&d<=Number(f.radius||20)))&&(!f.mine||a.is_owner||['accepted','pending'].includes(a.membership));
 });
}
function localDate(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function validate(a,now=new Date()){
 if(!String(a.title||'').trim()||a.title.trim().length>120)throw Error('Titre requis, 120 caractères maximum.');
 if(!categories[a.category])throw Error('Choisis une catégorie.');
 if(a.activity_type&&findType(a.activity_type)?.category!==a.category)throw Error('Le type précis ne correspond pas à la catégorie.');
 if(a.venue_cost_status&&!['free','unknown','on_site'].includes(a.venue_cost_status))throw Error('Statut des frais du lieu invalide.');
 if((a.cost_details||'').length>1200)throw Error('Précision tarifaire : 1 200 caractères maximum.');
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
const api=Object.freeze({categories,families,activityTypes,fold,findType,searchTypes,typeMatches,safeLink,distance,weekend,filter,validate,localDate,fees,fullyFree,recommend});root.OrevamiActivitiesCore=api;
if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis==='undefined'?window:globalThis);
