import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup,users,request} from './admin-v21-db.mjs';
const sql=await readFile(new URL('../supabase/migrations/202610030003_admin_v2.sql',import.meta.url),'utf8');
const activation=await readFile(new URL('../supabase/migrations/202610030004_admin_v21_request_gate.sql',import.meta.url),'utf8');
let checks=0;
async function isolated(fn){const db=await setup();try{await fn(db);}finally{await db.close();}}
await isolated(async db=>{
 await db.exec('alter table auth.users drop column created_at');
 await assert.rejects(()=>db.exec(sql),/colonne manquante auth.users.created_at/);checks++;
 await db.exec('rollback');assert.equal((await db.query("select to_regclass('public.admin_audit_log') x")).rows[0].x,null);checks++;
});
await isolated(async db=>{
 await db.exec('alter table public.profiles disable row level security');
 await assert.rejects(()=>db.exec(sql),/RLS désactivée sur public.profiles/);checks++;
 await db.exec('rollback');assert.equal((await db.query("select to_regclass('public.admin_audit_log') x")).rows[0].x,null);checks++;
});
await isolated(async db=>{
 await db.exec(sql);
 await db.exec("alter role authenticator set pgrst.db_pre_request='public.existing_request_hook'");
 await assert.rejects(()=>db.exec(activation),/aucune substitution automatique/);checks++;
 await db.exec('rollback');
 assert.ok((await db.query("select setconfig from pg_db_role_setting s join pg_roles r on r.oid=s.setrole where r.rolname='authenticator'")).rows[0].setconfig.includes('pgrst.db_pre_request=public.existing_request_hook'));checks++;
 await assert.rejects(()=>request(db,users[0],"select public.myevent_admin_action('user',$1,'suspend','','Motif très détaillé')",[users[1]]),/004/);checks++;
 await db.exec('alter role authenticator reset pgrst.db_pre_request');await db.exec(activation);
 await assert.rejects(()=>request(db,users[0],"select public.myevent_admin_action('event',$1,'visibility',null)",[users[0]]));checks++;
 await assert.rejects(()=>request(db,null,"select public.myevent_admin_list('users')",[],'anon'),/permission denied/);checks++;
 await request(db,null,'select public.myevent_api_request_guard()',[],'anon');checks++;
 await db.query("update auth.users set banned_until=now()+interval '1 day' where id=$1",[users[2]]);
 await assert.rejects(()=>request(db,users[2],'select public.social_inbox_snapshot()'),/MYEVENT_ACCOUNT_SUSPENDED/);checks++;
});
console.log(`Admin V2.1 activation: ${checks} preflight, atomic rollback, existing hook and external ban checks passed.`);
