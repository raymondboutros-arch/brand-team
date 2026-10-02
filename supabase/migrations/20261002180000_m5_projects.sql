-- LIVBRID HQ, module 5: Projects, with Owner-only project money (2 Oct 2026).
-- Studio modules live only in the studio's own workspace (LIVBRID), never in a client's.
-- Projects: Owner and Team read and edit. Money, hours and the profit range: Owner only.
-- No figures are stored in this file; the history is imported separately.

-- Which workspace is the studio --------------------------------------------------------

alter table public.workspaces add column is_studio boolean not null default false;
update public.workspaces set is_studio = true where slug = 'livbrid';

-- Only the database (or a platform migration) decides which workspace is the studio.
create or replace function private.keep_studio_flag()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.is_studio := case when tg_op = 'UPDATE' then old.is_studio else false end;
  end if;
  return new;
end;
$$;

create trigger keep_studio_flag before insert or update on public.workspaces
  for each row execute function private.keep_studio_flag();

create or replace function private.is_studio(ws uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$ select coalesce((select w.is_studio from public.workspaces w where w.id = ws), false) $$;

grant execute on function private.is_studio(uuid) to authenticated;

-- Owner-only lines in the activity log (money changes) ---------------------------------

alter table public.activity add column owner_only boolean not null default false;

alter policy "Members read the activity log" on public.activity
  using (private.can_read(workspace_id) and (not owner_only or private.is_owner(workspace_id)));

-- Projects -------------------------------------------------------------------------------

create type public.project_status as enum ('signed', 'in_progress', 'delivered', 'closed', 'lost');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  number int not null,
  client text not null check (char_length(client) between 2 and 120),
  sector text check (sector is null or char_length(sector) <= 120),
  client_type text check (client_type in ('family', 'founder', 'ngo', 'corporate', 'own', 'other')),
  source text check (source in ('referral', 'someone_we_knew', 'google', 'ai', 'social', 'tender', 'other')),
  buyer text check (buyer is null or char_length(buyer) <= 120),
  brief text check (brief is null or char_length(brief) <= 2000),
  real_need text check (real_need is null or char_length(real_need) <= 2000),
  deliverables text check (deliverables is null or char_length(deliverables) <= 2000),
  lead_person text check (lead_person is null or char_length(lead_person) <= 80),
  status public.project_status not null default 'signed',
  year int check (year is null or year between 2000 and 2100),
  starts_on date,
  ends_on date check (ends_on is null or starts_on is null or ends_on >= starts_on),
  duration text check (duration is null or char_length(duration) <= 40),
  price_usd numeric(12, 2) check (price_usd is null or price_usd >= 0),
  -- Close-out: facts, not scores.
  referred text check (referred in ('yes', 'no', 'maybe')),
  came_back text check (came_back in ('yes', 'no', 'maybe')),
  five_more text check (five_more in ('yes', 'no', 'maybe')),
  brand_to_website text check (brand_to_website in ('yes', 'no', 'na')),
  proof text check (proof in ('both', 'result', 'testimonial', 'neither')),
  result text check (result is null or char_length(result) <= 2000),
  testimonial text check (testimonial is null or char_length(testimonial) <= 2000),
  may_name boolean not null default false,
  may_name_note text check (may_name_note is null or char_length(may_name_note) <= 300),
  lost_said text check (lost_said is null or char_length(lost_said) <= 1000),
  lost_think text check (lost_think is null or char_length(lost_think) <= 1000),
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (workspace_id, number),
  unique (id, workspace_id)
);
create index projects_workspace_status_idx on public.projects (workspace_id, status);
create index projects_created_by_idx on public.projects (created_by);
create index projects_updated_by_idx on public.projects (updated_by);

-- Owner only: invoices, payments and outside costs, one line each.
create table public.project_money (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  kind text not null check (kind in ('invoiced', 'paid', 'cost')),
  category text check (
    (kind = 'cost' and category in ('freelancer', 'team_share', 'hosting', 'print', 'ads', 'software', 'other'))
    or (kind <> 'cost' and category is null)
  ),
  amount_usd numeric(12, 2) not null check (amount_usd > 0),
  on_date date not null default current_date,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id) on delete cascade
);
create index project_money_project_idx on public.project_money (project_id, workspace_id);
create index project_money_workspace_idx on public.project_money (workspace_id);
create index project_money_created_by_idx on public.project_money (created_by);

