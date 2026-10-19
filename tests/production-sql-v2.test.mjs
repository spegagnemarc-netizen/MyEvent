import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {fixture,catalog,existing} from '../scripts/activities-test-fixture.mjs';
test('corrected SQL under Production default function privileges: atomic install, exact replay, closed state and drift refusal',async()=>{
 const db=new PGlite(),sql=await readFile(new URL('../docs/production-v1/002-install-closed-corrected.sql',import.meta.url),'utf8');
 try{
 await db.exec(fixture);
 await db.exec(`alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
 create function public.production_preserved_probe(integer) returns integer language sql as $$select $1$$;
 insert into public.admin_reports(target_kind,target_id,reason) values('event','00000000-0000-4000-8000-000000000001','Existing local report to preserve');`);
 const before=(await db.query(existing)).rows,defaults=(await db.query('select defaclrole,defaclnamespace,defaclobjtype,defaclacl::text from pg_default_acl order by oid')).rows,reports=(await db.query('select * from public.admin_reports')).rows;
 await assert.rejects(db.exec(sql.replace('COMMIT;',()=>"DO $$BEGIN RAISE EXCEPTION 'forced rollback';END$$;COMMIT;")),/forced rollback/);
 await db.exec('ROLLBACK');assert.equal((await db.query("select to_regnamespace('activities_private') as n")).rows[0].n,null);
 await db.exec(sql);
 assert.deepEqual((await db.query(existing)).rows,before);assert.deepEqual((await db.query('select * from public.admin_reports')).rows,reports);
 assert.deepEqual((await db.query('select defaclrole,defaclnamespace,defaclobjtype,defaclacl::text from pg_default_acl order by oid')).rows,defaults);
 const installed=(await db.query(catalog)).rows[0].manifest;
 assert.equal(installed.relations.filter(r=>r.kind==='r'&&r.rls).length,7);
 const publicFunctions=installed.functions.filter(f=>f.schema==='public');assert.equal(publicFunctions.length,6);
 for(const f of publicFunctions)assert.equal(f.acl,'{postgres=X/postgres,authenticated=X/postgres}');
 assert.deepEqual((await db.query('select enabled,registrations_enabled from activities_private.settings')).rows,[{enabled:false,registrations_enabled:false}]);
 assert.equal((await db.query('select count(*)::int n from activities_private.adult_access')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from activities_private.activities')).rows[0].n,0);
 await db.exec(sql);assert.deepEqual((await db.query(catalog)).rows[0].manifest,installed);assert.deepEqual((await db.query(existing)).rows,before);
 await db.exec('set role anon');await assert.rejects(db.query('select public.activities_capabilities()'),/permission denied/);await db.exec('reset role;set role authenticated');await assert.rejects(db.query('select * from activities_private.activities'),/permission denied/);assert.equal((await db.query('select public.activities_capabilities() c')).rows[0].c.enabled,false);await db.exec('reset role');
 await db.exec('update activities_private.settings set enabled=true');await assert.rejects(db.exec(sql),/no longer closed/);await db.exec('rollback;update activities_private.settings set enabled=false');
 await db.exec('grant execute on function public.activities_list() to service_role');
 await assert.rejects(db.exec(sql),/Existing installation divergence: functions/);await db.exec('rollback');assert.deepEqual((await db.query(existing)).rows,before);
 console.log('Six exact signatures/ACLs verified; existing functions/default ACLs/report data unchanged; no remote writes.');
 }finally{await db.close();}
});
