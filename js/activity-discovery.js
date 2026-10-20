/* One authorised activity snapshot and one discovery selection for home and workspace. */
(function(root){'use strict';
 const C=root.OrevamiActivitiesCore;if(!C)return;
 const context=()=>root.myeventCameraContext?.()||{},listeners=new Set();
 const defaults=()=>({view:'foryou',city:'',radius:20,position:null,geoSource:'',types:[],freeOnly:false,free:false,category:'',activity_type:'',date:'',available:true});
 let owner=null,state=defaults(),rows=[],cap={},pending=null,ticket=0,areaTicket=0,loadedAt=0,error='',firstIdentity=true;
 function snapshot(){return {state:{...state,types:[...state.types]},rows,cap,error,loading:!!pending};}
 function emit(){for(const fn of listeners)fn(snapshot());}
 function key(){return 'orevami.activities.discovery.v1.'+owner;}
 function validPosition(p){return !!p&&[p.lat,p.lon].every(Number.isFinite)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;}
 function identity(){
  const id=context().user?.id||'';if(owner===id)return id;
  owner=id;ticket++;areaTicket++;pending=null;rows=[];cap={};loadedAt=0;error='';state=defaults();
  if(id){try{const saved=JSON.parse(localStorage.getItem(key())||'null');if(saved){state.city=String(saved.city||'').slice(0,100);state.radius=[5,20,50,100].includes(saved.radius)?saved.radius:20;state.types=(saved.types||[]).filter(t=>C.findType(t));state.freeOnly=saved.freeOnly===true;if(state.city&&validPosition(saved.center)){state.position=saved.center;state.geoSource='city';}}}catch{}
   if(firstIdentity&&!state.city)try{const saved=JSON.parse(localStorage.getItem('myevent_social_last_position_v1')||'null');if(validPosition(saved)){state.position={lat:saved.lat,lon:saved.lon};state.geoSource='gps';}}catch{}
  }
  if(id)firstIdentity=false;emit();return id;
 }
 function persist(){if(!owner)return;try{localStorage.setItem(key(),JSON.stringify({city:state.city,radius:state.radius,types:state.types,freeOnly:state.freeOnly,center:state.geoSource==='city'?state.position:null}));}catch{}}
 function update(patch){identity();state={...state,...patch};state.radius=Math.max(1,Math.min(100,Number(state.radius)||20));persist();emit();}
 async function refresh({force=false}={}){
  const id=identity(),{sb}=context();if(!id||!sb){error='Connecte-toi pour découvrir les sorties accessibles.';emit();return snapshot();}
  if(pending)return pending;if(!force&&loadedAt&&Date.now()-loadedAt<30000)return snapshot();
  const version=++ticket;
  pending=(async()=>{try{
   const capabilities=await sb.rpc('activities_capabilities');if(version!==ticket||id!==context().user?.id)return snapshot();if(capabilities.error)throw capabilities.error;
   cap=capabilities.data||{};if(cap.enabled!==true||cap.version!==4||cap.account_access!==true){rows=[];error='Les sorties ne sont pas accessibles pour ce compte.';return snapshot();}
   const result=await sb.rpc('activities_list');if(version!==ticket||id!==context().user?.id)return snapshot();if(result.error)throw result.error;
   const seen=new Set();rows=(Array.isArray(result.data)?result.data:[]).filter(a=>a?.id&&!seen.has(a.id)&&seen.add(a.id));error='';loadedAt=Date.now();
  }catch{if(version===ticket){rows=[];cap={};error='Sorties indisponibles pour le moment. Le reste de l’accueil reste accessible.';}}
  finally{if(version===ticket){pending=null;emit();}}return snapshot();})();
  emit();return pending;
 }
 function select(extra={},now=new Date()){
  const f={...state,...extra},mine=f.mine===true||f.view==='mine';
  if(!mine&&!f.city&&!validPosition(f.position))return [];
  let visible=C.filter(rows,{category:f.category,activity_type:f.activity_type,date:f.date,free:f.view==='free'||f.free||(f.view==='foryou'&&f.freeOnly),today:f.view==='today',weekend:f.view==='weekend',mine,available:mine?false:f.available!==false},now);
  if(!mine)visible=visible.filter(a=>{
   const distance=C.distance(f.position,a.position),sameCity=f.city&&C.fold(a.city)===C.fold(f.city);
   if(validPosition(f.position))return distance!==null?distance<=f.radius:!!sameCity;
   return !!sameCity;
  });
  if(f.view==='foryou')visible=C.recommend(visible,{types:f.types,freeOnly:f.freeOnly});
  if(f.view==='nearby')visible.sort((a,b)=>(C.distance(f.position,a.position)??Infinity)-(C.distance(f.position,b.position)??Infinity)||Date.parse(a.starts_at)-Date.parse(b.starts_at));
  else if(f.view!=='foryou')visible.sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));
  return visible;
 }
 async function area(city){
  identity();const text=String(city||'').trim().slice(0,100),version=++areaTicket;
  update({city:text,position:null,geoSource:text?'city':''});if(!text)return;
  try{const response=await fetch('/api/integration-venues?mode=activity-area&q='+encodeURIComponent(text),{cache:'no-store'});if(!response.ok)throw Error();const found=await response.json();if(version===areaTicket&&validPosition(found.position))update({position:found.position,geoSource:'city'});}catch{/* Exact city remains usable; never widen to unrelated places. */}
 }
 function locate(){
  identity();const id=owner;return new Promise(resolve=>{
   if(!navigator.geolocation){resolve(false);return;}
   navigator.geolocation.getCurrentPosition(p=>{if(owner!==id){resolve(false);return;}areaTicket++;update({city:'',position:{lat:p.coords.latitude,lon:p.coords.longitude},geoSource:'gps'});resolve(true);},()=>resolve(false),{enableHighAccuracy:false,timeout:12000,maximumAge:60000});
  });
 }
 function reset(){owner=null;identity();emit();}
 root.OrevamiActivityDiscovery=Object.freeze({get:()=>{identity();return snapshot();},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},update,refresh,select,area,locate,reset});
 root.addEventListener('storage',e=>{if(e.key==='myevent_social_last_position_v1'&&state.geoSource!=='city'){try{const p=JSON.parse(e.newValue);if(validPosition(p))update({position:{lat:p.lat,lon:p.lon},geoSource:'gps'});}catch{}}});
 root.addEventListener('myevent-camera-feed-session',()=>{identity();refresh();});
 context().sb?.auth?.onAuthStateChange(()=>{if((context().user?.id||'')!==owner)reset();});
})(window);
