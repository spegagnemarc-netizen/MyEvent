import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
test('API dispatch loads ESM handler from CommonJS without crashing',async()=>{
 const temp=new URL('../api/.tasks-ai-runtime-check.cjs',import.meta.url);
 const source=readFileSync(new URL('../api/generate-materials.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/^import /m);writeFileSync(temp,source.replace('export default async function handler','module.exports = async function handler'));
 try{const handler=createRequire(import.meta.url)(temp.pathname);const res={status(code){this.code=code;return this;},json(body){this.body=body;return this;}};await handler({method:'POST',headers:{},body:{mode:'tasks'}},res);assert.equal(res.code,401);assert.match(res.body.error,/Reconnecte/);}finally{unlinkSync(temp);}
});
const source=readFileSync(new URL('../js/tasks-runtime.js',import.meta.url),'utf8');
function setup(response){let expire;const box={innerHTML:''},summary={textContent:''};let renders=0;const c=vm.createContext({event:{id:'test-event',creator_id:'test-owner'},user:{id:'test-user'},$:id=>id==='eventTasksList'?box:summary,esc:String,msg(){},renderEventTasks(){renders++;box.innerHTML='loaded';},startEventTasksRealtime(){},AbortController,setTimeout:fn=>{expire=fn;return 1;},clearTimeout(){},sb:{from(){const q={select(){return q;},eq(){return q;},order(){return q;},in(){return q;},abortSignal(){return response;}};return q;}}});vm.runInContext(source.slice(0,source.indexOf('function taskIsManager'))+source.slice(source.indexOf("let eventTasksScope="),source.indexOf('function renderEventTasks')),c);return{c,box,run:()=>vm.runInContext('loadEventTasks()',c),expire:()=>expire(),renders:()=>renders};}
test('stalled task reads leave loading with explicit retry',async()=>{const x=setup(new Promise(()=>{}));const p=x.run();x.expire();await p;assert.match(x.box.innerHTML,/trop de temps/);assert.match(x.box.innerHTML,/Réessayer/);});
test('database error leaves loading',async()=>{const x=setup(Promise.resolve({error:{message:'fixture'}}));await x.run();assert.match(x.box.innerHTML,/Impossible de charger/);});
test('late task reads cannot replace a different event',async()=>{let done;const x=setup(new Promise(r=>done=r));const p=x.run();x.c.event={id:'other-event'};done({data:[]});await p;assert.equal(x.renders(),0);});
test('opening the tasks workspace actually starts its loader',()=>{
 const workspace=readFileSync(new URL('../js/events-workspace.js',import.meta.url),'utf8');
 const start=workspace.indexOf(' async function openTool(key){');const end=workspace.indexOf('\n }',start)+3;
 const node=()=>({classList:{add(){},remove(){}},appendChild(){}}),panel={...node(),dataset:{panel:'tasks'}},body=node();let loads=0;
 const c=vm.createContext({context:()=>({event:{id:'test'}}),nav:{},showScreen(){},document:{createElement:node},body,panels:new Map([['tasks',panel]]),bridge:{tab(){}},loadEventTasks(){loads++;}});
 vm.runInContext(workspace.slice(start,end)+';openTool("tasks");',c);
 assert.equal(loads,1);assert.equal(panel.open,true);
});
