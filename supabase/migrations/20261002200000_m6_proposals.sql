-- LIVBRID HQ, module 6: Proposals (2 Oct 2026, planned for 6 Nov).
-- The price list (three offers, their options and one custom line), enquiries, and proposals
-- built from the price list. Every enquiry and proposal is followed to won or lost; closing a
-- proposal creates the project (signed, or a lost pitch with the reasons).
-- Studio workspace only. Owner and Team read and build proposals. Only the Owner changes
-- prices. Only a person approves a proposal: never a request made through Claude.
-- No prices are stored in this file; the price list is entered separately.

-- Projects learn what was sold and when -------------------------------------------------------

alter table public.projects
  add column offer text check (offer in ('diagnostic', 'build', 'keep', 'custom')),
  add column price_per text not null default 'once' check (price_per in ('once', 'month')),
  add column signed_on date,
  add column enquiry_id uuid;

-- The price list --------------------------------------------------------------------------------

create table public.price_list (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  offer text not null check (offer in ('diagnostic', 'build', 'keep', 'custom')),
  label text not null check (char_length(label) between 2 and 120),
  detail text check (detail is null or char_length(detail) <= 600),
  market text not null default 'any' check (market in ('lebanon', 'abroad', 'any')),
  price_usd numeric(12, 2) check (price_usd is null or price_usd >= 0),
  per text not null default 'once' check (per in ('once', 'month')),
  position int not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (id, workspace_id)
);
create index price_list_workspace_idx on public.price_list (workspace_id, position);
create index price_list_updated_by_idx on public.price_list (updated_by);

-- Enquiries (E1, E2...) ---------------------------------------------------------------------------

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  number int not null,
  received_on date not null default current_date,
  client text not null check (char_length(client) between 2 and 120),
  contact text check (contact is null or char_length(contact) <= 120),
  sector text check (sector is null or char_length(sector) <= 120),
  source text check (source in ('referral', 'someone_we_knew', 'google', 'ai', 'social', 'tender', 'other')),
  market text not null default 'lebanon' check (market in ('lebanon', 'abroad')),
  notes text check (notes is null or char_length(notes) <= 6000),
  status text not null default 'open' check (status in ('open', 'won', 'lost', 'declined')),
  closed_note text check (closed_note is null or char_length(closed_note) <= 1000),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (workspace_id, number),
  unique (id, workspace_id)
);
create index enquiries_workspace_status_idx on public.enquiries (workspace_id, status);
create index enquiries_created_by_idx on public.enquiries (created_by);
create index enquiries_updated_by_idx on public.enquiries (updated_by);

alter table public.projects
  add constraint projects_enquiry_fkey foreign key (enquiry_id, workspace_id)
  references public.enquiries (id, workspace_id) on delete set null (enquiry_id);
create index projects_enquiry_idx on public.projects (enquiry_id, workspace_id);

-- Proposals (Q1, Q2...) ----------------------------------------------------------------------------

create type public.proposal_status as enum ('draft', 'approved', 'sent', 'won', 'lost');

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  number int not null,
  enquiry_id uuid not null,
  title text not null check (char_length(title) between 3 and 160),
  client text not null check (char_length(client) between 2 and 120),
  market text not null default 'lebanon' check (market in ('lebanon', 'abroad')),
  issued_on date not null default current_date,
  valid_until date,
  intro text check (intro is null or char_length(intro) <= 2000),
  our_thinking text check (our_thinking is null or char_length(our_thinking) <= 6000),
  thinking_by text check (thinking_by in ('claude', 'person')),
  scope text check (scope is null or char_length(scope) <= 6000),
  not_included text check (not_included is null or char_length(not_included) <= 3000),
  timeline text check (timeline is null or char_length(timeline) <= 2000),
  payment_terms text check (payment_terms is null or char_length(payment_terms) <= 2000),
  status public.proposal_status not null default 'draft',
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  sent_on date,
  closed_on date,
  project_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (workspace_id, number),
  unique (id, workspace_id),
  foreign key (enquiry_id, workspace_id) references public.enquiries (id, workspace_id) on delete cascade,
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id) on delete set null (project_id)
);
create index proposals_workspace_status_idx on public.proposals (workspace_id, status);
create index proposals_enquiry_idx on public.proposals (enquiry_id, workspace_id);
create index proposals_project_idx on public.proposals (project_id, workspace_id);
create index proposals_approved_by_idx on public.proposals (approved_by);
create index proposals_created_by_idx on public.proposals (created_by);
create index proposals_updated_by_idx on public.proposals (updated_by);

