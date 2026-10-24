const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),card=require('../js/place-card');
test('missing and unverified URLs stay hidden; verified URL survives missing hours/menu',()=>{
 const window={};vm.runInNewContext(fs.readFileSync('js/restaurant-information.js','utf8'),{window,document:{readyState:'complete',getElementById:()=>null,addEventListener:()=>{}},URL,AbortController,setTimeout,clearTimeout,Map,Date});
 assert.equal(card.websiteAllowed({}),false);assert.equal(card.websiteAllowed({website:'https://example.org'}),false);
 const venue={name:'Restaurant',website:'https://example.org'};const enriched=window.OrevamiRestaurantInformation.applyInformation(venue,{status:'unavailable',website:'https://example.org',website_verified:true});assert.equal(card.websiteAllowed(enriched),true);assert.match(card.restaurantMiniature({...enriched,type:'restaurant'}),/data-restaurant-website/);
});
test('third visible restaurant is queued for validation instead of bypassing it',async()=>{
 let active=0,peak=0,discovery=0,validation=0;const window={MyEventPlaceCard:card};const fetch=async(url)=>{if(url.includes('restaurant-discovery')){discovery++;peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,2));active--;return {ok:true,json:async()=>({photos:[],sources:[]})};}validation++;return {ok:true,json:async()=>({status:'unavailable',website_verified:true,photos:[],sources:[]})};};
 vm.runInNewContext(fs.readFileSync('js/restaurant-information.js','utf8'),{window,document:{readyState:'complete',getElementById:()=>null,addEventListener:()=>{}},fetch,URL,AbortController,setTimeout,clearTimeout,Map,Date});
 const rows=await Promise.all([1,2,3].map(i=>window.OrevamiRestaurantInformation.enrich({name:'Restaurant '+i,lat:44.56,lon:6.08,city:'Gap',address:i+' rue Exemple',website:'https://example.org/'+i})));assert.equal(discovery,3);assert.equal(validation,3);assert.equal(peak,2);assert.ok(rows.every(x=>x.website_verified));
});
