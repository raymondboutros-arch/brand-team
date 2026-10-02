-- Covering index for the composite foreign key project_private (project_id, workspace_id) -> projects (id, workspace_id).
-- Raised by the Supabase performance advisor after m5_projects.
create index if not exists project_private_project_ws_idx on public.project_private (project_id, workspace_id);
