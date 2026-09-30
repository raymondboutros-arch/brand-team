"use client";

import { useActionState } from "react";
import { invitePerson, type InviteState } from "./actions";

export function InviteForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(invitePerson.bind(null, slug), {} as InviteState);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1fr_160px_auto] sm:items-end">
      <div>
        <label htmlFor="invite-email" className="label">Email</label>
        <input id="invite-email" name="email" type="email" required className="field" placeholder="name@livbrid.com" />
      </div>
      <div>
        <label htmlFor="invite-role" className="label">Role</label>
        <select id="invite-role" name="role" defaultValue="team" className="field">
          <option value="team">Team</option>
          <option value="owner">Owner</option>
        </select>
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Inviting…" : "Invite"}
      </button>
      {(state.error || state.ok) && (
        <p role="status" className={`text-sm sm:col-span-3 ${state.error ? "text-danger" : "text-ok"}`}>
          {state.error ?? state.ok}
        </p>
      )}
    </form>
  );
}
