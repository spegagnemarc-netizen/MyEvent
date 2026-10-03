import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/core-runtime.js',import.meta.url),'utf8');
const section=source.slice(source.indexOf('function renderEventLoadError('),source.indexOf('let inlineEventRenderToken'));
function setup(results){
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'Chargement…',classList:{add(){},remove(){}},replaceChildren(p){this.textContent=p.textContent;this.innerHTML='';}});return nodes.get(id);};
 const calls=[];const context=vm.createContext({user:null,event:null,activeEventRole:'member',currentReservation:null,window:{},$:node,global(message){node('globalmsg').textContent=message;},document:{createElement(){return {setAttribute(){}};},querySelectorAll(){return [];},addEventListener(){}},sb:{from(table){calls.push(table);const result=results.shift();return {select(){return this;},eq(){return this;},order(){return Promise.resolve(result);},maybeSingle(){return Promise.resolve(result);},then(resolve,reject){return Promise.resolve(result).then(resolve,reject);}};}}});
 vm.runInContext(section,context);return {context,node,calls};
}
test('profile failure ends loading before event queries',async()=>{const {context,node,calls}=setup([{error:{message:"Could not find the table 'public.profiles' in the schema cache"}}]);await context.show({id:'fictional-b'});assert.match(node('eventList').textContent,/Impossible de charger.*Profil.*public.profiles/);assert.deepEqual(calls,['profiles']);});
test('event failure remains rejected and visible',async()=>{const {context,node}=setup([{error:{message:'events missing'}}]);context.user={id:'fictional-b'};await assert.rejects(context.loadEvents(),/Événements : events missing/);assert.match(node('eventList').textContent,/events missing/);});
test('membership failure remains rejected and visible',async()=>{const {context,node}=setup([{data:[]},{error:{message:'membership denied'}}]);context.user={id:'fictional-b'};await assert.rejects(context.loadEvents(),/Groupes : membership denied/);assert.match(node('eventList').textContent,/membership denied/);});
test('empty accessible list succeeds',async()=>{const {context,node}=setup([{data:[]},{data:[]}]);context.user={id:'fictional-b'};assert.equal((await context.loadEvents()).length,0);assert.match(node('eventList').innerHTML,/Aucun groupe/);});
test('error markup remains text',()=>{const {context,node}=setup([]);context.renderEventLoadError({message:'<img src=x onerror=alert(1)>'});assert.match(node('eventList').textContent,/<img/);assert.equal(node('eventList').innerHTML,'');});
