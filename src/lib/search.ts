import { createClient } from "@/lib/supabase/server";

/**
 * Search across one workspace: plan and strategy notes, Reference, tasks, decisions,
 * workstreams, the Action queue, Channels, the fixed brand lines, the Scorecard and, in the studio's own
 * workspace, Projects.
 * Runs as the signed-in person, so row level security decides what they can find.
 */

export type Hit = {
  id: string;
  kind: Kind;
  title: string;
  mark?: string; // D1, A3, 4, shown in Instrument Serif italic
  meta?: string;
  snippet: string;
  href: string; // path inside the workspace, e.g. "plan#ws-4"
};

export type Kind =
  | "page"
  | "task"
  | "decision"
  | "workstream"
  | "action"
  | "channel"
  | "project"
  | "proposal"
  | "enquiry"
  | "line"
  | "metric";

export const KIND_LABEL: Record<Kind, string> = {
  page: "Pages",
  decision: "Decisions",
  task: "Tasks",
  action: "Action queue",
  channel: "Channels",
  project: "Projects",
  proposal: "Proposals",
  enquiry: "Enquiries",
  workstream: "Workstreams",
  line: "Brand lines",
  metric: "Scorecard",
};

const AREA_PATH: Record<string, string> = { plan: "plan", strategy: "brand", reference: "reference" };
const AREA_NAME: Record<string, string> = { plan: "Plan", strategy: "Brand strategy", reference: "Reference" };
const STATUS_NAME: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  waiting: "Waiting",
  done: "Done",
  approved: "Approved",
  dismissed: "Dismissed",
  open: "Open",
  decided: "Decided",
};

const PROJECT_STATUS: Record<string, string> = {
  signed: "Signed",
  in_progress: "In progress",
  delivered: "Delivered",
  closed: "Closed",
  lost: "Lost pitch",
};

const CHANNEL_STATUS: Record<string, string> = {
  to_check: "Not checked",
  needs_update: "Needs update",
  up_to_date: "Up to date",
  to_claim: "To claim",
  to_close: "To close",
};

const SALES_STATUS: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  sent: "Sent",
  won: "Won",
  lost: "Lost",
  open: "Open",
  declined: "Not for us",
};

