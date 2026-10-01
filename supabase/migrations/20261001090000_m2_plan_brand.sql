-- LIVBRID HQ, modules 2 and 3 (brought forward on 1 Oct 2026):
-- the plan (workstreams, tasks, decisions, roadmap), the scorecard,
-- the brand strategy (fixed lines with history, step sections) and reference pages.
-- Same rules as module 1: every row has workspace_id, reads need can_read,
-- writes need can_edit, and brand changes need the Owner.

create type public.task_status as enum ('not_started', 'in_progress', 'waiting', 'done');
create type public.decision_status as enum ('open', 'decided');

-- Long-form pages: plan notes, strategy steps, reference -----------------------

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  area text not null check (area in ('plan', 'strategy', 'reference')),
  key text not null check (key ~ '^[a-z0-9][a-z0-9-]{0,60}$'),
  title text not null,
  summary text,
  status text,
  body_md text not null default '',
  position int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (workspace_id, area, key)
);
create index sections_updated_by_idx on public.sections (updated_by);

-- Plan ------------------------------------------------------------------------------

create table public.workstreams (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  number int not null,
  title text not null,
  summary_md text not null default '',
  extra_md text not null default '',
  position int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (workspace_id, number),
  unique (id, workspace_id)
);
create index workstreams_updated_by_idx on public.workstreams (updated_by);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  workstream_id uuid,
  title text not null,
  owner text,
  due_on date,
  status public.task_status not null default 'not_started',
  this_week boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  foreign key (workstream_id, workspace_id) references public.workstreams (id, workspace_id) on delete cascade
);
create index tasks_workspace_idx on public.tasks (workspace_id, due_on);
create index tasks_workstream_idx on public.tasks (workstream_id, workspace_id);
create index tasks_updated_by_idx on public.tasks (updated_by);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code text check (code ~ '^D[0-9]{1,3}$'),
  title text not null,
  recommendation text,
  due_on date,
  status public.decision_status not null default 'open',
  outcome text,
  decided_on date,
  decided_label text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (workspace_id, code)
);
create index decisions_updated_by_idx on public.decisions (updated_by);

create table public.roadmap_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key text not null,
  label text not null,
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  highlight boolean not null default false,
  position int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (workspace_id, key)
);
create index roadmap_items_updated_by_idx on public.roadmap_items (updated_by);

-- Scorecard ------------------------------------------------------------------------

create table public.metrics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key text not null,
  label text not null,
  goal_label text,
  baseline text,
  counts text not null default 'month' check (counts in ('month', 'total')),
  position int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (workspace_id, key),
  unique (id, workspace_id)
);
create index metrics_updated_by_idx on public.metrics (updated_by);

create table public.metric_targets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  metric_id uuid not null,
  on_date date not null,
  value text not null,
  unique (metric_id, on_date),
  foreign key (metric_id, workspace_id) references public.metrics (id, workspace_id) on delete cascade
);
create index metric_targets_ws_idx on public.metric_targets (metric_id, workspace_id);

create table public.metric_values (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  metric_id uuid not null,
  month date not null check (extract(day from month) = 1),
  value text not null,
  note text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (metric_id, month),
  foreign key (metric_id, workspace_id) references public.metrics (id, workspace_id) on delete cascade
);
create index metric_values_ws_idx on public.metric_values (metric_id, workspace_id);
create index metric_values_updated_by_idx on public.metric_values (updated_by);

-- Brand: the lines that never change, with every past version kept ---------------

create table public.brand_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key text not null,
  label text not null,
  words text not null,
  where_used text,
  position int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (workspace_id, key),
  unique (id, workspace_id)
);
create index brand_lines_updated_by_idx on public.brand_lines (updated_by);

create table public.brand_line_versions (
  id bigint generated always as identity primary key,
  workspace_id uuid not null,
  line_id uuid not null,
  words text not null,
  valid_until timestamptz not null default now(),
  replaced_by uuid references auth.users (id) on delete set null,
  foreign key (line_id, workspace_id) references public.brand_lines (id, workspace_id) on delete cascade
);
create index brand_line_versions_line_idx on public.brand_line_versions (line_id, workspace_id);
create index brand_line_versions_replaced_by_idx on public.brand_line_versions (replaced_by);

