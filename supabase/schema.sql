-- SC-500 Field Manual: one progress row per signed-in user.
-- Run once in Supabase: SQL Editor > New query > paste > Run.

create table if not exists public.sc500_progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.sc500_progress enable row level security;

-- Each user can only see and change their own row.
drop policy if exists "read own progress"   on public.sc500_progress;
drop policy if exists "insert own progress" on public.sc500_progress;
drop policy if exists "update own progress" on public.sc500_progress;
drop policy if exists "delete own progress" on public.sc500_progress;

create policy "read own progress"   on public.sc500_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own progress" on public.sc500_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own progress" on public.sc500_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own progress" on public.sc500_progress for delete to authenticated using ((select auth.uid()) = user_id);

-- Anonymous visitors get nothing.
revoke all on public.sc500_progress from anon;
grant select, insert, update, delete on public.sc500_progress to authenticated;
