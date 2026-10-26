-- Run exclusively on verified TEST project ahyyknfjsielnqyoxqgh.
-- Existing identities are selected in the database, never printed or changed.
-- All settings mutations are rolled back, including the admin enable/suspend test.
begin;
do $tests$
declare admin_id uuid; member_id uuid; affected integer;
begin
 select a.user_id into admin_id from public.platform_admins a join auth.users u on u.id=a.user_id
 where a.role='super_admin' and (u.banned_until is null or u.banned_until<=now())
 and not exists(select 1 from public.admin_account_controls c where c.user_id=u.id and c.suspended) limit 1;
 select u.id into member_id from auth.users u where (u.banned_until is null or u.banned_until<=now())
 and not exists(select 1 from public.platform_admins a where a.user_id=u.id)
 and not exists(select 1 from public.admin_account_controls c where c.user_id=u.id and c.suspended) limit 1;
 if admin_id is null or member_id is null then raise exception 'Missing TEST role fixture'; end if;
 perform set_config('request.jwt.claim.sub',member_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_id,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if not public.myevent_account_active() or public.myevent_is_admin() then raise exception 'Invalid member fixture'; end if;
 select count(*) into affected from public.automatic_ad_settings;
 if affected<>1 then raise exception 'Active account cannot read settings'; end if;
 update public.automatic_ad_settings set enabled=true where id=true;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Member bypassed admin RLS'; end if;
 begin
  insert into public.automatic_ad_settings(id) values(false);
  raise exception 'Insert unexpectedly allowed';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.automatic_ad_settings;
  raise exception 'Delete unexpectedly allowed';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if not public.myevent_is_admin() or not public.myevent_account_active() then raise exception 'Invalid admin fixture'; end if;
 update public.automatic_ad_settings set enabled=true,spacing=8,max_slots=2 where id=true;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Admin save failed'; end if;
 update public.automatic_ad_settings set enabled=false where id=true;
 if exists(select 1 from public.automatic_ad_settings where enabled) then raise exception 'Admin suspension failed'; end if;
 begin
  update public.automatic_ad_settings set spacing=4;
  raise exception 'Spacing constraint bypassed';
 exception when check_violation then null; end;
 begin
  update public.automatic_ad_settings set max_slots=3;
  raise exception 'Cap constraint bypassed';
 exception when check_violation then null; end;
 begin
  update public.automatic_ad_settings set publisher_id='invalid';
  raise exception 'Provider constraint bypassed';
 exception when check_violation then null; end;
 begin
  update public.automatic_ad_settings set id=true;
  raise exception 'Identity column unexpectedly writable';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 execute 'set local role authenticated';
 select count(*) into affected from public.automatic_ad_settings;
 if affected<>0 then raise exception 'Inactive identity can read settings'; end if;
 update public.automatic_ad_settings set enabled=true;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Inactive identity can update'; end if;
 execute 'reset role';
 execute 'set local role anon';
 begin
  perform * from public.automatic_ad_settings;
  raise exception 'Anonymous read unexpectedly allowed';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
end $tests$;
select 'PASS: TEST admin/member/inactive/anonymous RLS, suspension and constraints; all changes rolled back' as result;
rollback;
