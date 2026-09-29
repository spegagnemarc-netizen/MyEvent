-- Marketplace unread state for V1.
alter table public.marketplace_threads
  add column if not exists buyer_last_read_at timestamptz,
  add column if not exists seller_last_read_at timestamptz;

create or replace function public.marketplace_mark_thread_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  t public.marketplace_threads;
begin
  if caller is null then raise exception 'Authentification requise'; end if;
  select * into t from public.marketplace_threads where id=p_thread_id;
  if not found or caller not in (t.buyer_id,t.seller_id) then raise exception 'Conversation inaccessible'; end if;
  if caller=t.buyer_id then
    update public.marketplace_threads set buyer_last_read_at=now() where id=p_thread_id;
  else
    update public.marketplace_threads set seller_last_read_at=now() where id=p_thread_id;
  end if;
end $$;

revoke all on function public.marketplace_mark_thread_read(uuid) from public,anon;
grant execute on function public.marketplace_mark_thread_read(uuid) to authenticated;

create or replace function public.marketplace_unread_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.marketplace_messages m
  join public.marketplace_threads t on t.id=m.thread_id
  where auth.uid() in (t.buyer_id,t.seller_id)
    and m.sender_id<>auth.uid()
    and m.created_at > coalesce(
      case when auth.uid()=t.buyer_id then t.buyer_last_read_at else t.seller_last_read_at end,
      '-infinity'::timestamptz
    );
$$;

revoke all on function public.marketplace_unread_count() from public,anon;
grant execute on function public.marketplace_unread_count() to authenticated;
