-- LIVBRID HQ, module 8: Channels (3 Oct 2026, planned for 23 Oct).
-- Every account a brand has: social profiles, review sites, directories, Google and domains.
-- Who owns it, which email it is under, whether two-step sign-in is on and whether the login is
-- in the password manager. No passwords, ever: there is no column for one. Live numbers and the
-- connection itself come later, through each platform's official sign-in.

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null default 'social' check (kind in ('reviews', 'directory', 'google', 'social', 'website')),
  platform text not null check (char_length(platform) between 2 and 60),
  shown_name text check (shown_name is null or char_length(shown_name) <= 120),
  handle text check (handle is null or char_length(handle) <= 120),
  url text check (url is null or (char_length(url) <= 500 and url ~ '^https?://[^[:space:]]+$')),
  owner text check (owner is null or char_length(owner) <= 80),
  login_email text check (login_email is null or (char_length(login_email) <= 200 and login_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  two_step boolean,
  in_vault boolean,
  status text not null default 'to_check' check (status in ('to_check', 'needs_update', 'up_to_date', 'to_claim', 'to_close')),
  connection text not null default 'not_connected' check (connection in ('not_connected', 'connected', 'broken')),
  note text check (note is null or char_length(note) <= 2000),
  checked_on date,
  position int not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create index channels_workspace_idx on public.channels (workspace_id, kind, position);
create unique index channels_workspace_url_key on public.channels (workspace_id, lower(url)) where url is not null;
create index channels_created_by_idx on public.channels (created_by);
create index channels_updated_by_idx on public.channels (updated_by);

comment on table public.channels is 'Every account a brand has, with its owner and sign-in safety. No passwords.';

-- Stamps --------------------------------------------------------------------------------------

create or replace function private.stamp_channel_row()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := (select auth.uid());
  else
    new.id := old.id;
    new.workspace_id := old.workspace_id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger stamp_channels before insert or update on public.channels
  for each row execute function private.stamp_channel_row();

-- Activity log: names what changed, never the values (an email address stays out of the log) ----

create or replace function private.channel_status_label(s text)
returns text
language sql immutable
set search_path = ''
as $$
  select case s
    when 'to_check' then 'Not checked'
    when 'needs_update' then 'Needs update'
    when 'up_to_date' then 'Up to date'
    when 'to_claim' then 'To claim'
    when 'to_close' then 'To close'
    else s
  end
$$;

create or replace function private.log_channel_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  rec record;
  line text;
  changed text[] := '{}';
begin
  if coalesce(current_setting('app.skip_log', true), '') = 'on' then
    return null;
  end if;
  if tg_op = 'DELETE' then rec := old; else rec := new; end if;
  if not exists (select 1 from public.workspaces w where w.id = rec.workspace_id) then
    return null;
  end if;

  if tg_op = 'INSERT' then
    line := 'Added the channel ' || rec.platform || coalesce(' (' || rec.shown_name || ')', '');
  elsif tg_op = 'DELETE' then
    line := 'Removed the channel ' || rec.platform || coalesce(' (' || rec.shown_name || ')', '');
  else
    if new.status is distinct from old.status then
      line := rec.platform || ' moved from ' || private.channel_status_label(old.status)
        || ' to ' || private.channel_status_label(new.status);
    else
      if new.platform is distinct from old.platform or new.kind is distinct from old.kind then changed := changed || 'platform'; end if;
      if new.shown_name is distinct from old.shown_name or new.handle is distinct from old.handle then changed := changed || 'name'; end if;
      if new.url is distinct from old.url then changed := changed || 'link'; end if;
      if new.owner is distinct from old.owner then changed := changed || 'owner'; end if;
      if new.login_email is distinct from old.login_email then changed := changed || 'login email'; end if;
      if new.two_step is distinct from old.two_step then changed := changed || 'two-step sign-in'; end if;
      if new.in_vault is distinct from old.in_vault then changed := changed || 'password manager'; end if;
      if new.note is distinct from old.note or new.checked_on is distinct from old.checked_on then changed := changed || 'notes'; end if;
      if new.connection is distinct from old.connection then changed := changed || 'connection'; end if;
      if cardinality(changed) = 0 then
        return null;
      end if;
      line := 'Updated ' || rec.platform || ': ' || array_to_string(changed, ', ');
    end if;
  end if;

  insert into public.activity (workspace_id, actor_id, via, action, summary)
  values (rec.workspace_id, (select auth.uid()), private.request_via(), 'channels.' || lower(tg_op), left(line, 500));
  return null;
end;
$$;

create trigger log_channels after insert or update or delete on public.channels
  for each row execute function private.log_channel_change();

-- Row level security --------------------------------------------------------------------------
-- Everyone in the workspace sees its channels; Owner and Team add and change them; only the
-- Owner removes one.

alter table public.channels enable row level security;
revoke all on public.channels from anon;

create policy "Members read channels" on public.channels
  for select to authenticated using (private.can_read(workspace_id));
create policy "Owner and Team add channels" on public.channels
  for insert to authenticated with check (private.can_edit(workspace_id));
create policy "Owner and Team edit channels" on public.channels
  for update to authenticated
  using (private.can_edit(workspace_id))
  with check (private.can_edit(workspace_id));
create policy "Owner removes channels" on public.channels
  for delete to authenticated using (private.is_owner(workspace_id));
