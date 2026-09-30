-- LIVBRID HQ, module 1: people, workspaces, access and the activity log.
--
-- Rules this file enforces (see CLAUDE.md):
--   * Every brand is walled off: a person only reads a workspace they belong to.
--   * Owner and Team must have passed two-step sign-in (aal2) before the
--     database shows them anything. Client roles arrive in 2027.
--   * Every change is written to the activity log by the database itself.

create schema if not exists private;
grant usage on schema private to authenticated;

create type public.member_role as enum ('owner', 'team', 'client_approver', 'client_viewer');

-- People -------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'One row per signed-in person. Created automatically on first sign-in.';

-- Who may create new brand workspaces. Managed with SQL only, never from the app.
create table public.platform_admins (
  email text primary key check (email = lower(email))
);

-- Workspaces and access ------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  name text not null check (length(name) between 1 and 80),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.workspaces is 'One row per brand. LIVBRID first, Pro Ink next.';

create table public.members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index members_user_id_idx on public.members (user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (email = lower(email) and email like '%_@_%'),
  role public.member_role not null,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (workspace_id, email)
);
create index invites_email_idx on public.invites (email) where accepted_at is null;
create index invites_invited_by_idx on public.invites (invited_by);

-- Activity log -----------------------------------------------------------------

create table public.activity (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  via text not null default 'app' check (via in ('app', 'claude', 'system')),
  action text not null,
  summary text not null,
  created_at timestamptz not null default now()
);
create index activity_workspace_idx on public.activity (workspace_id, created_at desc);
create index activity_actor_idx on public.activity (actor_id);
comment on table public.activity is 'Every change: who, what, when, and whether it came through Claude. Written by triggers only.';

-- Access helpers (private schema: not reachable through the API) --------------

create or replace function private.passed_two_step()
returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal') = 'aal2', false)
$$;

-- The role the current person holds in a workspace, counted only when the
-- sign-in is strong enough for that role. Null means no access.
create or replace function private.active_role(ws uuid)
returns public.member_role
language sql stable security definer
set search_path = ''
as $$
  select m.role
  from public.members m
  where m.workspace_id = ws
    and m.user_id = (select auth.uid())
    and (
      m.role in ('client_approver', 'client_viewer')
      or private.passed_two_step()
    )
$$;

