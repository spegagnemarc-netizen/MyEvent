import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {pdfBlocks,createRentalPDF} from '../js/rental-pdf.mjs';import {prefillRental,renderRental} from '../js/rental-documents.mjs';
const library=createRequire(import.meta.url)('../js/vendor/pdf-lib-1.17.1.min.js');
export const example={...prefillRental({id:'EXEMPLE-FICTIF',title:'Enceinte portable',description:'Enceinte, housse, chargeur',price_cents:3500,city:'Lyon',condition:'good'}),owner:'Propriétaire fictif',ownerAddress:'Adresse fictive à Lyon',renter:'Locataire fictif',renterAddress:'Adresse fictive à Paris',start:'2026-10-20T10:00',end:'2026-10-22T10:00',total:'70',deposit:'100',depositMode:'Chèque non encaissé',returnBy:'2026-10-25',place:'Lyon',signedAt:'2026-10-20',outAt:'2026-10-20T10:00',outState:'Vérifié ensemble : bon fonctionnement, accessoires présents.',observations:'EXEMPLE FICTIF — document de contrôle uniquement.'};
test('all three PDFs reopen as A4 documents and preserve French text and paper signature blocks',async()=>{
 for(const kind of ['contract','receipt','inventory']){const blocks=pdfBlocks(renderRental(example,kind));assert.ok(blocks.some(b=>b.text.includes('Propriétaire fictif')));assert.ok(blocks.filter(b=>b.style==='signature').length>1);const bytes=await createRentalPDF(blocks,library),read=await library.PDFDocument.load(bytes);assert.ok(read.getPageCount()>0);assert.equal(read.getPage(0).getWidth(),595.28);assert.match(read.getTitle(),/location|garantie|matériel/);}
});
test('long text paginates and unrepresentable characters are rejected without silently modifying identities',async()=>{
 const bytes=await createRentalPDF([{text:'Observations '.repeat(3000),style:'body'}],library);assert.ok((await library.PDFDocument.load(bytes)).getPageCount()>2);
 await assert.rejects(createRentalPDF([{text:'租赁',style:'body'}],library),/caractère/);
});
