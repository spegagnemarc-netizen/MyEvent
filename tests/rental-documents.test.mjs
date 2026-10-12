import test from 'node:test';
import assert from 'node:assert/strict';
import {prefillRental,validateRental,renderRental} from '../js/rental-documents.mjs';
const item={id:'one',title:'Enceinte',description:'Housse incluse',city:'Lyon',price_cents:3500,condition:'good'};
const complete={...prefillRental(item),owner:'Loueur',ownerAddress:'Lyon',renter:'Locataire',renterAddress:'Paris',start:'2026-10-20T10:00',end:'2026-10-22T10:00',total:'70',place:'Lyon',signedAt:'2026-10-20'};
test('prefill copies public equipment facts but never invents identity, dates, deposit or total',()=>{
 const d=prefillRental(item);assert.equal(d.daily,'35.00');assert.match(d.equipment,/Housse incluse/);for(const key of ['owner','renter','start','total','deposit','received'])assert.equal(d[key],'');assert.equal(item.title,'Enceinte');
});
test('validation rejects missing parties, reversed dates and invalid amounts',()=>{
 assert.equal(validateRental(complete,'contract').length,0);
 for(const changes of [{owner:''},{end:complete.start},{total:'-1'},{total:'NaN'}])assert.ok(validateRental({...complete,...changes},'contract').length);
 assert.ok(validateRental({...complete,ownerStatus:'Professionnel'},'contract').length);
});
test('receipt never asserts receipt of funds without explicit paper confirmation and details',()=>{
 const d={...complete,deposit:'100',depositMode:'Chèque non encaissé',returnBy:'2026-10-25',returnTerms:'Retour direct après constat'};
 assert.equal(validateRental(d,'receipt').length,0);assert.match(renderRental(d,'receipt'),/aucune remise de fonds n’est attestée/);
 assert.ok(validateRental({...d,receiptStatus:'Confirmée par le propriétaire sur papier'},'receipt').length);
 const signed={...d,receiptStatus:'Confirmée par le propriétaire sur papier',received:'100',receivedAt:'2026-10-20T10:00'};
 assert.equal(validateRental(signed,'receipt').length,0);assert.match(renderRental(signed,'receipt'),/ne constitue pas un encaissement/);
 assert.ok(validateRental({...signed,received:'101'},'receipt').length);
});
test('inventory separates departure and return signatures, with no automatic return acceptance',()=>{
 const d={...complete,outAt:complete.start,outState:'Test fonctionnel ensemble'};
 assert.equal(validateRental(d,'inventory').length,0);const html=renderRental(d,'inventory');assert.match(html,/Départ — signature/);assert.match(html,/Retour — signature/);assert.match(html,/ne vaut pas acceptation/);
 assert.ok(validateRental({...d,backAt:'2026-10-19T09:00'},'inventory').length);
});
test('untrusted listing and user text is escaped in all printable documents',()=>{
 for(const kind of ['contract','receipt','inventory']){const html=renderRental({...complete,equipment:'<script>alert(1)</script>',owner:'<img onerror=evil>'},kind);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.match(html,/&lt;script&gt;/);assert.match(html,/deux originaux/);assert.match(html,/@page/);}
});
