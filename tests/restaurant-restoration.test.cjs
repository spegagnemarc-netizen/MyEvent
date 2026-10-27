const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const {JSDOM}=require('jsdom');
const base='3c1e014557cddf032d1cddab06a4b390a4e49649';
const read=p=>fs.readFileSync(p,'utf8').replaceAll('\r\n','\n'),original=p=>cp.execFileSync('git',['show',base+':'+p],{encoding:'utf8'}).replaceAll('\r\n','\n');
test('targeted restoration: 20 sourced restaurants, V3 → V2 → accordion, preserved searches and 12 functions; no providers',async()=>{
 const oldFetch=global.fetch;global.fetch=()=>{throw Error('External network forbidden');};
 const dom=new JSDOM('<div id="outingResults"></div><div id="outingMsg"></div><input id="outingMaxBudget" value="0">',{url:'https://preview.invalid',runScripts:'outside-only'});
 try{
 const catalog=require('../data/restaurant-catalog-gap.json');assert.equal(catalog.length,20);
 assert.equal(read('data/restaurant-catalog-gap.json'),cp.execFileSync('git',['show','213c203:data/restaurant-catalog-gap.json'],{encoding:'utf8'}));
 const features=catalog.map((r,i)=>({properties:{place_id:String(i),name:r.name,city:r.city,formatted:r.address,lat:r.coordinates?.[0]??44.55907,lon:r.coordinates?.[1]??6.07967}}));
 let providerMocks=0;const {results}=await require('../lib/geoapify-restaurants').searchRestaurants({lat:44.55907,lon:6.07967,radius:20},{key:'fixture',fetchImpl:async()=>{providerMocks++;return {ok:true,json:async()=>({features})};}});
 assert.equal(providerMocks,1);assert.equal(results.length,20);assert.equal(results.filter(r=>r.restaurant_catalog).length,20);
 const w=dom.window;w.fetch=async(url,options={})=>{assert.ok(String(url).startsWith('/api/integration-venues?'),'Only mocked same-origin information requests allowed');const v=JSON.parse(options.body||'{}');const p=results.find(p=>p.name===v.name)||results[0];const info=p.restaurant_catalog.information;return {ok:true,json:async()=>String(url).includes('restaurant-discovery')?{website:info.website,website_verified:true,information:info,photos:[],sources:info.sources}:{...info,website_verified:true}};};
 w.HTMLElement.prototype.scrollIntoView=function(){};
 for(const name of ['activities-core','place-card','restaurant-venue-sheet','restaurant-information'])w.eval(read('js/'+name+'.js'));
 const runtime=read('js/sorties-reservations-runtime.js'),start=runtime.indexOf('function renderOutingResults(){'),end=runtime.indexOf('function renderSelectedOutingBox',start);
 const p=results.find(p=>p.name==='Le Pasturier');
 w.eval('const $=id=>document.getElementById(id);const outingResultsData='+JSON.stringify([p,{id:'activity-fixture',type:'museum',source:'openstreetmap',name:'Musée fictif',lat:44.56,lon:6.08,distance:1}])+';let outingFilter="all",outingSearch="";const outingCategory=t=>t==="restaurant"?"restaurant":"culture",isSelectedOuting=()=>false,esc=s=>String(s);'+runtime.slice(start,end)+';renderOutingResults();');
 const mini=w.document.querySelector('.restaurantMini');assert.ok(mini);assert.ok(mini.querySelector('[data-outing-select]'));assert.ok(mini.querySelector('[data-outing-map]'));assert.match(w.document.querySelector('#outingResults').textContent,/Musée fictif/);
 mini.querySelector('.restaurantMiniOpenButton').click();await new Promise(r=>setTimeout(r,40));
 const sheet=w.document.querySelector('dialog.restaurant-v2');assert.ok(sheet?.open);assert.match(sheet.textContent,/Le Pasturier/);assert.ok(sheet.querySelector('[data-section="Menus"]'));assert.ok(sheet.querySelector('[data-section="Horaires"]'));
 const accordion=sheet.querySelector('[data-restaurant-accordion]');assert.ok(accordion);assert.match(accordion.querySelector('summary').textContent,/Horaires, menus et réservation/);accordion.open=true;accordion.dispatchEvent(new w.Event('toggle'));await new Promise(r=>setTimeout(r,20));
 assert.equal(accordion.dataset.loaded,'true');assert.match(accordion.textContent,/27/);assert.ok(accordion.querySelector('a[href*="carte-tradtionnelle"]'));assert.ok(accordion.querySelector('a[href*="contact-et-reservation"]'));
 // Every existing search/filter/reservation line is retained, apart from the single restaurant-render branch.
 const added="    if(outingCategory(p.type)==='restaurant'&&p.source!=='viator'&&window.MyEventPlaceCard?.restaurantMiniature)return window.MyEventPlaceCard.restaurantMiniature(p,{selected});\n";
 assert.equal(runtime.replaceAll('\r\n','\n').replace(added,'').replace("    if(cat==='restaurant'&&window.MyEventPlaceCard.matchesRestaurant)return okCat&&window.MyEventPlaceCard.matchesRestaurant(p,q,max);\n",'').replace("arr.filter((p,index)=>index<30||outingCategory(p.type)==='restaurant')",'arr.slice(0,30)'),original('js/sorties-reservations-runtime.js'));
 for(const path of ['api/search-halls.js','js/activity-venue-sheet.js','js/orevami-restaurants.js','server/orevami-restaurants.js','api/[search].js','api/create-payment-session.js','api/stripe-webhook.js'])assert.equal(read(path).replaceAll('\r\n','\n'),original(path),path+' preserved');
 const apis=fs.readdirSync('api').filter(p=>p.endsWith('.js'));assert.equal(apis.length,12);assert.deepEqual(apis.sort(),cp.execFileSync('git',['ls-tree','--name-only',base+':api'],{encoding:'utf8'}).trim().split('\n').filter(p=>p.endsWith('.js')).sort());
 const config=JSON.parse(read('vercel.json'));assert.equal(config.git.deploymentEnabled['fix/restaurant-v2-v3-restore-20261026'],false);assert.ok(config.routes.find(r=>r.dest==='/api/search-places?restaurant_information=1'));
 const html=read('index.html');for(const asset of ['restaurant-information.js','restaurant-venue-sheet.js','restaurant-restoration.css'])assert.ok(html.includes(asset));
 console.log('20/20 catalog matches; V3→V2→accordion passed; current searches/reservations unchanged; 12/12 function entry points; zero real provider requests.');
 }finally{dom.window.close();global.fetch=oldFetch;}
});
