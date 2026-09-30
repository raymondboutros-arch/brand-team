"use client";

import { useActionState } from "react";
import { sendSignInLink, type SignInState } from "./actions";

const initial: SignInState = { status: "idle" };

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(sendSignInLink, initial);

  if (state.status === "sent") {
    return (
      <div className="mt-8 card p-5">
        <p className="font-medium">Check your inbox</p>
        <p className="mt-1 text-sm text-muted">
          We sent a sign-in link to <span className="text-ink">{state.email}</span>. Open it in this
          browser. It works once and expires in an hour.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="label">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className="field"
          placeholder="you@livbrid.com"
          aria-invalid={state.status === "error"}
          aria-describedby={state.status === "error" ? "email-error" : undefined}
        />
        {state.status === "error" && (
          <p id="email-error" role="alert" className="mt-2 text-sm text-danger">
            {state.message}
          </p>
        )}
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
