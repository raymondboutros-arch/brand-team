-- LIVBRID HQ, module 7: Visibility (3 Oct 2026, planned for 13 Nov). Replaces Connections.
-- Where the studio stands on Google (Search Console, one row per week), in AI answers (each check
-- is a run of prompts across assistants) and on other sites (links and mentions, one row per week).
-- Studio workspace only; Owner and Team read and add. Weekly plus on demand, never daily:
-- Search Console runs about two days behind and the site gets about 20 clicks in 90 days.

create table public.visibility_google (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  week_of date not null check (extract(isodow from week_of) = 1),
  days int not null default 7 check (days between 1 and 7),
  clicks int not null default 0 check (clicks >= 0),
  impressions int not null default 0 check (impressions >= 0),
  nonbrand_clicks int check (nonbrand_clicks >= 0),
  nonbrand_impressions int check (nonbrand_impressions >= 0),
  avg_position numeric(5, 1) check (avg_position is null or avg_position > 0),
  top_queries jsonb not null default '[]' check (jsonb_typeof(top_queries) = 'array'),
  source text not null default 'search_console' check (source in ('search_console', 'by_hand')),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (workspace_id, week_of)
);
create index visibility_google_created_by_idx on public.visibility_google (created_by);
create index visibility_google_updated_by_idx on public.visibility_google (updated_by);

create table public.visibility_ai_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  checked_on date not null default current_date,
  label text not null check (char_length(label) between 3 and 120),
  note text check (note is null or char_length(note) <= 2000),
  complete boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (id, workspace_id)
);
create index visibility_ai_runs_workspace_idx on public.visibility_ai_runs (workspace_id, checked_on);
create index visibility_ai_runs_created_by_idx on public.visibility_ai_runs (created_by);
create index visibility_ai_runs_updated_by_idx on public.visibility_ai_runs (updated_by);

-- One answer: one prompt, asked once, to one assistant.
create table public.visibility_ai_answers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  prompt_no int not null check (prompt_no between 1 and 200),
  prompt text not null check (char_length(prompt) between 3 and 500),
  kind text not null check (kind in ('discovery', 'brand', 'language')),
  assistant text not null check (assistant in ('chatgpt', 'google_ai_mode', 'gemini', 'perplexity', 'claude', 'copilot')),
  attempt int not null default 1 check (attempt between 1 and 5),
  named boolean not null default false,
  position int check (position is null or position between 1 and 50),
  verdict text check (verdict in ('accurate', 'partly', 'wrong', 'not_found', 'outdated')),
  names text[] not null default '{}',
  sources text[] not null default '{}',
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  foreign key (run_id, workspace_id) references public.visibility_ai_runs (id, workspace_id) on delete cascade,
  unique (run_id, prompt_no, assistant, attempt)
);
create index visibility_ai_answers_run_idx on public.visibility_ai_answers (run_id, workspace_id);
create index visibility_ai_answers_created_by_idx on public.visibility_ai_answers (created_by);

create table public.visibility_sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  week_of date not null check (extract(isodow from week_of) = 1),
  domain_rating numeric(4, 1) check (domain_rating is null or domain_rating between 0 and 100),
  referring_domains int check (referring_domains >= 0),
  backlinks int check (backlinks >= 0),
  mentions int check (mentions >= 0),
  source text not null default 'ahrefs' check (source in ('ahrefs', 'by_hand')),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (workspace_id, week_of)
);
create index visibility_sites_created_by_idx on public.visibility_sites (created_by);
create index visibility_sites_updated_by_idx on public.visibility_sites (updated_by);

-- Stamps --------------------------------------------------------------------------------------

create or replace function private.stamp_visibility_row()
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
  if tg_table_name <> 'visibility_ai_answers' then
    new.updated_at := now();
    new.updated_by := (select auth.uid());
  end if;
  return new;
end;
$$;

create trigger stamp_visibility_google before insert or update on public.visibility_google
  for each row execute function private.stamp_visibility_row();
create trigger stamp_visibility_ai_runs before insert or update on public.visibility_ai_runs
  for each row execute function private.stamp_visibility_row();
create trigger stamp_visibility_ai_answers before insert or update on public.visibility_ai_answers
  for each row execute function private.stamp_visibility_row();
create trigger stamp_visibility_sites before insert or update on public.visibility_sites
  for each row execute function private.stamp_visibility_row();

-- Activity log --------------------------------------------------------------------------------

create or replace function private.assistant_label(a text)
returns text
language sql immutable
set search_path = ''
as $$
  select case a
    when 'chatgpt' then 'ChatGPT'
    when 'google_ai_mode' then 'Google AI Mode'
    when 'gemini' then 'Gemini'
    when 'perplexity' then 'Perplexity'
    when 'claude' then 'Claude'
    when 'copilot' then 'Copilot'
    else a
  end