-- Owner only: hours per person per week.
create table public.project_hours (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  person text not null check (char_length(person) between 1 and 80),
  week_of date not null,
  hours numeric(5, 2) not null check (hours > 0 and hours <= 100),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id) on delete cascade
);
create index project_hours_project_idx on public.project_hours (project_id, workspace_id);
create index project_hours_workspace_idx on public.project_hours (workspace_id);
create index project_hours_created_by_idx on public.project_hours (created_by);

-- Owner only: the profit range from the audit and a private note.
create table public.project_private (
  project_id uuid primary key,
  workspace_id uuid not null,
  profit_range text check (profit_range in ('lost_money', 'broke_even', 'healthy', 'excellent')),
  note text check (note is null or char_length(note) <= 2000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id) on delete cascade
);
create index project_private_workspace_idx on public.project_private (workspace_id);
create index project_private_updated_by_idx on public.project_private (updated_by);

-- Numbers (P1, P2...) and stamps ------------------------------------------------------------

create or replace function private.prepare_project()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended('projects' || new.workspace_id::text, 0));
    select coalesce(max(p.number), 0) + 1 into new.number
    from public.projects p where p.workspace_id = new.workspace_id;
    new.created_at := now();
    new.created_by := (select auth.uid());
  else
    new.id := old.id;
    new.workspace_id := old.workspace_id;
    new.number := old.number;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger prepare_project before insert or update on public.projects
  for each row execute function private.prepare_project();

create or replace function private.stamp_owner_row()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'project_private' then
    if tg_op = 'UPDATE' then
      new.project_id := old.project_id;
      new.workspace_id := old.workspace_id;
    end if;
    new.updated_at := now();
    new.updated_by := (select auth.uid());
  else
    if tg_op = 'INSERT' then
      new.created_at := now();
      new.created_by := (select auth.uid());
    else
      new.id := old.id;
      new.workspace_id := old.workspace_id;
      new.project_id := old.project_id;
      new.created_at := old.created_at;
      new.created_by := old.created_by;
    end if;
  end if;
  return new;
end;
$$;

create trigger stamp_project_money before insert or update on public.project_money
  for each row execute function private.stamp_owner_row();
create trigger stamp_project_hours before insert or update on public.project_hours
  for each row execute function private.stamp_owner_row();
create trigger stamp_project_private before insert or update on public.project_private
  for each row execute function private.stamp_owner_row();

-- Activity log --------------------------------------------------------------------------------
-- Project lines are seen by everyone who sees the workspace. Money lines are Owner only.

create or replace function private.project_status_label(s text)
returns text
language sql immutable
set search_path = ''
as $$
  select case s
    when 'signed' then 'Signed'
    when 'in_progress' then 'In progress'
    when 'delivered' then 'Delivered'
    when 'closed' then 'Closed'
    when 'lost' then 'Lost'
    else s
  end
$$;

create or replace function private.log_project_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  rec record;
  ws uuid;
  pname text;
  line text;
  secret boolean := false;