create table public.proposal_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  proposal_id uuid not null,
  price_item_id uuid references public.price_list (id) on delete set null,
  offer text not null default 'custom' check (offer in ('diagnostic', 'build', 'keep', 'custom')),
  label text not null check (char_length(label) between 2 and 160),
  detail text check (detail is null or char_length(detail) <= 600),
  price_usd numeric(12, 2) check (price_usd is null or price_usd >= 0),
  per text not null default 'once' check (per in ('once', 'month')),
  position int not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  foreign key (proposal_id, workspace_id) references public.proposals (id, workspace_id) on delete cascade
);
create index proposal_lines_proposal_idx on public.proposal_lines (proposal_id, workspace_id);
create index proposal_lines_price_item_idx on public.proposal_lines (price_item_id);
create index proposal_lines_created_by_idx on public.proposal_lines (created_by);

-- Stamps and numbers -----------------------------------------------------------------------------

create or replace function private.prepare_sales_row()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'price_list' then
    if tg_op = 'UPDATE' then
      new.id := old.id;
      new.workspace_id := old.workspace_id;
    end if;
    new.updated_at := now();
    new.updated_by := (select auth.uid());
    return new;
  end if;

  -- enquiries
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended('enquiries' || new.workspace_id::text, 0));
    select coalesce(max(e.number), 0) + 1 into new.number
    from public.enquiries e where e.workspace_id = new.workspace_id;
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

create trigger prepare_price_list before insert or update on public.price_list
  for each row execute function private.prepare_sales_row();
create trigger prepare_enquiry before insert or update on public.enquiries
  for each row execute function private.prepare_sales_row();

-- Proposals: numbers, approval by a person, and no changes once a proposal has gone out.
create or replace function private.guard_proposal()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  closing boolean := coalesce(current_setting('app.closing_proposal', true), '') = 'on';
  content_changed boolean;
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended('proposals' || new.workspace_id::text, 0));
    select coalesce(max(p.number), 0) + 1 into new.number
    from public.proposals p where p.workspace_id = new.workspace_id;
    new.status := 'draft';
    new.approved_at := null;
    new.approved_by := null;
    new.sent_on := null;
    new.closed_on := null;
    new.project_id := null;
    new.thinking_by := case when new.our_thinking is null then null
                            when private.request_via() = 'claude' then 'claude' else 'person' end;
    new.created_at := now();
    new.created_by := (select auth.uid());
    new.updated_at := now();
    new.updated_by := (select auth.uid());
    return new;
  end if;

  new.id := old.id;
  new.workspace_id := old.workspace_id;
  new.number := old.number;
  new.enquiry_id := old.enquiry_id;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  if not closing then
    new.project_id := old.project_id;
    new.closed_on := old.closed_on;
  end if;

  content_changed :=
    (new.title, new.client, new.market, new.issued_on, new.valid_until, new.intro, new.our_thinking,
     new.scope, new.not_included, new.timeline, new.payment_terms)
    is distinct from
    (old.title, old.client, old.market, old.issued_on, old.valid_until, old.intro, old.our_thinking,
     old.scope, old.not_included, old.timeline, old.payment_terms);

  if content_changed then
    if old.status in ('sent', 'won', 'lost') then
      raise exception 'This proposal has gone out. Move it back to draft to change it.' using errcode = '22023';
    end if;
    if old.status = 'approved' and new.status = 'approved' then
      new.status := 'draft';
    end if;
    if new.our_thinking is distinct from old.our_thinking then
      new.thinking_by := case when new.our_thinking is null then null
                              when private.request_via() = 'claude' then 'claude' else 'person' end;
    else
      new.thinking_by := old.thinking_by;
    end if;
  else
    new.thinking_by := old.thinking_by;
  end if;

  new.approved_at := old.approved_at;
  new.approved_by := old.approved_by;
  new.sent_on := case when new.status = old.status then old.sent_on else new.sent_on end;

  if new.status is distinct from old.status then
    if old.status in ('won', 'lost') then
      raise exception 'This proposal is closed.' using errcode = '22023';
    end if;
    if new.status in ('won', 'lost') and not closing then
      raise exception 'Close a proposal with close_proposal(), so the project is created with it.' using errcode = '22023';
    end if;

    if new.status = 'approved' then
      if old.status <> 'draft' then
        raise exception 'Only a draft can be approved.' using errcode = '22023';
      end if;
      if private.request_via() = 'claude' then
        raise exception 'Only a person can approve a proposal, not a request made through Claude.' using errcode = '42501';
      end if;
      if coalesce(btrim(new.our_thinking), '') = '' or coalesce(btrim(new.scope), '') = '' then
        raise exception 'Write our thinking and the scope before approving.' using errcode = '22023';
      end if;
      if not exists (select 1 from public.proposal_lines l where l.proposal_id = new.id) then
        raise exception 'Add at least one line from the price list before approving.' using errcode = '22023';
      end if;
      if exists (select 1 from public.proposal_lines l where l.proposal_id = new.id and l.price_usd is null) then
        raise exception 'Every line needs a price before approving. Only the Owner sets a custom price.' using errcode = '22023';
      end if;
      new.approved_at := now();
      new.approved_by := (select auth.uid());
      new.sent_on := null;
    elsif new.status = 'sent' then
      if old.status <> 'approved' then
        raise exception 'Approve the proposal before marking it sent.' using errcode = '22023';
      end if;
      new.sent_on := coalesce(new.sent_on, current_date);
    elsif new.status = 'draft' then
      new.approved_at := null;
      new.approved_by := null;
      new.sent_on := null;
    elsif new.status in ('won', 'lost') then
      new.closed_on := current_date;
    end if;
  end if;

  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger guard_proposal before insert or update on public.proposals
  for each row execute function private.guard_proposal();

