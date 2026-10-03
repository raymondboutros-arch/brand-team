import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Content: the idea bank and the calendar. Each item moves idea, draft, approved, scheduled, live,
 * or is dropped. Team drafts; only the Owner or a client approver approves, never through Claude.
 * Nothing here publishes: going live is recorded by a person once it is out.
 */

export type ContentStage = "idea" | "draft" | "approved" | "scheduled" | "live" | "dropped";
export type ContentFormat = "article" | "post" | "carousel" | "video" | "story" | "email" | "other";

/** The stages in order, the way an item moves. Dropped sits outside the line. */
export const STAGES: { value: Exclude<ContentStage, "dropped">; label: string; plural: string }[] = [
  { value: "idea", label: "Idea", plural: "Ideas" },
  { value: "draft", label: "Draft", plural: "Drafts" },
  { value: "approved", label: "Approved", plural: "Approved" },
  { value: "scheduled", label: "Scheduled", plural: "Scheduled" },
  { value: "live", label: "Live", plural: "Live" },
];

export const STAGE_LABEL: Record<ContentStage, string> = {
  idea: "Idea",
  draft: "Draft",
  approved: "Approved",
  scheduled: "Scheduled",
  live: "Live",
  dropped: "Dropped",
};

export const FORMATS: { value: ContentFormat; label: string }[] = [
  { value: "article", label: "Article" },
  { value: "post", label: "Post" },
  { value: "carousel", label: "Carousel" },
  { value: "video", label: "Video" },
  { value: "story", label: "Story" },
  { value: "email", label: "Email" },
  { value: "other", label: "Other" },
];
export const FORMAT_LABEL = Object.fromEntries(FORMATS.map((f) => [f.value, f.label])) as Record<ContentFormat, string>;

export type ContentItem = {
  id: string;
  number: number;
  title: string;
  format: ContentFormat;
  series: string | null;
  channel_id: string | null;
  stage: ContentStage;
  brief: string | null;
  fact: string | null;
  body_md: string | null;
  owner: string | null;
  due_on: string | null;
  publish_on: string | null;
  live_url: string | null;
  source: "team" | "claude";
  review_token: string;
  review_requested_at: string | null;
  review_requested_by: string | null;
  review_note: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type ChannelOption = { id: string; label: string };

/** A draft that someone has sent for approval and nobody has decided on yet. */
export const waitingForApproval = (c: Pick<ContentItem, "stage" | "review_requested_at">) =>
  c.stage === "draft" && c.review_requested_at !== null;

const COLUMNS =
  "id, number, title, format, series, channel_id, stage, brief, fact, body_md, owner, due_on, publish_on, live_url, source, review_token, review_requested_at, review_requested_by, review_note, approved_at, approved_by, created_at, updated_at, updated_by";

async function channelOptions(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("channels")
    .select("id, platform, shown_name, status")
    .eq("workspace_id", workspaceId)
    .neq("status", "to_close")
    .order("kind")
    .order("position");
  return (data ?? []).map((c) => ({
    id: c.id as string,
    label: [c.platform, c.shown_name].filter(Boolean).join(", "),
  })) as ChannelOption[];
}

async function peopleNames(ids: (string | null)[]) {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (unique.length === 0) return names;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", unique);
  for (const p of data ?? []) names.set(p.id, (p.full_name as string | null) ?? String(p.email).split("@")[0]);
  return names;
}

/** Every item in the workspace, with the channels to pick from. Row level security decides what shows. */
export const getContent = cache(async (workspaceId: string) => {
  const supabase = await createClient();
  const [{ data, error }, channels] = await Promise.all([
    supabase
      .from("content_items")
      .select(COLUMNS)
      .eq("workspace_id", workspaceId)
      .order("number", { ascending: true }),
    channelOptions(workspaceId),
  ]);
  if (error) throw error;
  const items = (data ?? []) as ContentItem[];
  const channelName = new Map(channels.map((c) => [c.id, c.label]));
  return { items, channels, channelName };
});

/** One item by its number, with the names of the people around it. */
export const getContentItem = cache(async (workspaceId: string, number: number) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_items")
    .select(COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("number", number)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const item = data as ContentItem;
  const [channels, names] = await Promise.all([
    channelOptions(workspaceId),
    peopleNames([item.approved_by, item.review_requested_by, item.updated_by]),
  ]);
  return { item, channels, channelName: new Map(channels.map((c) => [c.id, c.label])), names };
});

/** Drafts waiting for someone to approve them, for the sidebar. */
export const countToApprove = cache(async (workspaceId: string) => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("content_items")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("stage", "draft")
    .not("review_requested_at", "is", null);
  return count ?? 0;
});
