import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type ActionStatus = "waiting" | "approved" | "done" | "dismissed";
export type ActionImpact = "high" | "medium" | "low";
export type ActionArea = "website" | "google" | "ai" | "social" | "brand" | "content" | "other";

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  waiting: "Waiting",
  approved: "Approved",
  done: "Done",
  dismissed: "Dismissed",
};

export const ACTION_AREAS: { value: ActionArea; label: string }[] = [
  { value: "website", label: "Website" },
  { value: "google", label: "Google" },
  { value: "ai", label: "AI answers" },
  { value: "social", label: "Social" },
  { value: "brand", label: "Brand" },
  { value: "content", label: "Content" },
  { value: "other", label: "Other" },
];
export const AREA_LABEL = Object.fromEntries(ACTION_AREAS.map((a) => [a.value, a.label])) as Record<ActionArea, string>;

export const IMPACT_LABEL: Record<ActionImpact, string> = {
  high: "High impact",
  medium: "Medium impact",
  low: "Low impact",
};

export type Action = {
  id: string;
  number: number;
  title: string;
  area: ActionArea;
  finding: string;
  evidence_url: string | null;
  fix: string;
  impact: ActionImpact;
  status: ActionStatus;
  source: "team" | "claude" | "connection";
  owner: string | null;
  due_on: string | null;
  decision_note: string | null;
  created_at: string;
  created_by: string | null;
  decided_at: string | null;
  decided_by: string | null;
  done_at: string | null;
};

const IMPACT_ORDER: Record<ActionImpact, number> = { high: 0, medium: 1, low: 2 };

/**
 * Every finding in the workspace, with the names of the people who added and decided them.
 * Row level security decides what the viewer can see.
 */
export const getActions = cache(async (workspaceId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("actions")
    .select(
      "id, number, title, area, finding, evidence_url, fix, impact, status, source, owner, due_on, decision_note, created_at, created_by, decided_at, decided_by, done_at",
    )
    .eq("workspace_id", workspaceId)
    .order("number", { ascending: true });
  if (error) throw error;
  const actions = (data ?? []) as Action[];

  const ids = [...new Set(actions.flatMap((a) => [a.created_by, a.decided_by]).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: people } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    for (const p of people ?? []) names.set(p.id, (p.full_name as string | null) ?? (p.email as string));
  }

  const byStatus: Record<ActionStatus, Action[]> = {
    waiting: actions
      .filter((a) => a.status === "waiting")
      .sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact] || a.number - b.number),
    approved: actions
      .filter((a) => a.status === "approved")
      .sort((a, b) => (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999") || a.number - b.number),
    done: actions.filter((a) => a.status === "done").sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? "")),
    dismissed: actions
      .filter((a) => a.status === "dismissed")
      .sort((a, b) => (b.decided_at ?? "").localeCompare(a.decided_at ?? "")),
  };

  return { all: actions, byStatus, names };
});

/** How many findings wait for a decision. Used by the sidebar and the Overview. */
export const countWaiting = cache(async (workspaceId: string) => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("actions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "waiting");
  return count ?? 0;
});
