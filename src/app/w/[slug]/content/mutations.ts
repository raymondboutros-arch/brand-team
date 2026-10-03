"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/hq";

export type FormState = { error?: string; ok?: string };

const FORMATS = ["article", "post", "carousel", "video", "story", "email", "other"] as const;
const MOVES = ["idea", "draft", "approved", "scheduled", "live", "dropped"] as const;

const text = (f: FormData, k: string, max: number) => {
  const v = String(f.get(k) ?? "").trim();
  return v ? v.slice(0, max) : null;
};
const oneOf = <T extends string>(f: FormData, k: string, allowed: readonly T[]) => {
  const v = String(f.get(k) ?? "").trim() as T;
  return allowed.includes(v) ? v : null;
};
const isDate = (v: string | null) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v);
const isUuid = (v: string | null) => v === null || /^[0-9a-f-]{36}$/i.test(v);

/** The database's own messages are written for people; anything else gets a plain one. */
function dbMessage(error: { message?: string } | null, fallback: string) {
  const m = error?.message ?? "";
  if (/^(Only|Approve|Pick|Write|Add the|This is|New content|That channel)/.test(m)) return m;
  return fallback;
}

async function editor(slug: string) {
  const workspace = await getWorkspace(slug);
  return workspace.role === "owner" || workspace.role === "team" ? workspace : null;
}

async function approver(slug: string) {
  const workspace = await getWorkspace(slug);
  return workspace.role === "owner" || workspace.role === "client_approver" ? workspace : null;
}

const refresh = (slug: string) => revalidatePath(`/w/${slug}`, "layout");

function fields(f: FormData) {
  return {
    title: text(f, "title", 200),
    format: oneOf(f, "format", FORMATS),
    series: text(f, "series", 80),
    channel_id: text(f, "channel_id", 36),
    owner: text(f, "owner", 80),
    due_on: text(f, "due_on", 10),
    brief: text(f, "brief", 4000),
    fact: text(f, "fact", 1000),
  };
}

function check(row: ReturnType<typeof fields>) {
  if (!row.title || row.title.length < 2) return "Give it a working title.";
  if (!row.format) return "Choose a format.";
  if (!isUuid(row.channel_id)) return "Choose the channel from the list.";
  if (!isDate(row.due_on)) return "Pick the date from the calendar.";
  return null;
}

/** Owner and Team add an idea to the bank. */
export async function addContent(slug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const row = fields(formData);
  const problem = check(row);
  if (problem) return { error: problem };

  const workspace = await editor(slug);
  if (!workspace) return { error: "Only the Owner and the Team can add content." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_items")
    .insert({ ...row, workspace_id: workspace.id, stage: "idea" })
    .select("number")
    .single();
  if (error || !data) return { error: dbMessage(error, "The idea didn't save. Try again.") };

  refresh(slug);
  return { ok: `Added C${data.number} to the ideas.` };
}

/** Owner and Team change the details or the text. Changing approved words sends it back to draft. */
export async function saveContent(
  slug: string,
  contentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const row = fields(formData);
  const problem = check(row);
  if (problem) return { error: problem };
  const publish = text(formData, "publish_on", 10);
  const live = text(formData, "live_url", 500);
  if (!isDate(publish)) return { error: "Pick the date from the calendar." };
  if (live && !/^https?:\/\/\S+$/.test(live)) return { error: "The live link must start with https://" };

  const workspace = await editor(slug);
  if (!workspace) return { error: "Only the Owner and the Team can change content." };

  const update: Record<string, unknown> = { ...row, publish_on: publish, live_url: live };
  if (formData.has("body_md")) update.body_md = text(formData, "body_md", 60000);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_items")
    .update(update)
    .eq("id", contentId)
    .eq("workspace_id", workspace.id)
    .select("stage")
    .single();
  if (error || !data) return { error: dbMessage(error, "The changes didn't save. Try again.") };

  refresh(slug);
  const was = String(formData.get("was") ?? "");
  const sentBack = (was === "approved" || was === "scheduled") && data.stage === "draft";
  return { ok: sentBack ? "Saved. It's back to draft, to be approved again." : "Saved." };
}

/**
 * Moves an item to another stage. Approving needs the Owner or a client approver; the database
 * also refuses it through Claude. Everything else needs the Owner or the Team.
 */
export async function moveContent(
  slug: string,
  contentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const to = oneOf(formData, "to", MOVES);
  if (!to) return { error: "Choose where it goes." };
  const publish = text(formData, "publish_on", 10);
  const live = text(formData, "live_url", 500);
  if (!isDate(publish)) return { error: "Pick the date from the calendar." };
  if (live && !/^https?:\/\/\S+$/.test(live)) return { error: "The live link must start with https://" };
  if (to === "scheduled" && !publish) return { error: "Pick the date it goes out." };

  const workspace = to === "approved" ? await approver(slug) : await editor(slug);
  if (!workspace) {
    return {
      error: to === "approved" ? "Only the Owner or a client approver can approve content." : "Only the Owner and the Team can move content.",
    };
  }

  const update: Record<string, unknown> = { stage: to };
  if (publish) update.publish_on = publish;
  if (live) update.live_url = live;

  const supabase = await createClient();
  const { error } = await supabase.from("content_items").update(update).eq("id", contentId).eq("workspace_id", workspace.id);
  if (error) return { error: dbMessage(error, "That didn't save. Try again.") };

  refresh(slug);
  return { ok: "Saved." };
}

/** The person drafting says it's ready: it shows as waiting for approval. */
export async function sendForApproval(slug: string, contentId: string): Promise<FormState> {
  const workspace = await editor(slug);
  if (!workspace) return { error: "Only the Owner and the Team can send a draft for approval." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_items")
    .update({ review_requested_at: new Date().toISOString() })
    .eq("id", contentId)
    .eq("workspace_id", workspace.id);
  if (error) return { error: dbMessage(error, "That didn't save. Try again.") };
  refresh(slug);
  return { ok: "Sent for approval." };
}

/** The Owner or a client approver sends a draft back with a note. */
export async function askForChanges(
  slug: string,
  contentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const note = text(formData, "note", 2000);
  if (!note) return { error: "Say what should change." };
  const workspace = await approver(slug);
  if (!workspace) return { error: "Only the Owner or a client approver can send a draft back." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_items")
    .update({ review_note: note, review_requested_at: null })
    .eq("id", contentId)
    .eq("workspace_id", workspace.id)
    .eq("stage", "draft");
  if (error) return { error: dbMessage(error, "That didn't save. Try again.") };
  refresh(slug);
  return { ok: "Sent back with your note." };
}

/** A new review link. The old one stops working at once. */
export async function newReviewLink(slug: string, contentId: string) {
  const workspace = await editor(slug);
  if (!workspace) return;
  const supabase = await createClient();
  await supabase
    .from("content_items")
    .update({ review_token: randomBytes(32).toString("hex") })
    .eq("id", contentId)
    .eq("workspace_id", workspace.id);
  refresh(slug);
}
