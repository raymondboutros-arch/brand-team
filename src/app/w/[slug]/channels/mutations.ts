"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/hq";
import { todayInBeirut } from "@/lib/dates";

export type FormState = { error?: string; ok?: string };

const KINDS = ["reviews", "directory", "google", "social", "website"] as const;
const STATUSES = ["to_check", "needs_update", "up_to_date", "to_claim", "to_close"] as const;

const text = (f: FormData, k: string, max: number) => {
  const v = String(f.get(k) ?? "").trim();
  return v ? v.slice(0, max) : null;
};
const oneOf = <T extends string>(f: FormData, k: string, allowed: readonly T[]) => {
  const v = String(f.get(k) ?? "").trim() as T;
  return allowed.includes(v) ? v : null;
};
/** A yes / no / not filled in select: "yes", "no" or "". */
const yesNo = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "");
  return v === "yes" ? true : v === "no" ? false : null;
};

/** Anything that looks like a password or a code never gets saved, even in the notes. */
const LOOKS_SECRET = /\b(password|passcode|pwd|mot de passe|backup code|recovery code)\b\s*[:=]/i;

async function editor(slug: string) {
  const workspace = await getWorkspace(slug);
  if (workspace.role !== "owner" && workspace.role !== "team") return null;
  return workspace;
}

/** Owner and Team add a channel (channelId null) or update one. */
export async function saveChannel(
  slug: string,
  channelId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const platform = text(formData, "platform", 60);
  const kind = oneOf(formData, "kind", KINDS);
  const status = oneOf(formData, "status", STATUSES) ?? "to_check";
  const url = text(formData, "url", 500);
  const loginEmail = text(formData, "login_email", 200);
  const checkedOn = text(formData, "checked_on", 10);
  const note = text(formData, "note", 2000);

  if (!platform) return { error: "Name the platform, for example Instagram or Clutch." };
  if (!kind) return { error: "Choose what kind of channel it is." };
  if (url && !/^https?:\/\/\S+$/.test(url)) return { error: "The link must start with https://" };
  if (loginEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(loginEmail)) {
    return { error: "The login email doesn't look like an email address." };
  }
  if (checkedOn && !/^\d{4}-\d{2}-\d{2}$/.test(checkedOn)) return { error: "Pick the date from the calendar." };
  if (note && LOOKS_SECRET.test(note)) {
    return { error: "That note looks like it holds a password or a code. Keep those in the password manager, never here." };
  }

  const workspace = await editor(slug);
  if (!workspace) return { error: "Only the Owner and the Team can change channels." };

  const row = {
    platform,
    kind,
    status,
    url,
    shown_name: text(formData, "shown_name", 120),
    handle: text(formData, "handle", 120),
    owner: text(formData, "owner", 80),
    login_email: loginEmail,
    two_step: yesNo(formData, "two_step"),
    in_vault: yesNo(formData, "in_vault"),
    checked_on: checkedOn,
    note,
  };

  const supabase = await createClient();
  const { error } = channelId
    ? await supabase.from("channels").update(row).eq("id", channelId).eq("workspace_id", workspace.id)
    : await supabase.from("channels").insert({ ...row, workspace_id: workspace.id, position: 100 });

  if (error) {
    if (error.code === "23505") return { error: "That link is already on another channel." };
    return { error: "The channel didn't save. Try again." };
  }

  revalidatePath(`/w/${slug}`, "layout");
  return { ok: channelId ? "Saved." : `Added ${platform}.` };
}

/** Owner and Team change only the status, from the row itself. */
export async function setChannelStatus(slug: string, channelId: string, status: string) {
  if (!(STATUSES as readonly string[]).includes(status)) return;
  const workspace = await editor(slug);
  if (!workspace) return;
  const supabase = await createClient();
  await supabase
    .from("channels")
    .update({ status, checked_on: todayInBeirut() })
    .eq("id", channelId)
    .eq("workspace_id", workspace.id);
  revalidatePath(`/w/${slug}`, "layout");
}

/** Only the Owner removes a channel. The activity log keeps a line saying it was removed. */
export async function removeChannel(slug: string, channelId: string) {
  const workspace = await getWorkspace(slug);
  if (workspace.role !== "owner") return;
  const supabase = await createClient();
  await supabase.from("channels").delete().eq("id", channelId).eq("workspace_id", workspace.id);
  revalidatePath(`/w/${slug}`, "layout");
}
