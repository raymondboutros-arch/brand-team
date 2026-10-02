import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Projects (Owner and Team) and their money, hours and profit range (Owner only). */

export type ProjectStatus = "signed" | "in_progress" | "delivered" | "closed" | "lost";

export type Project = {
  id: string;
  number: number;
  client: string;
  sector: string | null;
  client_type: string | null;
  source: string | null;
  buyer: string | null;
  brief: string | null;
  real_need: string | null;
  deliverables: string | null;
  lead_person: string | null;
  status: ProjectStatus;
  year: number | null;
  starts_on: string | null;
  ends_on: string | null;
  duration: string | null;
  price_usd: number | null;
  referred: string | null;
  came_back: string | null;
  five_more: string | null;
  brand_to_website: string | null;
  proof: string | null;
  result: string | null;
  testimonial: string | null;
  may_name: boolean;
  may_name_note: string | null;
  lost_said: string | null;
  lost_think: string | null;
  notes: string | null;
  updated_at: string;
};

export type MoneyLine = {
  id: string;
  project_id: string;
  kind: "invoiced" | "paid" | "cost";
  category: string | null;
  amount_usd: number;
  on_date: string;
  note: string | null;
};

export type HoursLine = {
  id: string;
  project_id: string;
  person: string;
  week_of: string;
  hours: number;
  note: string | null;
};

export type ProjectPrivate = { project_id: string; profit_range: string | null; note: string | null };

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  signed: "Signed",
  in_progress: "In progress",
  delivered: "Delivered",
  closed: "Closed",
  lost: "Lost pitch",
};
export const STATUSES = Object.keys(STATUS_LABEL) as ProjectStatus[];

export const CLIENT_TYPE: Record<string, string> = {
  founder: "Founder-led business",
  family: "Family business",
  ngo: "NGO or international organization",
  corporate: "Corporate",
  own: "Our own venture",
  other: "Other",
};

export const SOURCE: Record<string, string> = {
  referral: "Referral",
  someone_we_knew: "Someone we knew",
  google: "Google",
  ai: "An AI answer",
  social: "Social media",
  tender: "Tender",
  other: "Other",
};

export const YES_NO: Record<string, string> = { yes: "Yes", no: "No", maybe: "Maybe", na: "Not applicable" };

export const PROOF: Record<string, string> = {
  both: "A measurable result and a strong testimonial",
  result: "A measurable result",
  testimonial: "A strong testimonial",
  neither: "Neither yet",
};

export const PROFIT_RANGE: Record<string, string> = {
  lost_money: "Lost money",
  broke_even: "Broke even",
  healthy: "Healthy",
  excellent: "Excellent",
};

export const MONEY_KIND: Record<MoneyLine["kind"], string> = {
  invoiced: "Invoiced",
  paid: "Paid",
  cost: "Outside cost",
};

export const COST_CATEGORY: Record<string, string> = {
  freelancer: "Freelancer",
  team_share: "Team share",
  hosting: "Hosting",
  print: "Print",
  ads: "Ads",
  software: "Software",
  other: "Other",
};

/** The choices the project form offers, as [value, label] pairs. */
export const PROJECT_OPTIONS = {
  status: Object.entries(STATUS_LABEL),
  clientType: Object.entries(CLIENT_TYPE),
  source: Object.entries(SOURCE),
  proof: Object.entries(PROOF),
} as const;

const COLUMNS =
  "id, number, client, sector, client_type, source, buyer, brief, real_need, deliverables, lead_person, status, year, starts_on, ends_on, duration, price_usd, referred, came_back, five_more, brand_to_website, proof, result, testimonial, may_name, may_name_note, lost_said, lost_think, notes, updated_at";

export async function getProjects(workspaceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("number", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function getProject(workspaceId: string, number: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("number", number)
    .maybeSingle();
  if (error) throw error;
  return data as Project | null;
}

/** Owner only. Row level security returns nothing to anyone else. */
export async function getMoney(workspaceId: string, projectId?: string) {
  const supabase = await createClient();
  let money = supabase
    .from("project_money")
    .select("id, project_id, kind, category, amount_usd, on_date, note")
    .eq("workspace_id", workspaceId)
    .order("on_date", { ascending: false });
  let hours = supabase
    .from("project_hours")
    .select("id, project_id, person, week_of, hours, note")
    .eq("workspace_id", workspaceId)
    .order("week_of", { ascending: false });
  let priv = supabase.from("project_private").select("project_id, profit_range, note").eq("workspace_id", workspaceId);
  if (projectId) {
    money = money.eq("project_id", projectId);
    hours = hours.eq("project_id", projectId);
    priv = priv.eq("project_id", projectId);
  }
  const [m, h, p] = await Promise.all([money, hours, priv]);
  return {
    lines: (m.data ?? []).map((l) => ({ ...l, amount_usd: Number(l.amount_usd) })) as MoneyLine[],
    hours: (h.data ?? []).map((l) => ({ ...l, hours: Number(l.hours) })) as HoursLine[],
    private: (p.data ?? []) as ProjectPrivate[],
  };
}

/** Totals for one project, or for any set of lines. */
export function totals(lines: MoneyLine[], hours: HoursLine[]) {
  const sum = (k: MoneyLine["kind"]) => lines.filter((l) => l.kind === k).reduce((s, l) => s + l.amount_usd, 0);
  const invoiced = sum("invoiced");
  const paid = sum("paid");
  const costs = sum("cost");
  const hoursTotal = hours.reduce((s, h) => s + h.hours, 0);
  const left = paid - costs;
  return {
    invoiced,
    paid,
    costs,
    owed: Math.max(0, invoiced - paid),
    left,
    hours: hoursTotal,
    perHour: hoursTotal > 0 ? left / hoursTotal : null,
  };
}

export function usd(n: number | null | undefined, { cents = false } = {}) {
  if (n === null || n === undefined) return "";
  return (
    "USD " +
    n.toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })
  );
}