-- Proposal lines: prices come from the price list unless the Owner sets them. Changing a line
-- sends an approved proposal back to draft; a proposal that has gone out can't change.
create or replace function private.guard_proposal_line()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  rec record;
  pstatus public.proposal_status;
  item public.price_list;
  owner boolean;
begin
  if tg_op = 'DELETE' then rec := old; else rec := new; end if;

  select p.status into pstatus from public.proposals p where p.id = rec.proposal_id;
  if pstatus in ('sent', 'won', 'lost') then
    raise exception 'This proposal has gone out. Move it back to draft to change it.' using errcode = '22023';
  end if;
  if pstatus = 'approved' then
    update public.proposals set status = 'draft' where id = rec.proposal_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  owner := (select auth.uid()) is null or private.is_owner(new.workspace_id);

  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := (select auth.uid());
    if new.price_item_id is not null then
      select * into item from public.price_list pl
      where pl.id = new.price_item_id and pl.workspace_id = new.workspace_id;
      if not found then
        raise exception 'That price is not on this workspace''s price list.' using errcode = '22023';
      end if;
      new.offer := item.offer;
      new.per := item.per;
      new.label := coalesce(nullif(btrim(new.label), ''), item.label);
      new.detail := coalesce(new.detail, item.detail);
      if not owner or new.price_usd is null then
        new.price_usd := item.price_usd;
      end if;
    elsif not owner then
      new.offer := 'custom';
      new.price_usd := null;
    end if;
  else
    new.id := old.id;
    new.workspace_id := old.workspace_id;
    new.proposal_id := old.proposal_id;
    new.price_item_id := old.price_item_id;
    new.offer := old.offer;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    if not owner then
      new.price_usd := old.price_usd;
      new.per := old.per;
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_proposal_line before insert or update or delete on public.proposal_lines
  for each row execute function private.guard_proposal_line();

-- Closing a proposal: won becomes a signed project (plus a Keep plan project when the proposal
-- has one), lost becomes a lost pitch with the reasons. Runs as the person, so their row level
-- security and the activity log apply. Returns the new project's number.
create or replace function public.close_proposal(
  p_proposal uuid,
  p_outcome text,
  p_said text default null,
  p_think text default null
)
returns int
language plpgsql security invoker
set search_path = ''
as $$
declare
  pr public.proposals;
  en public.enquiries;
  main text;
  once_total numeric;
  month_total numeric;
  main_labels text;
  keep_labels text;
  pid uuid;
  pno int;
  won boolean := p_outcome = 'won';
