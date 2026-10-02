"use client";

import { useActionState } from "react";
import { saveProject, type FormState } from "./mutations";

type Option = readonly [string, string];

export type ProjectFormValues = {
  client?: string;
  sector?: string | null;
  client_type?: string | null;
  source?: string | null;
  buyer?: string | null;
  brief?: string | null;
  real_need?: string | null;
  deliverables?: string | null;
  lead_person?: string | null;
  status?: string;
  year?: number | null;
  starts_on?: string | null;
  ends_on?: string | null;
  duration?: string | null;
  price_usd?: number | null;
  price_per?: string;
  offer?: string | null;
  signed_on?: string | null;
  referred?: string | null;
  came_back?: string | null;
  five_more?: string | null;
  brand_to_website?: string | null;
  proof?: string | null;
  result?: string | null;
  testimonial?: string | null;
  may_name?: boolean;
  may_name_note?: string | null;
  lost_said?: string | null;
  lost_think?: string | null;
  notes?: string | null;
};

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

function Select({ id, value, options, blank = "Not set" }: { id: string; value?: string | null; options: Option[]; blank?: string }) {
  return (
    <select id={id} name={id} defaultValue={value ?? ""} className="field">
      <option value="">{blank}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

const YN: Option[] = [
  ["yes", "Yes"],
  ["no", "No"],
  ["maybe", "Maybe"],
];

/** Add a project, or edit one. The close-out part is facts, not scores. */
export function ProjectForm({
  slug,
  projectId,
  values = {},
  options,
  submitLabel,
}: {
  slug: string;
  projectId: string | null;
  values?: ProjectFormValues;
  options: { status: Option[]; clientType: Option[]; source: Option[]; proof: Option[]; offer: Option[] };
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState(saveProject.bind(null, slug, projectId), {} as FormState);
  const v = values;
  const area = "field h-auto py-2";

  return (
    <form action={action} className="grid gap-8">
      <fieldset className="grid gap-4">
        <legend className="mb-1 text-[17px] font-semibold">The client</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="client" label="Client">
            <input id="client" name="client" required minLength={2} maxLength={120} defaultValue={v.client} className="field" />
          </Field>
          <Field id="sector" label="Sector" hint="optional">
            <input id="sector" name="sector" maxLength={120} defaultValue={v.sector ?? ""} className="field" />
          </Field>
          <Field id="client_type" label="Type of client">
            <Select id="client_type" value={v.client_type} options={options.clientType} />
          </Field>
          <Field id="source" label="How they found us">
            <Select id="source" value={v.source} options={options.source} />
          </Field>
          <Field id="buyer" label="Who buys and decides" hint="optional">
            <input id="buyer" name="buyer" maxLength={120} defaultValue={v.buyer ?? ""} className="field" placeholder="The owner" />
          </Field>
          <Field id="lead_person" label="Who leads it for us" hint="optional">
            <input id="lead_person" name="lead_person" maxLength={80} defaultValue={v.lead_person ?? ""} className="field" placeholder="Ray" />
          </Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-[17px] font-semibold">The work</legend>
        <Field id="brief" label="What they asked for">
          <textarea id="brief" name="brief" rows={2} maxLength={2000} defaultValue={v.brief ?? ""} className={area} />
        </Field>
        <Field id="real_need" label="What they really needed">
          <textarea id="real_need" name="real_need" rows={2} maxLength={2000} defaultValue={v.real_need ?? ""} className={area} />
        </Field>
        <Field id="deliverables" label="What we deliver">
          <textarea id="deliverables" name="deliverables" rows={2} maxLength={2000} defaultValue={v.deliverables ?? ""} className={area} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="status" label="Status">
            <select id="status" name="status" defaultValue={v.status ?? "signed"} className="field">
              {options.status.map(([val, l]) => (
                <option key={val} value={val}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field id="offer" label="What we sold">
            <Select id="offer" value={v.offer} options={options.offer} blank="Before the three offers" />
          </Field>
          <Field id="price_usd" label="Price" hint="USD">
            <input id="price_usd" name="price_usd" inputMode="decimal" defaultValue={v.price_usd ?? ""} className="field" placeholder="8000" />
          </Field>
          <Field id="price_per" label="Charged">
            <select id="price_per" name="price_per" defaultValue={v.price_per ?? "once"} className="field">
              <option value="once">Once</option>
              <option value="month">Every month</option>
            </select>
          </Field>
          <Field id="signed_on" label="Signed on" hint="counts on the Scorecard">
            <input id="signed_on" name="signed_on" type="date" defaultValue={v.signed_on ?? ""} className="field" />
          </Field>
          <Field id="year" label="Year">
            <input id="year" name="year" inputMode="numeric" maxLength={4} defaultValue={v.year ?? ""} className="field" placeholder="2026" />
          </Field>
          <Field id="starts_on" label="Starts" hint="optional">
            <input id="starts_on" name="starts_on" type="date" defaultValue={v.starts_on ?? ""} className="field" />
          </Field>
          <Field id="ends_on" label="Ends" hint="optional">
            <input id="ends_on" name="ends_on" type="date" defaultValue={v.ends_on ?? ""} className="field" />
          </Field>
          <Field id="duration" label="How long" hint="optional">
            <input id="duration" name="duration" maxLength={40} defaultValue={v.duration ?? ""} className="field" placeholder="2 months" />
          </Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-[17px] font-semibold">Close-out</legend>
        <p className="-mt-2 text-sm text-muted">Facts, not scores. Fill these when the project closes.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="referred" label="Did they refer someone?">
            <Select id="referred" value={v.referred} options={YN} />
          </Field>
          <Field id="came_back" label="Did they come back?">
            <Select id="came_back" value={v.came_back} options={YN} />
          </Field>
          <Field id="five_more" label="Five more like them?">
            <Select id="five_more" value={v.five_more} options={YN} />
          </Field>
          <Field id="brand_to_website" label="Did the brand lead to a website?">
            <Select
              id="brand_to_website"
              value={v.brand_to_website}
              options={[
                ["yes", "Yes"],
                ["no", "No"],
                ["na", "Not applicable"],
              ]}
            />
          </Field>
        </div>
        <Field id="proof" label="What we can show">
          <Select id="proof" value={v.proof} options={options.proof} />
        </Field>
        <Field id="result" label="The measurable result" hint="optional">
          <textarea id="result" name="result" rows={2} maxLength={2000} defaultValue={v.result ?? ""} className={area} />
        </Field>
        <Field id="testimonial" label="The testimonial, word for word" hint="optional">
          <textarea id="testimonial" name="testimonial" rows={3} maxLength={2000} defaultValue={v.testimonial ?? ""} className={area} />
        </Field>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="may_name" defaultChecked={v.may_name} className="mt-1 size-4 accent-[#111111]" />
          <span>
            <span className="font-medium">We have written permission to name this client</span>
            <span className="block text-sm text-muted">Without it, the client&apos;s name stays off the site, proposals and posts.</span>
          </span>
        </label>
        <Field id="may_name_note" label="Where the permission is" hint="optional">
          <input id="may_name_note" name="may_name_note" maxLength={300} defaultValue={v.may_name_note ?? ""} className="field" placeholder="Email from the owner, 4 October" />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-[17px] font-semibold">If we lost it</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="lost_said" label="What they said">
            <textarea id="lost_said" name="lost_said" rows={2} maxLength={1000} defaultValue={v.lost_said ?? ""} className={area} />
          </Field>
          <Field id="lost_think" label="Why we think we lost">
            <textarea id="lost_think" name="lost_think" rows={2} maxLength={1000} defaultValue={v.lost_think ?? ""} className={area} />
          </Field>
        </div>
      </fieldset>

      <Field id="notes" label="Notes" hint="optional">
        <textarea id="notes" name="notes" rows={3} maxLength={4000} defaultValue={v.notes ?? ""} className={area} />
      </Field>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Saving…" : submitLabel}
        </button>
        {(state.error || state.ok) && (
          <p role="status" className={`text-sm ${state.error ? "text-danger" : "text-ink"}`}>
            {state.error ?? state.ok}
          </p>
        )}
      </div>
    </form>
  );
}
