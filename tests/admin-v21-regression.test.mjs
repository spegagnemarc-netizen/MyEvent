import assert from 'node:assert/strict';
import {setup,installAdmin,users,request,direct} from './admin-v21-db.mjs';
import {readFile} from 'node:fs/promises';
const db=await setup();const [admin,active,suspended]=users;
let checks=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const fails=async(fn,regex)=>{await assert.rejects(fn,regex);checks++;};
const event='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
try{
 await direct(db,active,"insert into public.events(id,creator_id,name) values($1,$2,'Événement réel')",[event,active]);
 await direct(db,active,"insert into public.event_members(event_id,user_id,role) values($1,$2,'owner')",[event,active]);
 // An unrelated public table must NOT get a blanket policy.
 await db.exec('create table public.unrelated_extension_table(id int);');
 const before=(await db.query("select schemaname,tablename,policyname,qual,with_check from pg_policies order by 1,2,3")).rows;
 await installAdmin(db);
 equal((await db.query("select count(*)::int n from pg_policies where tablename='unrelated_extension_table'")).rows[0].n,0,'Unrelated tables untouched');
 const after=(await db.query("select schemaname,tablename,policyname,qual,with_check from pg_policies order by 1,2,3")).rows;
 for(const p of before)equal(after.find(x=>x.schemaname===p.schemaname&&x.tablename===p.tablename&&x.policyname===p.policyname),p,'Existing policy unchanged');
 await fails(()=>request(db,active,"select public.myevent_admin_list('users')"),/refusé/);
 await fails(()=>request(db,admin,'select * from public.admin_audit_log'),/permission denied/);
 await fails(()=>request(db,admin,"select nextval('public.admin_audit_log_id_seq')"),/permission denied/);
 await fails(()=>request(db,active,'select public.myevent_admin_guard()'),/permission denied/);
 equal((await request(db,admin,"select jsonb_array_length(public.myevent_admin_list('users')) n")).rows[0].n,8);
 await request(db,active,"update public.profiles set display_name='Actif V2.1' where id=$1",[active]);
 equal((await request(db,active,'select display_name from public.profiles where id=$1',[active])).rows[0].display_name,'Actif V2.1');
 await request(db,active,"select public.friend_action($1,'send')",[suspended]);
 await request(db,suspended,"select public.friend_action($1,'accept')",[active]);
 await request(db,active,"update public.events set visibility='public' where id=$1",[event]);
 await request(db,suspended,'select public.join_visible_event($1)',[event]);
 await request(db,active,'select public.set_event_coorganizer($1,$2,true)',[event,suspended]);
 equal((await request(db,suspended,'select role from public.event_members where event_id=$1 and user_id=$2',[event,suspended])).rows[0].role,'coorganizer');
 await fails(()=>request(db,suspended,'update public.events set creator_id=$2 where id=$1',[event,suspended]),/propriétaire/);
 // Even an admin co-organizer must use the audited RPC for visibility changes.
 await request(db,admin,'select public.join_visible_event($1)',[event]);
 await request(db,active,'select public.set_event_coorganizer($1,$2,true)',[event,admin]);
 await fails(()=>request(db,admin,"update public.events set visibility='friends' where id=$1",[event]),/propriétaire/);
 await request(db,admin,"select public.myevent_admin_action('event',$1,'visibility','friends')",[event]);
 await request(db,active,"update public.events set visibility='public' where id=$1",[event]);
 const story=(await request(db,active,"insert into public.social_stories(author_id,media_path,media_type) values($1,$2,'image') returning id",[active,active+'/photo.jpg'])).rows[0].id;
 equal((await request(db,suspended,'select id from public.social_stories where id=$1',[story])).rows.length,1);
 await request(db,suspended,'insert into public.social_story_likes(story_id,user_id) values($1,$2)',[story,suspended]);
 equal((await request(db,active,'select public.story_like_summary($1) s',[story])).rows[0].s.count,1);
 const post=(await request(db,active,'insert into public.event_feed_posts(author_id,event_id,body) values($1,$2,$3) returning id',[active,event,'Publication réelle'])).rows[0].id;
 await request(db,suspended,'insert into public.feed_likes(event_post_id,user_id) values($1,$2)',[post,suspended]);
 await request(db,suspended,"insert into public.feed_comments(event_post_id,author_id,body) values($1,$2,'Commentaire réel')",[post,suspended]);
 equal((await request(db,active,"select public.feed_interactions('event',$1) s",[post])).rows[0].s.likes,1);
 const conv=(await request(db,active,'select public.dm_open($1) id',[suspended])).rows[0].id;
 await request(db,suspended,'select public.dm_send($1,$2,$3)',[conv,'Réponse à la Story',crypto.randomUUID()]);
 equal((await request(db,active,'select public.dm_history($1) h',[conv])).rows[0].h.messages[0].body,'Réponse à la Story');
 const listing=(await request(db,active,"insert into public.marketplace_listings(title,description,mode,category,price_cents,city,condition) values('Enceinte portable','Enceinte avec housse et chargeur pour événements','rent','sound',2000,'Gap','good') returning id")).rows[0].id;
 const image=active+'/'+listing+'/'+crypto.randomUUID()+'.jpg';
 await direct(db,active,"insert into storage.objects(bucket_id,name) values('marketplace-images',$1)",[image]);
 await request(db,active,"update public.marketplace_listings set status='active',image_paths=array[$2] where id=$1",[listing,image]);
 await request(db,suspended,'select public.marketplace_contact($1)',[listing]);
 // Music + real outing/planning reservation tables keep legacy checks.
 const track=(await request(db,active,"insert into public.music_tracks(provider,provider_track_id,title) values('youtube','test-video','Morceau') returning id")).rows[0].id;
 const playlist=(await request(db,active,'insert into public.music_playlists(event_id,created_by) values($1,$2) returning id',[event,active])).rows[0].id;
 const song=(await request(db,active,'insert into public.music_playlist_items(event_id,playlist_id,track_id,proposed_by,position) values($1,$2,$3,$4,1) returning id',[event,playlist,track,active])).rows[0].id;
 await request(db,suspended,'insert into public.music_votes(event_id,playlist_item_id,user_id) values($1,$2,$3)',[event,song,suspended]);
 await request(db,active,'select public.music_reorder_queue($1,$2,array[$3]::uuid[])',[event,playlist,song]);
 await request(db,active,"insert into public.event_outings(event_id,title,creator_id) values($1,'Sortie de test',$2)",[event,active]);
 const plan=(await request(db,active,"insert into public.event_outing_plans(event_id,title,created_by) values($1,'Planning de test',$2) returning id",[event,active])).rows[0].id;
 await request(db,active,"insert into public.event_outing_plan_items(event_id,plan_id,step_order,title) values($1,$2,1,'Activité')",[event,plan]);
 await request(db,active,"insert into public.event_outing_plan_reservations(event_id,plan_id,step_order,status) values($1,$2,1,'confirmed')",[event,plan]);
 equal((await request(db,suspended,'select * from public.event_outing_plan_reservations where plan_id=$1',[plan])).rows.length,1);
 // Preserve an external Auth ban across suspension/reactivation; repeat must keep snapshot.
 const externalBan=new Date(Date.now()+86400000).toISOString();
 await db.query('update auth.users set banned_until=$2 where id=$1',[suspended,externalBan]);
 await request(db,admin,"select public.myevent_admin_action('user',$1,'suspend','','Motif suffisamment précis')",[suspended]);
 await request(db,admin,"select public.myevent_admin_action('user',$1,'suspend','','Motif répété sans perdre la sauvegarde')",[suspended]);
 for(const sql of ["select public.social_inbox_snapshot()","select public.event_social_feed()","select public.story_like_summary('"+story+"')","select public.nearby_friend_locations()","select public.game_list()"])
  await fails(()=>request(db,suspended,sql),/MYEVENT_ACCOUNT_SUSPENDED/);
 for(const table of ['profiles','friendships','social_stories','dm_messages','events','music_playlists','event_outing_plan_reservations','marketplace_listings'])
  equal((await direct(db,suspended,'select * from public.'+table)).rows.length,0,'Suspended direct RLS '+table);
 equal((await direct(db,suspended,'select * from storage.objects')).rows.length,0,'Suspended Storage');
 await fails(()=>direct(db,suspended,"insert into storage.objects(bucket_id,name) values('story-media',$1)",[suspended+'/new.jpg']),/row-level security/);
 await fails(()=>request(db,suspended,"select public.myevent_admin_list('users')"),/MYEVENT_ACCOUNT_SUSPENDED/);
 equal((await request(db,active,'select * from public.social_stories where id=$1',[story])).rows.length,1,'Active user unaffected');
 equal((await request(db,active,'select public.dm_history($1) h',[conv])).rows[0].h.messages[0].body,'Réponse à la Story','Messages retained');
 await request(db,admin,"select public.myevent_admin_action('user',$1,'reactivate')",[suspended]);
 equal((await db.query('select banned_until from auth.users where id=$1',[suspended])).rows[0].banned_until.toISOString(),new Date(externalBan).toISOString(),'External ban restored');
 // External edits after suspension must not be overwritten.
 await request(db,admin,"select public.myevent_admin_action('user',$1,'suspend','','Une seconde suspension complète')",[suspended]);
 const later=new Date(Date.now()+172800000).toISOString();await db.query('update auth.users set banned_until=$2 where id=$1',[suspended,later]);
 await request(db,admin,"select public.myevent_admin_action('user',$1,'reactivate')",[suspended]);
 equal((await db.query('select banned_until from auth.users where id=$1',[suspended])).rows[0].banned_until.toISOString(),new Date(later).toISOString(),'Later external ban preserved');
 await fails(()=>request(db,admin,"select public.myevent_admin_action('user',$1,'reactivate')",[suspended]),/autres bannissements/);
 // Rollback is targeted and preserves history/data; repeated install is not allowed.
 await db.exec(await readFile(new URL('../supabase/admin/rollback.sql',import.meta.url),'utf8'));
 equal((await db.query("select count(*)::int n from pg_policies where policyname='admin_account_active_v2'")).rows[0].n,0);
 equal((await db.query('select count(*)::int n from public.admin_audit_log')).rows[0].n>0,true,'Audit retained');
 equal((await db.query('select count(*)::int n from public.social_stories')).rows[0].n,1,'Stories retained');
 console.log(`Admin V2.1 regression: ${checks} checks passed (real migrations, 3 roles, simulated API gate + direct RLS).`);
}finally{await db.close();}
