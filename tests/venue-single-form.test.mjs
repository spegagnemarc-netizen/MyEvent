import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
test('pasted URL analyses once; one add preserves absent values and edits use the original controls',async()=>{
 const d=new JSDOM('<main class="activities"><form><label>Lieu<input name="venue"></label><label>Adresse<input name="address" value="Rendez-vous fictif"></label><label>Ville<input name="city" value="Gap"></label><label>Latitude<input name="latitude" value="44.56"></label><label>Longitude<input name="longitude" value="6.08"></label><input name="title" value="Sortie patinoire fictive"></form></main>',{url:'https://preview.invalid',runScripts:'outside-only'});
 try{for(const n of ['activities-core','venue-analysis-review','activity-venue-sheet','activities-widgets'])d.window.eval(await readFile(new URL('../js/'+n+'.js',import.meta.url),'utf8'));
 const form=d.window.document.querySelector('form'),original=form.elements.address,w=d.window.OrevamiActivitiesWidgets.venueFinder({form});let calls=0;
 d.window.fetch=async()=>{calls++;return {ok:true,json:async()=>({name:'Alp’Arena fictive',website:'https://example.org/',sources:[],opening_hours:[],activity_hours:[],prices:[],warnings:[]})};};
 const timer=d.window.setTimeout.bind(d.window);d.window.setTimeout=(fn,ms)=>timer(fn,ms===650?5:ms);
 form.elements.venue_link.value='https://example.org/';form.elements.venue_link.dispatchEvent(new d.window.Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,30));assert.equal(calls,1);
 const dialog=w.element.querySelector('dialog');assert.equal(dialog.querySelector('.act-place-footer button').disabled,false);dialog.querySelector('.act-place-footer button').click();
 assert.equal(form.elements.address,original);assert.equal(form.querySelectorAll('[name=address]').length,1);assert.equal(original.value,'Rendez-vous fictif');assert.equal(form.elements.latitude.value,'44.56');assert.equal(form.elements.title.value,'Sortie patinoire fictive');assert.equal(form.elements.venue.value,'Alp’Arena fictive');
 original.value='Point fictif corrigé';original.dispatchEvent(new d.window.Event('input',{bubbles:true}));assert.equal(w.selected.address,'Point fictif corrigé');assert.match(w.element.querySelector('.act-venue-selection').textContent,/Point fictif corrigé/);w.destroy();
 }finally{d.window.close();}
});
