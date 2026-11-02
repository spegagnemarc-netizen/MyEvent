// Bounded routing over actual OSM ways. Never connect disconnected components.
const {distanceKm}=require('../lib/geoapify-restaurants');
const km=(a,b)=>distanceKm(a[1],a[0],b[1],b[0]);
const fail=message=>Object.assign(Error(message),{status:422});
function parameters(params){
 let points;try{points=JSON.parse(params.get('points'));}catch{throw fail('Étapes invalides.');}
 const mode=params.get('mode');
 if(!['hike','walk','cycle','mtb'].includes(mode)||!Array.isArray(points)||points.length<2||points.length>30||points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>85))throw fail('Choisissez 2 à 30 étapes et une pratique prise en charge.');
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),west=Math.min(...xs),east=Math.max(...xs),south=Math.min(...ys),north=Math.max(...ys);
 if(km([west,south],[east,north])>20)throw fail('Les étapes doivent tenir dans une zone de 20 km. Découpez votre parcours.');
 const padLat=0.012,padLon=Math.min(0.1,padLat/Math.cos(north*Math.PI/180));
 return {points,mode,bbox:[south-padLat,west-padLon,north+padLat,east+padLon]};
}
function allowed(t,mode){
 const foot=['hike','walk'].includes(mode),key=foot?'foot':'bicycle',access=t[key]??t[foot?'access':'vehicle']??t.access;
 if(!t.highway||['motorway','motorway_link','trunk','trunk_link','construction','proposed','raceway'].includes(t.highway)||['no','private','customers','destination','agricultural','forestry','use_sidepath'].includes(access)||t.area==='yes'||t.motorroad==='yes')return false;
 if(Object.keys(t).some(k=>/conditional$/.test(k)&&/^(access|foot|bicycle|vehicle|oneway)/.test(k)))return false;
 if(foot)return !['via_ferrata'].includes(t.highway)&&!['alpine_hiking','demanding_alpine_hiking','difficult_alpine_hiking'].includes(t.sac_scale);
 if(t.highway==='steps'||t.bicycle==='dismount')return false;
 if(mode==='cycle'&&(['path','footway','pedestrian','bridleway'].includes(t.highway)&&!['yes','designated','permissive'].includes(t.bicycle)||['sand','mud','rock','ground','dirt','grass'].includes(t.surface)||t.tracktype&&t.tracktype!=='grade1'||Number(t['mtb:scale'])>0))return false;
 if(mode==='mtb'&&(Number(t['mtb:scale'])>2||['horrible','very_horrible','impassable'].includes(t.smoothness)))return false;
 if(!foot&&['footway','pedestrian','bridleway'].includes(t.highway)&&!['yes','designated','permissive'].includes(t.bicycle))return false;
 return true;
}
class Heap{
 constructor(){this.a=[];}
 push(v){let i=this.a.length;this.a.push(v);while(i){const p=(i-1)>>1;if(this.a[p][0]<=v[0])break;this.a[i]=this.a[p];i=p;}this.a[i]=v;}
 pop(){const first=this.a[0],last=this.a.pop();if(this.a.length){let i=0;while(2*i+1<this.a.length){let j=2*i+1;if(j+1<this.a.length&&this.a[j+1][0]<this.a[j][0])j++;if(last[0]<=this.a[j][0])break;this.a[i]=this.a[j];i=j;}this.a[i]=last;}return first;}
}
function route(elements,{points,mode}){
 if(elements.length>=5000)throw fail('Réseau trop dense ou incomplet. Rapprochez les étapes.');
 const nodes=new Map(),edges=new Map(),connected=new Set();let count=0;
 for(const w of elements){if(w.type!=='way'||!allowed(w.tags||{},mode)||!Array.isArray(w.nodes)||w.nodes.length!==w.geometry?.length)continue;
  const t=w.tags,foot=['hike','walk'].includes(mode),one=foot?t['oneway:foot']:(t['oneway:bicycle']??t.oneway??(t.junction==='roundabout'?'yes':'no'));
  for(let i=0;i<w.nodes.length;i++){const p=w.geometry[i];if(!Number.isFinite(p?.lon)||!Number.isFinite(p?.lat))continue;nodes.set(w.nodes[i],[p.lon,p.lat]);if(!edges.has(w.nodes[i]))edges.set(w.nodes[i],[]);}
  for(let i=1;i<w.nodes.length;i++){const a=w.nodes[i-1],b=w.nodes[i],p=w.geometry[i-1],q=w.geometry[i];if(!p||!q||!nodes.has(a)||!nodes.has(b))continue;const length=km(nodes.get(a),nodes.get(b));if(!Number.isFinite(length)||length<=0)continue;
   const weight=length*(mode==='mtb'&&['primary','secondary'].includes(t.highway)?3:1);
   if(one!=='-1')edges.get(a).push([b,weight]);if(!['yes','1','true'].includes(one))edges.get(b).push([a,weight]);connected.add(a);connected.add(b);count++;
  }
  if(nodes.size>100000||count>150000)throw fail('Réseau trop volumineux. Rapprochez les étapes.');
 }
 const snaps=points.map(p=>{let id=null,d=Infinity;for(const [n,q]of nodes){if(!connected.has(n))continue;const v=km(p,q);if(v<d){id=n;d=v;}}if(id===null||d>0.15)throw fail('Une étape est à plus de 150 m du réseau utilisable cartographié. Déplacez-la sur un chemin.');return {id,d};});
 const lines=[];
 for(let i=1;i<snaps.length;i++){
  const start=snaps[i-1].id,end=snaps[i].id;if(start===end)throw fail('Deux étapes rejoignent le même point du réseau. Éloignez-les.');
  const heap=new Heap(),dist=new Map([[start,0]]),prev=new Map();heap.push([0,start]);let visits=0;
  while(heap.a.length){const [cost,n]=heap.pop();if(cost!==dist.get(n))continue;if(n===end)break;if(++visits>100000)throw fail('Calcul trop complexe. Rapprochez les étapes.');for(const [next,w]of edges.get(n)||[]){const c=cost+w;if(c<(dist.get(next)??Infinity)){dist.set(next,c);prev.set(next,n);heap.push([c,next]);}}}
  if(!dist.has(end))throw fail('Aucune liaison calculable sur le réseau autorisé cartographié. Aucun raccord en ligne droite ajouté.');
  const ids=[end];while(ids.at(-1)!==start){ids.push(prev.get(ids.at(-1)));if(ids.length>20000)throw fail('Tracé trop détaillé. Découpez le parcours.');}lines.push(ids.reverse().map(id=>nodes.get(id)));
 }
 const line=lines.flatMap((l,i)=>i?l.slice(1):l);if(line.length>20000)throw fail('Tracé trop détaillé. Découpez le parcours.');
 return {geometry:{type:'MultiLineString',coordinates:[line]},snapped:snaps.map(s=>nodes.get(s.id)),max_snap_m:Math.ceil(Math.max(...snaps.map(s=>s.d))*1000),notice:'Calcul sur les chemins OSM et restrictions renseignées, sans validation de terrain ni garantie de sécurité. Accès, obstacles, fermetures et conditions à vérifier. Étapes rapprochées du réseau (150 m maximum), sans segment de raccord inventé. Profil VTT prudent : difficultés techniques connues supérieures à 2 exclues ; données manquantes possibles.'};
}
module.exports={parameters,allowed,route};
