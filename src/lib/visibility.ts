import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Visibility: Google (Search Console, weekly), AI answers (checks of the prompt list) and other sites. */

export type GoogleWeek = {
  week_of: string;
  days: number;
  clicks: number;
  impressions: number;
  nonbrand_clicks: number | null;
  nonbrand_impressions: number | null;
  avg_position: number | null;
  top_queries: { query: string; impressions: number; clicks: number; position: number }[];
  source: "search_console" | "by_hand";
  note: string | null;
};

export type AiRun = { id: string; checked_on: string; label: string; note: string | null; complete: boolean };

export type AiAnswer = {
  run_id: string;
  prompt_no: number;
  prompt: string;
  kind: "discovery" | "brand" | "language";
  assistant: Assistant;
  attempt: number;
  named: boolean;
  position: number | null;
  verdict: "accurate" | "partly" | "wrong" | "not_found" | "outdated" | null;
  names: string[];
  sources: string[];
  note: string | null;
};

export type SitesWeek = {
  week_of: string;
  domain_rating: number | null;
  referring_domains: number | null;
  backlinks: number | null;
  mentions: number | null;
  source: string;
  note: string | null;
};

export const ASSISTANTS = ["chatgpt", "google_ai_mode", "gemini", "perplexity", "claude"] as const;
export type Assistant = (typeof ASSISTANTS)[number] | "copilot";

export const ASSISTANT_LABEL: Record<Assistant, string> = {
  chatgpt: "ChatGPT",
  google_ai_mode: "Google AI Mode",
  gemini: "Gemini",
  perplexity: "Perplexity",
  claude: "Claude",
  copilot: "Copilot",
};

export const VERDICT_LABEL: Record<NonNullable<AiAnswer["verdict"]>, string> = {
  accurate: "Right",
  partly: "Partly",
  wrong: "Wrong",
  not_found: "Not found",
  outdated: "Outdated",
};

export const KIND_LABEL: Record<AiAnswer["kind"], string> = {
  discovery: "Buyers looking for an agency",
  brand: "Questions about LIVBRID",
  language: "In Arabic and French",
};

export async function getVisibility(workspaceId: string) {
  const supabase = await createClient();
  const [google, runs, sites] = await Promise.all([
    supabase
      .from("visibility_google")
      .select("week_of, days, clicks, impressions, nonbrand_clicks, nonbrand_impressions, avg_position, top_queries, source, note")
      .eq("workspace_id", workspaceId)
      .order("week_of", { ascending: false }),
    supabase
      .from("visibility_ai_runs")
      .select("id, checked_on, label, note, complete")
      .eq("workspace_id", workspaceId)
      .order("checked_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("visibility_sites")
      .select("week_of, domain_rating, referring_domains, backlinks, mentions, source, note")
      .eq("workspace_id", workspaceId)
      .order("week_of", { ascending: false }),
  ]);
  for (const r of [google, runs, sites]) if (r.error) throw r.error;

  const allRuns = (runs.data ?? []) as AiRun[];
  const latest = allRuns[0] ?? null;
  let answers: AiAnswer[] = [];
  if (latest) {
    const { data, error } = await supabase
      .from("visibility_ai_answers")
      .select("run_id, prompt_no, prompt, kind, assistant, attempt, named, position, verdict, names, sources, note")
      .eq("run_id", latest.id)
      .order("prompt_no")
      .order("assistant")
      .order("attempt");
    if (error) throw error;
    answers = (data ?? []) as AiAnswer[];
  }

  return {
    google: ((google.data ?? []) as GoogleWeek[]).map((w) => ({
      ...w,
      avg_position: w.avg_position === null ? null : Number(w.avg_position),
    })),
    runs: allRuns,
    latest,
    answers,
    sites: (sites.data ?? []) as SitesWeek[],
  };
}

/** The same agency written several ways ("Paperview Design and Branding", "Paperview") counts once. */
function agencyKey(name: string) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\b(design and branding|design|branding|agency|studio|creative studio|marketing agency|digital agency|global|lb|mena)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Who AI names, and how often, across the answers given. The name shown is the shortest spelling seen. */
export function topNames(answers: AiAnswer[], limit = 10) {
  const counts = new Map<string, { label: string; n: number }>();
  for (const a of answers) {
    const seen = new Set<string>();
    for (const name of a.names) {
      const key = agencyKey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const cur = counts.get(key);
      if (cur) {
        cur.n += 1;
        if (name.length < cur.label.length) cur.label = name;
      } else counts.set(key, { label: name, n: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).slice(0, limit);
}

export function topSources(answers: AiAnswer[], limit = 10) {
  const counts = new Map<string, number>();
  for (const a of answers) for (const s of new Set(a.sources)) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts.entries()]
    .map(([host, n]) => ({ host, n }))
    .sort((a, b) => b.n - a.n || a.host.localeCompare(b.host))
    .slice(0, limit);
}

/** Searches without our name across several weeks, added up. */
export function topQueries(weeks: GoogleWeek[], limit = 10) {
  const m = new Map<string, { query: string; impressions: number; clicks: number; posSum: number }>();
  for (const w of weeks)
    for (const q of w.top_queries) {
      const cur = m.get(q.query) ?? { query: q.query, impressions: 0, clicks: 0, posSum: 0 };
      cur.impressions += q.impressions;
      cur.clicks += q.clicks;
      cur.posSum += q.position * q.impressions;
      m.set(q.query, cur);
    }
  return [...m.values()]
    .map((q) => ({ ...q, position: q.impressions ? q.posSum / q.impressions : null }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);
}