create or replace function private.can_read(ws uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$ select private.active_role(ws) is not null $$;

create or replace function private.can_edit(ws uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$ select coalesce(private.active_role(ws) in ('owner', 'team'), false) $$;

create or replace function private.is_owner(ws uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$ select coalesce(private.active_role(ws) = 'owner', false) $$;

create or replace function private.shares_workspace_with(other uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members mine
    join public.members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = other
      and private.can_read(mine.workspace_id)
  )
$$;

-- 'claude' when the request came through the HQ connector (header x-hq-via).
create or replace function private.request_via()
returns text
language sql stable
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then 'system'
    when coalesce(current_setting('request.headers', true), '') = '' then 'app'
    when (current_setting('request.headers', true)::json ->> 'x-hq-via') = 'claude' then 'claude'
    else 'app'
  end
$$;

grant execute on all functions in schema private to authenticated;

-- Row level security ------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.workspaces enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.activity enable row level security;

-- Nothing is readable without signing in.
revoke all on public.profiles, public.platform_admins, public.workspaces,
  public.members, public.invites, public.activity from anon;
-- platform_admins is managed with SQL only.
revoke all on public.platform_admins from authenticated;
-- The activity log is written by the database, never by a person.
revoke insert, update, delete on public.activity from authenticated;
-- People may only change their own display name.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;
-- Workspaces are created through create_workspace() and renamed by the Owner.
revoke insert, delete on public.workspaces from authenticated;
revoke update on public.workspaces from authenticated;
grant update (name) on public.workspaces to authenticated;
-- Members join through invites; the Owner can change a role or remove someone.
revoke insert on public.members from authenticated;
revoke update on public.members from authenticated;
grant update (role) on public.members to authenticated;

create policy "See yourself and people you work with"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_workspace_with(id));

create policy "Edit your own name"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Members see their workspace"
  on public.workspaces for select to authenticated
  using (private.can_read(id));

create policy "Owner renames the workspace"
  on public.workspaces for update to authenticated
  using (private.is_owner(id))
  with check (private.is_owner(id));

create policy "Members see who else is in the workspace"
  on public.members for select to authenticated
  using (private.can_read(workspace_id));

create policy "Owner changes other people's roles"
  on public.members for update to authenticated
  using (private.is_owner(workspace_id) and user_id <> (select auth.uid()))
  with check (private.is_owner(workspace_id) and user_id <> (select auth.uid()));

create policy "Owner removes other people"
  on public.members for delete to authenticated
  using (private.is_owner(workspace_id) and user_id <> (select auth.uid()));

create policy "Owner sees invites"
  on public.invites for select to authenticated
  using (private.is_owner(workspace_id));

create policy "Owner invites people"
  on public.invites for insert to authenticated
  with check (
    private.is_owner(workspace_id)
    and invited_by = (select auth.uid())
    and accepted_at is null
  );

create policy "Owner cancels invites"
  on public.invites for delete to authenticated
  using (private.is_owner(workspace_id) and accepted_at is null);

create policy "Members read the activity log"
  on public.activity for select to authenticated
  using (private.can_read(workspace_id));

-- Automatic profile on first sign-in ------------------------------------------

create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, lower(new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Activity log triggers -----------------------------------------------------------

create or replace function private.person_label(uid uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
  select coalesce(p.full_name, p.email, 'Someone') from public.profiles p where p.id = uid
$$;

create or replace function private.log_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  ws uuid;
  what text := tg_table_name || '.' || lower(tg_op);
  line text;
begin
  if tg_table_name = 'workspaces' then
    if tg_op = 'INSERT' then
      ws := new.id;
      line := 'Created the workspace ' || new.name;
    elsif tg_op = 'UPDATE' then
      if new.name is not distinct from old.name then
        return null;
      end if;
      ws := new.id;
      line := 'Renamed the workspace from ' || old.name || ' to ' || new.name;
    else
      return null; -- a deleted workspace takes its log with it
    end if;

  elsif tg_table_name = 'members' then
    if tg_op = 'INSERT' then
      ws := new.workspace_id;
      line := coalesce(private.person_label(new.user_id), 'Someone') || ' joined as ' || replace(new.role::text, '_', ' ');
    elsif tg_op = 'UPDATE' then
      if new.role is not distinct from old.role then
        return null;
      end if;
      ws := new.workspace_id;
      line := coalesce(private.person_label(new.user_id), 'Someone') || ' is now ' || replace(new.role::text, '_', ' ');
    else
      ws := old.workspace_id;
      line := coalesce(private.person_label(old.user_id), 'Someone') || ' was removed';
    end if;

  elsif tg_table_name = 'invites' then
    if tg_op = 'INSERT' then
      ws := new.workspace_id;
      line := 'Invited ' || new.email || ' as ' || replace(new.role::text, '_', ' ');
    elsif tg_op = 'DELETE' then
      ws := old.workspace_id;
      line := 'Cancelled the invite for ' || old.email;
    else
      return null; -- accepting an invite is logged as the member joining
    end if;

  else
    return null;
  end if;

  -- Skip rows removed because their whole workspace is being deleted.
  if not exists (select 1 from public.workspaces w where w.id = ws) then
    return null;
  end if;

  insert into public.activity (workspace_id, actor_id, via, action, summary)
  values (ws, (select auth.uid()), private.request_via(), what, line);
  return null;
end;
$$;

create trigger log_workspaces after insert or update on public.workspaces
  for each row execute function private.log_change();
create trigger log_members after insert or update or delete on public.members
  for each row execute function private.log_change();
create trigger log_invites after insert or update or delete on public.invites
  for each row execute function private.log_change();

-- Actions the app calls ------------------------------------------------------------

-- Turns any open invites for the signed-in email address into memberships.
create or replace function public.claim_invites()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  my_email text;
  claimed integer := 0;
begin
  if me is null then
    raise exception 'Sign in first';
  end if;

  select lower(u.email) into my_email
  from auth.users u
  where u.id = me and u.email_confirmed_at is not null;

  if my_email is null then
    return 0;
  end if;

  with opened as (
    update public.invites i
    set accepted_at = now()
    where i.email = my_email and i.accepted_at is null
    returning i.workspace_id, i.role
  ), added as (
    insert into public.members (workspace_id, user_id, role)
    select workspace_id, me, role from opened
    on conflict (workspace_id, user_id) do nothing
    returning 1
  )
  select count(*) into claimed from added;

  return claimed;
end;
$$;

-- Creates a brand workspace with the caller as Owner. Platform admins only.
create or replace function public.create_workspace(p_name text, p_slug text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  new_id uuid;
begin
  if me is null or not private.passed_two_step() then
    raise exception 'Two-step sign-in is required';
  end if;
  if not exists (
    select 1 from public.platform_admins a
    where a.email = lower((select auth.jwt() ->> 'email'))
  ) then
    raise exception 'Only LIVBRID can create workspaces';
  end if;

  insert into public.workspaces (name, slug, created_by)
  values (trim(p_name), lower(trim(p_slug)), me)
  returning id into new_id;

  insert into public.members (workspace_id, user_id, role)
  values (new_id, me, 'owner');

  return new_id;
end;
$$;

revoke execute on function public.claim_invites() from public, anon;
revoke execute on function public.create_workspace(text, text) from public, anon;
grant execute on function public.claim_invites() to authenticated;
grant execute on function public.create_workspace(text, text) to authenticated;

-- First workspace --------------------------------------------------------------------

insert into public.platform_admins (email) values ('raymondboutros@gmail.com');

insert into public.workspaces (slug, name) values ('livbrid', 'LIVBRID');

insert into public.invites (workspace_id, email, role)
select id, 'raymondboutros@gmail.com', 'owner' from public.workspaces where slug = 'livbrid';
