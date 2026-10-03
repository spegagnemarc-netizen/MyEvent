import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {readFile,mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createRequire} from 'node:module';const require=createRequire(import.meta.url);const {JSDOM}=require('jsdom');
import {supabaseEnvironment} from '../server/supabase-environment.mjs';
import handler from '../api/runtime-config.js';
import {checkConfig} from '../scripts/check-test-environment.mjs';import {validateSchemaOnly,prepare,priorMigrations} from '../scripts/prepare-admin-test.mjs';
const ref='aaaaaaaaaaaaaaaaaaaa',env={VERCEL_ENV:'preview',SUPABASE_URL:`https://${ref}.supabase.co`,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fake',MYEVENT_TEST_SUPABASE_REF:ref};
test('Preview is pinned, no source fallback, local and production scopes remain explicit',()=>{
 const c=supabaseEnvironment(env);assert.equal(c.projectRef,ref);assert.equal(c.authStorageKey,`myevent-test-preview-${ref}-auth`);
 for(const bad of [{},{...env,SUPABASE_URL:'https://nxxvadbliinhvkirqkkl.supabase.co',MYEVENT_TEST_SUPABASE_REF:'nxxvadbliinhvkirqkkl'},
 {...env,MYEVENT_TEST_SUPABASE_REF:'bbbbbbbbbbbbbbbbbbbb'},{...env,SUPABASE_URL:'https://evil.test'},
 {...env,SUPABASE_URL:`https://user:password@${ref}.supabase.co`},{...env,SUPABASE_PUBLISHABLE_KEY:'sb_secret_fake'},
 {...env,SUPABASE_PUBLISHABLE_KEY:'eyJ.fake.service_role'},{...env,SUPABASE_URL:env.SUPABASE_URL+'/auth'},
 {...env,VERCEL_ENV:'something'},{...env,VERCEL_ENV:'preview',MYEVENT_ENV:'production',MYEVENT_TEST_SUPABASE_REF:''}])assert.throws(()=>supabaseEnvironment(bad));
 assert.equal(supabaseEnvironment({...env,VERCEL_ENV:'production',MYEVENT_TEST_SUPABASE_REF:''}).authStorageKey,`sb-${ref}-auth-token`);
 assert.equal(supabaseEnvironment({...env,VERCEL_ENV:'development',SUPABASE_URL:'http://127.0.0.1:54321',MYEVENT_TEST_SUPABASE_REF:'local'}).projectRef,'local');
 assert.equal(checkConfig(c,ref).isolated,true);assert.throws(()=>checkConfig({...c,environment:'production'},ref));assert.throws(()=>checkConfig({...c,service_role:'secret'},ref));
});
test('Public config endpoint returns only allowlisted public fields and never secrets',()=>{
 const names=[...Object.keys(env),'SUPABASE_SERVICE_ROLE_KEY','OPENAI_API_KEY'];const saved=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 try{Object.assign(process.env,env,{SUPABASE_SERVICE_ROLE_KEY:'never_expose',OPENAI_API_KEY:'never_expose'});
 let body,code,headers={};const res={setHeader(k,v){headers[k]=v;},status(n){code=n;return this;},json(v){body=v;return this;}};
 handler({method:'GET'},res);assert.equal(code,200);assert.equal(headers['Cache-Control'],'no-store, max-age=0');checkConfig(body,ref);assert(!JSON.stringify(body).includes('never_expose'));
 process.env.MYEVENT_TEST_SUPABASE_REF='wrong';handler({method:'GET'},res);assert.equal(code,503);assert.equal(Object.keys(body).join(','),'error');handler({method:'POST'},res);assert.equal(code,405);
 }finally{for(const k of names){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});
test('Browser boundary fails closed and shows test identity; same session key for both entry points',async()=>{
 const source=await readFile(new URL('../js/runtime-config.js',import.meta.url),'utf8');
 for(const valid of [true,false]){
  const dom=new JSDOM('<body></body>',{url:'https://example.test',runScripts:'outside-only'});
  dom.window.fetch=async()=>({ok:valid,json:async()=>valid?supabaseEnvironment(env):{error:'failure'}});
  dom.window.eval(source);if(valid){const c=await dom.window.myeventRuntime.ready;assert.equal(c.projectRef,ref);}else await assert.rejects(dom.window.myeventRuntime.ready);
  await new Promise(r=>setImmediate(r));assert.match(dom.window.document.getElementById('myeventEnvironmentBanner').textContent,valid?/MYEVENT TEST/:/BLOQUÉE/);dom.window.close();
 }
 for(const p of ['../js/core-runtime.js','../js/marketplace.mjs']){const s=await readFile(new URL(p,import.meta.url),'utf8');assert(s.includes('storageKey:config.authStorageKey'));assert(!s.includes('sb_publishable_'));assert(!s.includes('nxxvadbliinhvkirqkkl'));}
 for(const p of ['../index.html','../marketplace.html'])assert((await readFile(new URL(p,import.meta.url),'utf8')).includes('/js/runtime-config.js'));
});
test('Schema-only pack rejects data/secrets and lists history including duplicate migration versions',async()=>{
 const base=['profiles','events','event_members','marketplace_listings','platform_admins','admin_partner_content'].map(t=>`CREATE TABLE public.${t} (id uuid);`).join('\n');
 validateSchemaOnly(base+"create function f() returns void as $$ begin insert into x values(1); end; $$ language plpgsql;");
 for(const bad of ['INSERT INTO public.profiles VALUES(1);','COPY auth.users FROM stdin;','select setval(1);','-- sb_secret_bad','CREATE TABLE public.admin_account_controls(id uuid);'])assert.throws(()=>validateSchemaOnly(base+bad));
 assert.throws(()=>validateSchemaOnly('create table x(id uuid);'));assert.equal(priorMigrations.filter(x=>x.startsWith('202609280002')).length,2);
 const temp=await mkdtemp(join(tmpdir(),'admin-schema-'));try{
  const {writeFile}=await import('node:fs/promises');await writeFile(join(temp,'base.sql'),base);const result=await prepare(join(temp,'base.sql'),join(temp,'output'));assert.equal(result.length,5);
  assert.equal((await readFile(join(temp,'output/04-admin-v2.sql'),'utf8')),await readFile(new URL('../supabase/migrations/202610030003_admin_v2.sql',import.meta.url),'utf8'));
 }finally{await rm(temp,{recursive:true,force:true});}
});
test('Fictitious accounts seed refuses defaults and grants only A on an empty test fixture',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();
 try{await db.exec(`create schema auth;create table auth.users(id uuid primary key,email text);create table profiles(id uuid primary key,display_name text,username text,avatar text);create table platform_admins(user_id uuid primary key,role text);`);
 const sql=await readFile(new URL('../supabase/test/accounts.sql',import.meta.url),'utf8');
 await assert.rejects(db.exec(sql),/Confirmer/);await db.exec('rollback');
 await db.exec("select set_config('myevent.test_project_ref','aaaaaaaaaaaaaaaaaaaa',false)");await assert.rejects(db.exec(sql),/Remplacer/);await db.exec('rollback');
 const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
 for(let i=0;i<3;i++)await db.query('insert into auth.users values($1,$2)',[ids[i],`myevent-${'abc'[i]}@example.invalid`]);
 let configured=sql;for(let i=0;i<3;i++)configured=configured.replace(`00000000-0000-0000-0000-00000000000${'abc'[i]}`,ids[i]);
 await db.exec(configured);assert.equal((await db.query('select count(*)::int n from profiles')).rows[0].n,3);assert.deepEqual((await db.query('select * from platform_admins')).rows,[{user_id:ids[0],role:'super_admin'}]);
 await db.query('insert into platform_admins values($1,$2)',[ids[1],'super_admin']);await assert.rejects(db.exec(configured),/classiques/);await db.exec('rollback');
 }finally{await db.close();}
});
