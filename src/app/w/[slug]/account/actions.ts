"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/hq";

export type NameState = { error?: string; ok?: boolean };

export async function saveName(_prev: NameState, formData: FormData): Promise<NameState> {
  const name = String(formData.get("full_name") ?? "").trim().slice(0, 80);
  const viewer = await getViewer();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: name || null })
    .eq("id", viewer.id);
  if (error) return { error: "Your name didn't save. Try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}
