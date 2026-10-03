// Isolated PostgreSQL fixture, built from the repository's real migrations.
// Legacy tables below are a fixture, NOT proof of the remote Supabase schema.
import {setup as setupGames,users} from './games-db.mjs';
import {readFile} from 'node:fs/promises';
export {users};
export async function setup(){
 const db=await setupGames();
 await db.exec(`create role authenticator;alter role service_role bypassrls;
 alter table auth.users add column created_at timestamptz default now();
 alter table auth.users add column banned_until timestamptz;
 alter table public.events add column name text default 'Test';
 alter table public.events add column location text;
 alter table public.events add column description text;
 alter table public.events add column event_date timestamptz;
 alter table public.events add column event_type text default 'general';
 alter table public.events add column cover_url text;
 alter table public.events add column invite_code text;
 alter table public.events add column created_at timestamptz default now();
 alter table public.event_members add column id uuid default gen_random_uuid();
 alter table public.event_members add column role text default 'member';
 alter table public.event_members add column nickname text;
 alter table public.event_members add column status text;
 alter table public.event_members add column joined_at timestamptz default now();
 alter table public.event_members add primary key(event_id,user_id);
 create publication supabase_realtime;
 create table public.messages(id uuid primary key default gen_random_uuid(),event_id uuid references public.events(id),user_id uuid references auth.users(id),content text,created_at timestamptz default now());
 create table public.polls(id uuid primary key default gen_random_uuid(),event_id uuid references public.events(id),creator_id uuid references auth.users(id),question text,allow_multiple boolean default false,created_at timestamptz default now());
 create table public.poll_options(id uuid primary key default gen_random_uuid(),poll_id uuid references public.polls(id),option_text text);
 create table public.event_outings(id uuid primary key default gen_random_uuid(),event_id uuid references public.events(id),title text,creator_id uuid);
 create table public.event_outing_plans(id uuid primary key default gen_random_uuid(),event_id uuid unique references public.events(id),title text,created_by uuid);
 create table public.event_outing_plan_items(id uuid primary key default gen_random_uuid(),plan_id uuid references public.event_outing_plans(id),event_id uuid references public.events(id),step_order int,title text);
 create table public.event_outing_plan_reservations(id uuid primary key default gen_random_uuid(),plan_id uuid references public.event_outing_plans(id),event_id uuid references public.events(id),step_order int,status text,unique(plan_id,step_order));
 create table public.event_supplies(id uuid primary key default gen_random_uuid(),event_id uuid references public.events(id),title text);
 alter table public.profiles enable row level security;
 create policy legacy_profile on public.profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
 alter table public.events enable row level security;
 create policy legacy_events on public.events for all to authenticated using(true) with check(true);
 alter table public.event_members enable row level security;
 create policy legacy_members on public.event_members for all to authenticated using(true) with check(true);
 grant select,insert,update,delete on public.profiles,public.events,public.event_members to authenticated;
 grant select,insert,delete on storage.objects to authenticated;
 grant usage on schema auth,storage to service_role;`);
 for(const t of ['messages','polls','poll_options','event_outings','event_outing_plans','event_outing_plan_items','event_outing_plan_reservations','event_supplies']){
  await db.exec(`alter table public.${t} enable row level security;create policy legacy_${t} on public.${t} for all to authenticated using(true) with check(true);grant all on public.${t} to authenticated;`);
 }
 for(const name of ['20260923_music_v1.sql','20260924_music_integrity.sql','20260923_social_camera_feed.sql',
 '202609250001_marketplace.sql','202609270004_event_member_profiles.sql','202609270005_event_roles_visibility_feed.sql',
 '202609270006_event_member_identity.sql','202609280001_social_inbox.sql','202609280002_fix_event_creation_rls.sql',
 '202609280002_story_interactions.sql','202609280003_feed_interactions.sql','202609290001_v1_realtime_modules.sql',
 '202609290002_marketplace_unread.sql','202609290003_supply_quantities.sql','202609300001_event_tasks.sql',
 '202609300002_social_locations.sql','202610030001_platform_admin.sql','202610030002_admin_partner_content.sql']){
  const sql=(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8')).replace('create extension if not exists pgcrypto;','');
  try{await db.exec(sql);}catch(error){throw new Error(name+': '+error.message);}
 }
 // Camera V1 relies on existing grants in production; model that legacy grant.
 await db.exec('grant select,insert,delete on public.social_posts to authenticated;grant select,insert,update,delete on public.music_tracks,public.music_playlists,public.music_playlist_items,public.music_votes,public.music_favorites,public.event_music_settings to authenticated;grant all on all tables in schema public to service_role;');
 await db.query('insert into public.platform_admins(user_id) values($1)',[users[0]]);
 return db;
}
export async function installAdmin(db){
 for(const name of ['202610030003_admin_v2.sql','202610030004_admin_v21_request_gate.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
}
// Model the PostgREST pre-request step explicitly. PGlite is NOT an HTTP server.
export const request=(db,id,sql,args=[],role='authenticated')=>db.transaction(async tx=>{
 await tx.exec(`set local role ${role}`);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id||'']);
 await tx.query('select public.myevent_api_request_guard()');return tx.query(sql,args);
});
export const direct=(db,id,sql,args=[])=>db.transaction(async tx=>{
 await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id||'']);return tx.query(sql,args);
});
