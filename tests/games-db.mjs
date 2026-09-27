import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
export const users=Array.from({length:8},(_,i)=>`${i+1}`.repeat(8)+'-'+`${i+1}`.repeat(4)+'-4'+`${i+1}`.repeat(3)+'-8'+`${i+1}`.repeat(3)+'-'+`${i+1}`.repeat(12));
export async function setup(){
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage to authenticated,anon;
 create table public.profiles(id uuid primary key references auth.users(id),display_name text,username text,avatar text);
 create table public.events(id uuid primary key,creator_id uuid references auth.users(id));
 create table public.event_members(event_id uuid references public.events(id),user_id uuid references auth.users(id));
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;`);
 for(let i=0;i<users.length;i++){
  await db.query('insert into auth.users values($1)',[users[i]]);
  await db.query('insert into public.profiles values($1,$2,$3,null)',[users[i],['Marc','Caroline','Lucas','Noélyne','Timéo','Victoire','Camille','Alex'][i],'test'+i]);
 }
 for(const file of ['202609250002_friends_stories.sql','202609270001_friend_invite_links.sql','202609270002_games_engine.sql','202609270003_defis_game.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 return db;
}
export const as=(db,id,sql,params=[],role='authenticated')=>db.transaction(async tx=>{
 await tx.exec(`set local role ${role}`);
 await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id||'']);
 return tx.query(sql,params);
});
export async function rpc(db,id,name,args={}){
 const keys=Object.keys(args);
 if(!/^[a-z_]+$/.test(name)||keys.some(k=>!/^[a-z_]+$/.test(k)))throw Error('Invalid RPC');
 return (await as(db,id,`select public.${name}(${keys.map((k,i)=>k+'=> $'+(i+1)).join(',')}) as value`,Object.values(args))).rows[0].value;
}
