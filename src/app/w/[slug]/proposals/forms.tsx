"use client";

import { useActionState, useState } from "react";
import {
  addLine,
  addPriceItem,
  closeProposal,
  saveEnquiry,
  saveLine,
  savePriceItem,
  saveProposal,
  setProposalStatus,
  startProposal,
  type FormState,
} from "./mutations";

type Option = readonly [string, string];

function Status({ state }: { state: FormState }) {
  if (!state.error && !state.ok) return null;
  return (
    <p role="status" className={`text-sm ${state.error ? "text-danger" : "text-ink"}`}>
      {state.error ?? state.ok}
    </p>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label} {hint && <span className="font-normal text-muted">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

const area = "field h-auto py-2 leading-relaxed";

// Enquiries --------------------------------------------------------------------------------

export type EnquiryValues = {
  client?: string;
  contact?: string | null;
  sector?: string | null;
  source?: string | null;
  market?: string;
  received_on?: string;
  notes?: string | null;
};

export function EnquiryForm({
  slug,
  enquiryId,
  values,
  sources,
  submitLabel,
  primary = true,
}: {
  slug: string;
  enquiryId: string | null;
  values: EnquiryValues;
  sources: Option[];
  submitLabel: string;
  primary?: boolean;
}) {
  const [state, action, pending] = useActionState(saveEnquiry.bind(null, slug, enquiryId), {} as FormState);
  const v = values;
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="e-client" label="Who it's from" hint="the business">
          <input id="e-client" name="client" required minLength={2} maxLength={120} defaultValue={v.client} className="field" />
        </Field>
        <Field id="e-contact" label="Who we spoke to" hint="optional">
          <input id="e-contact" name="contact" maxLength={120} defaultValue={v.contact ?? ""} className="field" placeholder="The owner" />
        </Field>
        <Field id="e-sector" label="Sector" hint="optional">
          <input id="e-sector" name="sector" maxLength={120} defaultValue={v.sector ?? ""} className="field" />
        </Field>
        <Field id="e-source" label="How they found us">
          <select id="e-source" name="source" defaultValue={v.source ?? ""} className="field">
            <option value="">Not sure</option>
            {sources.map(([val, l]) => (
              <option key={val} value={val}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field id="e-market" label="Where they are">
          <select id="e-market" name="market" defaultValue={v.market ?? "lebanon"} className="field">
            <option value="lebanon">Lebanon</option>
            <option value="abroad">Outside Lebanon</option>
          </select>
        </Field>
        <Field id="e-received" label="Received">
          <input id="e-received" name="received_on" type="date" required defaultValue={v.received_on} className="field" />
        </Field>
      </div>
      <Field id="e-notes" label="What they told us" hint="Claude drafts our thinking from these notes">
        <textarea id="e-notes" name="notes" rows={5} maxLength={6000} defaultValue={v.notes ?? ""} className={area} />
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={`btn ${primary ? "btn-primary" : "btn-secondary"}`}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function StartProposalForm({ slug, enquiryId, offers }: { slug: string; enquiryId: string; offers: Option[] }) {
  const [state, action, pending] = useActionState(startProposal.bind(null, slug, enquiryId), {} as FormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="sp-offer" className="label">
          What we&apos;re proposing
        </label>
        <select id="sp-offer" name="offer" defaultValue="diagnostic" className="field w-auto pr-8">
          {offers.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Starting…" : "Start a proposal"}
      </button>
      <div className="w-full">
        <Status state={state} />
      </div>
    </form>
  );
}

// Proposals --------------------------------------------------------------------------------

export type ProposalValues = {
  title: string;
  client: string;
  market: string;
  issued_on: string;
  valid_until: string | null;
  intro: string | null;
  our_thinking: string | null;
  scope: string | null;
  not_included: string | null;
  timeline: string | null;
  payment_terms: string | null;
};

export function ProposalForm({
  slug,
  proposalId,
  values: v,
  claudeDraft,
}: {
  slug: string;
  proposalId: string;
  values: ProposalValues;
  claudeDraft: boolean;
}) {
  const [state, action, pending] = useActionState(saveProposal.bind(null, slug, proposalId), {} as FormState);
  return (
    <form action={action} className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field id="p-title" label="Title">
            <input id="p-title" name="title" required minLength={3} maxLength={160} defaultValue={v.title} className="field" />
          </Field>
        </div>
        <Field id="p-client" label="Prepared for">
          <input id="p-client" name="client" required minLength={2} maxLength={120} defaultValue={v.client} className="field" />
        </Field>
        <Field id="p-market" label="Prices for">
          <select id="p-market" name="market" defaultValue={v.market} className="field">
            <option value="lebanon">Lebanon</option>
            <option value="abroad">Outside Lebanon</option>
          </select>
        </Field>
        <Field id="p-issued" label="Date">
          <input id="p-issued" name="issued_on" type="date" required defaultValue={v.issued_on} className="field" />
        </Field>
        <Field id="p-valid" label="Valid until">
          <input id="p-valid" name="valid_until" type="date" defaultValue={v.valid_until ?? ""} className="field" />
        </Field>
      </div>

      <Field id="p-intro" label="Intro" hint="a short opening, in our voice">
        <textarea id="p-intro" name="intro" rows={3} maxLength={2000} defaultValue={v.intro ?? ""} className={area} />
      </Field>

      <div>
        <Field id="p-thinking" label="Our thinking" hint="written for this client">
          <textarea id="p-thinking" name="our_thinking" rows={8} maxLength={6000} defaultValue={v.our_thinking ?? ""} className={area} />
        </Field>
        <p className="mt-1.5 text-[13px] text-muted">
          {claudeDraft
            ? "Drafted by Claude from the enquiry notes. Read it closely and make it ours before approving."
            : "Ask Claude in chat to draft this from the enquiry notes. It lands here for a person to edit and approve."}
        </p>
      </div>

      <Field id="p-scope" label="Scope" hint="start lines with a dash for a list">
        <textarea id="p-scope" name="scope" rows={7} maxLength={6000} defaultValue={v.scope ?? ""} className={area} />
      </Field>
      <Field id="p-not" label="Not included">
        <textarea id="p-not" name="not_included" rows={3} maxLength={3000} defaultValue={v.not_included ?? ""} className={area} />
      </Field>
      <Field id="p-timeline" label="Timeline">
        <textarea id="p-timeline" name="timeline" rows={3} maxLength={2000} defaultValue={v.timeline ?? ""} className={area} />
      </Field>
      <Field id="p-terms" label="Payment terms">
        <textarea id="p-terms" name="payment_terms" rows={3} maxLength={2000} defaultValue={v.payment_terms ?? ""} className={area} />
      </Field>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Saving…" : "Save the proposal"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function AddLineForm({ slug, proposalId, items }: { slug: string; proposalId: string; items: Option[] }) {
  const [state, action, pending] = useActionState(addLine.bind(null, slug, proposalId), {} as FormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1 basis-[280px]">
        <label htmlFor="al-item" className="label">
          Add from the price list
        </label>
        <select id="al-item" name="price_item_id" required defaultValue="" className="field">
          <option value="" disabled>
            Choose a line
          </option>
          {items.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className="btn btn-secondary">
        {pending ? "Adding…" : "Add the line"}
      </button>
      <div className="w-full">
        <Status state={state} />
      </div>
    </form>
  );
}

/** Wording for everyone; the price field only for the Owner. */
export function LineForm({
  slug,
  lineId,
  label,
  detail,
  price,
  canPrice,
}: {
  slug: string;
  lineId: string;
  label: string;
  detail: string | null;
  price: number | null;
  canPrice: boolean;
}) {
  const [state, action, pending] = useActionState(saveLine.bind(null, slug, lineId), {} as FormState);
  return (
    <form action={action} className="grid gap-3 pt-2">
      <div className={`grid gap-3 ${canPrice ? "sm:grid-cols-[1fr_160px]" : ""}`}>
        <div>
          <label htmlFor={`ln-${lineId}`} className="label text-[13px]">
            Line
          </label>
          <input id={`ln-${lineId}`} name="label" required minLength={2} maxLength={160} defaultValue={label} className="field h-9" />
        </div>
        {canPrice && (
          <div>
            <label htmlFor={`lp-${lineId}`} className="label text-[13px]">
              Price <span className="font-normal text-muted">(USD)</span>
            </label>
            <input id={`lp-${lineId}`} name="price_usd" inputMode="decimal" defaultValue={price ?? ""} className="field h-9" />
          </div>
        )}
      </div>
      <div>
        <label htmlFor={`ld-${lineId}`} className="label text-[13px]">
          What&apos;s included
        </label>
        <textarea id={`ld-${lineId}`} name="detail" rows={2} maxLength={600} defaultValue={detail ?? ""} className={area} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-secondary h-9">
          {pending ? "Saving…" : "Save the line"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

/** Approve, mark as sent, or back to draft. Approving is always a person's click. */
export function StatusButton({
  slug,
  proposalId,
  status,
  label,
  pendingLabel,
  tone,
}: {
  slug: string;
  proposalId: string;
  status: "draft" | "approved" | "sent";
  label: string;
  pendingLabel: string;
  tone: "ink" | "secondary" | "quiet";
}) {
  const [state, action, pending] = useActionState(setProposalStatus.bind(null, slug, proposalId), {} as FormState);
  const cls =
    tone === "ink" ? "btn h-10 bg-ink text-paper hover:bg-ink/85" : tone === "secondary" ? "btn btn-secondary" : "btn-quiet";
  return (
    <form action={action} className="contents">
      <input type="hidden" name="status" value={status} />
      <button type="submit" disabled={pending} className={cls}>
        {pending ? pendingLabel : label}
      </button>
      {(state.error || state.ok) && (
        <span className="w-full">
          <Status state={state} />
        </span>
      )}
    </form>
  );
}

export function CloseProposalForm({ slug, proposalId }: { slug: string; proposalId: string }) {
  const [state, action, pending] = useActionState(closeProposal.bind(null, slug, proposalId), {} as FormState);
  const [outcome, setOutcome] = useState<"won" | "lost">("won");
  return (
    <form action={action} className="grid gap-4">
      <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
        <legend className="label">How did it end?</legend>
        {(["won", "lost"] as const).map((o) => (
          <label key={o} className="flex items-center gap-2 text-[15px]">
            <input
              type="radio"
              name="outcome"
              value={o}
              checked={outcome === o}
              onChange={() => setOutcome(o)}
              className="size-4 accent-[#111111]"
            />
            {o === "won" ? "We won it" : "We lost it"}
          </label>
        ))}
      </fieldset>
      {outcome === "won" ? (
        <p className="text-sm text-muted">
          It becomes a signed project in Projects, with this proposal&apos;s price. A Keep plan line becomes its own project.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cl-said" label="What they said">
            <textarea id="cl-said" name="lost_said" rows={3} maxLength={1000} className={area} />
          </Field>
          <Field id="cl-think" label="Why we think we lost">
            <textarea id="cl-think" name="lost_think" rows={3} maxLength={1000} className={area} />
          </Field>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-secondary">
          {pending ? "Saving…" : outcome === "won" ? "Mark as won" : "Mark as lost"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

// Price list -------------------------------------------------------------------------------

export function PriceItemForm({
  slug,
  item,
}: {
  slug: string;
  item: { id: string; label: string; detail: string | null; price_usd: number | null; per: string; active: boolean };
}) {
  const [state, action, pending] = useActionState(savePriceItem.bind(null, slug, item.id), {} as FormState);
  return (
    <form action={action} className="grid gap-3 pt-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <div>
          <label htmlFor={`pl-${item.id}`} className="label text-[13px]">
            Name
          </label>
          <input id={`pl-${item.id}`} name="label" required minLength={2} maxLength={120} defaultValue={item.label} className="field h-9" />
        </div>
        <div>
          <label htmlFor={`pp-${item.id}`} className="label text-[13px]">
            Price <span className="font-normal text-muted">(USD{item.per === "month" ? " a month" : ""})</span>
          </label>
          <input
            id={`pp-${item.id}`}
            name="price_usd"
            inputMode="decimal"
            defaultValue={item.price_usd ?? ""}
            placeholder="Set in each proposal"
            className="field h-9"
          />
        </div>
      </div>
      <div>
        <label htmlFor={`pd-${item.id}`} className="label text-[13px]">
          What&apos;s included
        </label>
        <textarea id={`pd-${item.id}`} name="detail" rows={2} maxLength={600} defaultValue={item.detail ?? ""} className={area} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={item.active} className="size-4 accent-[#111111]" />
        Offered in new proposals
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-secondary h-9">
          {pending ? "Saving…" : "Save"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function AddPriceItemForm({ slug, offers }: { slug: string; offers: Option[] }) {
  const [state, action, pending] = useActionState(addPriceItem.bind(null, slug), {} as FormState);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="ap-offer" label="Option of">
          <select id="ap-offer" name="offer" defaultValue="build" className="field">
            {offers.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field id="ap-market" label="For">
          <select id="ap-market" name="market" defaultValue="lebanon" className="field">
            <option value="lebanon">Lebanon</option>
            <option value="abroad">Outside Lebanon</option>
            <option value="any">Anywhere</option>
          </select>
        </Field>
        <Field id="ap-per" label="Charged">
          <select id="ap-per" name="per" defaultValue="once" className="field">
            <option value="once">Once</option>
            <option value="month">Every month</option>
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <Field id="ap-label" label="Name">
          <input id="ap-label" name="label" required minLength={2} maxLength={120} className="field" />
        </Field>
        <Field id="ap-price" label="Price" hint="USD">
          <input id="ap-price" name="price_usd" inputMode="decimal" className="field" placeholder="Leave empty to price each time" />
        </Field>
      </div>
      <Field id="ap-detail" label="What's included" hint="optional">
        <textarea id="ap-detail" name="detail" rows={2} maxLength={600} className={area} />
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-secondary">
          {pending ? "Adding…" : "Add to the price list"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}