$$;

create or replace function private.log_visibility_change()
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
  if not exists (select 1 from public.workspaces w where w.id = ws) then
    return null;
  end if;

  if tg_table_name = 'visibility_google' then
    line := case tg_op when 'DELETE' then 'Removed the Google numbers for the week of ' else 'Google, week of ' end
      || to_char(rec.week_of, 'FMDD Mon YYYY')
      || case when tg_op = 'DELETE' then '' else
           ': ' || rec.clicks || ' clicks, ' || coalesce(rec.nonbrand_clicks::text, 'unknown') || ' without our name, '
           || rec.impressions || ' impressions' end;
  elsif tg_table_name = 'visibility_ai_runs' then
    line := case tg_op when 'INSERT' then 'Started the AI check "' when 'DELETE' then 'Removed the AI check "' else 'Updated the AI check "' end
      || rec.label || '"' || case when tg_op = 'UPDATE' and new.complete and not old.complete then ', now complete' else '' end;
  elsif tg_table_name = 'visibility_ai_answers' then
    line := 'AI check, prompt ' || rec.prompt_no || ', ' || private.assistant_label(rec.assistant) || ': '
      || case when rec.kind = 'brand' then coalesce(replace(rec.verdict, '_', ' '), 'answered')
              when rec.named then 'named us' || coalesce(' at #' || rec.position, '')
              else 'did not name us' end;
  elsif tg_table_name = 'visibility_sites' then
    line := 'Other sites, week of ' || to_char(rec.week_of, 'FMDD Mon YYYY') || ': '
      || coalesce(rec.referring_domains::text || ' sites linking', 'links not counted')
      || coalesce(', ' || rec.mentions || ' mentions', '');
  else
    return null;
  end if;

  insert into public.activity (workspace_id, actor_id, via, action, summary)
  values (ws, (select auth.uid()), private.request_via(), tg_table_name || '.' || lower(tg_op), left(line, 500));
  return null;
end;
$$;

create trigger log_visibility_google after insert or update or delete on public.visibility_google
  for each row execute function private.log_visibility_change();
create trigger log_visibility_ai_runs after insert or update or delete on public.visibility_ai_runs
  for each row execute function private.log_visibility_change();
create trigger log_visibility_ai_answers after insert or update or delete on public.visibility_ai_answers
  for each row execute function private.log_visibility_change();
create trigger log_visibility_sites after insert or update or delete on public.visibility_sites
  for each row execute function private.log_visibility_change();

-- Row level security --------------------------------------------------------------------------

alter table public.visibility_google enable row level security;
alter table public.visibility_ai_runs enable row level security;
alter table public.visibility_ai_answers enable row level security;
alter table public.visibility_sites enable row level security;
revoke all on public.visibility_google, public.visibility_ai_runs, public.visibility_ai_answers, public.visibility_sites from anon;

create policy "Studio reads Google numbers" on public.visibility_google
  for select to authenticated using (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Studio adds Google numbers" on public.visibility_google
  for insert to authenticated with check (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Studio edits Google numbers" on public.visibility_google
  for update to authenticated
  using (private.is_studio(workspace_id) and private.can_edit(workspace_id))
  with check (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Owner removes Google numbers" on public.visibility_google
  for delete to authenticated using (private.is_studio(workspace_id) and private.is_owner(workspace_id));

create policy "Studio reads AI checks" on public.visibility_ai_runs
  for select to authenticated using (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Studio adds AI checks" on public.visibility_ai_runs
  for insert to authenticated with check (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Studio edits AI checks" on public.visibility_ai_runs
  for update to authenticated
  using (private.is_studio(workspace_id) and private.can_edit(workspace_id))
  with check (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Owner removes AI checks" on public.visibility_ai_runs
  for delete to authenticated using (private.is_studio(workspace_id) and private.is_owner(workspace_id));

create policy "Studio reads AI answers" on public.visibility_ai_answers
  for select to authenticated using (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Studio adds AI answers" on public.visibility_ai_answers
  for insert to authenticated with check (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Studio edits AI answers" on public.visibility_ai_answers
  for update to authenticated
  using (private.is_studio(workspace_id) and private.can_edit(workspace_id))
  with check (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Owner removes AI answers" on public.visibility_ai_answers
  for delete to authenticated using (private.is_studio(workspace_id) and private.is_owner(workspace_id));

create policy "Studio reads other sites" on public.visibility_sites
  for select to authenticated using (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Studio adds other sites" on public.visibility_sites
  for insert to authenticated with check (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Studio edits other sites" on public.visibility_sites
  for update to authenticated
  using (private.is_studio(workspace_id) and private.can_edit(workspace_id))
  with check (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Owner removes other sites" on public.visibility_sites
  for delete to authenticated using (private.is_studio(workspace_id) and private.is_owner(workspace_id));
