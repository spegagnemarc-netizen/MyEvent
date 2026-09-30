-- MyEvent — "Qui fait quoi ?" event tasks.
create table if not exists public.event_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 180),
  note text,
  due_at timestamptz,
  status text not null default 'todo' check (status in ('todo','doing','done')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_task_assignees (
  task_id uuid not null references public.event_tasks(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id,user_id)
);

create index if not exists event_tasks_event_idx on public.event_tasks(event_id);
create index if not exists event_task_assignees_event_idx on public.event_task_assignees(event_id);
create index if not exists event_task_assignees_user_idx on public.event_task_assignees(user_id);

alter table public.event_tasks enable row level security;
alter table public.event_task_assignees enable row level security;

drop policy if exists "event_tasks_select" on public.event_tasks;
create policy "event_tasks_select" on public.event_tasks for select to authenticated
using (public.event_is_member(event_id));

drop policy if exists "event_tasks_insert" on public.event_tasks;
create policy "event_tasks_insert" on public.event_tasks for insert to authenticated
with check (created_by=auth.uid() and public.event_is_member(event_id));

drop policy if exists "event_tasks_update" on public.event_tasks;
create policy "event_tasks_update" on public.event_tasks for update to authenticated
using (
  public.event_is_manager(event_id)
  or created_by=auth.uid()
  or exists(select 1 from public.event_task_assignees a where a.task_id=id and a.user_id=auth.uid())
)
with check (public.event_is_member(event_id));

drop policy if exists "event_tasks_delete" on public.event_tasks;
create policy "event_tasks_delete" on public.event_tasks for delete to authenticated
using (public.event_is_manager(event_id) or created_by=auth.uid());

drop policy if exists "event_task_assignees_select" on public.event_task_assignees;
create policy "event_task_assignees_select" on public.event_task_assignees for select to authenticated
using (public.event_is_member(event_id));

drop policy if exists "event_task_assignees_insert" on public.event_task_assignees;
create policy "event_task_assignees_insert" on public.event_task_assignees for insert to authenticated
with check (
  public.event_is_member(event_id)
  and (user_id=auth.uid() or public.event_is_manager(event_id))
  and exists(select 1 from public.event_tasks t where t.id=task_id and t.event_id=event_id)
);

drop policy if exists "event_task_assignees_delete" on public.event_task_assignees;
create policy "event_task_assignees_delete" on public.event_task_assignees for delete to authenticated
using (user_id=auth.uid() or public.event_is_manager(event_id));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='event_tasks') then
    alter publication supabase_realtime add table public.event_tasks;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='event_task_assignees') then
    alter publication supabase_realtime add table public.event_task_assignees;
  end if;
end $$;
