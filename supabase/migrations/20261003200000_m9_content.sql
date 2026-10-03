-- LIVBRID HQ, module 9: Content (3 Oct 2026, planned for 30 Oct).
-- The idea bank and the calendar. Each item moves idea, draft, approved, scheduled, live (or is
-- dropped). Team drafts; only the Owner or a client approver approves, and never through Claude.
-- Every draft has a review link: a long random token that opens that one draft, read only,
-- without signing in. Nothing here publishes anywhere: going live is recorded by a person.

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  number int not null,
  title text not null check (char_length(btrim(title)) between 2 and 200),
  format text not null default 'article'
    check (format in ('article', 'post', 'carousel', 'video', 'story', 'email', 'other')),
  series text check (series is null or char_length(series) <= 80),
  channel_id uuid references public.channels (id) on delete set null,
  stage text not null default 'idea'
    check (stage in ('idea', 'draft', 'approved', 'scheduled', 'live', 'dropped')),
  brief text check (brief is null or char_length(brief) <= 4000),
  fact text check (fact is null or char_length(fact) <= 1000),
  body_md text check (body_md is null or char_length(body_md) <= 60000),
  owner text check (owner is null or char_length(owner) <= 80),
  due_on date,
  publish_on date,
  live_url text check (live_url is null or (char_length(live_url) <= 500 and live_url ~ '^https?://[^[:space:]]+$')),
  source text not null default 'team' check (source in ('team', 'claude')),
  review_token text not null
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
    check (review_token ~ '^[0-9a-f]{64}$'),
  review_requested_at timestamptz,
  review_requested_by uuid references auth.users (id) on delete set null,
  review_note text check (review_note is null or char_length(review_note) <= 2000),
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (workspace_id, number),
  unique (review_token)
);
create index content_items_workspace_idx on public.content_items (workspace_id, stage);
create index content_items_channel_idx on public.content_items (channel_id);
create index content_items_created_by_idx on public.content_items (created_by);
create index content_items_updated_by_idx on public.content_items (updated_by);
create index content_items_approved_by_idx on public.content_items (approved_by);
create index content_items_review_requested_by_idx on public.content_items (review_requested_by);

comment on table public.content_items is
  'The idea bank and calendar: ideas, drafts and their stage, channel and dates. Only a person approves.';

-- Guard: numbers, stamps, who may change what, and which stage can follow which ------------------

create or replace function private.content_stage_label(s text)
returns text
language sql immutable
set search_path = ''
as $$
  select case s
    when 'idea' then 'Idea'
    when 'draft' then 'Draft'
    when 'approved' then 'Approved'
    when 'scheduled' then 'Scheduled'
    when 'live' then 'Live'
    when 'dropped' then 'Dropped'
    else s
  end
$$;

create or replace function private.guard_content_item()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  via text := private.request_via();
  role text;
  text_changed boolean;
