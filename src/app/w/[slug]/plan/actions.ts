"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/hq";

const STATUSES = new Set(["not_started", "in_progress", "waiting", "done"]);

export async function setTaskStatus(slug: string, taskId: string, status: string) {
  if (!STATUSES.has(status)) return;
  const workspace = await getWorkspace(slug);
  if (workspace.role !== "owner" && workspace.role !== "team") return;

  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({ status: status as "not_started" | "in_progress" | "waiting" | "done" })
    .eq("id", taskId)
    .eq("workspace_id", workspace.id);

  revalidatePath(`/w/${slug}`, "layout");
}
