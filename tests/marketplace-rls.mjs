// Runs the real migration against an isolated PostgreSQL engine, never production.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE_URL||'@electric-sql/pglite');
const db=new PGlite();
const seller='11111111-1111-4111-8111-111111111111',buyer='22222222-2222-4222-8222-222222222222',outsider='33333333-3333-4333-8333-333333333333';
const listing='44444444-4444-4444-8444-444444444444',image=`${seller}/${listing}/55555555-5555-4555-8555-555555555555.jpg`;
let checks=0;
async function as(id,fn,role='authenticated'){
  return db.transaction(async tx=>{await tx.exec(`set local role ${role}`);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id||'']);return fn(tx);});
}
async function denied(id,sql,params=[]){await assert.rejects(as(id,tx=>tx.query(sql,params)));checks++;}
try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,storage to authenticated,anon;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,delete on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;`);
  await db.query('insert into auth.users values($1),($2),($3)',[seller,buyer,outsider]);
  await db.exec(await readFile(new URL('../supabase/migrations/202609250001_marketplace.sql',import.meta.url),'utf8'));checks++;
  const insert=`insert into public.marketplace_listings(id,title,description,mode,category,price_cents,city,condition) values($1,'Enceinte portable','Enceinte avec chargeur et housse incluse.','rent','sound',3500,'Lyon','good')`;
  await as(seller,tx=>tx.query(insert,[listing]));checks++;
  assert.equal((await as(buyer,tx=>tx.query('select * from public.marketplace_listings'))).rows.length,0);checks++;
  await denied(buyer,"insert into public.marketplace_listings(owner_id,title,description,mode,category,price_cents,city,condition) values($1,'Enceinte volée','Tentative de fausse propriété du matériel','sale','sound',3500,'Lyon','good')",[seller]);
  await denied(seller,"update public.marketplace_listings set status='active' where id=$1",[listing]);
  await as(seller,tx=>tx.query("insert into storage.objects(bucket_id,name) values('marketplace-images',$1)",[image]));checks++;
  assert.equal((await as(buyer,tx=>tx.query('select * from storage.objects'))).rows.length,0);checks++;
  await denied(buyer,"insert into storage.objects(bucket_id,name) values('marketplace-images',$1)",[image]);
  await denied(seller,"update public.marketplace_listings set image_paths=array['other/person/photo.jpg'] where id=$1",[listing]);
  await as(seller,tx=>tx.query("update public.marketplace_listings set status='active',image_paths=array[$2] where id=$1",[listing,image]));checks++;
  assert.equal((await as(buyer,tx=>tx.query('select * from public.marketplace_listings'))).rows.length,1);checks++;
  assert.equal((await as(buyer,tx=>tx.query('select * from storage.objects'))).rows.length,1);checks++;
  assert.equal((await as(buyer,tx=>tx.query("update public.marketplace_listings set price_cents=1 where id=$1 returning id",[listing]))).rows.length,0);checks++;
  await denied(seller,'update public.marketplace_listings set owner_id=$1 where id=$2',[buyer,listing]);
  await as(buyer,tx=>tx.query('insert into public.marketplace_favorites(listing_id) values($1)',[listing]));checks++;
  assert.equal((await as(outsider,tx=>tx.query('select * from public.marketplace_favorites'))).rows.length,0);checks++;
  const thread=(await as(buyer,tx=>tx.query('select public.marketplace_contact($1) as id',[listing]))).rows[0].id;checks++;
  assert.equal((await as(buyer,tx=>tx.query('select public.marketplace_contact($1) as id',[listing]))).rows[0].id,thread);checks++;
  await denied(seller,'select public.marketplace_contact($1)',[listing]);
  await denied(outsider,'insert into public.marketplace_threads(listing_id,listing_title,buyer_id,seller_id) values($1,$2,$3,$4)',[listing,'forged',buyer,seller]);
  await as(buyer,tx=>tx.query('insert into public.marketplace_messages(thread_id,body) values($1,$2)',[thread,'Disponible samedi ?']));checks++;
  assert.equal((await as(seller,tx=>tx.query('select * from public.marketplace_messages'))).rows.length,1);checks++;
  assert.equal((await as(outsider,tx=>tx.query('select * from public.marketplace_messages'))).rows.length,0);checks++;
  assert.equal((await as(outsider,tx=>tx.query('select * from public.marketplace_threads'))).rows.length,0);checks++;
  await denied(outsider,'insert into public.marketplace_messages(thread_id,body) values($1,$2)',[thread,'Intrusion']);
  await denied(buyer,'insert into public.marketplace_messages(thread_id,sender_id,body) values($1,$2,$3)',[thread,seller,'Usurpation']);
  await denied(buyer,'insert into public.marketplace_messages(thread_id,body) values($1,$2)',[thread,' ']);
  await denied(buyer,'insert into public.marketplace_messages(thread_id,body,created_at) values($1,$2,now())',[thread,'Date forgée']);
  await as(seller,tx=>tx.query("update public.marketplace_listings set status='archived' where id=$1",[listing]));checks++;
  assert.equal((await as(buyer,tx=>tx.query('select * from public.marketplace_listings'))).rows.length,0);checks++;
  await denied(outsider,'select public.marketplace_contact($1)',[listing]);
  await as(seller,tx=>tx.query('insert into public.marketplace_messages(thread_id,body) values($1,$2)',[thread,'Annonce retirée, merci.']));checks++;
  await assert.rejects(as(null,tx=>tx.query('select * from public.marketplace_listings'),'anon'));checks++;
  await assert.rejects(as(null,tx=>tx.query('select public.marketplace_contact($1)',[listing]),'anon'));checks++;
  console.log(`PASS: ${checks} migration / ownership / messages / storage / anonymous-access checks`);
}finally{await db.close();}
