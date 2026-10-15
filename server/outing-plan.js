// Pure planning helpers. Only supplied places and user-specified times/prices survive.
const finite = value => value == null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const clock = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')) ? String(value) : null;
const food = p => p.type === 'restaurant';
function distance(a,b,c,d){const rad=Math.PI/180,q=Math.sin((c-a)*rad/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin((d-b)*rad/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,q)));}
function prepare(body={}) {
  const people=Math.max(1,Math.min(5000,Math.trunc(Number(body.people)||1)));
  const budget=finite(body.budget_per_person),radius=finite(body.radius),center=body.center||{};
  const startTime=clock(body.start_time),mealTime=clock(body.meal_time);
  if(budget!=null&&budget<0)throw Object.assign(new Error('Le budget ne peut pas être négatif.'),{status:422,code:'INVALID_BUDGET'});
  if(startTime&&mealTime&&mealTime<startTime)throw Object.assign(new Error('L’heure du repas précède le début de la sortie. Ajuste ces horaires.'),{status:422,code:'INCOMPATIBLE_TIMES'});
  const seen=new Set(),candidates=[];
  for(const [i,c] of (Array.isArray(body.candidates)?body.candidates:[]).slice(0,120).entries()){
    if(!c||typeof c!=='object')continue;
    const lat=finite(c.lat),lon=finite(c.lon),price=finite(c.price_per_person),capacity=finite(c.capacity);
    if(!String(c.name||'').trim()||lat==null||lon==null||Math.abs(lat)>90||Math.abs(lon)>180)continue;
    const key=String(c.name).trim().toLowerCase()+'|'+lat.toFixed(5)+'|'+lon.toFixed(5);
    if(seen.has(key))continue;seen.add(key);
    let km=finite(c.distance_km);
    if(finite(center.lat)!=null&&finite(center.lon)!=null)km=distance(Number(center.lat),Number(center.lon),lat,lon);
    if(radius!=null&&km!=null&&km>radius)continue;
    if(capacity!=null&&capacity>0&&capacity<people)continue;
    if(budget!=null&&price!=null&&price>budget)continue;
    candidates.push({place_type:String(c.place_type||c.type||'').slice(0,100),id:String(c.id||'c'+i),name:String(c.name).slice(0,180),type:c.type==='restaurant'?'restaurant':['culture','nature'].includes(c.type)?c.type:'activity',address:String(c.address||'').slice(0,240),lat,lon,price_per_person:price!=null&&price>=0?price:null,capacity:capacity!=null&&capacity>0?capacity:null,distance_km:km,website:c.website?String(c.website).slice(0,500):null,phone:c.phone?String(c.phone).slice(0,80):null});
  }
  // IDs must identify a single real place; ambiguous duplicates are not selectable.
  const counts=new Map();for(const c of candidates)counts.set(c.id,(counts.get(c.id)||0)+1);
  const unique=candidates.filter(c=>counts.get(c.id)===1);
  const restaurants=unique.filter(food),activities=unique.filter(p=>!food(p));
  if(!restaurants.length||!activities.length)throw Object.assign(new Error(!restaurants.length?'Aucun restaurant compatible parmi les lieux disponibles. Élargis le rayon ou ajuste les critères.':'Aucune activité compatible parmi les lieux disponibles. Élargis le rayon ou ajuste les critères.'),{status:422,code:!restaurants.length?'NO_COMPATIBLE_RESTAURANT':'NO_COMPATIBLE_ACTIVITY'});
  const requestedSteps=Math.max(2,Math.min(5,Math.trunc(Number(body.requested_steps)||3)));
  return {people,budget:budget!=null&&budget>=0?budget:null,radius,requestedSteps,targetSteps:Math.min(requestedSteps,activities.length+1),candidates:unique,startTime,mealTime,mealType:['lunch','dinner'].includes(body.meal_type)?body.meal_type:'none'};
}
function option(selection,ctx,title,summary){
  if(selection.length!==ctx.targetSteps||new Set(selection.map(c=>c.id)).size!==selection.length||selection.filter(food).length!==1)return null;
  if(ctx.budget!=null&&selection.reduce((sum,c)=>sum+(c.price_per_person??0),0)>ctx.budget)return null;
  const restaurant=selection.find(food),activities=selection.filter(p=>!food(p));
  // Anchor only explicit user inputs. No opening hours, durations or travel times are invented.
  const order=ctx.startTime&&((ctx.mealTime&&ctx.startTime<ctx.mealTime)||(!ctx.mealTime&&ctx.mealType!=='none'))?[activities[0],restaurant,...activities.slice(1)]:[restaurant,...activities];
  const steps=order.map((c,i)=>({candidate_id:c.id,type:c.type,name:c.name,address:c.address,lat:c.lat,lon:c.lon,price_per_person:c.price_per_person,price_is_estimate:false,start_time:food(c)&&ctx.mealTime?ctx.mealTime:i===0?ctx.startTime:null,duration_minutes:null,website:c.website,phone:c.phone,source:'openstreetmap'}));
  const pricesKnown=steps.every(s=>s.price_per_person!=null);
  return {title:String(title||'Sortie proposée').slice(0,180),summary:String(summary||'Proposition à partir des lieux disponibles.').slice(0,400),total_estimated_per_person:pricesKnown?steps.reduce((sum,s)=>sum+s.price_per_person,0):null,budget_verified:pricesKnown,capacity_verified:selection.every(c=>c.capacity!=null),incomplete:ctx.targetSteps<ctx.requestedSteps,requested_steps:ctx.requestedSteps,steps};
}
function fromModel(parsed,ctx,allowIncomplete=false){
  const map=new Map(ctx.candidates.map(c=>[c.id,c])),options=[],seen=new Set();
  for(const raw of (Array.isArray(parsed?.options)?parsed.options:[]).slice(0,3)){
    const ids=(Array.isArray(raw.steps)?raw.steps:[]).map(s=>String(s.candidate_id||''));
    if(ids.some(id=>!map.has(id)))continue;
    const optionContext=allowIncomplete&&ids.length>=2&&ids.length<=ctx.targetSteps?{...ctx,targetSteps:ids.length}:ctx;
    const result=option(ids.map(id=>map.get(id)),optionContext,'Sortie proposée','Sélection de lieux réels ; horaires, tarifs et accueil du groupe à confirmer.');
    const key=ids.slice().sort().join('|');if(result&&!seen.has(key)){seen.add(key);options.push(result);}
  }
  return options;
}
function fallback(ctx){
  const rank=(a,b)=>(a.price_per_person??0)-(b.price_per_person??0)||(a.distance_km??Infinity)-(b.distance_km??Infinity)||a.id.localeCompare(b.id);
  const restaurants=ctx.candidates.filter(food).sort(rank),activities=ctx.candidates.filter(p=>!food(p)).sort(rank),options=[];
  for(const restaurant of restaurants){
    const selection=[restaurant];let cost=restaurant.price_per_person??0;
    for(const activity of activities){if(ctx.budget!=null&&cost+(activity.price_per_person??0)>ctx.budget)continue;selection.push(activity);cost+=activity.price_per_person??0;if(selection.length===ctx.targetSteps)break;}
    const result=selection.length>=2?option(selection,{...ctx,targetSteps:selection.length},'Sortie à partir des lieux disponibles','Sélection automatique sans IA ; vérifie les horaires d’ouverture, les tarifs et la capacité avant de réserver.'):null;
    if(result)options.push(result);if(options.length===3)break;
  }
  return options;
}
function response(ctx,body,options,reason){
  const warnings=[];
  if(reason)warnings.push('Le moteur IA est indisponible ('+({AI_TIMEOUT:'délai dépassé',AI_NETWORK:'connexion interrompue',AI_QUOTA:'quota atteint',AI_HTTP:'erreur fournisseur',AI_RESPONSE:'réponse inexploitable',AI_NOT_CONFIGURED:'accès non configuré'}[reason]||'réponse inexploitable')+'). Une sélection automatique de lieux réels est proposée.');
  if(options.some(o=>o.incomplete))warnings.push(Math.max(...options.map(o=>o.steps.length))+' étapes disponibles sur '+ctx.requestedSteps+' demandées : proposition à compléter.');
  if(options.some(o=>!o.budget_verified))warnings.push('Certains tarifs sont inconnus : le respect du budget reste à confirmer.');
  if(options.some(o=>!o.capacity_verified))warnings.push('La capacité d’accueil du groupe reste à confirmer auprès des lieux.');
  if(ctx.mealType!=='none'&&!ctx.mealTime)warnings.push('Repas demandé : '+(ctx.mealType==='lunch'?'déjeuner':'dîner')+' ; horaire à préciser.');
  warnings.push('Les heures d’ouverture et durées ne sont pas vérifiées. Seuls tes horaires saisis sont repris ; les autres restent à définir.');
  if(String(body.request||'').trim()&&reason)warnings.push('Tes préférences libres restent à vérifier sur cette sélection de secours.');
  return {people:ctx.people,budget_per_person:ctx.budget,request:String(body.request||'').slice(0,2000),start_time:ctx.startTime,meal_type:ctx.mealType,meal_time:ctx.mealTime,requested_steps:ctx.requestedSteps,mode:reason?'deterministic':'ai',fallback_reason:reason||null,warning:warnings.join(' '),options};
}
// Extra choices reuse the same real places. Pagination never calls a provider.
const optionKey=o=>JSON.stringify((o?.steps||[]).map(s=>String(s.candidate_id)).sort());
function localPreferencePolicy(ctx,body){
  let text=String(body.request||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const all=ctx.candidates.map(c=>c.id),groups=[];
  // Only requirements supported by actual names/types are interpreted locally.
  // Unknown adjectives, exclusions and complex requests remain blocked, never guessed.
  if(/\b(pas|sans|sauf|eviter|uniquement|vegetarien|vegan|accessible|romantique|calme|terrasse)\b/.test(text))return null;
  const rules=[
    [/\bbowling\b/g,/bowling/],[/\b(cinema|cine)\b/g,/cinema/],[/\b(musee|musees)\b/g,/museum|musee/],
    [/\b(parc|parcs|nature)\b/g,/park|parc|garden|nature|playground/],[/\b(culture|culturel|culturelle)\b/g,/culture|museum|musee|theatre|cinema|gallery/],
    [/\b(piscine|piscines)\b/g,/swimming_pool|piscine/],[/\b(minigolf|mini golf)\b/g,/miniature_golf|minigolf/]
  ];
  for(const [words,match]of rules){if(!words.test(text))continue;words.lastIndex=0;text=text.replace(words,' ');const ids=ctx.candidates.filter(c=>match.test((c.name+' '+c.place_type+' '+c.type).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase())).map(c=>c.id);if(!ids.length)return null;groups.push(ids);}
  text=text.replace(/\b(restaurant|restaurants|resto|repas|activite|activites|loisir|loisirs|sortie|sorties|soiree|journee|conviviale|convivial|equilibree|equilibre|un|une|des|de|du|le|la|les|et|avec|puis|pour|je|veux|voudrais|faire|organiser|proposer)\b/g,' ').replace(/[\s+,.!;:&/()-]/g,'');
  return text?null:{candidate_ids:all,required_groups:groups};
}
function alternativePolicy(ctx,body,raw){
  if(!String(body.request||'').trim())return {candidate_ids:ctx.candidates.map(c=>c.id),required_groups:[]};
  const local=localPreferencePolicy(ctx,body);
  if(local)return local;
  if(raw?.preferences_checked!==true)return null;
  const allowed=new Set(ctx.candidates.map(c=>c.id));
  const ids=Array.isArray(raw.alternative_candidate_ids)?[...new Set(raw.alternative_candidate_ids.map(String))]:[];
  const groups=raw.required_candidate_groups;
  if(!ids.length||ids.some(id=>!allowed.has(id))||!Array.isArray(groups)||groups.length>ctx.targetSteps)return null;
  const pool=new Set(ids);
  if(groups.some(g=>!Array.isArray(g)||!g.length||g.some(id=>!pool.has(String(id)))))return null;
  return {candidate_ids:ids,required_groups:groups.map(g=>[...new Set(g.map(String))])};
}
function* extraOptions(ctx,policy){
  if(!policy)return;
  const ids=new Set(policy.candidate_ids),pool=ctx.candidates.filter(c=>ids.has(c.id));
  const rank=(a,b)=>(a.distance_km??Infinity)-(b.distance_km??Infinity)||a.id.localeCompare(b.id);
  const restaurants=pool.filter(food).sort(rank),buckets=['culture','activity','nature'].map(type=>pool.filter(c=>c.type===type).sort(rank));
  const activities=[];
  for(let i=0;i<Math.max(0,...buckets.map(b=>b.length));i++)for(const b of buckets)if(b[i])activities.push(b[i]);
  function* forRestaurant(restaurant,rotation){
    const a=activities.slice(rotation).concat(activities.slice(0,rotation));
    const remainingBudget=ctx.budget==null?Infinity:ctx.budget-(restaurant.price_per_person??0);
    const costs=a.map(c=>c.price_per_person??0).sort((x,y)=>x-y);
    let k=0,cost=0;
    while(k<ctx.targetSteps-1&&k<costs.length&&cost+costs[k]<=remainingBudget){cost+=costs[k];k++;}
    if(!k)return;
    // Lower bounds prune unaffordable branches before enumerating combinations.
    const min=Array.from({length:a.length+1},()=>Array(k+1).fill(Infinity));min[a.length][0]=0;
    for(let i=a.length-1;i>=0;i--){min[i][0]=0;for(let n=1;n<=k;n++)min[i][n]=Math.min(min[i+1][n],(a[i].price_per_person??0)+min[i+1][n-1]);}
    const groups=policy.required_groups.map(g=>new Set(g));
    function* choose(start,left,selection,budget){
      if(min[start][left]>budget)return;
      const unmet=groups.filter(g=>!selection.some(c=>g.has(c.id))),tail=a.slice(start);
      for(const g of unmet){
        const matches=tail.filter(c=>g.has(c.id));
        if(!left||!matches.length||Math.min(...matches.map(c=>c.price_per_person??0))>budget)return;
      }
      if(unmet.length){
        const maxCoverage=Math.max(0,...tail.map(c=>unmet.filter(g=>g.has(c.id)).length));
        if(!maxCoverage||Math.ceil(unmet.length/maxCoverage)>left)return;
      }
      if(!left){
        const result=option(selection,{...ctx,targetSteps:selection.length},'Autre sortie proposée','Combinaison automatique de lieux réels ; vérifie les horaires, tarifs et disponibilités.');
        if(result)yield {...result,generation:'deterministic'};
        return;
      }
      for(let i=start;i<=a.length-left;i++){
        const price=a[i].price_per_person??0;
        if(price<=budget)yield* choose(i+1,left-1,[...selection,a[i]],budget-price);
      }
    }
    yield* choose(0,k,[restaurant],remainingBudget);
  }
  const iterators=restaurants.map((r,i)=>forRestaurant(r,activities.length?i%activities.length:0));
  // Rotate restaurants as well as activity order, rather than exhausting one venue first.
  while(iterators.length){
    for(let i=0;i<iterators.length;){const next=iterators[i].next();if(next.done){iterators.splice(i,1);continue;}yield next.value;i++;}
  }
}
function extraPage(ctx,primary,policy,cursor=0,limit=10){
  if(!Number.isInteger(cursor)||cursor<0||cursor>10000)throw Object.assign(new Error('Page de propositions invalide. Relance la recherche.'),{status:400,code:'INVALID_PAGE'});
  const original=new Set(primary.map(optionKey)),options=[];let skipped=0,hasMore=false;
  for(const result of extraOptions(ctx,policy)){
    if(original.has(optionKey(result)))continue;
    if(skipped++<cursor)continue;
    if(options.length===limit){hasMore=true;break;}
    options.push(result);
  }
  return {options,next_cursor:cursor+options.length,has_more:hasMore&&cursor+options.length<=10000};
}
function expand(ctx,body,primary,policy,cursor=0,additional=false){
  const page=extraPage(ctx,primary,policy,cursor,additional?10:10-primary.length);
  return {options:additional?page.options:[...primary,...page.options],planner_version:'more-options-2',choice_summary:{candidate_count:ctx.candidates.length,primary_count:primary.length,eligible_count:policy?.candidate_ids.length||0,blocked_by:policy?null:'UNVERIFIED_PREFERENCES'},paging:{next_cursor:page.next_cursor,has_more:page.has_more,primary_options:primary.map(o=>({steps:o.steps.map(s=>({candidate_id:s.candidate_id}))})),alternative_policy:policy}};
}

module.exports={prepare,fromModel,fallback,response,alternativePolicy,localPreferencePolicy,extraPage,expand};
