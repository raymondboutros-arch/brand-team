-- Role names in the activity log match the screens: "joined as Owner", not "joined as owner".
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
      line := coalesce(private.person_label(new.user_id), 'Someone') || ' joined as ' || initcap(replace(new.role::text, '_', ' '));
    elsif tg_op = 'UPDATE' then
      if new.role is not distinct from old.role then
        return null;
      end if;
      ws := new.workspace_id;
      line := coalesce(private.person_label(new.user_id), 'Someone') || ' is now ' || initcap(replace(new.role::text, '_', ' '));
    else
      ws := old.workspace_id;
      line := coalesce(private.person_label(old.user_id), 'Someone') || ' was removed';
    end if;

  elsif tg_table_name = 'invites' then
    if tg_op = 'INSERT' then
      ws := new.workspace_id;
      line := 'Invited ' || new.email || ' as ' || initcap(replace(new.role::text, '_', ' '));
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
