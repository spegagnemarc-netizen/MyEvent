import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=readFileSync(new URL('../js/hall-finances-runtime.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('// Restored from'),source.indexOf('async function addSelectedAiMaterials'));
function setup({response={ok:true,json:async()=>({items:[{title:'Assiettes',quantity:30,note:'Buffet'}]})},session=true,hanging=false}={}){
 const nodes=Object.fromEntries(['materialAiGenerateBtn','materialAiPeople','materialAiMeal','materialAiDetails','materialAiResults','materialAiMsg'].map(id=>[id,{value:'',innerHTML:'',disabled:false}]));
 Object.assign(nodes.materialAiPeople,{value:'30'});nodes.materialAiMeal.value='Buffet dînatoire';nodes.materialAiDetails.value='En salle';
 let timer,request,calls=0;
 const c=vm.createContext({event:{id:'test-event',name:'Démo fictive'},user:{id:'test-user'},$:id=>nodes[id],hallSelected:()=>null,esc:s=>String(s),msg:(id,text)=>nodes[id].textContent=text,AbortController,TypeError,console,
 setTimeout:fn=>{timer=fn;return 1;},clearTimeout:()=>{},sb:{auth:{getSession:async()=>session?{data:{session:{access_token:'test-only'}}}:{data:{session:null}}}},fetch:async(url,options)=>{calls++;request=JSON.parse(options.body);return hanging?new Promise(()=>{}):response;}});
 vm.runInContext(code,c);return {c,nodes,run:()=>vm.runInContext('generateMaterialAi()',c),expire:()=>timer(),request:()=>request,calls:()=>calls};
}
test('restored context reaches API and renders buffet list for 30 indoors',async()=>{const x=setup();await x.run();assert.equal(x.calls(),1);assert.deepEqual(x.request(),{event_name:'Démo fictive',event_type:'',people:30,meal:'Buffet dînatoire',details:'En salle',hall:null});assert.match(x.nodes.materialAiResults.innerHTML,/Assiettes/);assert.equal(x.nodes.materialAiGenerateBtn.disabled,false);});
test('HTTP failure exits loading and displays explicit error',async()=>{const x=setup({response:{ok:false,status:429,json:async()=>({})}});await x.run();assert.match(x.nodes.materialAiMsg.textContent,/limité/);assert.equal(x.nodes.materialAiGenerateBtn.disabled,false);});
test('stalled network exits loading at deadline',async()=>{const x=setup({hanging:true});const pending=x.run();await Promise.resolve();x.expire();await pending;assert.match(x.nodes.materialAiMsg.textContent,/trop de temps/);assert.equal(x.nodes.materialAiGenerateBtn.disabled,false);});
test('expired session does not call provider',async()=>{const x=setup({session:false});await x.run();assert.equal(x.calls(),0);assert.match(x.nodes.materialAiMsg.textContent,/session a expiré/);});
test('late response never writes results into another event',async()=>{let done;const x=setup({response:{ok:true,json:()=>new Promise(r=>done=r)}});const p=x.run();while(!done)await Promise.resolve();x.c.event={id:'other-event'};done({items:[{title:'Assiettes',quantity:30}]});await p;assert.equal(x.nodes.materialAiResults.innerHTML,'');});
