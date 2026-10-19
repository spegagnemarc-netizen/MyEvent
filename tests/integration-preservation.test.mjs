import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url),manifest=JSON.parse(await readFile(new URL('docs/integration/production-preservation.json',root),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
test('all 348 protected Production files remain identical, including games, feed, event loading and SQL',async()=>{
 const differences=[];for(const item of manifest.files){try{const data=await readFile(new URL(item.file,root));if(hash(data)!==item.sha256&&hash(Buffer.from(data.toString('utf8').replaceAll('\r\n','\n')))!==item.sha256)differences.push(item.file);}catch{differences.push(item.file+' missing');}}assert.deepEqual(differences,[]);
});
test('Production HTML and routes are retained and dependency scripts/Stripe are preserved',async()=>{
 const base=path=>execFileSync('git',['show',manifest.base+':'+path],{cwd:root,encoding:'utf8'});
 const html=await readFile(new URL('index.html',root),'utf8'),original=base('index.html');
 const restored=html.replace(/\n<!-- Isolated integration modules:[\s\S]*?<script src="js\/activity-social-feed.js\?v=integration-1"><\/script>\n/,'');assert.equal(hash(Buffer.from(restored.replaceAll('\r\n','\n'))),hash(Buffer.from(original.replaceAll('\r\n','\n'))));
 const current=JSON.parse(await readFile(new URL('vercel.json',root),'utf8')),prior=JSON.parse(base('vercel.json'));assert.deepEqual(current.routes,prior.routes);for(const [k,v] of Object.entries(prior.functions))assert.deepEqual(current.functions[k],v);
 const pkg=JSON.parse(await readFile(new URL('package.json',root),'utf8')),old=JSON.parse(base('package.json'));assert.deepEqual(pkg.scripts,old.scripts);assert.equal(pkg.dependencies.stripe,old.dependencies.stripe);assert.deepEqual(pkg.devDependencies,old.devDependencies);
 const lock=await readFile(new URL('pnpm-lock.yaml',root),'utf8');assert.match(lock,/stripe:[\s\S]*?version: 22\.6\.2/);
});
