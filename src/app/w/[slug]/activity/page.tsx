import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatWhen, getWorkspace } from "@/lib/hq";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage({ params }: PageProps<"/w/[slug]/activity">) {
  const { slug } = await params;
  const workspace = await getWorkspace(slug);
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("activity")
    .select("id, summary, via, created_at, actor_id")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const ids = Array.from(new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean))) as string[];
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", ids)
    : { data: [] as { id: string; email: string; full_name: string | null }[] };
  const personById = new Map((people ?? []).map((p) => [p.id, p]));

  return (
    <div className="max-w-[880px]">
      <p className="eyebrow">{workspace.name}</p>
      <h1 className="mt-2 text-[34px] leading-[1.1] font-semibold tracking-[-0.015em]">Activity</h1>
      <p className="mt-3 text-muted">
        Every change, who made it and when. Changes made through Claude are marked, so the history
        always shows who asked for what.
      </p>

      <div className="mt-8 card overflow-x-auto">
        <table className="w-full text-left text-[15px]">
          <thead className="border-b border-line text-sm text-muted">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">What changed</th>
              <th scope="col" className="px-5 py-3 font-medium">Who</th>
              <th scope="col" className="px-5 py-3 font-medium whitespace-nowrap">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(rows ?? []).map((r) => {
              const actor = r.actor_id ? personById.get(r.actor_id) : undefined;
              const who =
                r.via === "system" ? "HQ setup" : (actor?.full_name ?? actor?.email ?? "Someone") + (r.via === "claude" ? ", through Claude" : "");
              return (
                <tr key={r.id}>
                  <td className="px-5 py-3">{r.summary}</td>
                  <td className="px-5 py-3 text-muted">{who}</td>
                  <td className="px-5 py-3 text-muted whitespace-nowrap">{formatWhen(r.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(!rows || rows.length === 0) && <p className="px-5 py-6 text-sm text-muted">Nothing yet.</p>}
      </div>
    </div>
  );
}
