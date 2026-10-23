import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import {JSDOM} from 'jsdom';
import {fixture,catalog,existing} from '../scripts/activities-test-fixture.mjs';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8');
test('new Production installation is atomic, empty, closed and preserves existing objects',async()=>{
 const sql=await read('docs/production-v1/001-install-closed.sql'),db=new PGlite();
 try{await db.exec(fixture);const before=(await db.query(existing)).rows;
 await assert.rejects(db.exec(sql.replace('COMMIT;',()=>"DO $$BEGIN RAISE EXCEPTION 'forced rollback';END$$;COMMIT;")),/forced rollback/);
 await db.exec('ROLLBACK');assert.equal((await db.query("select to_regnamespace('activities_private') as n")).rows[0].n,null);
 await db.exec(sql);assert.deepEqual((await db.query(existing)).rows,before);
 const manifest=(await db.query(catalog)).rows[0].manifest;
 assert.equal(manifest.relations.filter(x=>x.kind==='r'&&x.rls).length,7);assert.equal(manifest.functions.filter(x=>x.schema==='public').length,6);
 assert.deepEqual((await db.query('select enabled,registrations_enabled from activities_private.settings')).rows,[{enabled:false,registrations_enabled:false}]);
 assert.equal((await db.query('select count(*)::int as n from activities_private.adult_access')).rows[0].n,0);
 await db.exec('set role authenticated');assert.equal((await db.query('select public.activities_capabilities() as c')).rows[0].c.adult_access,false);
 await assert.rejects(db.query('select * from activities_private.activities'),/permission denied/);await db.exec('reset role');
 await assert.rejects(db.exec(sql),/Existing module/);await db.exec('rollback');
 }finally{await db.close();}
});
test('Production client requires exact project and active account eligibility; TEST UUID is not required in Production',async()=>{
 const sources=await Promise.all(['js/activities-core.js','js/activities-runtime.js'].map(read));
 for(const [projectRef,adult,visible,save] of [['nxxvadbliinhvkirqkkl',true,true,true],['nxxvadbliinhvkirqkkl',false,true,false],['ahyyknfjsielnqyoxqgh',true,false,false]]){
 const d=new JSDOM('<button id="activitiesShortcut">Sorties</button>',{url:'https://orevami.com',runScripts:'outside-only',pretendToBeVisual:true});
 d.window.scrollTo=()=>{};d.window.myeventRuntime={ready:Promise.resolve({environment:'production',isTest:false,projectRef})};
 d.window.myeventCameraContext=()=>({user:{id:'00000000-0000-4000-8000-000000000001'},sb:{rpc:async name=>({data:name==='activities_capabilities'?{enabled:true,adult_access:adult,version:4,account_access:adult,can_create:adult,registrations_enabled:false}:[]})}});
 for(const source of sources)d.window.eval(source);await new Promise(r=>setTimeout(r,0));
 assert.equal(!!d.window.document.querySelector('#activitiesPanel'),visible);
 if(visible){d.window.document.querySelector('#activitiesShortcut').click();await new Promise(r=>setTimeout(r,0));d.window.document.querySelector('[data-act-tab="create"]').click();assert.equal(!d.window.document.querySelector('#act-editor button[type="submit"]').disabled,save);}
 d.window.close();}
});
test('all 347 protected Production files and original search implementation are conserved',async()=>{
 const manifest=JSON.parse(await read('docs/integration/production-preservation.json')),hash=s=>createHash('sha256').update(s).digest('hex');
 for(const f of manifest.files){const bytes=await readFile(new URL(f.file,root));assert.ok(hash(bytes)===f.sha256||hash(bytes.toString().replaceAll('\r\n','\n'))===f.sha256,f.file);}
 const original=execFileSync('git',['show',manifest.base+':api/search-places.js'],{cwd:root,encoding:'utf8'});
 assert.equal((await read('api/search-places.js')).replaceAll('\r\n','\n').replace("\n    if(req.query?.integration_venues==='1')return require('../server/integration-venues')(req,res);\n",''),original.replaceAll('\r\n','\n'));
 const sql=await read('docs/production-v1/001-install-closed.sql');assert.ok(!sql.includes('864beda0-b216-4b9a-9697-4dc8fd8c41f9'));assert.ok(!sql.includes('tutoriel-organisatrice'));
});
