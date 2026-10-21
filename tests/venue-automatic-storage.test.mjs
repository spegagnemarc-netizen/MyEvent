import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{PGlite}=require('@electric-sql/pglite');
test('proposed TEST sheet storage reuses activity rights and saves atomically without granting table access',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema activities_private;grant usage on schema auth,activities_private to authenticated;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table activities_private.activities(id uuid primary key,organizer_id uuid);
 create function activities_private.allowed() returns boolean language sql as $$select auth.uid() is not null$$;
 create function public.activities_save(p_id uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$begin
 if p_id is not null and not exists(select 1 from activities_private.activities where id=p_id and organizer_id=auth.uid()) then raise exception 'owner';end if;
 p_id:=coalesce(p_id,gen_random_uuid());insert into activities_private.activities values(p_id,auth.uid()) on conflict do nothing;return p_id;end$$;
 create function public.activities_save_with_cover(uuid,uuid,jsonb) returns uuid language sql as $$select public.activities_save($2,$3)$$;
 create function public.activities_detail(p_id uuid) returns jsonb language sql security definer set search_path='' as $$select jsonb_build_object('id',id) from activities_private.activities where id=p_id and organizer_id=auth.uid()$$;`);
 await db.exec(await readFile(new URL('../docs/activities/automatic-venue-storage-proposal.sql',import.meta.url),'utf8'));
 const uid='11111111-1111-4111-8111-111111111111';await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');
 const [{id}]=(await db.query("select public.activities_save_with_venue(null,'{}','{\"name\":\"Établissement exemple\",\"booking_verified\":true}') as id")).rows;
 const result=(await db.query('select public.activities_venue_sheet($1) as sheet',[id])).rows[0].sheet;assert.equal(result.name,'Établissement exemple');assert.equal(result.booking_verified,undefined);
 await assert.rejects(db.query('select * from activities_private.venue_sheets'),/permission denied/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",['22222222-2222-4222-8222-222222222222']);assert.equal((await db.query('select public.activities_venue_sheet($1) as sheet',[id])).rows[0].sheet,null);
 await assert.rejects(db.query("select public.activities_save_with_venue($1,'{}','{}')",[id]),/owner/);
 }finally{await db.close();}
});
