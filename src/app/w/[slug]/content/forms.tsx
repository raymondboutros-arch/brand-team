"use client";

import { useActionState } from "react";
import { addContent, askForChanges, moveContent, saveContent, sendForApproval, type FormState } from "./mutations";

type Option = { id: string; label: string };

const FORMATS = [
  ["article", "Article"],
  ["post", "Post"],
  ["carousel", "Carousel"],
  ["video", "Video"],
  ["story", "Story"],
  ["email", "Email"],
  ["other", "Other"],
] as const;

const area = "field h-auto py-2 leading-relaxed";

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

export type ContentValues = {
  title?: string;
  format?: string;
  series?: string | null;
  channel_id?: string | null;
  owner?: string | null;
  due_on?: string | null;
  publish_on?: string | null;
  live_url?: string | null;
  brief?: string | null;
  fact?: string | null;
  body_md?: string | null;
};

function DetailFields({ p, v, channels }: { p: string; v: ContentValues; channels: Option[] }) {
  return (
    <>
      <Field id={`${p}-title`} label="Working title">
        <input id={`${p}-title`} name="title" required minLength={2} maxLength={200} defaultValue={v.title} className="field" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`${p}-format`} label="Format">
          <select id={`${p}-format`} name="format" defaultValue={v.format ?? "article"} className="field">
            {FORMATS.map(([val, l]) => (
              <option key={val} value={val}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${p}-series`} label="Series" hint="optional">
          <input id={`${p}-series`} name="series" maxLength={80} defaultValue={v.series ?? ""} className="field" placeholder="Owners' questions" />
        </Field>
        <Field id={`${p}-channel`} label="Where it goes">
          <select id={`${p}-channel`} name="channel_id" defaultValue={v.channel_id ?? ""} className="field">
            <option value="">Not decided</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field id={`${p}-brief`} label="What it says, and for whom" hint="optional">
        <textarea id={`${p}-brief`} name="brief" rows={3} maxLength={4000} defaultValue={v.brief ?? ""} className={area} />
      </Field>
      <Field id={`${p}-fact`} label="The first-hand fact" hint="a number, a result, a client's words. Articles need one">
        <textarea id={`${p}-fact`} name="fact" rows={2} maxLength={1000} defaultValue={v.fact ?? ""} className={area} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${p}-owner`} label="Who drafts it" hint="optional">
          <input id={`${p}-owner`} name="owner" maxLength={80} defaultValue={v.owner ?? ""} className="field" placeholder="Moe" />
        </Field>
        <Field id={`${p}-due`} label="Draft due" hint="optional">
          <input id={`${p}-due`} name="due_on" type="date" defaultValue={v.due_on ?? ""} className="field" />
        </Field>
      </div>
    </>
  );
}

/** Owner and Team add an idea to the bank. */
export function AddContentForm({ slug, channels }: { slug: string; channels: Option[] }) {
  const [state, action, pending] = useActionState(addContent.bind(null, slug), {} as FormState);
  return (
    <form action={action} className="grid gap-4">
      <DetailFields p="new" v={{}} channels={channels} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Adding…" : "Add the idea"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

/** Owner and Team change the details and write the draft. */
export function ContentForm({
  slug,
  contentId,
  stage,
  values,
  channels,
}: {
  slug: string;
  contentId: string;
  stage: string;
  values: ContentValues;
  channels: Option[];
}) {
  const [state, action, pending] = useActionState(saveContent.bind(null, slug, contentId), {} as FormState);
  const v = values;
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="was" value={stage} />
      <Field id="c-body" label="The draft" hint="Markdown: ## for headings, **bold**, - for lists">
        <textarea id="c-body" name="body_md" rows={18} maxLength={60000} defaultValue={v.body_md ?? ""} className={`${area} font-[inherit]`} />
      </Field>
      <DetailFields p="c" v={v} channels={channels} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="c-publish" label="Goes out on" hint="optional until it is scheduled">
          <input id="c-publish" name="publish_on" type="date" defaultValue={v.publish_on ?? ""} className="field" />
        </Field>
        <Field id="c-live" label="Live link" hint="once it is out">
          <input id="c-live" name="live_url" type="url" maxLength={500} defaultValue={v.live_url ?? ""} className="field" placeholder="https://" />
        </Field>
      </div>
      {(stage === "approved" || stage === "scheduled") && (
        <p className="text-sm text-muted">Changing the words sends it back to draft, to be approved again.</p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-secondary">
          {pending ? "Saving…" : "Save changes"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

const TONE = {
  primary: "btn btn-primary",
  ink: "btn bg-ink text-paper hover:bg-ink/85",
  secondary: "btn btn-secondary",
  quiet: "btn-quiet",
} as const;

/** One stage move, with the date or the link it needs. */
export function MoveForm({
  slug,
  contentId,
  to,
  label,
  pendingLabel,
  tone = "secondary",
  ask,
  defaults,
}: {
  slug: string;
  contentId: string;
  to: string;
  label: string;
  pendingLabel: string;
  tone?: keyof typeof TONE;
  ask?: "publish" | "live";
  defaults?: { publish_on?: string | null; live_url?: string | null };
}) {
  const [state, action, pending] = useActionState(moveContent.bind(null, slug, contentId), {} as FormState);
  const id = `${to}-${contentId.slice(0, 6)}`;
  return (
    <form action={action} className={ask ? "grid gap-3" : "contents"}>
      <input type="hidden" name="to" value={to} />
      {ask === "publish" && (
        <Field id={`${id}-date`} label="Goes out on">
          <input id={`${id}-date`} name="publish_on" type="date" required defaultValue={defaults?.publish_on ?? ""} className="field w-auto" />
        </Field>
      )}
      {ask === "live" && (
        <Field id={`${id}-url`} label="Live link" hint="optional">
          <input id={`${id}-url`} name="live_url" type="url" maxLength={500} defaultValue={defaults?.live_url ?? ""} className="field" placeholder="https://" />
        </Field>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={`${TONE[tone]} ${tone === "quiet" ? "" : "h-9"}`}>
          {pending ? pendingLabel : label}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function SendForApproval({ slug, contentId }: { slug: string; contentId: string }) {
  const [state, action, pending] = useActionState(sendForApproval.bind(null, slug, contentId), {} as FormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending} className="btn h-9 bg-ink text-paper hover:bg-ink/85">
        {pending ? "Sending…" : "Send for approval"}
      </button>
      <Status state={state} />
    </form>
  );
}

export function AskForChanges({ slug, contentId }: { slug: string; contentId: string }) {
  const [state, action, pending] = useActionState(askForChanges.bind(null, slug, contentId), {} as FormState);
  return (
    <form action={action} className="grid gap-3">
      <Field id="ask-note" label="What should change">
        <textarea id="ask-note" name="note" rows={3} required maxLength={2000} className={area} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-secondary h-9">
          {pending ? "Sending…" : "Send it back"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}
