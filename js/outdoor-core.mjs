export const modes={hike:'Randonnée',walk:'Balade',cycle:'Vélo',gravel:'Gravel',mtb:'VTT'};
const rad=v=>v*Math.PI/180;
export function distance(a,b){const dlat=rad(b[1]-a[1]),dlon=rad(b[0]-a[0]);return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(dlon/2)**2)));}
export function validateGeometry(g){
 if(g?.type!=='MultiLineString'||!Array.isArray(g.coordinates)||!g.coordinates.length||g.coordinates.length>2000)throw Error('Tracé absent ou invalide.');
 let count=0;for(const line of g.coordinates){if(!Array.isArray(line)||line.length<2)throw Error('Chaque segment doit contenir deux points.');for(const p of line){if(!Array.isArray(p)||p.length<2||p.length>3||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90)throw Error('Coordonnées invalides.');if(++count>20000)throw Error('Maximum 20 000 points.');}}
 return g;
}
export function metrics(g,mode='hike'){
 validateGeometry(g);let km=0,up=0,down=0,elevation=true;
 for(const line of g.coordinates){let last=null,known=0;for(let i=0;i<line.length;i++){if(i)km+=distance(line[i-1],line[i]);if(line[i].length===3){known++;if(last!==null){const delta=line[i][2]-last;up+=Math.max(0,delta);down+=Math.max(0,-delta);}last=line[i][2];}}if(known<2)elevation=false;}
 return {distance_km:Math.round(km*100)/100,duration_min:Math.max(1,Math.round(km/({hike:4,walk:3.5,cycle:16,gravel:13,mtb:10}[mode]||4)*60+(elevation?up/10:0))),ascent_m:elevation?Math.round(up):null,descent_m:elevation?Math.round(down):null};
}
export function parseGPX(text,Parser=globalThis.DOMParser){
 if(typeof text!=='string'||text.length>2000000||/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('GPX trop volumineux ou déclaration XML interdite.');
 const doc=new Parser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror')||doc.documentElement.localName!=='gpx')throw Error('Fichier GPX invalide.');
 const point=el=>{const lon=el.getAttribute('lon'),lat=el.getAttribute('lat');if(!lon?.trim()||!lat?.trim())throw Error('Coordonnée GPX manquante.');const p=[Number(lon),Number(lat)],ele=[...el.children].find(n=>n.localName==='ele');if(ele?.textContent.trim())p.push(Number(ele.textContent));return p;};
 const all=name=>[...doc.getElementsByTagNameNS('*',name)];
 let lines=all('trkseg').map(seg=>[...seg.children].filter(n=>n.localName==='trkpt').map(point));if(!lines.length)lines=all('rte').map(seg=>[...seg.children].filter(n=>n.localName==='rtept').map(point));
 const geometry=validateGeometry({type:'MultiLineString',coordinates:lines});return {name:all('name')[0]?.textContent?.slice(0,160)||'Parcours importé',geometry};
}
const xml=v=>String(v??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
export function exportGPX(route){validateGeometry(route.geometry);return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="OREVAMI" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${xml(route.name)}</name><desc>${xml(route.source_name)} — ${xml(route.source_url)} — ${xml(route.license)}</desc></metadata><trk><name>${xml(route.name)}</name>${route.geometry.coordinates.map(line=>'<trkseg>'+line.map(p=>`<trkpt lon="${p[0]}" lat="${p[1]}">${p.length===3?'<ele>'+p[2]+'</ele>':''}</trkpt>`).join('')+'</trkseg>').join('')}</trk></gpx>`;}
export function fromOSM(element,checkedAt=new Date().toISOString()){
 const tags=element.tags||{},seen=new Set(),lines=[];for(const m of element.members||[]){if(m.type!=='way'||seen.has(m.ref)||!m.geometry?.length)continue;seen.add(m.ref);const line=m.geometry.filter(p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lon)).map(p=>[p.lon,p.lat]);if(line.length>1)lines.push(line);}
 const geometry=validateGeometry({type:'MultiLineString',coordinates:lines});const activity=({hiking:'hike',foot:'walk',bicycle:'cycle',mtb:'mtb'})[tags.route];if(!activity)throw Error('Pratique non prise en charge.');
 return {id:'osm-'+element.id,owner_id:null,name:(tags.name||tags.ref||'Itinéraire OSM '+element.id).slice(0,160),activity,difficulty:tags.sac_scale||tags['mtb:scale']||'unknown',geometry,...metrics(geometry,activity),visibility:'public',source_name:'© contributeurs OpenStreetMap',source_url:'https://www.openstreetmap.org/relation/'+element.id,license:'ODbL-1.0',checked_at:checkedAt,description:'Itinéraire cartographié par la communauté. Segments éventuellement disjoints. Durée estimée ; accès et état du terrain à vérifier.'};
}
export function filterRoutes(rows,{query='',activity='',maxKm=0,maxMinutes=0,difficulty='',center=null,radius=20}={}){return rows.filter(r=>(!query||r.name.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')))&&(!activity||r.activity===activity)&&(!difficulty||r.difficulty===difficulty)&&(!maxKm||r.distance_km<=maxKm)&&(!maxMinutes||r.duration_min<=maxMinutes)&&(!center||r.geometry.coordinates.some(line=>line.some(p=>distance(center,p)<=radius))));}