-- Stamps and history ---------------------------------------------------------------

create or replace function private.stamp_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger stamp_sections before update on public.sections for each row execute function private.stamp_update();
create trigger stamp_workstreams before update on public.workstreams for each row execute function private.stamp_update();
create trigger stamp_tasks before update on public.tasks for each row execute function private.stamp_update();
create trigger stamp_decisions before update on public.decisions for each row execute function private.stamp_update();
create trigger stamp_roadmap before update on public.roadmap_items for each row execute function private.stamp_update();
create trigger stamp_metrics before update on public.metrics for each row execute function private.stamp_update();
create trigger stamp_metric_values before update on public.metric_values for each row execute function private.stamp_update();
create trigger stamp_brand_lines before update on public.brand_lines for each row execute function private.stamp_update();

create or replace function private.keep_brand_line_version()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.words is distinct from old.words then
    insert into public.brand_line_versions (workspace_id, line_id, words, replaced_by)
    values (old.workspace_id, old.id, old.words, (select auth.uid()));
  end if;
  return new;
end;
$$;

create trigger brand_line_history before update on public.brand_lines
  for each row execute function private.keep_brand_line_version();

-- Activity log for the new tables --------------------------------------------------

create or replace function private.status_label(s text)
returns text
language sql immutable
set search_path = ''
as $$ select initcap(replace(s, '_', ' ')) $$;

create or replace function private.log_content_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  rec record;
  ws uuid;
  line text;
begin
  -- Bulk imports switch the per-row log off and write one summary line instead.
  if coalesce(current_setting('app.skip_log', true), '') = 'on' then
    return null;
  end if;

  if tg_op = 'DELETE' then rec := old; else rec := new; end if;
  ws := rec.workspace_id;

  if tg_table_name = 'tasks' then
    if tg_op = 'INSERT' then
      line := 'Added the task "' || new.title || '"';
    elsif tg_op = 'DELETE' then
      line := 'Removed the task "' || old.title || '"';
    elsif new.status is distinct from old.status then
      line := '"' || new.title || '" moved from ' || private.status_label(old.status::text) || ' to ' || private.status_label(new.status::text);
    elsif new.due_on is distinct from old.due_on then
      line := '"' || new.title || '" is now due ' || coalesce(to_char(new.due_on, 'FMDD Mon YYYY'), 'with no date');
    else
      line := 'Updated the task "' || new.title || '"';
    end if;

  elsif tg_table_name = 'decisions' then
    if tg_op = 'INSERT' then
      line := 'Added the decision ' || coalesce(new.code || ' ', '') || '"' || new.title || '"';
    elsif tg_op = 'DELETE' then
      line := 'Removed the decision ' || coalesce(old.code || ' ', '') || '"' || old.title || '"';
    elsif new.status = 'decided' and old.status = 'open' then
      line := 'Decided ' || coalesce(new.code || ', ', '') || new.title || ': ' || coalesce(new.outcome, new.recommendation, '');
    elsif new.status = 'open' and old.status = 'decided' then
      line := 'Reopened ' || coalesce(new.code || ', ', '') || new.title;
    else
      line := 'Updated the decision ' || coalesce(new.code || ', ', '') || new.title;
    end if;

  elsif tg_table_name = 'brand_lines' then
    if tg_op = 'INSERT' then
      line := 'Added the fixed line "' || new.label || '"';
    elsif tg_op = 'DELETE' then
      line := 'Removed the fixed line "' || old.label || '"';
    elsif new.words is distinct from old.words then
      line := 'Changed the ' || lower(new.label) || ' to: ' || new.words;
    else
      line := 'Updated the fixed line "' || new.label || '"';
    end if;

  elsif tg_table_name = 'sections' then
    if tg_op = 'INSERT' then
      line := 'Added "' || new.title || '"';
    elsif tg_op = 'DELETE' then
      line := 'Removed "' || old.title || '"';
    elsif new.status is distinct from old.status then
      line := new.title || ' is now ' || coalesce(new.status, 'without a status');
    else
      line := 'Edited "' || new.title || '"';
    end if;

  elsif tg_table_name = 'metric_values' then
    line := 'Scorecard ' || to_char(rec.month, 'Mon YYYY') || ': '
      || coalesce((select m.label from public.metrics m where m.id = rec.metric_id), 'a number')
      || case when tg_op = 'DELETE' then ' cleared' else ' = ' || rec.value end;

  elsif tg_table_name = 'workstreams' then
    line := case tg_op when 'INSERT' then 'Added workstream ' else 'Updated workstream ' end
      || rec.number || ', ' || rec.title;

  elsif tg_table_name = 'roadmap_items' then
    line := case tg_op when 'INSERT' then 'Added to the roadmap: ' when 'DELETE' then 'Removed from the roadmap: ' else 'Moved on the roadmap: ' end
      || rec.label || ' (' || to_char(rec.starts_on, 'FMDD Mon') || case when rec.ends_on <> rec.starts_on then ' to ' || to_char(rec.ends_on, 'FMDD Mon YYYY') else ' ' || to_char(rec.starts_on, 'YYYY') end || ')';

  else
    return null;
  end if;

  if not exists (select 1 from public.workspaces w where w.id = ws) then
    return null;
  end if;

  insert into public.activity (workspace_id, actor_id, via, action, summary)
  values (ws, (select auth.uid()), private.request_via(), tg_table_name || '.' || lower(tg_op), left(line, 500));
  return null;
