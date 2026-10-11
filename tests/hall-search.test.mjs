import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),handler=require('../api/search-halls.js');
const venue=(id,name,tags={},extra={})=>({id,type:'node',lat:48.8566,lon:2.3522,tags:{amenity:'events_venue',name,...tags},...extra});
async function search(elements,query={}){
 const original=globalThis.fetch;let upstream;
 globalThis.fetch=async url=>{upstream=String(url);return {ok:true,json:async()=>({elements})};};
 const res={statusCode:0,status(n){this.statusCode=n;return this;},setHeader(){return this;},json(body){this.body=body;return this;}};
 try{await handler({method:'GET',query:{lat:'48.8566',lon:'2.3522',radius:'5',...query}},res);return {...res,upstream};}finally{globalThis.fetch=original;}
}
test('Hall search keeps reception venues and excludes sports, theatres and unrelated public facilities',async()=>{
 const accepted=[venue(1,'Salle des fêtes'),venue(2,'Salle polyvalente',{amenity:'community_centre'}),venue(3,'Espace mariage'),venue(4,'Domaine de réception')];
 const excluded=[venue(5,'Gymnase municipal'),venue(6,'Salle Théâtre Victor Hugo'),venue(7,'Theater hall'),venue(8,'Cinéma central'),venue(9,'Salle de sport'),venue(10,'Salle polyvalente',{leisure:'sports_centre'}),venue(11,'Salle de réception',{building:'school'}),venue(12,'Bibliothèque'),venue(13,'Centre culturel',{amenity:'community_centre'}),venue(14,'Hôpital')];
 const r=await search([...accepted,...excluded]);assert.equal(r.statusCode,200);assert.deepEqual(r.body.results.map(x=>x.id),accepted.map(x=>'osm-'+x.id));assert.equal(r.body.source,'OpenStreetMap / Overpass');assert(r.upstream.includes('overpass'));
});
test('Known capacity/budget filters keep unknown values explicitly unknown; duplicates removed',async()=>{
 const r=await search([venue(1,'Réception A',{capacity:'20',price:'100'}),venue(2,'Réception B',{capacity:'100',price:'1000'}),venue(3,'Réception C'),venue(4,'Réception C')],{minCapacity:'50',maxBudget:'500'});assert.equal(r.body.results.length,1);assert.equal(r.body.results[0].capacity,null);assert.equal(r.body.results[0].price,null);
});
test('Invalid coordinates or radius do not call the provider',async()=>{
 for(const query of [{lat:'100'},{radius:'999'}]){const r=await search([],query);assert.equal(r.statusCode,400);assert.equal(r.upstream,undefined);}
});
