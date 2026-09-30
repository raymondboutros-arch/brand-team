-- Lets the app know whether to show the "new workspace" form.
-- create_workspace() still checks on its own.
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins a
    where a.email = lower((select auth.jwt() ->> 'email'))
  )
$$;

revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
