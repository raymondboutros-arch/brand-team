"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer, getWorkspace } from "@/lib/hq";

export type InviteState = { error?: string; ok?: string };

const INVITABLE = new Set(["owner", "team"]);

export async function invitePerson(slug: string, _prev: InviteState, formData: FormData): Promise<InviteState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "team");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a full email address." };
  if (!INVITABLE.has(role)) return { error: "Choose Owner or Team." };

  const [viewer, workspace] = await Promise.all([getViewer(), getWorkspace(slug)]);
  if (workspace.role !== "owner") return { error: "Only the Owner can invite people." };
  if (email === viewer.email) return { error: "That's you." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("invites")
    .insert({ workspace_id: workspace.id, email, role, invited_by: viewer.id });

  if (error) {
    if (error.code === "23505") return { error: `${email} has already been invited.` };
    return { error: "The invite didn't save. Try again." };
  }

  revalidatePath(`/w/${slug}/people`);
  return { ok: `Invited ${email}. They can sign in now with that email.` };
}

export async function cancelInvite(slug: string, formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const workspace = await getWorkspace(slug);
  const supabase = await createClient();
  await supabase.from("invites").delete().eq("id", id).eq("workspace_id", workspace.id);
  revalidatePath(`/w/${slug}/people`);
}

export async function changeRole(slug: string, formData: FormData) {
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!INVITABLE.has(role)) return;
  const workspace = await getWorkspace(slug);
  const supabase = await createClient();
  await supabase.from("members").update({ role }).eq("workspace_id", workspace.id).eq("user_id", userId);
  revalidatePath(`/w/${slug}/people`);
}

export async function removePerson(slug: string, formData: FormData) {
  const userId = String(formData.get("user_id") ?? "");
  const workspace = await getWorkspace(slug);
  const supabase = await createClient();
  await supabase.from("members").delete().eq("workspace_id", workspace.id).eq("user_id", userId);
  revalidatePath(`/w/${slug}/people`);
}
