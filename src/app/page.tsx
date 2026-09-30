import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyWorkspaces } from "@/lib/hq";

export default async function Home() {
  // Pick up any invite that arrived since this person last signed in.
  const supabase = await createClient();
  await supabase.rpc("claim_invites");

  const workspaces = await getMyWorkspaces();
  redirect(workspaces.length > 0 ? `/w/${workspaces[0].slug}` : "/workspaces");
}
