"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/hq";
import { CLIENT_TYPE, COST_CATEGORY, PROFIT_RANGE, PROOF, SOURCE, STATUSES } from "@/lib/projects";

export type FormState = { error?: string; ok?: string };

const text = (f: FormData, k: string, max = 2000) => {
  const v = String(f.get(k) ?? "").trim();
  return v ? v.slice(0, max) : null;
};
const oneOf = (f: FormData, k: string, allowed: string[]) => {
  const v = String(f.get(k) ?? "").trim();
  return allowed.includes(v) ? v : null;
};
const isDate = (v: string | null) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v);

async function studioEditor(slug: string) {
  const workspace = await getWorkspace(slug);
  if (!workspace.isStudio) return null;
  if (workspace.role !== "owner" && workspace.role !== "team") return null;
  return workspace;
}

async function studioOwner(slug: string) {
  const workspace = await getWorkspace(slug);
  if (!workspace.isStudio || workspace.role !== "owner") return null;
  return workspace;
}

/** Add a project, or save changes to one. Owner and Team, studio workspace only. */
export async function saveProject(slug: string, projectId: string | null, _prev: FormState, f: FormData): Promise<FormState> {
  const workspace = await studioEditor(slug);
  if (!workspace) return { error: "Only the Owner and the Team can change projects." };

  const client = text(f, "client", 120);
  if (!client || client.length < 2) return { error: "Give the client's name." };

  const priceRaw = String(f.get("price_usd") ?? "").replace(/[^\d.]/g, "");
  const price = priceRaw ? Number(priceRaw) : null;
  if (price !== null && (!Number.isFinite(price) || price < 0)) return { error: "The price should be a number in US dollars." };

  const yearRaw = String(f.get("year") ?? "").trim();
  const year = yearRaw ? Number(yearRaw) : null;
  if (year !== null && (!Number.isInteger(year) || year < 2000 || year > 2100)) return { error: "The year should look like 2026." };

  const starts_on = text(f, "starts_on", 10);
  const ends_on = text(f, "ends_on", 10);
  if (!isDate(starts_on) || !isDate(ends_on)) return { error: "Pick the dates from the calendar." };
  if (starts_on && ends_on && ends_on < starts_on) return { error: "The end date is before the start date." };

  const row = {
    client,
    sector: text(f, "sector", 120),
    client_type: oneOf(f, "client_type", Object.keys(CLIENT_TYPE)),
    source: oneOf(f, "source", Object.keys(SOURCE)),
    buyer: text(f, "buyer", 120),
    brief: text(f, "brief"),
    real_need: text(f, "real_need"),
    deliverables: text(f, "deliverables"),
    lead_person: text(f, "lead_person", 80),
    status: (oneOf(f, "status", STATUSES) ?? "signed") as (typeof STATUSES)[number],
    year,
    starts_on,
    ends_on,
    duration: text(f, "duration", 40),
    price_usd: price,
    referred: oneOf(f, "referred", ["yes", "no", "maybe"]),
    came_back: oneOf(f, "came_back", ["yes", "no", "maybe"]),
    five_more: oneOf(f, "five_more", ["yes", "no", "maybe"]),
    brand_to_website: oneOf(f, "brand_to_website", ["yes", "no", "na"]),
    proof: oneOf(f, "proof", Object.keys(PROOF)),
    result: text(f, "result"),
    testimonial: text(f, "testimonial"),
    may_name: f.get("may_name") === "on",
    may_name_note: text(f, "may_name_note", 300),
    lost_said: text(f, "lost_said", 1000),
    lost_think: text(f, "lost_think", 1000),
    notes: text(f, "notes", 4000),
  };

  const supabase = await createClient();
  if (projectId) {
    const { error } = await supabase.from("projects").update(row).eq("id", projectId).eq("workspace_id", workspace.id);
    if (error) return { error: "The changes didn't save. Try again." };
    revalidatePath(`/w/${slug}`, "layout");
    return { ok: "Saved." };
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ ...row, workspace_id: workspace.id })
    .select("number")
    .single();
  if (error || !data) return { error: "The project didn't save. Try again." };
  revalidatePath(`/w/${slug}`, "layout");
  redirect(`/w/${slug}/projects/${data.number}`);
}

