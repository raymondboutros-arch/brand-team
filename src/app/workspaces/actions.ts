"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string };

export async function createWorkspace(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!name) return { error: "Give the workspace a name." };
  if (slug.length < 2) return { error: "The address needs at least two letters or numbers." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_workspace", { p_name: name, p_slug: slug });
  if (error) {
    if (error.code === "23505") return { error: `The address ${slug} is taken. Try another.` };
    return { error: error.message };
  }
  redirect(`/w/${slug}`);
}
