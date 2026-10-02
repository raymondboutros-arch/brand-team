"use client";

import { useActionState } from "react";
import { addAction, type AddState } from "./mutations";

const AREAS = [
  ["website", "Website"],
  ["google", "Google"],
  ["ai", "AI answers"],
  ["social", "Social"],
  ["brand", "Brand"],
  ["content", "Content"],
  ["other", "Other"],
] as const;

/** Owner and Team add a finding: what we saw, the evidence, and the fix we propose. */
export function AddForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(addAction.bind(null, slug), {} as AddState);

  return (
    <form action={action} className="mt-4 grid gap-4">
      <div>
        <label htmlFor="aq-title" className="label">Finding</label>
        <input id="aq-title" name="title" required minLength={3} maxLength={200} className="field" placeholder="The Google profile shows only the town, not the street" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="aq-area" className="label">Area</label>
          <select id="aq-area" name="area" defaultValue="website" className="field">
            {AREAS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="aq-impact" className="label">Impact</label>
          <select id="aq-impact" name="impact" defaultValue="medium" className="field">
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="aq-finding" className="label">What we found</label>
        <textarea id="aq-finding" name="finding" required maxLength={4000} rows={3} className="field h-auto py-2" />
      </div>
      <div>
        <label htmlFor="aq-evidence" className="label">
          Link to the evidence <span className="font-normal text-muted">(optional)</span>
        </label>
        <input id="aq-evidence" name="evidence_url" type="url" className="field" placeholder="https://" />
      </div>
      <div>
        <label htmlFor="aq-fix" className="label">Proposed fix</label>
        <textarea id="aq-fix" name="fix" required maxLength={4000} rows={3} className="field h-auto py-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="aq-owner" className="label">
            Who would do it <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="aq-owner" name="owner" maxLength={80} className="field" placeholder="Ray" />
        </div>
        <div>
          <label htmlFor="aq-due" className="label">
            By when <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="aq-due" name="due_on" type="date" className="field" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Adding…" : "Add to the queue"}
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
