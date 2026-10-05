import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup,installAdmin,users,request} from './admin-v21-db.mjs';

test('actual V3 migration installs after V2 and Explorer and retains server authorization',async()=>{
 const db=await setup();
 try{
  await installAdmin(db);
  await db.exec(await readFile(new URL('../supabase/migrations/202610050001_personal_reservations.sql',import.meta.url),'utf8'));
  const migration=await readFile(new URL('../supabase/migrations/202610050002_admin_v3_dashboard_reservations.sql',import.meta.url),'utf8');
  await db.exec(migration);
  const identity=(await request(db,users[0],'select public.myevent_admin_identity() as result')).rows[0].result;
  assert.equal(identity.is_admin,true);
  await assert.rejects(request(db,users[1],'select public.myevent_admin_statistics()'),/refusé/);
  assert.ok((await request(db,users[0],'select public.myevent_admin_statistics() as result')).rows[0].result);
  const saved=(await request(db,users[0],"select public.myevent_admin_partner_content_save('hotels_com','activity','Fictif',p_affiliate_url=>'https://www.hotels.com/test') as id")).rows[0].id;
  assert.equal((await db.query("select provider from public.admin_partner_content where title='Fictif'")).rows[0].provider,'hotels_com');
  await request(db,users[0],"select public.myevent_admin_partner_content_save('omio','activity','Fictif',p_id=>$1)",[saved]);
  assert.equal((await db.query('select provider from public.admin_partner_content where id=$1',[saved])).rows[0].provider,'omio');
 }finally{await db.close();}
});
