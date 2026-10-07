import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('actual Storage repair uses object paths, keeps event boundaries and rejects malformed folders safely',async()=>{
 const db=new PGlite(),event='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const owner='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222',guest='33333333-3333-4333-8333-333333333333';
 try{
 await db.exec(`create role authenticated;create schema auth;create schema storage;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.events(id uuid primary key,creator_id uuid,name text,cover_url text,visibility text);
 create table public.event_members(event_id uuid,user_id uuid);
 create function public.event_is_member(eid uuid,uid uuid default auth.uid()) returns boolean language sql security definer as $$select exists(select 1 from events where id=eid and creator_id=uid) or exists(select 1 from event_members where event_id=eid and user_id=uid)$$;
 create function public.is_event_member(eid uuid) returns boolean language sql security definer as $$select public.event_is_member(eid)$$;
 create function public.event_is_visible(eid uuid,uid uuid default auth.uid()) returns boolean language sql security definer as $$select public.event_is_member(eid,uid) or exists(select 1 from events where id=eid and visibility='public')$$;
 grant select on public.events to authenticated; create table storage.objects(bucket_id text,name text);
 alter table storage.objects enable row level security;grant usage on schema storage,auth to authenticated;grant select,insert on storage.objects to authenticated;
 create policy event_media_select on storage.objects for select to authenticated using(bucket_id='event-media');
 create policy event_cover_visible_v2 on storage.objects for select to authenticated using(bucket_id='event-media' and exists(select 1 from events e where e.cover_url=name and public.event_is_visible(e.id)));
 create policy event_media_scope_v2 on storage.objects as restrictive for select using(bucket_id<>'event-media' or exists(select 1 from events e where e.id::text=split_part(name,'/',1) and (public.event_is_member(e.id) or (e.cover_url=name and public.event_is_visible(e.id)))));
 create policy "Members can read event voices" on storage.objects for select to authenticated using(false);
 create policy "Members can upload event voices" on storage.objects for insert to authenticated with check(false);
 insert into events values('${event}','${owner}','Anniversaire','${event}/cover.jpg','public');
 insert into event_members values('${event}','${member}');
 insert into storage.objects values('event-media','${event}/cover.jpg'),('event-media','${event}/private.jpg'),('event-media','unrelated/secret.jpg'),('event-voices','${event}/voice.m4a'),('event-voices','invalid/voice.m4a');`);
 const as=(uid,sql)=>db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);return tx.query(sql);});
 assert.equal((await as(owner,'select * from storage.objects')).rows.length,0,'reproduces title/path confusion');
 const repair=await readFile(new URL('../supabase/migrations/202610070001_storage_event_path_scope.sql',import.meta.url),'utf8');
 await db.exec(repair);await db.exec(repair);
 for(const uid of [owner,member])assert.equal((await as(uid,'select * from storage.objects')).rows.length,3);
 assert.deepEqual((await as(guest,'select name from storage.objects')).rows.map(r=>r.name),[`${event}/cover.jpg`]);
 await db.exec("update events set visibility='private'");assert.equal((await as(guest,'select * from storage.objects')).rows.length,0);
 await as(member,`insert into storage.objects values('event-voices','${event}/new.m4a')`);
 await assert.rejects(as(guest,`insert into storage.objects values('event-voices','${event}/outsider.m4a')`),/row-level security/);
 await assert.rejects(as(member,"insert into storage.objects values('event-voices','invalid/new.m4a')"),/row-level security/);
 }finally{await db.close();}
});