end;
$$;

create trigger log_sections after insert or update or delete on public.sections for each row execute function private.log_content_change();
create trigger log_workstreams after insert or update or delete on public.workstreams for each row execute function private.log_content_change();
create trigger log_tasks after insert or update or delete on public.tasks for each row execute function private.log_content_change();
create trigger log_decisions after insert or update or delete on public.decisions for each row execute function private.log_content_change();
create trigger log_roadmap after insert or update or delete on public.roadmap_items for each row execute function private.log_content_change();
create trigger log_metric_values after insert or update or delete on public.metric_values for each row execute function private.log_content_change();
create trigger log_brand_lines after insert or update or delete on public.brand_lines for each row execute function private.log_content_change();

-- Row level security -----------------------------------------------------------------

alter table public.sections enable row level security;
alter table public.workstreams enable row level security;
alter table public.tasks enable row level security;
alter table public.decisions enable row level security;
alter table public.roadmap_items enable row level security;
alter table public.metrics enable row level security;
alter table public.metric_targets enable row level security;
alter table public.metric_values enable row level security;
alter table public.brand_lines enable row level security;
alter table public.brand_line_versions enable row level security;

revoke all on public.sections, public.workstreams, public.tasks, public.decisions,
  public.roadmap_items, public.metrics, public.metric_targets, public.metric_values,
  public.brand_lines, public.brand_line_versions from anon;
revoke insert, update, delete on public.brand_line_versions from authenticated;

-- Reading: anyone with access to the workspace.
create policy "Read sections" on public.sections for select to authenticated using (private.can_read(workspace_id));
create policy "Read workstreams" on public.workstreams for select to authenticated using (private.can_read(workspace_id));
create policy "Read tasks" on public.tasks for select to authenticated using (private.can_read(workspace_id));
create policy "Read decisions" on public.decisions for select to authenticated using (private.can_read(workspace_id));
create policy "Read roadmap" on public.roadmap_items for select to authenticated using (private.can_read(workspace_id));
create policy "Read metrics" on public.metrics for select to authenticated using (private.can_read(workspace_id));
create policy "Read targets" on public.metric_targets for select to authenticated using (private.can_read(workspace_id));
create policy "Read scorecard" on public.metric_values for select to authenticated using (private.can_read(workspace_id));
create policy "Read brand lines" on public.brand_lines for select to authenticated using (private.can_read(workspace_id));
create policy "Read brand line history" on public.brand_line_versions for select to authenticated using (private.can_read(workspace_id));

