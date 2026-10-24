const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
test('generic restaurant V2 preserves actions, safe photos and source facts',async()=>{
 const d=new JSDOM('<main/>',{url:'https://preview.invalid',runScripts:'outside-only'});
 try{const w=d.window;for(const script of ['activities-core','activity-venue-sheet'])w.eval(fs.readFileSync('js/'+script+'.js','utf8'));
 const sheet=w.OrevamiVenueSheet.create({host:w.document.querySelector('main'),onAdd:()=>{}});
 await sheet.open({name:'Restaurant réel',category:'restaurant',lat:44.56,lon:6.08,distance:2,phone:'0492000000',website:'https://example.org',booking_url:'https://example.org/contact',image:'https://maps.google.com/photo',menu_url:'https://example.org/menu'},{load:false});
 assert.ok(sheet.element.classList.contains('restaurant-v2'));assert.equal(sheet.element.querySelectorAll('img').length,0);
 for(const text of ['Ajouter à l’événement','Partager','Appeler','Voir sur la carte','Aucun avis ORÉVAMI','2 km'])assert.ok(sheet.element.textContent.includes(text),text);
 for(const name of ['Informations','Menus','Horaires','Avis'])assert.ok(sheet.element.querySelector('[data-section="'+name+'"]'));
 await sheet.open({name:'Salle',category:'stadium'},{load:false});assert.equal(sheet.element.classList.contains('restaurant-v2'),false);sheet.destroy();
 }finally{d.window.close();}
});