/** Words worth searching for: no PostgREST syntax characters, at most five words. */
export function searchTerms(q: string) {
  return q
    .replace(/[%_,()"'\\*:.]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
    .slice(0, 5);
}

/** Markdown to plain text, enough for a readable snippet. */
function plain(md: string | null | undefined) {
  return (md ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>`|]/g, " ")
    .replace(/-{3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** About 160 characters of text around the first word that matches. */
function snippetFor(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  const at = Math.min(...terms.map((t) => lower.indexOf(t.toLowerCase())).filter((i) => i >= 0), Infinity);
  if (!Number.isFinite(at)) return text.slice(0, 160) + (text.length > 160 ? "…" : "");
  const start = Math.max(0, at - 60);
  const end = Math.min(text.length, at + 120);
  return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
}

/** Every term must appear in at least one of the columns. */
function allTerms<T extends { or: (f: string) => T }>(query: T, columns: string[], terms: string[]) {
  return terms.reduce((q, t) => q.or(columns.map((c) => `${c}.ilike.%${t}%`).join(",")), query);
}

function score(title: string, terms: string[]) {
  const t = title.toLowerCase();
  return terms.reduce((s, w) => s + (t.includes(w.toLowerCase()) ? 2 : 0), 0);
}

export async function searchHQ(workspaceId: string, q: string): Promise<{ terms: string[]; hits: Hit[] }> {
  const terms = searchTerms(q);
  if (terms.length === 0) return { terms, hits: [] };
  const supabase = await createClient();
  const LIMIT = 25;

  const [sections, tasks, decisions, workstreams, actions, projects, proposals, enquiries, lines, metrics, channels] = await Promise.all([
    allTerms(
      supabase.from("sections").select("id, area, key, title, body_md").eq("workspace_id", workspaceId),
      ["title", "body_md"],
      terms,
    ).limit(LIMIT),
    allTerms(
      supabase.from("tasks").select("id, title, owner, due_on, status, workstream_id").eq("workspace_id", workspaceId),
      ["title", "owner"],
      terms,
    ).limit(LIMIT),
    allTerms(
      supabase
        .from("decisions")
        .select("id, code, title, recommendation, outcome, status")
        .eq("workspace_id", workspaceId),
      ["code", "title", "recommendation", "outcome"],
      terms,
    ).limit(LIMIT),
    allTerms(
      supabase.from("workstreams").select("id, number, title, summary_md, extra_md").eq("workspace_id", workspaceId),
      ["title", "summary_md", "extra_md"],
      terms,
    ).limit(LIMIT),
    allTerms(
      supabase.from("actions").select("id, number, title, finding, fix, status").eq("workspace_id", workspaceId),
      ["title", "finding", "fix", "owner"],
      terms,
    ).limit(LIMIT),
    // Only the studio's Owner and Team can read projects; for anyone else this returns nothing.
    allTerms(
      supabase
        .from("projects")
        .select("id, number, client, sector, brief, real_need, deliverables, notes, status")
        .eq("workspace_id", workspaceId),
      ["client", "sector", "brief", "real_need", "deliverables", "notes"],
      terms,
    ).limit(LIMIT),
    allTerms(
      supabase
        .from("proposals")
        .select("id, number, title, client, our_thinking, scope, status")
        .eq("workspace_id", workspaceId),
      ["title", "client", "our_thinking", "scope"],
      terms,
    ).limit(LIMIT),
    allTerms(
      supabase.from("enquiries").select("id, number, client, sector, notes, status").eq("workspace_id", workspaceId),
      ["client", "sector", "notes"],
      terms,
    ).limit(LIMIT),
    allTerms(
      supabase.from("brand_lines").select("id, label, words, where_used").eq("workspace_id", workspaceId),
      ["label", "words", "where_used"],
      terms,
    ).limit(LIMIT),
    allTerms(
      supabase.from("metrics").select("id, label, goal_label, baseline").eq("workspace_id", workspaceId),
      ["label", "goal_label"],
      terms,
    ).limit(LIMIT),
    allTerms(
      supabase
        .from("channels")
        .select("id, platform, shown_name, handle, url, owner, note, status")
        .eq("workspace_id", workspaceId),
      ["platform", "shown_name", "handle", "url", "owner", "login_email", "note"],
      terms,
    ).limit(LIMIT),
  ]);

  const wsNumber = new Map<string, number>();
  if ((tasks.data ?? []).some((t) => t.workstream_id)) {
    const { data } = await supabase.from("workstreams").select("id, number").eq("workspace_id", workspaceId);
    for (const w of data ?? []) wsNumber.set(w.id, w.number);
  }

  const hits: Hit[] = [];

  for (const s of sections.data ?? []) {
    hits.push({
      id: s.id,
      kind: "page",
      title: s.title,
      meta: AREA_NAME[s.area] ?? s.area,
      snippet: snippetFor(plain(s.body_md), terms),
      href: `${AREA_PATH[s.area] ?? s.area}#${s.key}`,
    });
  }
  for (const d of decisions.data ?? []) {
    hits.push({
      id: d.id,
      kind: "decision",
      title: d.title,
      mark: d.code ?? undefined,
      meta: STATUS_NAME[d.status],
      snippet: snippetFor(plain([d.outcome, d.recommendation].filter(Boolean).join(" ")), terms),
      href: d.status === "open" && d.code ? `plan#${d.code.toLowerCase()}` : "plan#decision-log",
    });
  }
  for (const t of tasks.data ?? []) {
    const n = t.workstream_id ? wsNumber.get(t.workstream_id) : undefined;
    hits.push({
      id: t.id,
      kind: "task",
      title: t.title,
      meta: [t.owner, STATUS_NAME[t.status]].filter(Boolean).join(", "),
      snippet: "",
      href: n ? `plan#ws-${n}` : "plan#this-week",
    });
  }
  for (const a of actions.data ?? []) {
    hits.push({
      id: a.id,
      kind: "action",
      title: a.title,
      mark: `A${a.number}`,
      meta: STATUS_NAME[a.status],
      snippet: snippetFor(plain([a.finding, a.fix].filter(Boolean).join(" ")), terms),
      href: `actions${a.status === "waiting" ? "" : `?show=${a.status}`}#a${a.number}`,
    });
  }
  for (const c of channels.data ?? []) {
    hits.push({
      id: c.id,
      kind: "channel",
      title: [c.platform, c.shown_name].filter(Boolean).join(", "),
      meta: [c.owner, CHANNEL_STATUS[c.status]].filter(Boolean).join(", "),
      snippet: snippetFor(plain([c.note, c.handle, c.url].filter(Boolean).join(" ")), terms),
      href: `channels#ch-${c.id}`,
    });
  }
  for (const p of projects.data ?? []) {
    hits.push({
      id: p.id,
      kind: "project",
      title: p.client,
      mark: `P${p.number}`,
      meta: [p.sector, PROJECT_STATUS[p.status]].filter(Boolean).join(", "),
      snippet: snippetFor(plain([p.deliverables, p.brief, p.real_need, p.notes].filter(Boolean).join(" ")), terms),
      href: `projects/${p.number}`,
    });
  }
  for (const q of proposals.data ?? []) {
    hits.push({
      id: q.id,
      kind: "proposal",
      title: q.title,
      mark: `Q${q.number}`,
      meta: [q.client, SALES_STATUS[q.status]].filter(Boolean).join(", "),
      snippet: snippetFor(plain([q.our_thinking, q.scope].filter(Boolean).join(" ")), terms),
      href: `proposals/${q.number}`,
    });
  }
  for (const e of enquiries.data ?? []) {
    hits.push({
      id: e.id,
      kind: "enquiry",
      title: e.client,
      mark: `E${e.number}`,
      meta: [e.sector, SALES_STATUS[e.status]].filter(Boolean).join(", "),
      snippet: snippetFor(plain(e.notes), terms),
      href: `proposals/enquiries/${e.number}`,
    });
  }
  for (const w of workstreams.data ?? []) {
    hits.push({
      id: w.id,
      kind: "workstream",
      title: w.title,
      mark: String(w.number),
      snippet: snippetFor(plain([w.summary_md, w.extra_md].filter(Boolean).join(" ")), terms),
      href: `plan#ws-${w.number}`,
    });
  }
  for (const l of lines.data ?? []) {
    hits.push({
      id: l.id,
      kind: "line",
      title: l.label,
      snippet: snippetFor(plain(l.words), terms),
      href: "brand#fixed-lines",
    });
  }
  for (const m of metrics.data ?? []) {
    hits.push({
      id: m.id,
      kind: "metric",
      title: m.goal_label ?? m.label,
      meta: m.baseline ? `Now ${m.baseline}` : undefined,
      snippet: "",
      href: "scorecard",
    });
  }

  hits.sort((a, b) => score(b.title, terms) - score(a.title, terms));
  return { terms, hits };
}