begin
  if p_outcome not in ('won', 'lost') then
    raise exception 'The outcome is won or lost.' using errcode = '22023';
  end if;

  select * into pr from public.proposals where id = p_proposal for update;
  if not found then
    raise exception 'Proposal not found.' using errcode = 'P0002';
  end if;
  if pr.status not in ('approved', 'sent') then
    raise exception 'Only an approved or sent proposal can be won or lost.' using errcode = '22023';
  end if;
  select * into en from public.enquiries where id = pr.enquiry_id;

  select coalesce(sum(l.price_usd) filter (where l.per = 'once'), 0),
         coalesce(sum(l.price_usd) filter (where l.per = 'month'), 0)
    into once_total, month_total
  from public.proposal_lines l where l.proposal_id = pr.id;

  select l.offer into main
  from public.proposal_lines l where l.proposal_id = pr.id
  order by case l.offer when 'build' then 1 when 'custom' then 2 when 'diagnostic' then 3 else 4 end, l.position
  limit 1;

  select string_agg(l.label, '; ' order by l.position) into main_labels
  from public.proposal_lines l where l.proposal_id = pr.id and (main = 'keep' or l.offer <> 'keep');
  select string_agg(l.label, '; ' order by l.position) into keep_labels
  from public.proposal_lines l where l.proposal_id = pr.id and l.offer = 'keep';

  insert into public.projects (
    workspace_id, client, sector, source, buyer, brief, deliverables, status, year,
    price_usd, price_per, offer, signed_on, enquiry_id, lost_said, lost_think, notes
  ) values (
    pr.workspace_id, pr.client, en.sector, en.source, en.contact, left(en.notes, 2000), left(main_labels, 2000),
    case when won then 'signed'::public.project_status else 'lost'::public.project_status end,
    extract(year from current_date)::int,
    case when main = 'keep' then month_total else once_total end,
    case when main = 'keep' then 'month' else 'once' end,
    main,
    case when won then current_date end,
    en.id,
    case when won then null else left(p_said, 1000) end,
    case when won then null else left(p_think, 1000) end,
    'From proposal Q' || pr.number || ', ' || pr.title
  )
  returning id, number into pid, pno;

  if won and main <> 'keep' and keep_labels is not null then
    insert into public.projects (
      workspace_id, client, sector, source, buyer, deliverables, status, year,
      price_usd, price_per, offer, signed_on, enquiry_id, notes
    ) values (
      pr.workspace_id, pr.client, en.sector, en.source, en.contact, left(keep_labels, 2000), 'signed',
      extract(year from current_date)::int, month_total, 'month', 'keep', current_date, en.id,
      'Keep plan from proposal Q' || pr.number || ', starts after the build'
    );
  end if;

  perform set_config('app.closing_proposal', 'on', true);
  update public.proposals set status = p_outcome::public.proposal_status, project_id = pid where id = pr.id;
  perform set_config('app.closing_proposal', '', true);

  update public.enquiries e
  set status = case
      when exists (select 1 from public.proposals p where p.enquiry_id = e.id and p.status = 'won') then 'won'
      when exists (select 1 from public.proposals p where p.enquiry_id = e.id and p.status in ('draft', 'approved', 'sent')) then 'open'
      else 'lost'
    end
  where e.id = pr.enquiry_id;

  return pno;
end;
$$;

revoke all on function public.close_proposal(uuid, text, text, text) from public, anon;
grant execute on function public.close_proposal(uuid, text, text, text) to authenticated;

-- Activity log ------------------------------------------------------------------------------------

create or replace function private.money_text(n numeric, per text)
returns text
language sql immutable
set search_path = ''
as $$
  select case when n is null then 'no price yet'
    else 'USD ' || to_char(n, 'FM999,999,990') || case when per = 'month' then ' a month' else '' end end
$$;

