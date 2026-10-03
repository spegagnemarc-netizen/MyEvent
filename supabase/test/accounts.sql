-- TEST ONLY: after creating exactly three NEW fictitious accounts via Auth UI.
-- No password or API key belongs in SQL or in this repository.
-- Replace the 3 UUID placeholders locally with IDs from the NEW project's Auth UI.
-- Do not run unchanged. Do not seed auth.users directly.
begin;
do $$ declare a uuid:='00000000-0000-0000-0000-00000000000a';
 b uuid:='00000000-0000-0000-0000-00000000000b';c uuid:='00000000-0000-0000-0000-00000000000c';
 runtime_ref text; begin
 -- Independent identity setup requires an explicit project-local confirmation.
 runtime_ref:=current_setting('myevent.test_project_ref',true);
 if runtime_ref is null or runtime_ref='' or runtime_ref='nxxvadbliinhvkirqkkl' then
  raise exception 'Confirmer le projet TEST avant création des profils';end if;
 if a::text like '00000000-%' or b::text like '00000000-%' or c::text like '00000000-%' then
  raise exception 'Remplacer les trois UUID par les identités fictives du projet TEST';end if;
 if a=b or a=c or b=c or (select count(*) from auth.users where id in(a,b,c))<>3 or (select count(*) from auth.users)<>3 then
  raise exception 'Trois comptes Auth distincts sont requis';end if;
 if (select count(*) from auth.users where (id=a and email='myevent-a@example.invalid') or (id=b and email='myevent-b@example.invalid') or (id=c and email='myevent-c@example.invalid'))<>3 then
  raise exception 'Utiliser exclusivement les trois adresses fictives prescrites';end if;
 insert into public.profiles(id,display_name,username,avatar) values
 (a,'Admin Test A','myevent_test_a','🛡️'),(b,'Membre Test B','myevent_test_b','🧪'),(c,'Membre Test C','myevent_test_c','🧪')
 on conflict(id) do update set display_name=excluded.display_name,username=excluded.username,avatar=excluded.avatar;
 insert into public.platform_admins(user_id,role) values(a,'super_admin') on conflict(user_id) do update set role='super_admin';
 if exists(select 1 from public.platform_admins where user_id in(b,c)) then
  raise exception 'B et C doivent être des utilisateurs classiques';end if;
end $$;
commit;
-- In the same SQL Editor execution, set confirmation BEFORE this transaction:
-- select set_config('myevent.test_project_ref','<NEW_TEST_PROJECT_REF>',false);
-- This operator confirmation supplements (not replaces) checking the Dashboard URL.
