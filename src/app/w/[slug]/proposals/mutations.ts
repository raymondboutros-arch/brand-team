"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/hq";
import { OFFERS, getEnquiryById, startingText, type Offer } from "@/lib/proposals";
import { SOURCE } from "@/lib/projects";
import { todayInBeirut } from "@/lib/dates";

export type FormState = { error?: string; ok?: string };

const text = (f: FormData, k: string, max = 2000) => {
  const v = String(f.get(k) ?? "").trim();
  return v ? v.slice(0, max) : null;
};
const oneOf = <T extends string>(f: FormData, k: string, allowed: readonly T[]) => {
  const v = String(f.get(k) ?? "").trim() as T;
  return allowed.includes(v) ? v : null;
};
const isDate = (v: string | null) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v);
const money = (f: FormData, k: string) => {
  const raw = String(f.get(k) ?? "").replace(/[^\d.]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};
const MARKETS = ["lebanon", "abroad"] as const;

/** The database's own words are written for people; anything else gets a plain message. */
function dbMessage(error: { message?: string } | null, fallback: string) {
  const m = error?.message ?? "";
  if (/^(Only|This proposal|Approve|Write|Add at least|Every line|That price)/.test(m)) return m;
  return fallback;
}

async function studioEditor(slug: string) {
  const workspace = await getWorkspace(slug);
  if (!workspace.isStudio || (workspace.role !== "owner" && workspace.role !== "team")) return null;
  return workspace;
}

async function studioOwner(slug: string) {
  const workspace = await getWorkspace(slug);
  if (!workspace.isStudio || workspace.role !== "owner") return null;
  return workspace;
}

const refresh = (slug: string) => revalidatePath(`/w/${slug}`, "layout");

// Enquiries ------------------------------------------------------------------------------

function enquiryRow(f: FormData) {
  const client = text(f, "client", 120);
  const received_on = text(f, "received_on", 10) ?? todayInBeirut();
  return {
    client,
    received_on,
    contact: text(f, "contact", 120),
    sector: text(f, "sector", 120),
    source: oneOf(f, "source", Object.keys(SOURCE)),
    market: oneOf(f, "market", MARKETS) ?? "lebanon",
    notes: text(f, "notes", 6000),
  };
}

export async function saveEnquiry(slug: string, enquiryId: string | null, _prev: FormState, f: FormData): Promise<FormState> {
  const workspace = await studioEditor(slug);
  if (!workspace) return { error: "Only the Owner and the Team can change enquiries." };
  const row = enquiryRow(f);
  if (!row.client || row.client.length < 2) return { error: "Who is the enquiry from?" };
  if (!isDate(row.received_on)) return { error: "Pick the date from the calendar." };

  const supabase = await createClient();
  if (enquiryId) {
    const { error } = await supabase.from("enquiries").update(row).eq("id", enquiryId).eq("workspace_id", workspace.id);
    if (error) return { error: "The changes didn't save. Try again." };
    refresh(slug);
    return { ok: "Saved." };
  }
  const { data, error } = await supabase
    .from("enquiries")
    .insert({ ...row, workspace_id: workspace.id })
    .select("number")
    .single();
  if (error || !data) return { error: "The enquiry didn't save. Try again." };
  refresh(slug);
  redirect(`/w/${slug}/proposals/enquiries/${data.number}`);
}

/** Close an enquiry that never got to a proposal, or open it again. */
export async function setEnquiryStatus(slug: string, enquiryId: string, f: FormData) {
  const workspace = await studioEditor(slug);
  const status = oneOf(f, "status", ["open", "lost", "declined"] as const);
  if (!workspace || !status) return;
  const supabase = await createClient();
  await supabase
    .from("enquiries")
    .update({ status, closed_note: status === "open" ? null : text(f, "closed_note", 1000) })
    .eq("id", enquiryId)
    .eq("workspace_id", workspace.id);
  refresh(slug);
}

// Proposals ------------------------------------------------------------------------------

/** Start a proposal from an enquiry, with the decided starting text and the offer's first line. */
export async function startProposal(slug: string, enquiryId: string, _prev: FormState, f: FormData): Promise<FormState> {
  const workspace = await studioEditor(slug);
  if (!workspace) return { error: "Only the Owner and the Team can start proposals." };
  const offer = oneOf(f, "offer", OFFERS) as Offer | null;
  if (!offer) return { error: "Choose what we are proposing." };
  const enquiry = await getEnquiryById(workspace.id, enquiryId);
  if (!enquiry) return { error: "That enquiry isn't here any more." };

  const start = startingText(offer, enquiry.client);
  const issued = todayInBeirut();
  const valid = new Date(issued + "T00:00:00Z");
  valid.setUTCDate(valid.getUTCDate() + 30);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proposals")
    .insert({
      workspace_id: workspace.id,
      enquiry_id: enquiry.id,
      client: enquiry.client,
      market: enquiry.market,
      title: start.title.slice(0, 160),
      issued_on: issued,
      valid_until: valid.toISOString().slice(0, 10),
      timeline: start.timeline || null,
      not_included: start.not_included || null,
      payment_terms: start.payment_terms || null,
    })
    .select("id, number")
    .single();
  if (error || !data) return { error: "The proposal didn't start. Try again." };

  // The offer's first line for this market, when there is one.
  const { data: item } = await supabase
    .from("price_list")
    .select("id, market")
    .eq("workspace_id", workspace.id)
    .eq("offer", offer)
    .eq("active", true)
    .in("market", [enquiry.market, "any"])
    .order("position")
    .limit(1)
    .maybeSingle();
  if (item) {
    await supabase
      .from("proposal_lines")
      .insert({ workspace_id: workspace.id, proposal_id: data.id, price_item_id: item.id, label: "", position: 10 });
  }

  refresh(slug);
  redirect(`/w/${slug}/proposals/${data.number}`);
}

export async function saveProposal(slug: string, proposalId: string, _prev: FormState, f: FormData): Promise<FormState> {
  const workspace = await studioEditor(slug);
  if (!workspace) return { error: "Only the Owner and the Team can change proposals." };
  const title = text(f, "title", 160);
  const client = text(f, "client", 120);
  if (!title || title.length < 3) return { error: "Give the proposal a title." };
  if (!client || client.length < 2) return { error: "Who is it for?" };
  const issued_on = text(f, "issued_on", 10) ?? todayInBeirut();
  const valid_until = text(f, "valid_until", 10);
  if (!isDate(issued_on) || !isDate(valid_until)) return { error: "Pick the dates from the calendar." };
  if (valid_until && valid_until < issued_on) return { error: "It can't expire before the date it's issued." };

  const supabase = await createClient();
  const { data: before } = await supabase.from("proposals").select("status").eq("id", proposalId).maybeSingle();
  const { error } = await supabase
    .from("proposals")
    .update({
      title,
      client,
      market: oneOf(f, "market", MARKETS) ?? "lebanon",
      issued_on,
      valid_until,
      intro: text(f, "intro"),
      our_thinking: text(f, "our_thinking", 6000),
      scope: text(f, "scope", 6000),
      not_included: text(f, "not_included", 3000),
      timeline: text(f, "timeline"),
      payment_terms: text(f, "payment_terms"),
    })
    .eq("id", proposalId)
    .eq("workspace_id", workspace.id);
  if (error) return { error: dbMessage(error, "The changes didn't save. Try again.") };
  const { data: after } = await supabase.from("proposals").select("status").eq("id", proposalId).maybeSingle();
  refresh(slug);
  if (before?.status === "approved" && after?.status === "draft") {
    return { ok: "Saved. It changed after approval, so it's back in draft and needs approving again." };
  }
  return { ok: "Saved." };
}

export async function addLine(slug: string, proposalId: string, _prev: FormState, f: FormData): Promise<FormState> {
  const workspace = await studioEditor(slug);
  if (!workspace) return { error: "Only the Owner and the Team can change proposals." };
  const itemId = text(f, "price_item_id", 64);
  if (!itemId) return { error: "Choose a line from the price list." };
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("proposal_lines")
    .select("position")
    .eq("proposal_id", proposalId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("proposal_lines").insert({
    workspace_id: workspace.id,
    proposal_id: proposalId,
    price_item_id: itemId,
    label: text(f, "label", 160) ?? "",
    position: (last?.position ?? 0) + 10,
  });
  if (error) return { error: dbMessage(error, "That line didn't save. Try again.") };
  refresh(slug);
  return { ok: "Added." };
}

/** Owner only: the price of one line, and its wording. */
export async function saveLine(slug: string, lineId: string, _prev: FormState, f: FormData): Promise<FormState> {
  const workspace = await studioEditor(slug);
  if (!workspace) return { error: "Only the Owner and the Team can change proposals." };
  const label = text(f, "label", 160);
  if (!label || label.length < 2) return { error: "The line needs a name." };
  const update: Record<string, unknown> = { label, detail: text(f, "detail", 600) };
  if (workspace.role === "owner") {
    const p = money(f, "price_usd");
    if (Number.isNaN(p)) return { error: "The price should be a number in US dollars." };
    update.price_usd = p;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("proposal_lines").update(update).eq("id", lineId).eq("workspace_id", workspace.id);
  if (error) return { error: dbMessage(error, "That line didn't save. Try again.") };
  refresh(slug);
  return { ok: "Saved." };
}

export async function removeLine(slug: string, lineId: string) {
  const workspace = await studioEditor(slug);
  if (!workspace) return;
  const supabase = await createClient();
  await supabase.from("proposal_lines").delete().eq("id", lineId).eq("workspace_id", workspace.id);
  refresh(slug);
}

/** Approve (a person, never through Claude), mark as sent, or move back to draft. */
export async function setProposalStatus(slug: string, proposalId: string, _prev: FormState, f: FormData): Promise<FormState> {
  const workspace = await studioEditor(slug);
  if (!workspace) return { error: "Only the Owner and the Team can do this." };
  const status = oneOf(f, "status", ["draft", "approved", "sent"] as const);
  if (!status) return { error: "Something went wrong. Reload the page." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("proposals")
    .update({ status, ...(status === "sent" ? { sent_on: todayInBeirut() } : {}) })
    .eq("id", proposalId)
    .eq("workspace_id", workspace.id);
  if (error) return { error: dbMessage(error, "That didn't save. Try again.") };
  refresh(slug);
  return {
    ok: status === "approved" ? "Approved. Save the PDF and send it." : status === "sent" ? "Marked as sent." : "Back in draft.",
  };
}

/** Won becomes a signed project; lost becomes a lost pitch in Projects, with the reasons. */
export async function closeProposal(slug: string, proposalId: string, _prev: FormState, f: FormData): Promise<FormState> {
  const workspace = await studioEditor(slug);
  if (!workspace) return { error: "Only the Owner and the Team can do this." };
  const outcome = oneOf(f, "outcome", ["won", "lost"] as const);
  if (!outcome) return { error: "Won or lost?" };
  const said = text(f, "lost_said", 1000);
  const think = text(f, "lost_think", 1000);
  if (outcome === "lost" && !said && !think) return { error: "Write what they said, or why we think we lost." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("close_proposal", {
    p_proposal: proposalId,
    p_outcome: outcome,
    p_said: said,
    p_think: think,
  });
  if (error || typeof data !== "number") return { error: dbMessage(error, "That didn't save. Try again.") };
  refresh(slug);
  redirect(`/w/${slug}/projects/${data}`);
}

// Price list (Owner only) -------------------------------------------------------------------

export async function savePriceItem(slug: string, itemId: string, _prev: FormState, f: FormData): Promise<FormState> {
  const workspace = await studioOwner(slug);
  if (!workspace) return { error: "Only the Owner changes prices." };
  const label = text(f, "label", 120);
  if (!label || label.length < 2) return { error: "The line needs a name." };
  const p = money(f, "price_usd");
  if (Number.isNaN(p)) return { error: "The price should be a number in US dollars." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("price_list")
    .update({ label, detail: text(f, "detail", 600), price_usd: p, active: f.get("active") === "on" })
    .eq("id", itemId)
    .eq("workspace_id", workspace.id);
  if (error) return { error: "That didn't save. Try again." };
  refresh(slug);
  return { ok: "Saved. Proposals already started keep their prices." };
}

export async function addPriceItem(slug: string, _prev: FormState, f: FormData): Promise<FormState> {
  const workspace = await studioOwner(slug);
  if (!workspace) return { error: "Only the Owner changes prices." };
  const offer = oneOf(f, "offer", OFFERS);
  const label = text(f, "label", 120);
  if (!offer) return { error: "Which offer is it an option of?" };
  if (!label || label.length < 2) return { error: "Give the option a name." };
  const p = money(f, "price_usd");
  if (Number.isNaN(p)) return { error: "The price should be a number in US dollars." };
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("price_list")
    .select("position")
    .eq("workspace_id", workspace.id)
    .eq("offer", offer)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const base = { diagnostic: 10, build: 20, keep: 30, custom: 40 }[offer];
  const { error } = await supabase.from("price_list").insert({
    workspace_id: workspace.id,
    offer,
    label,
    detail: text(f, "detail", 600),
    market: oneOf(f, "market", ["lebanon", "abroad", "any"] as const) ?? "any",
    price_usd: p,
    per: oneOf(f, "per", ["once", "month"] as const) ?? "once",
    position: (last?.position ?? base) + 1,
  });
  if (error) return { error: "That didn't save. Try again." };
  refresh(slug);
  return { ok: "Added to the price list." };
}