create or replace function private.log_sales_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  rec record;
  ws uuid;
  q text;
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

  if tg_table_name = 'price_list' then
    if tg_op = 'INSERT' then
      line := 'Added to the price list: ' || new.label || ', ' || private.money_text(new.price_usd, new.per);
    elsif tg_op = 'DELETE' then
      line := 'Removed from the price list: ' || old.label;
    elsif (new.price_usd, new.per) is distinct from (old.price_usd, old.per) then
      line := 'Price list: ' || new.label || case new.market when 'lebanon' then ' (Lebanon)' when 'abroad' then ' (outside Lebanon)' else '' end
        || ' is now ' || private.money_text(new.price_usd, new.per) || ', was ' || private.money_text(old.price_usd, old.per);
    elsif new.active is distinct from old.active then
      line := 'Price list: ' || new.label || case when new.active then ' is offered again' else ' is no longer offered' end;
    else
      line := 'Updated the price list line ' || new.label;
    end if;

  elsif tg_table_name = 'enquiries' then
    q := 'E' || rec.number || ', ' || rec.client;
    if tg_op = 'INSERT' then
      line := 'New enquiry ' || q;
    elsif tg_op = 'DELETE' then
      line := 'Removed the enquiry ' || q;
    elsif new.status is distinct from old.status then
      line := q || case new.status when 'won' then ': won' when 'lost' then ': lost' when 'declined' then ': not for us' else ': open again' end
        || case when new.closed_note is not null and new.status in ('lost', 'declined') then ' (' || new.closed_note || ')' else '' end;
    else
      line := 'Updated the enquiry ' || q;
    end if;

  elsif tg_table_name = 'proposals' then
    q := 'Q' || rec.number || ' for ' || rec.client;
    if tg_op = 'INSERT' then
      line := 'Started the proposal ' || q;
    elsif tg_op = 'DELETE' then
      line := 'Removed the proposal ' || q;
    elsif new.status is distinct from old.status then
      line := case new.status
          when 'approved' then 'Approved the proposal ' || q
          when 'sent' then 'Sent the proposal ' || q
          when 'draft' then 'The proposal ' || q || ' is back in draft'
          when 'won' then 'Won the proposal ' || q || coalesce(', now project P' || (select p.number from public.projects p where p.id = new.project_id), '')
          else 'Lost the proposal ' || q
        end;
    else
      line := 'Edited the proposal ' || q;
    end if;

  elsif tg_table_name = 'proposal_lines' then
    select 'Q' || p.number into q from public.proposals p where p.id = rec.proposal_id;
    if q is null then
      return null;
    end if;
    if tg_op = 'INSERT' then
      line := 'Added ' || new.label || ' to ' || q || ', ' || private.money_text(new.price_usd, new.per);
    elsif tg_op = 'DELETE' then
      line := 'Removed ' || old.label || ' from ' || q;
    elsif new.price_usd is distinct from old.price_usd then
      line := q || ': ' || new.label || ' is now ' || private.money_text(new.price_usd, new.per);
    else
      line := q || ': edited the line ' || new.label;
    end if;
  else
    return null;
  end if;

  insert into public.activity (workspace_id, actor_id, via, action, summary)
  values (ws, (select auth.uid()), private.request_via(), tg_table_name || '.' || lower(tg_op), left(line, 500));
  return null;
end;
$$;

create trigger log_price_list after insert or update or delete on public.price_list
  for each row execute function private.log_sales_change();
create trigger log_enquiries after insert or update or delete on public.enquiries
  for each row execute function private.log_sales_change();
create trigger log_proposals after insert or update or delete on public.proposals
  for each row execute function private.log_sales_change();
create trigger log_proposal_lines after insert or update or delete on public.proposal_lines
  for each row execute function private.log_sales_change();

-- Row level security ------------------------------------------------------------------------------

alter table public.price_list enable row level security;
alter table public.enquiries enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_lines enable row level security;
revoke all on public.price_list, public.enquiries, public.proposals, public.proposal_lines from anon;

create policy "Studio reads the price list" on public.price_list
  for select to authenticated using (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Owner adds prices" on public.price_list
  for insert to authenticated with check (private.is_studio(workspace_id) and private.is_owner(workspace_id));
create policy "Owner changes prices" on public.price_list
  for update to authenticated
  using (private.is_studio(workspace_id) and private.is_owner(workspace_id))
  with check (private.is_studio(workspace_id) and private.is_owner(workspace_id));
create policy "Owner removes prices" on public.price_list
  for delete to authenticated using (private.is_studio(workspace_id) and private.is_owner(workspace_id));

create policy "Studio reads enquiries" on public.enquiries
  for select to authenticated using (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Studio adds enquiries" on public.enquiries
  for insert to authenticated with check (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Studio edits enquiries" on public.enquiries
  for update to authenticated
  using (private.is_studio(workspace_id) and private.can_edit(workspace_id))
  with check (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Owner removes enquiries" on public.enquiries
  for delete to authenticated using (private.is_studio(workspace_id) and private.is_owner(workspace_id));

create policy "Studio reads proposals" on public.proposals
  for select to authenticated using (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Studio adds proposals" on public.proposals
  for insert to authenticated with check (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Studio edits proposals" on public.proposals
  for update to authenticated
  using (private.is_studio(workspace_id) and private.can_edit(workspace_id))
  with check (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Owner removes proposals" on public.proposals
  for delete to authenticated using (private.is_studio(workspace_id) and private.is_owner(workspace_id));

create policy "Studio reads proposal lines" on public.proposal_lines
  for select to authenticated using (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Studio adds proposal lines" on public.proposal_lines
  for insert to authenticated with check (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Studio edits proposal lines" on public.proposal_lines
  for update to authenticated
  using (private.is_studio(workspace_id) and private.can_edit(workspace_id))
  with check (private.is_studio(workspace_id) and private.can_edit(workspace_id));
create policy "Studio removes proposal lines" on public.proposal_lines
  for delete to authenticated using (private.is_studio(workspace_id) and private.can_edit(workspace_id));
