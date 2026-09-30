"use client";

import { useActionState } from "react";
import { saveName, type NameState } from "./actions";

export function NameForm({ initial }: { initial: string }) {
  const [state, action, pending] = useActionState(saveName, {} as NameState);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[220px] flex-1">
        <label htmlFor="full_name" className="label">Full name</label>
        <input id="full_name" name="full_name" defaultValue={initial} className="field" placeholder="Raymond Boutros" />
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Saving…" : "Save"}
      </button>
      {state.error && <p role="alert" className="w-full text-sm text-danger">{state.error}</p>}
      {state.ok && <p role="status" className="w-full text-sm text-ok">Saved.</p>}
    </form>
  );
}
