import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const runtime=readFileSync(new URL('../js/theme-runtime.js',import.meta.url),'utf8');
test('Profile accent persists per user and is restored on standalone pages',()=>{
 const dom=new JSDOM('<div id="myeventAppearanceCard"><input type="color" data-theme="accent"></div>',{url:'https://myevent.test/',runScripts:'outside-only'}),w=dom.window;
 w.setInterval=()=>0;w.eval(runtime);w.myeventThemeSetUser('unit-user-a');
 const input=w.document.querySelector('input');input.value='#21c789';input.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.equal(w.document.documentElement.style.getPropertyValue('--myevent-accent'),'#21c789');
 assert.equal(w.document.documentElement.style.getPropertyValue('--myevent-accent-rgb'),'33,199,137');
 const saved=w.localStorage.getItem('myevent.theme.unit-user-a');
 w.myeventThemeSetUser('unit-user-b');assert.equal(w.document.documentElement.style.getPropertyValue('--myevent-accent'),'#ff6a34');
 w.myeventThemeSetUser('unit-user-a');assert.equal(input.value,'#21c789');
 const market=new JSDOM('',{url:'https://myevent.test/marketplace.html',runScripts:'outside-only'});
 market.window.setInterval=()=>0;market.window.localStorage.setItem('myevent.theme.unit-user-a',saved);market.window.eval(runtime);market.window.myeventThemeSetUser('unit-user-a');
 assert.equal(market.window.document.documentElement.style.getPropertyValue('--myevent-accent'),'#21c789');
 market.window.close();w.close();
});
