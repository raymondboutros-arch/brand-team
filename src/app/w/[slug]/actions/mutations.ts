"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/hq";

export type AddState = { error?: string; ok?: string };

const AREAS = new Set(["website", "google", "ai", "social", "brand", "content", "other"]);
const IMPACTS = new Set(["high", "medium", "low"]);

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

/** Owner and Team add a finding. It starts as waiting, for someone to approve or dismiss. */
export async function addAction(slug: string, _prev: AddState, formData: FormData): Promise<AddState> {
  const title = text(formData, "title");
  const area = text(formData, "area") || "other";
  const impact = text(formData, "impact") || "medium";
  const finding = text(formData, "finding");
  const fix = text(formData, "fix");
  const evidence = text(formData, "evidence_url");
  const owner = text(formData, "owner");
  const due = text(formData, "due_on");

  if (title.length < 3) return { error: "Give the finding a title of a few words." };
  if (title.length > 200) return { error: "Keep the title under 200 characters." };
  if (!AREAS.has(area) || !IMPACTS.has(impact)) return { error: "Choose an area and an impact." };
  if (!finding) return { error: "Say what you found." };
  if (!fix) return { error: "Propose a fix, even a rough one." };
  if (finding.length > 4000 || fix.length > 4000) return { error: "Keep each part under 4,000 characters." };
  if (evidence && !/^https?:\/\/\S+$/.test(evidence)) return { error: "The evidence link must start with https://" };
  if (owner.length > 80) return { error: "Keep the owner short, a name or two." };
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: "Pick a due date from the calendar." };

  const workspace = await getWorkspace(slug);
  if (workspace.role !== "owner" && workspace.role !== "team") {
    return { error: "Only the Owner and the Team can add findings." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("actions")
    .insert({
      workspace_id: workspace.id,
      title,
      area,
      impact,
      finding,
      fix,
      evidence_url: evidence || null,
      owner: owner || null,
      due_on: due || null,
    })
    .select("number")
    .single();

  if (error || !data) return { error: "The finding didn't save. Try again." };

  revalidatePath(`/w/${slug}`, "layout");
  return { ok: `Added A${data.number}. It's waiting for a decision.` };
}

/** Owner, Team and client approvers approve or dismiss a waiting finding, with an optional note. */
export async function decideAction(slug: string, actionId: string, formData: FormData) {
  const decision = text(formData, "decision");
  const note = text(formData, "note").slice(0, 1000);
  if (decision !== "approved" && decision !== "dismissed") return;

  const workspace = await getWorkspace(slug);
  if (!["owner", "team", "client_approver"].includes(workspace.role)) return;

  const supabase = await createClient();
  await supabase
    .from("actions")
    .update({ status: decision, decision_note: note || null })
    .eq("id", actionId)
    .eq("workspace_id", workspace.id)
    .eq("status", "waiting");

  revalidatePath(`/w/${slug}`, "layout");
}

/** Owner and Team mark an approved finding done, or move any finding back to waiting. */
export async function moveAction(slug: string, actionId: string, status: "done" | "waiting") {
  if (status !== "done" && status !== "waiting") return;
  const workspace = await getWorkspace(slug);
  if (workspace.role !== "owner" && workspace.role !== "team") return;

  const supabase = await createClient();
  let query = supabase.from("actions").update({ status }).eq("id", actionId).eq("workspace_id", workspace.id);
  if (status === "done") query = query.eq("status", "approved");
  await query;

  revalidatePath(`/w/${slug}`, "layout");
}
