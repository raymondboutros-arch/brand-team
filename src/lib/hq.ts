import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "team" | "client_approver" | "client_viewer";

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  team: "Team",
  client_approver: "Client approver",
  client_viewer: "Client viewer",
};

export type Viewer = {
  id: string;
  email: string;
  name: string | null;
  isPlatformAdmin: boolean;
};

/** The signed-in person. Sends them to sign in if there is no session. */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/sign-in");

  const [{ data: profile }, { data: admin }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", claims.sub).maybeSingle(),
    supabase.rpc("is_platform_admin"),
  ]);

  return {
    id: claims.sub,
    email: (profile?.email ?? claims.email ?? "") as string,
    name: profile?.full_name ?? null,
    // Only used to show or hide the "new workspace" form. The database checks again.
    isPlatformAdmin: admin === true,
  };
});

export type WorkspaceSummary = { id: string; slug: string; name: string; role: Role };

/** Workspaces the viewer belongs to. Row level security filters the list. */
export const getMyWorkspaces = cache(async (): Promise<WorkspaceSummary[]> => {
  const viewer = await getViewer();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("role, workspaces!inner(id, slug, name)")
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const ws = row.workspaces as unknown as { id: string; slug: string; name: string };
    return { id: ws.id, slug: ws.slug, name: ws.name, role: row.role as Role };
  });
});

/** One workspace by its address, or a 404 if the viewer isn't a member. */
export const getWorkspace = cache(async (slug: string): Promise<WorkspaceSummary> => {
  const all = await getMyWorkspaces();
  const ws = all.find((w) => w.slug === slug);
  if (!ws) notFound();
  return ws;
});

export function firstName(viewer: Viewer) {
  if (viewer.name) return viewer.name.split(" ")[0];
  return viewer.email.split("@")[0];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "30 Sep, 15:27" in Beirut time. */
export function formatWhen(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "Asia/Beirut",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.day} ${MONTHS[Number(parts.month) - 1]}, ${parts.hour}:${parts.minute}`;
}