begin
  if coalesce(current_setting('app.skip_log', true), '') = 'on' then
    return null;
  end if;

  if tg_op = 'DELETE' then rec := old; else rec := new; end if;
  ws := rec.workspace_id;
  if not exists (select 1 from public.workspaces w where w.id = ws) then
    return null;
  end if;

  if tg_table_name = 'projects' then
    pname := 'P' || rec.number || ', ' || rec.client;
    if tg_op = 'INSERT' then
      line := 'Added the project ' || pname;
    elsif tg_op = 'DELETE' then
      line := 'Removed the project ' || pname;
    elsif new.status is distinct from old.status then
      line := pname || ' moved from ' || private.project_status_label(old.status::text)
        || ' to ' || private.project_status_label(new.status::text);
    elsif new.may_name and not old.may_name then
      line := pname || ': we may now name the client';
    else
      line := 'Updated the project ' || pname;
    end if;
  else
    secret := true;
    select 'P' || p.number || ', ' || p.client into pname
    from public.projects p where p.id = rec.project_id;
    if pname is null then
      return null;
    end if;
    if tg_table_name = 'project_money' then
      line := case tg_op when 'DELETE' then 'Removed ' else 'Recorded ' end
        || case rec.kind when 'invoiced' then 'an invoice' when 'paid' then 'a payment' else 'a cost' end
        || ' of USD ' || to_char(rec.amount_usd, 'FM999,999,990.00') || ' on ' || pname;
    elsif tg_table_name = 'project_hours' then
      line := case tg_op when 'DELETE' then 'Removed ' else 'Logged ' end
        || rec.hours || ' hours for ' || rec.person || ' on ' || pname;
    else
      line := 'Updated the private notes on ' || pname;
    end if;
  end if;

  insert into public.activity (workspace_id, actor_id, via, action, summary, owner_only)
  values (ws, (select auth.uid()), private.request_via(), tg_table_name || '.' || lower(tg_op), left(line, 500), secret);
  return null;
end;
$$;

create trigger log_projects after insert or update or delete on public.projects
  for each row execute function private.log_project_change();
create trigger log_project_money after insert or update or delete on public.project_money
  for each row execute function private.log_project_change();
create trigger log_project_hours after insert or update or delete on public.project_hours
  for each row execute function private.log_project_change();
create trigger log_project_private after insert or update on public.project_private
  for each row execute function private.log_project_change();

-- Row level security --------------------------------------------------------------------------

alter table public.projects enable row level security;
alter table public.project_money enable row level security;
alter table public.project_hours enable row level security;
alter table public.project_private enable row level security;
revoke all on public.projects, public.project_money, public.project_hours, public.project_private from anon;

create policy "Studio reads projects" on public.projects
  for select to authenticated using (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Studio adds projects" on public.projects
  for insert to authenticated with check (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Studio edits projects" on public.projects
  for update to authenticated
  using (private.is_studio(workspace_id) and private.can_edit(workspace_id))
  with check (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Owner removes projects" on public.projects
  for delete to authenticated using (private.is_studio(workspace_id) and private.is_owner(workspace_id));

create policy "Owner reads money" on public.project_money
  for select to authenticated using (private.is_studio(workspace_id) and private.is_owner(workspace_id));
create policy "Owner adds money" on public.project_money
  for insert to authenticated with check (private.is_studio(workspace_id) and private.is_owner(workspace_id));
create policy "Owner edits money" on public.project_money
  for update to authenticated
  using (private.is_studio(workspace_id) and private.is_owner(workspace_id))
  with check (private.is_studio(workspace_id) and private.is_owner(workspace_id));
create policy "Owner removes money" on public.project_money
  for delete to authenticated using (private.is_studio(workspace_id) and private.is_owner(workspace_id));

create policy "Owner reads hours" on public.project_hours
  for select to authenticated using (private.is_studio(workspace_id) and private.is_owner(workspace_id));
create policy "Owner adds hours" on public.project_hours
  for insert to authenticated with check (private.is_studio(workspace_id) and private.is_owner(workspace_id));
create policy "Owner edits hours" on public.project_hours
  for update to authenticated
  using (private.is_studio(workspace_id) and private.is_owner(workspace_id))
  with check (private.is_studio(workspace_id) and private.is_owner(workspace_id));
create policy "Owner removes hours" on public.project_hours
  for delete to authenticated using (private.is_studio(workspace_id) and private.is_owner(workspace_id));

create policy "Owner reads private notes" on public.project_private
  for select to authenticated using (private.is_studio(workspace_id) and private.is_owner(workspace_id));
create policy "Owner adds private notes" on public.project_private
  for insert to authenticated with check (private.is_studio(workspace_id) and private.is_owner(workspace_id));
create policy "Owner edits private notes" on public.project_private
  for update to authenticated
  using (private.is_studio(workspace_id) and private.is_owner(workspace_id))
  with check (private.is_studio(workspace_id) and private.is_owner(workspace_id));
create policy "Owner removes private notes" on public.project_private
  for delete to authenticated using (private.is_studio(workspace_id) and private.is_owner(workspace_id));
