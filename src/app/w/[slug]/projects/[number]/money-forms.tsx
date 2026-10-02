"use client";

import { useActionState, useState } from "react";
import { addHours, addMoney, savePrivate, type FormState } from "../mutations";

type Option = readonly [string, string];

function Status({ state }: { state: FormState }) {
  if (!state.error && !state.ok) return null;
  return (
    <p role="status" className={`text-sm ${state.error ? "text-danger" : "text-ink"}`}>
      {state.error ?? state.ok}
    </p>
  );
}

/** An invoice, a payment or an outside cost. */
export function MoneyForm({
  slug,
  projectId,
  today,
  categories,
}: {
  slug: string;
  projectId: string;
  today: string;
  categories: Option[];
}) {
  const [state, action, pending] = useActionState(addMoney.bind(null, slug, projectId), {} as FormState);
  const [kind, setKind] = useState("invoiced");

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label htmlFor="m-kind" className="label">
            What
          </label>
          <select id="m-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="field">
            <option value="invoiced">Invoiced</option>
            <option value="paid">Paid to us</option>
            <option value="cost">Outside cost</option>
          </select>
        </div>
        {kind === "cost" && (
          <div>
            <label htmlFor="m-category" className="label">
              Cost of
            </label>
            <select id="m-category" name="category" defaultValue="freelancer" className="field">
              {categories.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="m-amount" className="label">
            Amount <span className="font-normal text-muted">(USD)</span>
          </label>
          <input id="m-amount" name="amount_usd" required inputMode="decimal" className="field" placeholder="2500" />
        </div>
        <div>
          <label htmlFor="m-date" className="label">
            Date
          </label>
          <input id="m-date" name="on_date" type="date" required defaultValue={today} className="field" />
        </div>
      </div>
      <div>
        <label htmlFor="m-note" className="label">
          Note <span className="font-normal text-muted">(optional)</span>
        </label>
        <input id="m-note" name="note" maxLength={300} className="field" placeholder="Second of three payments" />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-secondary">
          {pending ? "Recording…" : "Record it"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

/** Hours one person spent on the project in one week. */
export function HoursForm({ slug, projectId, today }: { slug: string; projectId: string; today: string }) {
  const [state, action, pending] = useActionState(addHours.bind(null, slug, projectId), {} as FormState);

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="h-person" className="label">
            Who
          </label>
          <input id="h-person" name="person" required maxLength={80} className="field" placeholder="Tony" />
        </div>
        <div>
          <label htmlFor="h-week" className="label">
            Week of
          </label>
          <input id="h-week" name="week_of" type="date" required defaultValue={today} className="field" />
        </div>
        <div>
          <label htmlFor="h-hours" className="label">
            Hours
          </label>
          <input id="h-hours" name="hours" required inputMode="decimal" className="field" placeholder="12" />
        </div>
      </div>
      <div>
        <label htmlFor="h-note" className="label">
          Note <span className="font-normal text-muted">(optional)</span>
        </label>
        <input id="h-note" name="note" maxLength={300} className="field" placeholder="Homepage build" />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-secondary">
          {pending ? "Logging…" : "Log the hours"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

/** The profit range and a private note. */
export function PrivateForm({
  slug,
  projectId,
  ranges,
  range,
  note,
}: {
  slug: string;
  projectId: string;
  ranges: Option[];
  range: string | null;
  note: string | null;
}) {
  const [state, action, pending] = useActionState(savePrivate.bind(null, slug, projectId), {} as FormState);

  return (
    <form action={action} className="grid gap-4">
      <div className="sm:max-w-[280px]">
        <label htmlFor="p-range" className="label">
          How it went for us
        </label>
        <select id="p-range" name="profit_range" defaultValue={range ?? ""} className="field">
          <option value="">Not set</option>
          {ranges.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="p-note" className="label">
          Private note <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea id="p-note" name="note" rows={2} maxLength={2000} defaultValue={note ?? ""} className="field h-auto py-2" />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-secondary">
          {pending ? "Saving…" : "Save"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}
