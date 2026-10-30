import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

test('restaurant picker uses its verified reader once and preserves facts through addition',async()=>{
 const d=new JSDOM('<main class="activities"><form><input name="venue"><input name="address"><input name="city"><input name="latitude"><input name="longitude"></form></main>',{url:'https://preview.invalid/',runScripts:'outside-only'});
 try{
  const w=d.window,doc=w.document,form=doc.querySelector('form');
  for(const name of ['activities-core','place-card','venue-analysis-review','activity-venue-sheet','activities-widgets'])w.eval(await readFile(new URL('../js/'+name+'.js',import.meta.url),'utf8'));
  let verifiedReads=0,genericReads=0;
  const venue={id:'geoapify-test',name:'Restaurant de test',category:'restaurant',city:'Gap',address:'Adresse de test',lat:44.56,lon:6.08,website:'https://example.org/',website_verified:true};
  w.OrevamiRestaurantInformation={load:async()=>{verifiedReads++;return {status:'available',website:'https://example.org/',website_verified:true,opening_hours:[{heading:'Horaires publiés',text:'Lundi 12 h–14 h'}],prices:[{text:'Tarif publié de test'}],booking_links:[],menus:[],sources:[]};}};
  w.fetch=async url=>{if(String(url).includes('mode=analyse-venue')){genericReads++;return {ok:true,json:async()=>({name:'Réponse partielle',website:'https://example.org/',opening_hours:[],prices:[],sources:[]})};}return {ok:true,json:async()=>({results:[venue]})};};
  const picker=w.OrevamiActivitiesWidgets.venueFinder({form});form.prepend(picker.element);
  picker.element.querySelector('input[type=search]').value='Restaurant';picker.element.querySelector('.act-venue-query button').click();await new Promise(r=>setTimeout(r,0));
  picker.element.querySelector('.act-place-open').click();await new Promise(r=>setTimeout(r,0));
  assert.equal(genericReads,0,'generic analysis must not overwrite the restaurant reader');
  assert.equal(verifiedReads,1,'the existing verified reader must handle restaurant enrichment');
  const dialog=picker.element.querySelector('dialog');assert.ok(dialog.open);assert.ok(dialog.querySelector('a[href="https://example.org/"]'));assert.match(dialog.textContent,/Lundi 12 h–14 h/);assert.match(dialog.textContent,/Tarif publié de test/);
  dialog.querySelector('.act-place-footer button').click();assert.equal(dialog.open,false);assert.equal(form.elements.venue.value,venue.name);assert.equal(picker.snapshot.website,venue.website);assert.match(picker.snapshot.opening_hours,/Lundi 12 h–14 h/);picker.destroy();
 }finally{d.window.close();}
});
