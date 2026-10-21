import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{analyseVenue,extractHTML}=require('../lib/venue-analysis');
test('automatic sheet keeps package context, integer euros, JSON-LD opening hours and phone booking separate from availability',async()=>{
 const html=`<html><head><script type="application/ld+json">{"@type":"BowlingAlley","name":"Bowling exemple","telephone":"+33400000000","openingHoursSpecification":[{"dayOfWeek":"https://schema.org/Saturday","opens":"10:00","closes":"22:00"}],"offers":{"@type":"Offer","name":"Formule famille","price":25,"priceCurrency":"EUR"}}</script></head><body><main><h1>Bowling exemple</h1><h2>Tarifs</h2><div><h3>Une partie</h3><p>10 € par personne</p></div><h3>Deux parties</h3><p>17 € par personne</p><a href="tel:+33400000000">Réserver</a></main></body></html>`;
 const r=await analyseVenue('https://example.org/',{reader:async(url,{kind})=>({url,body:Buffer.from(kind==='robots'?'':html)})});
 assert.ok(r.prices.some(p=>/Une partie.*10 €/.test(p.text)));assert.ok(r.prices.some(p=>/Deux parties.*17 €/.test(p.text)));assert.ok(r.prices.some(p=>/Formule famille.*25 €/.test(p.text)));assert.match(r.opening_hours[0].text,/Saturday.*10:00.*22:00/);assert.equal(r.booking_method,'phone');assert.equal(r.availability.status,'not_provided');assert.equal(r.requires_confirmation,false);assert.equal(r.storage,'draft_only');assert.equal(r.address,null);
});
test('JSON-LD schema support covers restaurant and museum without fabricating offers or slots',()=>{
 for(const type of ['Restaurant','Museum']){const p=extractHTML(`<html><head><script type="application/ld+json">{"@type":"${type}","name":"Lieu exemple","description":"Description publique"}</script></head><body><main><h1>Autre titre</h1></main></body></html>`,'https://example.org/');assert.equal(p.name,'Lieu exemple');assert.equal(p.description,'Description publique');assert.equal(p.tariffText.length,0);assert.equal(p.activity_hours.length,0);}
});
