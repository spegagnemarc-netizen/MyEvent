import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const core=await readFile(new URL('../js/core-runtime.js',import.meta.url),'utf8');
const recovery=core.slice(core.indexOf('function showPasswordRecovery()'),core.indexOf('async function signup()'));
function fixture(){
 const nodes=new Map();const calls=[];
 const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'',classList:{add(){},remove(){}},checkValidity:()=>true});return nodes.get(id);};
 const scope={$ ,URL,URLSearchParams,location:{origin:'https://demo.orevami.test',pathname:'/index.html',replace:url=>calls.push(['redirect',url])},msg:()=>{},setBusy:()=>{},sb:{auth:{resetPasswordForEmail:async(...args)=>{calls.push(['recovery',...args]);return{};},getSession:async()=>({data:{session:{}}}),updateUser:async()=>{calls.push(['update']);return{};},signOut:async()=>calls.push(['signout'])}}};
 vm.createContext(scope);vm.runInContext(recovery,scope);return{scope,$,calls};
}
test('recovery uses current origin and sends no password',async()=>{
 const {scope,$,calls}=fixture();$('email').value='demo@local.invalid';await scope.requestPasswordRecovery();
 assert.equal(calls[0][1],'demo@local.invalid');assert.equal(calls[0][2].redirectTo,'https://demo.orevami.test/index.html?auth=recovery');
});
test('mismatched recovery passwords never update the user',async()=>{
 const {scope,$,calls}=fixture();$('recoveryPassword').value='fixture-password';$('recoveryPasswordConfirm').value='different';await scope.saveRecoveredPassword({preventDefault(){}});assert.equal(calls.length,0);
});
test('successful recovery signs out and removes recovery parameters',async()=>{
 const {scope,$,calls}=fixture();$('recoveryPassword').value='fixture-password';$('recoveryPasswordConfirm').value='fixture-password';await scope.saveRecoveredPassword({preventDefault(){}});assert.deepEqual(calls,[['update'],['signout'],['redirect','/index.html#home']]);assert.equal($('recoveryPassword').value,'');
});
test('AI reservation dependencies are loaded before their extension',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');assert(html.indexOf('src="js/ai-runtime.js"')<html.indexOf('src="js/sorties-reservations-runtime.js'));
});
test('a refused event deletion never removes its Storage files',async()=>{
 const start=core.indexOf('async function deleteEvent(id)');
 const source=core.slice(start,core.indexOf('async function leaveEvent',start));
 const calls=[];
 const scope={user:{id:'synthetic-owner'},document:{querySelector:()=>null},confirm:()=>true,global:()=>{},sb:{from:()=>({select:()=>({eq:async()=>({data:[{storage_path:'fixture/file.jpg'}]})})}),rpc:async()=>({error:{message:'Denied'}}),storage:{from:()=>({remove:async()=>calls.push('removed')})}}};
 vm.createContext(scope);vm.runInContext(source,scope);await scope.deleteEvent('synthetic-event');assert.equal(calls.length,0);
});
