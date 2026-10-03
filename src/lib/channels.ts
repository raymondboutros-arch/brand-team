import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Channels: every account a brand has, who looks after it, which email it is under and whether
 * its sign-in is safe. No passwords, ever: the table has no column for one. Passwords live in
 * the password manager, and HQ only records whether the login is there.
 */

export type ChannelKind = "reviews" | "directory" | "google" | "social" | "website";
export type ChannelStatus = "to_check" | "needs_update" | "up_to_date" | "to_claim" | "to_close";
export type ChannelConnection = "not_connected" | "connected" | "broken";

export const CHANNEL_KINDS: { value: ChannelKind; label: string; plural: string }[] = [
  { value: "reviews", label: "Review site", plural: "Review sites" },
  { value: "directory", label: "Directory", plural: "Directories" },
  { value: "google", label: "Google", plural: "Google" },
  { value: "social", label: "Social", plural: "Social" },
  { value: "website", label: "Website or domain", plural: "Websites and domains" },
];
export const CHANNEL_KIND_LABEL = Object.fromEntries(CHANNEL_KINDS.map((k) => [k.value, k.label])) as Record<
  ChannelKind,
  string
>;

export const CHANNEL_STATUS: { value: ChannelStatus; label: string }[] = [
  { value: "needs_update", label: "Needs update" },
  { value: "to_claim", label: "To claim" },
  { value: "to_close", label: "To close" },
  { value: "to_check", label: "Not checked" },
  { value: "up_to_date", label: "Up to date" },
];
export const CHANNEL_STATUS_LABEL = Object.fromEntries(CHANNEL_STATUS.map((s) => [s.value, s.label])) as Record<
  ChannelStatus,
  string
>;

/** Statuses that need someone to do something on the platform itself. */
export const NEEDS_WORK: ChannelStatus[] = ["needs_update", "to_claim", "to_close"];

export const CONNECTION_LABEL: Record<ChannelConnection, string> = {
  not_connected: "Not connected",
  connected: "Connected",
  broken: "Connection broken",
};

export type Channel = {
  id: string;
  kind: ChannelKind;
  platform: string;
  shown_name: string | null;
  handle: string | null;
  url: string | null;
  owner: string | null;
  login_email: string | null;
  two_step: boolean | null;
  in_vault: boolean | null;
  status: ChannelStatus;
  connection: ChannelConnection;
  note: string | null;
  checked_on: string | null;
  position: number;
  updated_at: string;
  updated_by: string | null;
};

const STATUS_ORDER: Record<ChannelStatus, number> = {
  needs_update: 0,
  to_claim: 1,
  to_close: 2,
  to_check: 3,
  up_to_date: 4,
};

/** "instagram.com/livbrid" from "https://www.instagram.com/livbrid/". */
export function shortUrl(url: string) {
  return url
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/$/, "")
    .slice(0, 60);
}

/**
 * Every channel in the workspace, grouped by kind, with counts for the summary line.
 * Row level security decides what the viewer can see.
 */
export const getChannels = cache(async (workspaceId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("channels")
    .select(
      "id, kind, platform, shown_name, handle, url, owner, login_email, two_step, in_vault, status, connection, note, checked_on, position, updated_at, updated_by",
    )
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true })
    .order("platform", { ascending: true });
  if (error) throw error;
  const channels = (data ?? []) as Channel[];

  const ids = [...new Set(channels.map((c) => c.updated_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: people } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    for (const p of people ?? []) names.set(p.id, (p.full_name as string | null) ?? (p.email as string));
  }

  const byStatus = (list: Channel[]) =>
    [...list].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.position - b.position);

  const count = {
    all: channels.length,
    needsWork: channels.filter((c) => NEEDS_WORK.includes(c.status)).length,
    toCheck: channels.filter((c) => c.status === "to_check").length,
    upToDate: channels.filter((c) => c.status === "up_to_date").length,
    twoStepOn: channels.filter((c) => c.two_step === true).length,
    twoStepOff: channels.filter((c) => c.two_step === false).length,
    inVault: channels.filter((c) => c.in_vault === true).length,
    safetyUnknown: channels.filter((c) => c.two_step === null || c.in_vault === null).length,
  };

  return { channels, byStatus, names, count };
});
