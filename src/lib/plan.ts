import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type TaskStatus = "not_started" | "in_progress" | "waiting" | "done";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  waiting: "Waiting",
  done: "Done",
};

export type Section = {
  id: string;
  area: "plan" | "strategy" | "reference";
  key: string;
  title: string;
  summary: string | null;
  status: string | null;
  body_md: string;
  position: number;
  updated_at: string;
};

export type Workstream = {
  id: string;
  number: number;
  title: string;
  summary_md: string;
  extra_md: string;
};

export type Task = {
  id: string;
  workstream_id: string | null;
  title: string;
  owner: string | null;
  due_on: string | null;
  status: TaskStatus;
  this_week: boolean;
  position: number;
};

export type Decision = {
  id: string;
  code: string | null;
  title: string;
  recommendation: string | null;
  due_on: string | null;
  status: "open" | "decided";
  outcome: string | null;
  decided_on: string | null;
  decided_label: string | null;
  position: number;
};

export type RoadmapItem = {
  id: string;
  key: string;
  label: string;
  starts_on: string;
  ends_on: string;
  highlight: boolean;
};

export type Metric = {
  id: string;
  key: string;
  label: string;
  goal_label: string | null;
  baseline: string | null;
  counts: "month" | "total";
  position: number;
  goal_position: number | null;
};

export const getSections = cache(async (workspaceId: string, area: Section["area"]) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sections")
    .select("id, area, key, title, summary, status, body_md, position, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("area", area)
    .order("position");
  if (error) throw error;
  const list = (data ?? []) as Section[];
  return { list, byKey: Object.fromEntries(list.map((s) => [s.key, s])) as Record<string, Section> };
});

export const getPlan = cache(async (workspaceId: string) => {
  const supabase = await createClient();
  const [ws, tasks, decisions, roadmap] = await Promise.all([
    supabase.from("workstreams").select("id, number, title, summary_md, extra_md").eq("workspace_id", workspaceId).order("number"),
    supabase
      .from("tasks")
      .select("id, workstream_id, title, owner, due_on, status, this_week, position")
      .eq("workspace_id", workspaceId)
      .order("due_on", { ascending: true, nullsFirst: false })
      .order("position"),
    supabase
      .from("decisions")
      .select("id, code, title, recommendation, due_on, status, outcome, decided_on, decided_label, position")
      .eq("workspace_id", workspaceId)
      .order("position"),
    supabase
      .from("roadmap_items")
      .select("id, key, label, starts_on, ends_on, highlight")
      .eq("workspace_id", workspaceId)
      .order("position"),
  ]);
  for (const r of [ws, tasks, decisions, roadmap]) if (r.error) throw r.error;

  const allDecisions = (decisions.data ?? []) as Decision[];
  const decided = allDecisions
    .filter((d) => d.status === "decided")
    .sort((a, b) => (b.decided_on ?? "0000").localeCompare(a.decided_on ?? "0000") || a.position - b.position);

  return {
    workstreams: (ws.data ?? []) as Workstream[],
    tasks: (tasks.data ?? []) as Task[],
    openDecisions: allDecisions.filter((d) => d.status === "open"),
    decided,
    roadmap: (roadmap.data ?? []) as RoadmapItem[],
  };
});

export const getScorecard = cache(async (workspaceId: string) => {
  const supabase = await createClient();
  const [metrics, targets, values] = await Promise.all([
    supabase
      .from("metrics")
      .select("id, key, label, goal_label, baseline, counts, position, goal_position")
      .eq("workspace_id", workspaceId)
      .order("position"),
    supabase.from("metric_targets").select("metric_id, on_date, value").eq("workspace_id", workspaceId),
    supabase.from("metric_values").select("metric_id, month, value, note").eq("workspace_id", workspaceId),
  ]);
  for (const r of [metrics, targets, values]) if (r.error) throw r.error;
  return {
    metrics: (metrics.data ?? []) as Metric[],
    targets: (targets.data ?? []) as { metric_id: string; on_date: string; value: string }[],
    values: (values.data ?? []) as { metric_id: string; month: string; value: string; note: string | null }[],
  };
});

/** Scorecard numbers that fill themselves from Proposals and Projects (studio workspace only). */
export const AUTO_METRICS = ["enquiries", "diagnostics", "builds", "keep_plans"] as const;
export const AUTO_FROM = "2026-10-01";

export const getScorecardAuto = cache(async (workspaceId: string, throughMonth: string) => {
  const supabase = await createClient();
  const [enq, proj] = await Promise.all([
    supabase.from("enquiries").select("received_on").eq("workspace_id", workspaceId),
    supabase
      .from("projects")
      .select("offer, status, signed_on, ends_on, enquiry_id")
      .eq("workspace_id", workspaceId)
      .not("offer", "is", null),
  ]);
  // Outside the studio workspace, or without access, row level security returns nothing.
  if (enq.error || proj.error) return new Map<string, string>();
  const enquiries = (enq.data ?? []) as { received_on: string }[];
  const projects = (proj.data ?? []) as {
    offer: string;
    status: string;
    signed_on: string | null;
    ends_on: string | null;
    enquiry_id: string | null;
  }[];

  const out = new Map<string, string>(); // "key|YYYY-MM-01" -> value
  const d = new Date(AUTO_FROM + "T00:00:00Z");
  const last = new Date(throughMonth + "T00:00:00Z");
  while (d <= last) {
    const start = d.toISOString().slice(0, 10);
    const next = new Date(d);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const end = new Date(next.getTime() - 86_400_000).toISOString().slice(0, 10);
    const signedBy = (p: (typeof projects)[number]) => p.status !== "lost" && !!p.signed_on && p.signed_on <= end;

    const diagnostics = projects.filter((p) => p.offer === "diagnostic" && signedBy(p));
    const builds = projects.filter(
      (p) =>
        p.offer === "build" &&
        signedBy(p) &&
        !!p.enquiry_id &&
        diagnostics.some((g) => g.enquiry_id === p.enquiry_id && g.signed_on! <= p.signed_on!),
    );
    const keep = projects.filter(
      (p) => p.offer === "keep" && signedBy(p) && (p.status !== "closed" || (p.ends_on !== null && p.ends_on >= start)),
    );

    out.set(`enquiries|${start}`, String(enquiries.filter((e) => e.received_on >= start && e.received_on <= end).length));
    out.set(`diagnostics|${start}`, String(diagnostics.length));
    out.set(`builds|${start}`, String(builds.length));
    out.set(`keep_plans|${start}`, String(keep.length));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
});

export const getBrandLines = cache(async (workspaceId: string) => {
  const supabase = await createClient();
  const [lines, versions] = await Promise.all([
    supabase
      .from("brand_lines")
      .select("id, key, label, words, where_used, position, updated_at")
      .eq("workspace_id", workspaceId)
      .order("position"),
    supabase
      .from("brand_line_versions")
      .select("line_id, words, valid_until")
      .eq("workspace_id", workspaceId)
      .order("valid_until", { ascending: false }),
  ]);
  if (lines.error) throw lines.error;
  if (versions.error) throw versions.error;
  return {
    lines: (lines.data ?? []) as { id: string; key: string; label: string; words: string; where_used: string | null; updated_at: string }[],
    versions: (versions.data ?? []) as { line_id: string; words: string; valid_until: string }[],
  };
});

/** Task is late if its date has passed and it isn't done. */
export function isLate(task: Pick<Task, "due_on" | "status">, today: string) {
  return Boolean(task.due_on && task.due_on < today && task.status !== "done");
}