begin
  if new.channel_id is not null and not exists (
    select 1 from public.channels c where c.id = new.channel_id and c.workspace_id = new.workspace_id
  ) then
    raise exception 'That channel belongs to another workspace.' using errcode = '22023';
  end if;

  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended('content' || new.workspace_id::text, 0));
    select coalesce(max(c.number), 0) + 1 into new.number
    from public.content_items c where c.workspace_id = new.workspace_id;
    if new.stage not in ('idea', 'draft') then
      raise exception 'New content starts as an idea or a draft.' using errcode = '22023';
    end if;
    new.source := case when via = 'claude' then 'claude' else 'team' end;
    new.review_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    new.review_requested_at := null;
    new.review_requested_by := null;
    new.review_note := null;
    new.approved_at := null;
    new.approved_by := null;
    new.created_at := now();
    new.created_by := me;
    new.updated_at := now();
    new.updated_by := me;
    return new;
  end if;

  new.id := old.id;
  new.workspace_id := old.workspace_id;
  new.number := old.number;
  new.source := old.source;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.approved_at := old.approved_at;
  new.approved_by := old.approved_by;

  role := private.active_role(old.workspace_id);

  -- A client approver can only approve a draft or ask for changes, never edit it.
  if me is not null and not private.can_edit(old.workspace_id) then
    if old.stage <> 'draft'
       or new.stage not in ('draft', 'approved')
       or (new.title, new.format, new.series, new.channel_id, new.brief, new.fact, new.body_md, new.owner,
           new.due_on, new.publish_on, new.live_url, new.review_token)
          is distinct from
          (old.title, old.format, old.series, old.channel_id, old.brief, old.fact, old.body_md, old.owner,
           old.due_on, old.publish_on, old.live_url, old.review_token)
    then
      raise exception 'Only a draft can be approved or sent back with a note.' using errcode = '42501';
    end if;
  end if;

  -- Approval covers the words that were approved. Change them and it goes back to draft.
  text_changed := (new.title, new.format, new.brief, new.fact, new.body_md)
    is distinct from (old.title, old.format, old.brief, old.fact, old.body_md);
  if text_changed and old.stage in ('approved', 'scheduled') and new.stage in ('approved', 'scheduled', 'live') then
    new.stage := 'draft';
  end if;

  if new.stage is distinct from old.stage then
    if new.stage = 'approved' then
      if old.stage <> 'draft' then
        raise exception 'Only a draft can be approved.' using errcode = '22023';
      end if;
      if via = 'claude' then
        raise exception 'Only a person can approve content, not a request made through Claude.' using errcode = '42501';
      end if;
      if me is not null and coalesce(role, '') not in ('owner', 'client_approver') then
        raise exception 'Only the Owner or a client approver can approve content.' using errcode = '42501';
      end if;
      if coalesce(btrim(new.body_md), '') = '' then
        raise exception 'Write the draft before approving it.' using errcode = '22023';
      end if;
      if new.format = 'article' and coalesce(btrim(new.fact), '') = '' then
        raise exception 'Add the first-hand fact before approving an article.' using errcode = '22023';
      end if;
      new.approved_at := now();
      new.approved_by := me;
      new.review_note := null;
    elsif new.stage = 'scheduled' then
      if old.stage not in ('approved', 'scheduled') then
        raise exception 'Approve it before scheduling it.' using errcode = '22023';
      end if;
      if new.publish_on is null then
        raise exception 'Pick the date it goes out.' using errcode = '22023';
      end if;
    elsif new.stage = 'live' then
      if old.stage not in ('approved', 'scheduled') then
        raise exception 'Approve it before marking it live.' using errcode = '22023';
      end if;
      new.publish_on := coalesce(new.publish_on, (now() at time zone 'Asia/Beirut')::date);
    elsif new.stage = 'draft' then
      if old.stage = 'live' then
        raise exception 'This is live. Add a new item for a new version.' using errcode = '22023';
      end if;
      new.approved_at := null;
      new.approved_by := null;
    elsif new.stage = 'idea' then
      if old.stage not in ('draft', 'dropped') then
        raise exception 'Only a draft or a dropped item can go back to the ideas.' using errcode = '22023';
      end if;
      new.approved_at := null;
      new.approved_by := null;
    elsif new.stage = 'dropped' then
      if old.stage = 'live' then
        raise exception 'This is already live.' using errcode = '22023';
      end if;
      new.approved_at := null;
      new.approved_by := null;
    end if;
    new.review_requested_at := null;
    new.review_requested_by := null;
  elsif new.review_requested_at is distinct from old.review_requested_at then
    if new.review_requested_at is not null then
      if old.stage <> 'draft' then
        raise exception 'Only a draft can be sent for approval.' using errcode = '22023';
      end if;
      if coalesce(btrim(new.body_md), '') = '' then
        raise exception 'Write the draft before sending it for approval.' using errcode = '22023';
      end if;
      new.review_requested_at := now();
      new.review_requested_by := me;
      new.review_note := null;
    else
      new.review_requested_by := null;
    end if;
  else
    new.review_requested_by := old.review_requested_by;
  end if;

  if new.stage = 'scheduled' and new.publish_on is null then
    raise exception 'Pick the date it goes out.' using errcode = '22023';
  end if;

  new.updated_at := now();
  new.updated_by := me;
  return new;
end;
$$;

create trigger guard_content_items before insert or update on public.content_items
  for each row execute function private.guard_content_item();

-- Activity log: names what happened, never the text itself ----------------------------------------

