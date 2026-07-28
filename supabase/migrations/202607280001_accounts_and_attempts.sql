create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  target_criteria text,
  target_role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_attempt_id text not null,
  module_name text not null,
  mode text,
  difficulty text,
  accuracy numeric(5, 2),
  result jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, client_attempt_id)
);

create index if not exists attempts_user_completed_idx
  on public.attempts (user_id, completed_at desc);

alter table public.profiles enable row level security;
alter table public.attempts enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "attempts_select_own" on public.attempts;
create policy "attempts_select_own"
  on public.attempts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "attempts_insert_own" on public.attempts;
create policy "attempts_insert_own"
  on public.attempts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "attempts_update_own" on public.attempts;
create policy "attempts_update_own"
  on public.attempts
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "attempts_delete_own" on public.attempts;
create policy "attempts_delete_own"
  on public.attempts
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.attempts to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, display_name)
select
  id,
  nullif(trim(raw_user_meta_data ->> 'display_name'), '')
from auth.users
on conflict (id) do nothing;