-- Writing: Owner and Team edit the plan, scorecard and reference.
-- The brand strategy and the fixed lines change only with the Owner.
create policy "Team adds workstreams" on public.workstreams for insert to authenticated with check (private.can_edit(workspace_id));
create policy "Team changes workstreams" on public.workstreams for update to authenticated using (private.can_edit(workspace_id)) with check (private.can_edit(workspace_id));
create policy "Team removes workstreams" on public.workstreams for delete to authenticated using (private.can_edit(workspace_id));

create policy "Team adds tasks" on public.tasks for insert to authenticated with check (private.can_edit(workspace_id));
create policy "Team changes tasks" on public.tasks for update to authenticated using (private.can_edit(workspace_id)) with check (private.can_edit(workspace_id));
create policy "Team removes tasks" on public.tasks for delete to authenticated using (private.can_edit(workspace_id));

create policy "Team adds decisions" on public.decisions for insert to authenticated with check (private.can_edit(workspace_id));
create policy "Team changes decisions" on public.decisions for update to authenticated using (private.can_edit(workspace_id)) with check (private.can_edit(workspace_id));
create policy "Team removes decisions" on public.decisions for delete to authenticated using (private.can_edit(workspace_id));

create policy "Team adds roadmap" on public.roadmap_items for insert to authenticated with check (private.can_edit(workspace_id));
create policy "Team changes roadmap" on public.roadmap_items for update to authenticated using (private.can_edit(workspace_id)) with check (private.can_edit(workspace_id));
create policy "Team removes roadmap" on public.roadmap_items for delete to authenticated using (private.can_edit(workspace_id));

create policy "Team adds metrics" on public.metrics for insert to authenticated with check (private.can_edit(workspace_id));
create policy "Team changes metrics" on public.metrics for update to authenticated using (private.can_edit(workspace_id)) with check (private.can_edit(workspace_id));
create policy "Team removes metrics" on public.metrics for delete to authenticated using (private.can_edit(workspace_id));

create policy "Team adds targets" on public.metric_targets for insert to authenticated with check (private.can_edit(workspace_id));
create policy "Team changes targets" on public.metric_targets for update to authenticated using (private.can_edit(workspace_id)) with check (private.can_edit(workspace_id));
create policy "Team removes targets" on public.metric_targets for delete to authenticated using (private.can_edit(workspace_id));

create policy "Team adds scorecard" on public.metric_values for insert to authenticated with check (private.can_edit(workspace_id));
create policy "Team changes scorecard" on public.metric_values for update to authenticated using (private.can_edit(workspace_id)) with check (private.can_edit(workspace_id));
create policy "Team removes scorecard" on public.metric_values for delete to authenticated using (private.can_edit(workspace_id));

create policy "Add pages" on public.sections for insert to authenticated with check (case when area = 'strategy' then private.is_owner(workspace_id) else private.can_edit(workspace_id) end);
create policy "Change pages" on public.sections for update to authenticated using (case when area = 'strategy' then private.is_owner(workspace_id) else private.can_edit(workspace_id) end) with check (case when area = 'strategy' then private.is_owner(workspace_id) else private.can_edit(workspace_id) end);
create policy "Remove pages" on public.sections for delete to authenticated using (case when area = 'strategy' then private.is_owner(workspace_id) else private.can_edit(workspace_id) end);

create policy "Owner adds fixed lines" on public.brand_lines for insert to authenticated with check (private.is_owner(workspace_id));
create policy "Owner changes fixed lines" on public.brand_lines for update to authenticated using (private.is_owner(workspace_id)) with check (private.is_owner(workspace_id));
create policy "Owner removes fixed lines" on public.brand_lines for delete to authenticated using (private.is_owner(workspace_id));

-- The goal table lists income lines first, the scorecard lists them in reading order.
alter table public.metrics add column if not exists goal_position int;
