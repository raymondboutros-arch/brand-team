import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Proposals: the price list, enquiries, and proposals built from the price list. Studio only. */

export type Offer = "diagnostic" | "build" | "keep" | "custom";
export type Market = "lebanon" | "abroad";
export type ProposalStatus = "draft" | "approved" | "sent" | "won" | "lost";
export type EnquiryStatus = "open" | "won" | "lost" | "declined";

export type PriceItem = {
  id: string;
  offer: Offer;
  label: string;
  detail: string | null;
  market: Market | "any";
  price_usd: number | null;
  per: "once" | "month";
  position: number;
  active: boolean;
};

export type Enquiry = {
  id: string;
  number: number;
  received_on: string;
  client: string;
  contact: string | null;
  sector: string | null;
  source: string | null;
  market: Market;
  notes: string | null;
  status: EnquiryStatus;
  closed_note: string | null;
  updated_at: string;
};

export type Proposal = {
  id: string;
  number: number;
  enquiry_id: string;
  title: string;
  client: string;
  market: Market;
  issued_on: string;
  valid_until: string | null;
  intro: string | null;
  our_thinking: string | null;
  thinking_by: "claude" | "person" | null;
  scope: string | null;
  not_included: string | null;
  timeline: string | null;
  payment_terms: string | null;
  status: ProposalStatus;
  approved_at: string | null;
  approved_by: string | null;
  sent_on: string | null;
  closed_on: string | null;
  project_id: string | null;
  updated_at: string;
};

export type ProposalLine = {
  id: string;
  proposal_id: string;
  price_item_id: string | null;
  offer: Offer;
  label: string;
  detail: string | null;
  price_usd: number | null;
  per: "once" | "month";
  position: number;
};

export const OFFER_LABEL: Record<Offer, string> = {
  diagnostic: "Clarity Diagnostic",
  build: "Build",
  keep: "Keep plan",
  custom: "Custom work",
};
export const OFFERS = Object.keys(OFFER_LABEL) as Offer[];

export const MARKET_LABEL: Record<Market | "any", string> = {
  lebanon: "Lebanon",
  abroad: "Outside Lebanon",
  any: "Anywhere",
};

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  sent: "Sent",
  won: "Won",
  lost: "Lost",
};

export const ENQUIRY_STATUS_LABEL: Record<EnquiryStatus, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
  declined: "Not for us",
};

const num = <T extends { price_usd: unknown }>(r: T) => ({
  ...r,
  price_usd: r.price_usd === null || r.price_usd === undefined ? null : Number(r.price_usd),
});

const PROPOSAL_COLUMNS =
  "id, number, enquiry_id, title, client, market, issued_on, valid_until, intro, our_thinking, thinking_by, scope, not_included, timeline, payment_terms, status, approved_at, approved_by, sent_on, closed_on, project_id, updated_at";
const ENQUIRY_COLUMNS =
  "id, number, received_on, client, contact, sector, source, market, notes, status, closed_note, updated_at";

export async function getPriceList(workspaceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("price_list")
    .select("id, offer, label, detail, market, price_usd, per, position, active")
    .eq("workspace_id", workspaceId)
    .order("position");
  if (error) throw error;
  return (data ?? []).map(num) as PriceItem[];
}

/** Every enquiry with its proposals and their totals, newest first. */
export async function getPipeline(workspaceId: string) {
  const supabase = await createClient();
  const [enq, props, lines, projects] = await Promise.all([
    supabase.from("enquiries").select(ENQUIRY_COLUMNS).eq("workspace_id", workspaceId).order("number", { ascending: false }),
    supabase.from("proposals").select(PROPOSAL_COLUMNS).eq("workspace_id", workspaceId).order("number", { ascending: false }),
    supabase.from("proposal_lines").select("proposal_id, price_usd, per").eq("workspace_id", workspaceId),
    supabase.from("projects").select("id, number").eq("workspace_id", workspaceId),
  ]);
  for (const r of [enq, props, lines, projects]) if (r.error) throw r.error;
  const allLines = (lines.data ?? []).map(num) as Pick<ProposalLine, "proposal_id" | "price_usd" | "per">[];
  const projectNumber = new Map((projects.data ?? []).map((p) => [p.id as string, p.number as number]));
  return {
    enquiries: (enq.data ?? []) as Enquiry[],
    proposals: (props.data ?? []) as Proposal[],
    totalsFor: (proposalId: string) => sums(allLines.filter((l) => l.proposal_id === proposalId)),
    projectNumber,
  };
}

export async function getEnquiry(workspaceId: string, number: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enquiries")
    .select(ENQUIRY_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("number", number)
    .maybeSingle();
  if (error) throw error;
  return data as Enquiry | null;
}

export async function getEnquiryById(workspaceId: string, id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enquiries")
    .select(ENQUIRY_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Enquiry | null;
}

export async function getProposal(workspaceId: string, number: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proposals")
    .select(PROPOSAL_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("number", number)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const proposal = data as Proposal;
  const { data: lines, error: e2 } = await supabase
    .from("proposal_lines")
    .select("id, proposal_id, price_item_id, offer, label, detail, price_usd, per, position")
    .eq("proposal_id", proposal.id)
    .order("position")
    .order("created_at");
  if (e2) throw e2;
  return { proposal, lines: (lines ?? []).map(num) as ProposalLine[] };
}

/** One-off total, monthly total, and whether any line still has no price. */
export function sums(lines: Pick<ProposalLine, "price_usd" | "per">[]) {
  const once = lines.filter((l) => l.per === "once").reduce((s, l) => s + (l.price_usd ?? 0), 0);
  const month = lines.filter((l) => l.per === "month").reduce((s, l) => s + (l.price_usd ?? 0), 0);
  return { once, month, unpriced: lines.some((l) => l.price_usd === null), count: lines.length };
}

/** "USD 6,000", "USD 350 a month". */
export function price(n: number | null, per: "once" | "month" = "once") {
  if (n === null) return "Price to be set";
  return `USD ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}${per === "month" ? " a month" : ""}`;
}

/** The starting text for a new proposal, from the decided offers (D3, D11, D12 and step 3 of the strategy). */
export function startingText(offer: Offer, client: string) {
  const owns = "Once the project is paid, the files, the website and every account are yours.";
  switch (offer) {
    case "diagnostic":
      return {
        title: `Clarity Diagnostic for ${client}`,
        timeline:
          "Five working days, starting the day we have your answers to a short intake form and access to your website and Google profile. It ends with a 60-minute walkthrough and a fixed quote for the work.",
        not_included: "The work the Diagnostic recommends. That comes as a fixed quote at the end, so you know the full price before you commit.",
        payment_terms: "The Diagnostic fee is credited in full if you continue with us within 60 days.",
      };
    case "build":
      return {
        title: `A new brand and website for ${client}`,
        timeline: "5 to 6 weeks from the day we start, with your review days written in.",
        not_included: "",
        payment_terms: `Half to start, half before launch. The amount is fixed in this proposal. ${owns}`,
      };
    case "keep":
      return {
        title: `Keep plan for ${client}`,
        timeline: "",
        not_included: "",
        payment_terms: "",
      };
    default:
      return { title: `Proposal for ${client}`, timeline: "", not_included: "", payment_terms: "" };
  }
}

/** Line breaks typed in a box stay line breaks when shown as Markdown (lists and paragraphs untouched). */
export function keepBreaks(text: string | null) {
  if (!text) return text;
  return text.replace(/([^\n])\n(?!\n|\s*([-*+]|\d+\.)\s)/g, "$1  \n");
}
