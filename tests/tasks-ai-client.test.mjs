import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
class Element{constructor(){this.children=[];this.value='';this.classList={add(){},remove(){},toggle(){}};}replaceChildren(...nodes){this.children=nodes;}append(...nodes){this.children.push(...nodes);}setAttribute(){}addEventListener(type,fn){this['on'+type]=fn;}}
function setup(){
 const ids=['tasksAiBox','tasksAiForm','tasksAiMsg','tasksAiResults','tasksAiGenerateBtn','tasksAiOpenBtn','tasksAiCancelBtn','tasksAiPeople','tasksAiMeal','tasksAiDetails'];const nodes=Object.fromEntries(ids.map(id=>[id,new Element()]));nodes.tasksAiPeople.value='30';nodes.tasksAiMeal.value='Buffet dînatoire';nodes.tasksAiDetails.value='En salle';
 let request,rows,rendered=0;const query={select(){return this;},eq(){return this;},abortSignal:async()=>({data:rows?rows.map((x,i)=>({...x,id:x.id})):[],error:null}),insert(value){rows=value;return this;}};
 const c=vm.createContext({document:{getElementById:id=>nodes[id],createElement:()=>new Element()},event:{id:'event-test',name:'Démo fictive'},user:{id:'user-test'},eventTasks:[],renderEventTasks:()=>rendered++,AbortController,TypeError,setTimeout,clearTimeout,crypto:{randomUUID:()=> 'b5f59f95-b38e-48ef-855c-d4dd12b15988'},sb:{auth:{getSession:async()=>({data:{session:{access_token:'fixture'}}})},from:()=>query},fetch:async(url,opt)=>{request=JSON.parse(opt.body);return{ok:true,json:async()=>({items:[{title:'Installer les tables',note:'En salle'}]})};}});
 vm.runInContext(readFileSync(new URL('../js/tasks-ai.js',import.meta.url),'utf8'),c);return{c,nodes,generate:()=>nodes.tasksAiGenerateBtn.onclick(),rows:()=>rows,request:()=>request,rendered:()=>rendered};
}
test('context and draft display require no database write',async()=>{const x=setup();await x.generate();assert.equal(x.request().mode,'tasks');assert.equal(x.request().people,30);assert.equal(x.rows(),undefined);assert.match(x.nodes.tasksAiMsg.textContent,/1 tâches proposées/);});
test('explicit selection saves existing task schema without assigning people or dates',async()=>{const x=setup();await x.generate();await x.nodes.tasksAiResults.children.at(-1).onclick();assert.equal(x.rows().length,1);assert.equal(x.rows()[0].event_id,'event-test');assert.equal(x.rows()[0].created_by,'user-test');assert.equal(x.rows()[0].status,'todo');assert.equal(x.rows()[0].due_at,null);assert.equal(x.rows()[0].assigned_user_id,undefined);assert.equal(x.rendered(),1);});
test('switching event prevents saving an old draft',async()=>{const x=setup();await x.generate();x.c.event={id:'another-event'};await x.nodes.tasksAiResults.children.at(-1).onclick();assert.equal(x.rows(),undefined);assert.match(x.nodes.tasksAiMsg.textContent,/changé/);});
