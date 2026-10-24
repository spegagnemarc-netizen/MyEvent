/* Same authorised snapshot, cards and discovery state as the full Activities workspace. */
(function(root){'use strict';const C=root.OrevamiActivitiesCore,D=root.OrevamiActivityDiscovery;if(!C)return;
function node(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=String(text);if(cls)n.className=cls;return n;}
function action(label,fn,cls=''){const b=node('button',label,cls);b.type='button';b.addEventListener('click',fn);return b;}
function card(a,{onOpen=()=>{},onParticipate=onOpen,participationEnabled=false,showJoin=false,publicOnly=true,includeUnavailable=false,now=Date.now(),position=null}={}){
 if(!a||!/^[0-9a-f-]{36}$/i.test(a.id||'')||!['public','friends'].includes(a.visibility)||(publicOnly&&a.visibility!=='public')||(!includeUnavailable&&(a.status!=='open'||Date.parse(a.starts_at)<=now||a.remaining<=0))||!Number.isFinite(Date.parse(a.starts_at)))return null;
 const article=node('article',null,'activityShowcaseCard'),visual=C.cover(a),body=node('div',null,'activityShowcaseBody');article.dataset.activityId=a.id;article.setAttribute('role','listitem');article.setAttribute('aria-label',a.title||'Sortie');
 const distance=C.distance(position,a.position),type=C.findType(a.activity_type),badge=node('span',type?.label||C.categories[a.category]||'Sortie','activityCategory');visual.append(badge);
 if(distance!==null)visual.append(node('span',`📍 ${distance<1?'Moins de 1':Math.round(distance)} km`,'activityDistance'));
 if(a.is_owner)visual.append(node('span','Votre sortie','activityOwner'));
 const title=node('h3',a.title||'Sortie'),city=node('p',[a.venue,a.city].filter(Boolean).join(' · ')||'Lieu à préciser','activityCity');
 const date=new Intl.DateTimeFormat('fr-FR',{timeZone:C.activityZone(a),weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(a.starts_at));
 const info=node('div',null,'activityFacts');info.append(node('span','◷ '+date),node('span',`${a.participants_count??0} / ${a.capacity??'—'} · ${a.remaining??0} places`));
 const price=node('p',C.fullyFree(a)?'Gratuit · groupe et établissement':a.cost_mode==='on_site'?`${a.cost_amount} € / personne · frais du lieu à vérifier`:'Groupe gratuit · tarif du lieu à vérifier','activityPrice');price.title=C.fees(a);
 const view=action('Voir la sortie ↗',()=>onOpen(a.id),'activityView');const actions=node('div',null,'activityShowcaseActions');actions.append(view);
 if(showJoin&&!a.is_owner&&!['accepted','pending'].includes(a.membership)&&a.status==='open'){const join=action(a.join_mode==='approval'?'Demander à rejoindre':'Participer',()=>onParticipate(a.id),'activityJoin');join.disabled=!participationEnabled||a.remaining<=0;actions.append(join);}
 body.append(title,city,info,price,actions);article.append(visual,body);article.addEventListener('click',e=>{if(!e.target.closest('button,a'))onOpen(a.id);});return article;
}
root.OrevamiActivityFeed=Object.freeze({card});
async function init(){
 if(!D||!root.myeventRuntime?.ready)return;let config;try{config=await root.myeventRuntime.ready;}catch{return;}
 const feed=document.getElementById('socialFeed'),production=config?.environment==='production'&&config.isTest===false&&config.projectRef==='nxxvadbliinhvkirqkkl';
 if(document.getElementById('orevamiActivityFeed'))return;
 if(!feed||(!production&&(config?.isTest!==true||config.environment!=='preview'||config.projectRef!=='ahyyknfjsielnqyoxqgh')))return;
 const section=node('section',null,'activityFeedSection');section.id='orevamiActivityFeed';section.setAttribute('aria-label','Sorties & Rencontres');
 const header=node('div',null,'activityShowcaseHeader'),heading=node('div'),eyebrow=node('small','À PARTAGER, PRÈS DE VOUS'),title=node('h2','🌍 Sorties & Rencontres');heading.append(eyebrow,title);
 const open=()=>root.myeventOpenActivities?.();header.append(heading,action('Voir toutes les sorties ›',open,'activityBrowse'));
 const area=node('form',null,'activityAreaForm'),cityLabel=node('label','Votre ville'),city=node('input');city.name='city';city.placeholder='Ville, ex. Gap';city.maxLength=100;city.autocomplete='address-level2';cityLabel.append(city);
 const radiusLabel=node('label','Rayon'),radius=node('select');radius.name='radius';for(const v of [5,20,50,100])radius.add(new Option(v+' km',v));radiusLabel.append(radius);
 const search=node('button','Rechercher','activityAreaSearch');search.type='submit';const gps=action('⌖ Ma position',async()=>{gps.disabled=true;status.textContent='Autorisez la localisation ou choisissez une ville.';const ok=await D.locate();gps.disabled=false;if(ok)sector.open=false;if(!ok)status.textContent='GPS indisponible : choisissez une ville. Les autres fonctions restent disponibles.';},'activityLocate');area.append(cityLabel,radiusLabel,search,gps);
 const scope=node('p','','activityScope'),status=node('p','Chargement…','activityFeedStatus');status.setAttribute('role','status');
 const list=node('div',null,'activityFeedList');list.setAttribute('role','list');list.setAttribute('aria-label','Sorties accessibles dans votre secteur');list.tabIndex=0;
 const rail=node('div',null,'activityRail');rail.append(list);
 let drag=null,suppressClick=false;
 list.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0||e.target.closest('button,a,input,select'))return;drag={id:e.pointerId,x:e.clientX,start:list.scrollLeft,moved:false};});
 list.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const delta=e.clientX-drag.x;if(!drag.moved&&Math.abs(delta)>6){drag.moved=true;list.setPointerCapture(e.pointerId);list.classList.add('is-dragging');}if(drag.moved){e.preventDefault();list.scrollLeft=drag.start-delta;}});
 const finish=()=>{if(!drag)return;suppressClick=drag.moved;drag=null;list.classList.remove('is-dragging');if(suppressClick)root.setTimeout(()=>suppressClick=false,0);};
 list.addEventListener('pointerup',finish);list.addEventListener('pointercancel',finish);list.addEventListener('lostpointercapture',finish);
 list.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();}},true);
 list.addEventListener('dragstart',e=>e.preventDefault());
 list.addEventListener('wheel',e=>{if(e.ctrlKey||e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)||list.scrollWidth<=list.clientWidth)return;const direction=e.deltaY;if(direction>0&&list.scrollLeft>=list.scrollWidth-list.clientWidth-1||direction<0&&list.scrollLeft<=0)return;e.preventDefault();list.scrollBy({left:Math.sign(direction)*((list.firstElementChild?.getBoundingClientRect().width||list.clientWidth)+12),behavior:'smooth'});},{passive:false});
 const footer=action('＋ Organiser une sortie ici',()=>root.myeventCreateActivity?.(),'activityCreate');const sector=node('details',null,'activitySector'),sectorSummary=node('summary','Choisir mon secteur');sector.append(sectorSummary,area,scope);section.append(header,status,rail,footer);feed.before(section);
 const names={foryou:'Pour vous',today:'Aujourd’hui',weekend:'Ce week-end',free:'Gratuit',nearby:'À proximité',discover:'Toutes les sorties',mine:'Mes activités'};
 const filters=[...document.querySelectorAll('#socialHome .socialFilter')],views=['foryou','today','weekend','free','nearby'];
 filters.forEach((b,i)=>{b.dataset.activityFilter=views[i];b.setAttribute('aria-controls',section.id);b.addEventListener('click',()=>D.update({view:views[i]}));});
 area.addEventListener('submit',async e=>{e.preventDefault();const selectedCity=city.value;D.update({radius:Number(radius.value)});await D.area(selectedCity);sector.open=false;await D.refresh();});radius.addEventListener('change',()=>D.update({radius:Number(radius.value)}));
 function draw({state,cap,error,loading}){
  if(document.activeElement!==city)city.value=state.city;radius.value=String(state.radius);filters.forEach(b=>{const active=b.dataset.activityFilter===state.view;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  const hasArea=state.city||state.position;sectorSummary.textContent='⌖ '+(state.geoSource==='gps'?'Ma position':state.city||'Choisir mon secteur')+' · '+state.radius+' km';if(!hasArea)sector.open=true;scope.textContent=(names[state.view]||'Toutes les sorties')+' · '+(state.geoSource==='gps'?'autour de ma position':state.city||'choisissez votre secteur')+(state.position?` · ${state.radius} km`:'');
  const rows=D.select().slice(0,3);list.replaceChildren();for(const a of rows){const item=card(a,{publicOnly:false,position:state.position,onOpen:id=>root.myeventOpenActivity?.(id,'view',{origin:'feed'})});if(item)list.append(item);}
  footer.disabled=cap.can_create!==true;
  status.textContent=error||(loading?'Chargement des sorties…':!hasArea?'Choisissez une ville ou utilisez votre position pour découvrir les sorties de votre secteur.':!list.childElementCount?'Aucune sortie disponible pour ces critères. Élargissez le rayon ou découvrez toutes les sorties.':'');
  if(state.city&&!state.position&&!error&&!loading)scope.textContent+=' · rayon non appliqué : ville non localisée';
 }
 const active=filters.findIndex(b=>b.classList.contains('active'));D.subscribe(draw);draw(D.get());root.myeventRefreshActivitiesFeed=()=>D.refresh({force:true});
 if(active>=0)D.update({view:views[active]});D.refresh();
 root.addEventListener('focus',()=>D.refresh());
}
init();})(window);
