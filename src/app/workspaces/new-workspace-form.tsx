"use client";

import { useActionState, useState } from "react";
import { createWorkspace, type FormState } from "./actions";

export function NewWorkspaceForm() {
  const [state, action, pending] = useActionState(createWorkspace, {} as FormState);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const suggested = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return (
    <form action={action} className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div>
        <label htmlFor="ws-name" className="label">Brand name</label>
        <input
          id="ws-name"
          name="name"
          className="field"
          placeholder="Pro Ink"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="ws-slug" className="label">Address</label>
        <input
          id="ws-slug"
          name="slug"
          className="field"
          placeholder="pro-ink"
          value={slugTouched ? slug : suggested}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          required
        />
      </div>
      <button type="submit" disabled={pending} className="btn btn-secondary">
        {pending ? "Creating…" : "Create"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-danger sm:col-span-3">{state.error}</p>
      )}
    </form>
  );
}
