-- Performance advisor: cover the workspaces.created_by foreign key.
-- Security advisor notes reviewed on 30 Sep 2026, kept on purpose:
--   * platform_admins has no policies: it is managed with SQL only.
--   * claim_invites, create_workspace and is_platform_admin are security definer
--     functions callable by signed-in people: each checks the caller itself.
create index if not exists workspaces_created_by_idx on public.workspaces (created_by);
