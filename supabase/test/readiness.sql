-- READ ONLY on NEW TEST project after schema restore, BEFORE Admin 003.
-- No user rows, secrets, email addresses or passwords selected.
select name,to_regclass('public.'||name) is not null as present from unnest(array[
'profiles','events','event_members','messages','message_reads','message_reactions','voice_messages',
'polls','poll_options','poll_votes','media','event_outings','event_outing_plans','event_outing_plan_items',
'event_outing_plan_reservations','event_supplies','event_locations','event_fund_entries','event_fund_settings',
'event_fund_payment_details','event_hall_settings','friendships','friend_invites','social_posts','social_stories',
'social_story_likes','dm_conversations','dm_messages','dm_reads','marketplace_listings','marketplace_threads',
'marketplace_messages','music_playlists','music_tracks','game_rooms','platform_admins','admin_partner_content']) name;
select name,to_regprocedure(name) is not null as present from unnest(array[
'public.myevent_is_admin()','public.myevent_admin_overview()','public.event_protect_identity()',
'public.event_is_visible(uuid,uuid)','public.join_event_by_code(text)','public.leave_event(uuid)',
'public.delete_event(uuid)','public.set_event_coorganizer(uuid,uuid,boolean)']) name;
select id,public,file_size_limit from storage.buckets where id in
('profile-avatars','event-media','event-voices','social-media','story-media','dm-media','marketplace-images');
select schemaname,tablename from pg_publication_tables where pubname='supabase_realtime' order by 1,2;
-- Required absent object? Stop and complete the source schema-only extraction.
-- Do NOT replace with a permissive mock/test schema from tests/*.mjs.
