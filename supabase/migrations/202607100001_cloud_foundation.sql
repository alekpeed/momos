-- Mom Home cloud foundation
-- Run this migration in a new Supabase project before enabling cloud mode.

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'helper', 'viewer')),
  vault_access_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id),
  constraint vault_access_is_owner_only check (vault_access_allowed = false or role = 'owner')
);

create table if not exists public.household_snapshots (
  household_id uuid primary key references public.households(id) on delete cascade,
  state jsonb not null,
  schema_version integer not null default 1,
  revision bigint not null default 1,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table if not exists public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invited_email text not null,
  role text not null check (role in ('admin', 'helper', 'viewer')),
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.household_activity (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  device_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists household_members_user_idx on public.household_members(user_id);
create index if not exists household_activity_household_idx on public.household_activity(household_id, created_at desc);
create index if not exists household_invitations_household_idx on public.household_invitations(household_id);
create index if not exists push_subscriptions_household_idx on public.push_subscriptions(household_id);

create or replace function private.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function private.can_edit_household(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = (select auth.uid())
      and role in ('owner', 'admin', 'helper')
  );
$$;

create or replace function private.can_manage_household(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = (select auth.uid())
      and role in ('owner', 'admin')
  );
$$;

create or replace function private.household_id_from_storage_path(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.can_edit_household(uuid) to authenticated;
grant execute on function private.can_manage_household(uuid) to authenticated;
grant execute on function private.household_id_from_storage_path(text) to authenticated;

create or replace function public.protect_household_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.owner_user_id <> new.owner_user_id then
    raise exception 'Household ownership must be transferred through the dedicated ownership flow.';
  end if;
  return new;
end;
$$;

create or replace function public.protect_owner_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner' or new.user_id <> old.user_id) then
    raise exception 'The owner membership cannot be removed or demoted.';
  end if;
  if tg_op = 'UPDATE' then
    return new;
  end if;
  return old;
end;
$$;

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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_new_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.household_members (household_id, user_id, role)
  values (new.id, new.owner_user_id, 'owner');
  return new;
end;
$$;

drop trigger if exists on_household_created on public.households;
create trigger on_household_created
  after insert on public.households
  for each row execute function public.handle_new_household();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists households_set_updated_at on public.households;
create trigger households_set_updated_at before update on public.households
for each row execute function public.set_updated_at();

drop trigger if exists household_members_set_updated_at on public.household_members;
create trigger household_members_set_updated_at before update on public.household_members
for each row execute function public.set_updated_at();

drop trigger if exists households_protect_owner on public.households;
create trigger households_protect_owner before update on public.households
for each row execute function public.protect_household_owner();

drop trigger if exists household_members_protect_owner on public.household_members;
create trigger household_members_protect_owner before update or delete on public.household_members
for each row execute function public.protect_owner_membership();

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at before update on public.push_subscriptions
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_snapshots enable row level security;
alter table public.household_invitations enable row level security;
alter table public.household_activity enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "Profiles are visible to their owner"
on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy "Users update their own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Members can view households"
on public.households for select to authenticated
using ((select private.is_household_member(id)));

create policy "Authenticated users create their own household"
on public.households for insert to authenticated
with check (owner_user_id = (select auth.uid()));

create policy "Owners and admins update households"
on public.households for update to authenticated
using ((select private.can_manage_household(id)))
with check ((select private.can_manage_household(id)));

create policy "Members can view household membership"
on public.household_members for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "Owners and admins add members"
on public.household_members for insert to authenticated
with check ((select private.can_manage_household(household_id)) and role <> 'owner');

create policy "Owners and admins update members"
on public.household_members for update to authenticated
using ((select private.can_manage_household(household_id)) and role <> 'owner')
with check ((select private.can_manage_household(household_id)) and role <> 'owner');

create policy "Owners and admins remove members"
on public.household_members for delete to authenticated
using ((select private.can_manage_household(household_id)) and role <> 'owner');

create policy "Members can read household snapshots"
on public.household_snapshots for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "Editors can create household snapshots"
on public.household_snapshots for insert to authenticated
with check ((select private.can_edit_household(household_id)) and updated_by = (select auth.uid()));

create policy "Editors can update household snapshots"
on public.household_snapshots for update to authenticated
using ((select private.can_edit_household(household_id)))
with check ((select private.can_edit_household(household_id)) and updated_by = (select auth.uid()));

create or replace function public.save_household_snapshot(
  target_household_id uuid,
  target_state jsonb,
  target_schema_version integer default 1
)
returns public.household_snapshots
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved public.household_snapshots;
begin
  insert into public.household_snapshots (
    household_id,
    state,
    schema_version,
    revision,
    updated_by,
    updated_at
  ) values (
    target_household_id,
    target_state,
    target_schema_version,
    1,
    (select auth.uid()),
    now()
  )
  on conflict (household_id) do update set
    state = excluded.state,
    schema_version = excluded.schema_version,
    revision = public.household_snapshots.revision + 1,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning * into saved;

  return saved;
end;
$$;

grant execute on function public.save_household_snapshot(uuid, jsonb, integer) to authenticated;

create policy "Managers control invitations"
on public.household_invitations for all to authenticated
using ((select private.can_manage_household(household_id)))
with check ((select private.can_manage_household(household_id)) and invited_by = (select auth.uid()));

create policy "Members can read household activity"
on public.household_activity for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "Members can record household activity"
on public.household_activity for insert to authenticated
with check ((select private.is_household_member(household_id)) and actor_user_id = (select auth.uid()));

create policy "Users manage their own push subscriptions"
on public.push_subscriptions for all to authenticated
using (user_id = (select auth.uid()) and (select private.is_household_member(household_id)))
with check (user_id = (select auth.uid()) and (select private.is_household_member(household_id)));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'household-media',
  'household-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Members can read household media"
on storage.objects for select to authenticated
using (
  bucket_id = 'household-media'
  and (select private.is_household_member(private.household_id_from_storage_path(name)))
);

create policy "Editors can upload household media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'household-media'
  and (select private.can_edit_household(private.household_id_from_storage_path(name)))
);

create policy "Editors can update household media"
on storage.objects for update to authenticated
using (
  bucket_id = 'household-media'
  and (select private.can_edit_household(private.household_id_from_storage_path(name)))
)
with check (
  bucket_id = 'household-media'
  and (select private.can_edit_household(private.household_id_from_storage_path(name)))
);

create policy "Editors can delete household media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'household-media'
  and (select private.can_edit_household(private.household_id_from_storage_path(name)))
);
