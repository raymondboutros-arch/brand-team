-- LIVBRID HQ, module 4: the Action queue (2 Oct 2026).
-- A finding comes with its evidence and a proposed fix, and waits until a person
-- approves or dismisses it. Owner and Team add and edit findings and approve them.
-- Client approvers may only approve or dismiss a waiting finding. Client viewers read.
-- Findings added through the Claude connector (header x-hq-via: claude) are marked as Claude's.

create type public.action_status as enum ('waiting', 'approved', 'done', 'dismissed');
create type public.action_impact as enum ('high', 'medium', 'low');

create table public.actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  number int not null,
  title text not null check (char_length(title) between 3 and 200),
  area text not null default 'other'
    check (area in ('website', 'google', 'ai', 'social', 'brand', 'content', 'other')),
  finding text not null default '' check (char_length(finding) <= 4000),
  evidence_url text check (evidence_url is null or evidence_url ~ '^https?://'),
  fix text not null default '' check (char_length(fix) <= 4000),
  impact public.action_impact not null default 'medium',
  status public.action_status not null default 'waiting',
  source text not null default 'team' check (source in ('team', 'claude', 'connection')),
  owner text check (owner is null or char_length(owner) <= 80),
  due_on date,
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  done_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (workspace_id, number)
);
create index actions_workspace_status_idx on public.actions (workspace_id, status);
create index actions_created_by_idx on public.actions (created_by);
create index actions_decided_by_idx on public.actions (decided_by);
create index actions_updated_by_idx on public.actions (updated_by);

-- Owner, Team and client approvers can decide on findings.
create or replace function private.can_decide(ws uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$ select coalesce(private.active_role(ws) in ('owner', 'team', 'client_approver'), false) $$;

grant execute on function private.can_decide(uuid) to authenticated;

-- New findings get the next number in their workspace (A1, A2...) and a source
-- the person can't fake: 'claude' only through the connector, 'connection' only from the system.
create or replace function private.prepare_action()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text, 0));
  select coalesce(max(a.number), 0) + 1 into new.number
  from public.actions a where a.workspace_id = new.workspace_id;

  new.created_at := now();
  new.created_by := (select auth.uid());
  new.updated_at := now();
  new.updated_by := (select auth.uid());

  if private.request_via() = 'claude' then
    new.source := 'claude';
  elsif new.source = 'claude' or (new.source = 'connection' and (select auth.uid()) is not null) then
    new.source := 'team';
  end if;

  new.decided_at := null;
  new.decided_by := null;
  new.done_at := null;
  if new.status in ('approved', 'dismissed') then
    new.decided_at := now();
    new.decided_by := (select auth.uid());
  elsif new.status = 'done' then
    new.done_at := now();
  end if;
  return new;
end;
$$;

-- Keeps the record honest on every change: who decided and when is stamped here,
-- and client approvers can only approve or dismiss a waiting finding.
create or replace function private.guard_action()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  new.id := old.id;
  new.workspace_id := old.workspace_id;
  new.number := old.number;
  new.source := old.source;
  new.created_at := old.created_at;
  new.created_by := old.created_by;

  if (select auth.uid()) is not null and not private.can_edit(old.workspace_id) then
    if old.status <> 'waiting'
       or new.status not in ('approved', 'dismissed')
       or (new.title, new.area, new.finding, new.evidence_url, new.fix, new.impact, new.owner, new.due_on)
          is distinct from
          (old.title, old.area, old.finding, old.evidence_url, old.fix, old.impact, old.owner, old.due_on)
    then
      raise exception 'Only a waiting finding can be approved or dismissed' using errcode = '42501';
    end if;
  end if;

  new.decided_at := old.decided_at;
  new.decided_by := old.decided_by;
  new.done_at := old.done_at;
  if new.status is distinct from old.status then
    if new.status in ('approved', 'dismissed') then
      new.decided_at := now();
      new.decided_by := (select auth.uid());
    elsif new.status = 'waiting' then
      new.decided_at := null;
      new.decided_by := null;
      new.decision_note := null;
    end if;
    new.done_at := case when new.status = 'done' then now() end;
  end if;

  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger prepare_action before insert on public.actions
  for each row execute function private.prepare_action();
create trigger guard_action before update on public.actions
  for each row execute function private.guard_action();

-- Activity log: the same function as the plan, with a branch for findings.
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

  elsif tg_table_name = 'actions' then
    if tg_op = 'INSERT' then
      line := 'Added finding A' || new.number || ': ' || new.title;
    elsif tg_op = 'DELETE' then
      line := 'Removed finding A' || old.number || ': ' || old.title;
    elsif new.status is distinct from old.status then
      line := case new.status
                when 'approved' then 'Approved A'
                when 'dismissed' then 'Dismissed A'
                when 'done' then 'Marked done: A'
                else 'Moved back to waiting: A'
              end
              || new.number || ', ' || new.title
              || case when new.status in ('approved', 'dismissed') and new.decision_note is not null
                      then ' (' || new.decision_note || ')' else '' end;
    else
      line := 'Updated finding A' || new.number || ': ' || new.title;
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

create trigger log_actions after insert or update or delete on public.actions
  for each row execute function private.log_content_change();

-- Row level security ----------------------------------------------------------------

alter table public.actions enable row level security;
revoke all on public.actions from anon;

create policy "Read actions" on public.actions
  for select to authenticated using (private.can_read(workspace_id));
create policy "Team adds actions" on public.actions
  for insert to authenticated with check (private.can_edit(workspace_id));
create policy "Decide on actions" on public.actions
  for update to authenticated using (private.can_decide(workspace_id)) with check (private.can_decide(workspace_id));
create policy "Owner removes actions" on public.actions
  for delete to authenticated using (private.is_owner(workspace_id));
