import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('read-only production preflight works before admin tables exist and after registry installation',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role authenticated');
  const sql=await readFile(new URL('../supabase/admin/production-readiness-v3.sql',import.meta.url),'utf8');
  // Original bug: PostgreSQL resolves FROM before evaluating an existence WHERE.
  await assert.rejects(db.query("select provider from public.admin_partner_registry where to_regclass('public.admin_partner_registry') is not null"),/does not exist/);
  const before=await db.exec(sql);
  assert.equal(before.at(-1).rows[0].partner_registry_available,false);
  await db.exec('create table public.admin_partner_registry(provider text,label text,enabled boolean)');
  const after=await db.exec(sql);
  assert.equal(after.at(-1).rows[0].partner_registry_available,true);
 }finally{await db.close();}
});
