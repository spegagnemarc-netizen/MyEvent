import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/core-runtime.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('async function loadEventLocations('),source.indexOf("document.addEventListener('change',e=>{if(e.target?.id==='locationShareMode')"));
function fixture(geocode){
 const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{style:{},hidden:false,removeAttribute(){},textContent:''});return nodes.get(id);};
 const c={event:{id:'one',location:'44.55, 6.08'},user:{id:'test'},$,locationEventCoords:null,locationEventMarker:null,locationMap:{removeLayer(){},invalidateSize(){}},locationPlacesData:[],initLocationMap(){},geocodeEventLocation:geocode,renderLocationSearchCenter(){},getStoredActivitySearchCenter(){},makeLocationIcon(){},esc:s=>s,setTimeout:fn=>fn(),window:{},loadSharedMemberLocations:()=>{throw Error('Unneeded member read');},L:{marker:()=>({addTo(){return this;},bindPopup(){return this;}})}};
 vm.createContext(c);vm.runInContext(code,c);return c;
}
test('Navigation uses main event coordinates and finishes without nearby searches',async()=>{
 const c=fixture(async()=>({lat:44.55,lon:6.08,address:'Gap'}));await c.loadEventLocations({nearby:false});
 assert.equal(c.$('locNavigateBtn').href,'https://www.google.com/maps/dir/?api=1&destination=44.55%2C6.08');assert.equal(c.$('locationMapLoading').style.display,'none');
});
test('Late geocode is ignored; map failure ends loading with an explicit message',async()=>{
 let resolve;const c=fixture(()=>new Promise(r=>resolve=r));const pending=c.loadEventLocations({nearby:false});c.event={id:'two',location:'Paris'};resolve({lat:44.55,lon:6.08});await pending;assert.equal(c.locationEventCoords,null);
 c.geocodeEventLocation=async()=>{throw Error('network');};await c.loadEventLocations({nearby:false});assert.match(c.$('locationMsg').textContent,/indisponible/);assert.equal(c.$('locationMapLoading').style.display,'none');
});