create or replace function private.log_content_item_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  rec record;
  name text;
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
  name := 'C' || rec.number || ', ' || rec.title;

  if tg_op = 'INSERT' then
    line := 'Added ' || name || ' as ' || case when rec.stage = 'draft' then 'a draft' else 'an idea' end;
  elsif tg_op = 'DELETE' then
    line := 'Removed ' || name;
  elsif new.stage is distinct from old.stage then
    if new.stage = 'approved' then
      line := 'Approved ' || name;
    elsif new.stage = 'draft' and old.stage in ('approved', 'scheduled')
          and (new.title, new.format, new.brief, new.fact, new.body_md)
              is distinct from (old.title, old.format, old.brief, old.fact, old.body_md) then
      line := name || ' went back to draft because its text changed after approval';
    else
      line := name || ' moved from ' || private.content_stage_label(old.stage)
        || ' to ' || private.content_stage_label(new.stage);
    end if;
  elsif new.review_requested_at is not null and old.review_requested_at is null then
    line := 'Sent ' || name || ' for approval';
  elsif new.review_note is not null and new.review_note is distinct from old.review_note then
    line := 'Asked for changes on ' || name;
  else
    if new.title is distinct from old.title then changed := changed || 'title'; end if;
    if new.body_md is distinct from old.body_md then changed := changed || 'text'; end if;
    if new.brief is distinct from old.brief then changed := changed || 'brief'; end if;
    if new.fact is distinct from old.fact then changed := changed || 'first-hand fact'; end if;
    if (new.format, new.series) is distinct from (old.format, old.series) then changed := changed || 'format'; end if;
    if new.channel_id is distinct from old.channel_id then changed := changed || 'channel'; end if;
    if new.owner is distinct from old.owner then changed := changed || 'owner'; end if;
    if (new.due_on, new.publish_on) is distinct from (old.due_on, old.publish_on) then changed := changed || 'dates'; end if;
    if new.live_url is distinct from old.live_url then changed := changed || 'live link'; end if;
    if new.review_token is distinct from old.review_token then changed := changed || 'new review link'; end if;
    if cardinality(changed) = 0 then
      return null;
    end if;
    line := 'Updated ' || name || ': ' || array_to_string(changed, ', ');
  end if;

  insert into public.activity (workspace_id, actor_id, via, action, summary)
  values (rec.workspace_id, (select auth.uid()), private.request_via(), 'content.' || lower(tg_op), left(line, 500));
  return null;
end;
$$;

create trigger log_content_items after insert or update or delete on public.content_items
  for each row execute function private.log_content_item_change();

-- Row level security ----------------------------------------------------------------------------
-- Everyone in the workspace reads; Owner and Team add; Owner, Team and client approvers update
-- (the guard narrows what a client approver can change); only the Owner removes.

alter table public.content_items enable row level security;
revoke all on public.content_items from anon;

create policy "Members read content" on public.content_items
  for select to authenticated using (private.can_read(workspace_id));
create policy "Owner and Team add content" on public.content_items
  for insert to authenticated with check (private.can_edit(workspace_id));
create policy "Members who decide update content" on public.content_items
  for update to authenticated
  using (private.can_decide(workspace_id))
  with check (private.can_decide(workspace_id));
create policy "Owner removes content" on public.content_items
  for delete to authenticated using (private.is_owner(workspace_id));

-- The review link: one draft, read only, for whoever holds its 64-character link ------------------
-- Only drafts and approved items open. Internal notes (brief, first-hand fact, owner) stay out.

create or replace function public.content_for_review(p_token text)
returns table (
  brand text,
  number int,
  title text,
  format text,
  body_md text,
  stage text,
  updated_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select w.name, c.number, c.title, c.format, c.body_md, c.stage, c.updated_at
  from public.content_items c
  join public.workspaces w on w.id = c.workspace_id
  where p_token ~ '^[0-9a-f]{64}$'
    and c.review_token = p_token
    and c.stage in ('draft', 'approved')
$$;

revoke all on function public.content_for_review(text) from public;
grant execute on function public.content_for_review(text) to anon, authenticated;
comment on function public.content_for_review(text) is
  'Opens one draft for review by its link. Intended to be callable without signing in.';
