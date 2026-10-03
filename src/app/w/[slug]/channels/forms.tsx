"use client";

import { useActionState } from "react";
import { saveChannel, type FormState } from "./mutations";

type Option = readonly [string, string];

export type ChannelValues = {
  kind?: string;
  platform?: string;
  shown_name?: string | null;
  handle?: string | null;
  url?: string | null;
  owner?: string | null;
  login_email?: string | null;
  two_step?: boolean | null;
  in_vault?: boolean | null;
  status?: string;
  checked_on?: string | null;
  note?: string | null;
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

const yesNo = (v: boolean | null | undefined) => (v === true ? "yes" : v === false ? "no" : "");

/** Add a channel, or change one. There is no password field, by design. */
export function ChannelForm({
  slug,
  channelId,
  values,
  kinds,
  statuses,
  submitLabel,
  primary = false,
}: {
  slug: string;
  channelId: string | null;
  values: ChannelValues;
  kinds: Option[];
  statuses: Option[];
  submitLabel: string;
  primary?: boolean;
}) {
  const [state, action, pending] = useActionState(saveChannel.bind(null, slug, channelId), {} as FormState);
  const v = values;
  const p = channelId ? channelId.slice(0, 8) : "new";

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${p}-platform`} label="Platform">
          <input
            id={`${p}-platform`}
            name="platform"
            required
            maxLength={60}
            defaultValue={v.platform}
            className="field"
            placeholder="Instagram"
          />
        </Field>
        <Field id={`${p}-kind`} label="Kind">
          <select id={`${p}-kind`} name="kind" defaultValue={v.kind ?? "social"} className="field">
            {kinds.map(([val, l]) => (
              <option key={val} value={val}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${p}-name`} label="Name shown there" hint="optional">
          <input id={`${p}-name`} name="shown_name" maxLength={120} defaultValue={v.shown_name ?? ""} className="field" placeholder="LIVBRID" />
        </Field>
        <Field id={`${p}-handle`} label="Username" hint="optional">
          <input id={`${p}-handle`} name="handle" maxLength={120} defaultValue={v.handle ?? ""} className="field" placeholder="@livbrid" />
        </Field>
      </div>
      <Field id={`${p}-url`} label="Link" hint="optional">
        <input id={`${p}-url`} name="url" type="url" maxLength={500} defaultValue={v.url ?? ""} className="field" placeholder="https://" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${p}-owner`} label="Who looks after it" hint="optional">
          <input id={`${p}-owner`} name="owner" maxLength={80} defaultValue={v.owner ?? ""} className="field" placeholder="Moe" />
        </Field>
        <Field id={`${p}-status`} label="Status">
          <select id={`${p}-status`} name="status" defaultValue={v.status ?? "to_check"} className="field">
            {statuses.map(([val, l]) => (
              <option key={val} value={val}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="grid gap-4 rounded-md border border-line p-4">
        <legend className="px-1 text-sm font-medium">Sign-in</legend>
        <p className="-mt-1 text-sm text-muted">
          The password stays in the password manager. Here you only say where the login lives and whether it is safe.
        </p>
        <Field id={`${p}-email`} label="Login email" hint="the account it is under">
          <input
            id={`${p}-email`}
            name="login_email"
            type="email"
            maxLength={200}
            autoComplete="off"
            defaultValue={v.login_email ?? ""}
            className="field"
            placeholder="info@livbrid.com"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${p}-2fa`} label="Two-step sign-in">
            <select id={`${p}-2fa`} name="two_step" defaultValue={yesNo(v.two_step)} className="field">
              <option value="">Not filled in</option>
              <option value="yes">On</option>
              <option value="no">Off</option>
            </select>
          </Field>
          <Field id={`${p}-vault`} label="In the password manager">
            <select id={`${p}-vault`} name="in_vault" defaultValue={yesNo(v.in_vault)} className="field">
              <option value="">Not filled in</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <Field id={`${p}-note`} label="Notes" hint="what is wrong, what to change">
          <textarea id={`${p}-note`} name="note" rows={3} maxLength={2000} defaultValue={v.note ?? ""} className="field h-auto py-2 leading-relaxed" />
        </Field>
        <Field id={`${p}-checked`} label="Last checked" hint="optional">
          <input id={`${p}-checked`} name="checked_on" type="date" defaultValue={v.checked_on ?? ""} className="field" />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={`btn ${primary ? "btn-primary" : "btn-secondary"}`}>
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