/** Move a project along: signed, in progress, delivered, closed, or lost. */
export async function setProjectStatus(slug: string, projectId: string, f: FormData) {
  const workspace = await studioEditor(slug);
  const status = oneOf(f, "status", STATUSES);
  if (!workspace || !status) return;
  const supabase = await createClient();
  await supabase
    .from("projects")
    .update({ status: status as (typeof STATUSES)[number] })
    .eq("id", projectId)
    .eq("workspace_id", workspace.id);
  revalidatePath(`/w/${slug}`, "layout");
}

/** Owner only: an invoice, a payment or an outside cost. */
export async function addMoney(slug: string, projectId: string, _prev: FormState, f: FormData): Promise<FormState> {
  const workspace = await studioOwner(slug);
  if (!workspace) return { error: "Only the Owner records money." };
  const kind = oneOf(f, "kind", ["invoiced", "paid", "cost"]) as "invoiced" | "paid" | "cost" | null;
  if (!kind) return { error: "Choose invoiced, paid or outside cost." };
  const amount = Number(String(f.get("amount_usd") ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter the amount in US dollars." };
  const on_date = text(f, "on_date", 10);
  if (!on_date || !isDate(on_date)) return { error: "Pick the date." };
  const category = kind === "cost" ? oneOf(f, "category", Object.keys(COST_CATEGORY)) ?? "other" : null;

  const supabase = await createClient();
  const { error } = await supabase.from("project_money").insert({
    workspace_id: workspace.id,
    project_id: projectId,
    kind,
    category,
    amount_usd: amount,
    on_date,
    note: text(f, "note", 300),
  });
  if (error) return { error: "That line didn't save. Try again." };
  revalidatePath(`/w/${slug}/projects`, "layout");
  return { ok: "Recorded." };
}

export async function removeMoney(slug: string, lineId: string) {
  const workspace = await studioOwner(slug);
  if (!workspace) return;
  const supabase = await createClient();
  await supabase.from("project_money").delete().eq("id", lineId).eq("workspace_id", workspace.id);
  revalidatePath(`/w/${slug}/projects`, "layout");
}

/** Owner only: hours one person spent on the project in one week. */
export async function addHours(slug: string, projectId: string, _prev: FormState, f: FormData): Promise<FormState> {
  const workspace = await studioOwner(slug);
  if (!workspace) return { error: "Only the Owner logs hours here." };
  const person = text(f, "person", 80);
  if (!person) return { error: "Who worked these hours?" };
  const hours = Number(String(f.get("hours") ?? "").replace(",", "."));
  if (!Number.isFinite(hours) || hours <= 0 || hours > 100) return { error: "Hours should be between 0 and 100." };
  const week_of = text(f, "week_of", 10);
  if (!week_of || !isDate(week_of)) return { error: "Pick the week." };

  const supabase = await createClient();
  const { error } = await supabase.from("project_hours").insert({
    workspace_id: workspace.id,
    project_id: projectId,
    person,
    hours,
    week_of,
    note: text(f, "note", 300),
  });
  if (error) return { error: "The hours didn't save. Try again." };
  revalidatePath(`/w/${slug}/projects`, "layout");
  return { ok: "Logged." };
}

export async function removeHours(slug: string, lineId: string) {
  const workspace = await studioOwner(slug);
  if (!workspace) return;
  const supabase = await createClient();
  await supabase.from("project_hours").delete().eq("id", lineId).eq("workspace_id", workspace.id);
  revalidatePath(`/w/${slug}/projects`, "layout");
}

/** Owner only: the profit range and a private note. */
export async function savePrivate(slug: string, projectId: string, _prev: FormState, f: FormData): Promise<FormState> {
  const workspace = await studioOwner(slug);
  if (!workspace) return { error: "Only the Owner sees this." };
  const supabase = await createClient();
  const { error } = await supabase.from("project_private").upsert(
    {
      project_id: projectId,
      workspace_id: workspace.id,
      profit_range: oneOf(f, "profit_range", Object.keys(PROFIT_RANGE)),
      note: text(f, "note", 2000),
    },
    { onConflict: "project_id" },
  );
  if (error) return { error: "That didn't save. Try again." };
  revalidatePath(`/w/${slug}/projects`, "layout");
  return { ok: "Saved." };
}
