import type { Metadata } from "next";
import Link from "next/link";
import { getWorkspace } from "@/lib/hq";
import {
  ACTION_STATUS_LABEL,
  AREA_LABEL,
  IMPACT_LABEL,
  getActions,
  type Action,
  type ActionStatus,
} from "@/lib/actions";
import { dayInBeirut, formatDay, todayInBeirut } from "@/lib/dates";
import { AddForm } from "./add-form";
import { SubmitButton } from "./submit-button";
import { decideAction, moveAction } from "./mutations";

export const metadata: Metadata = { title: "Action queue" };

const TABS: ActionStatus[] = ["waiting", "approved", "done", "dismissed"];

const EMPTY: Record<ActionStatus, string> = {
  waiting: "Nothing is waiting. New findings land here, from the team or from Claude.",
  approved: "Nothing approved and still open.",
  done: "Nothing marked done yet.",
  dismissed: "Nothing dismissed.",
};

export default async function ActionQueuePage({ params, searchParams }: PageProps<"/w/[slug]/actions">) {
  const { slug } = await params;
  const { show } = await searchParams;
  const tab: ActionStatus = TABS.includes(show as ActionStatus) ? (show as ActionStatus) : "waiting";

  const workspace = await getWorkspace(slug);
  const { byStatus, names } = await getActions(workspace.id);
  const canEdit = workspace.role === "owner" || workspace.role === "team";
  const canDecide = canEdit || workspace.role === "client_approver";
  const base = `/w/${slug}/actions`;
  const today = todayInBeirut();
  const list = byStatus[tab];

  return (
    <div className="max-w-[880px]">
      <p className="eyebrow">{workspace.name}</p>
      <h1 className="mt-2 text-[34px] leading-[1.1] font-semibold tracking-[-0.015em]">Action queue</h1>
      <p className="mt-4 max-w-[64ch] text-[17px] leading-relaxed text-muted">
        Each finding comes with what we saw, the evidence and a proposed fix. Nothing changes until someone
        approves it.
      </p>

      {canEdit && (
        <details className="mt-6">
          <summary className="btn btn-secondary w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            Add a finding
          </summary>
          <div className="card mt-3 p-5 sm:p-6">
            <AddForm slug={slug} />
          </div>
        </details>
      )}

      <nav aria-label="Show" className="mt-8 flex flex-wrap gap-x-6 gap-y-1 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t}
            href={t === "waiting" ? base : `${base}?show=${t}`}
            aria-current={t === tab ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2.5 text-[15px] ${
              t === tab ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {ACTION_STATUS_LABEL[t]} <span className="font-normal text-faint">{byStatus[t].length}</span>
          </Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <p className="mt-6 text-muted">{EMPTY[tab]}</p>
      ) : (
        <div className="mt-6 grid gap-3">
          {list.map((a) => (
            <ActionCard
              key={a.id}
              a={a}
              names={names}
              slug={slug}
              canEdit={canEdit}
              canDecide={canDecide}
              today={today}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function addedBy(a: Action, names: Map<string, string>) {
  if (a.source === "claude") return "Added by Claude";
  if (a.source === "connection") return "Found by a connection";
  return `Added by ${(a.created_by && names.get(a.created_by)) || "the team"}`;
}

function ActionCard({
  a,
  names,
  slug,
  canEdit,
  canDecide,
  today,
}: {
  a: Action;
  names: Map<string, string>;
  slug: string;
  canEdit: boolean;
  canDecide: boolean;
  today: string;
}) {
  const decidedBy = (a.decided_by && names.get(a.decided_by)) || "someone";
  const late = a.status === "approved" && a.due_on !== null && a.due_on < today;

  return (
    <article
      id={`a${a.number}`}
      className="scroll-mt-6 rounded-lg border border-line bg-card p-5 target:border-ink target:ring-1 target:ring-ink sm:grid sm:grid-cols-[56px_1fr] sm:gap-4"
    >
      <p className="font-serif text-[28px] italic leading-none">A{a.number}</p>
      <div className="mt-2 min-w-0 sm:mt-0">
        <h2 className="text-[17px] font-semibold leading-snug">{a.title}</h2>
        <p className="mt-1 text-[13px] text-muted">
          {AREA_LABEL[a.area]} ·{" "}
          <span className={a.impact === "high" ? "font-medium text-ink" : ""}>{IMPACT_LABEL[a.impact]}</span> ·{" "}
          {addedBy(a, names)}, {formatDay(dayInBeirut(a.created_at))}
        </p>

        <dl className="mt-4 grid gap-3 text-[15px] leading-relaxed">
          {(a.finding || a.evidence_url) && (
            <div>
              <dt className="font-semibold">What we found</dt>
              {a.finding && <dd className="mt-0.5 whitespace-pre-line">{a.finding}</dd>}
              {a.evidence_url && (
                <dd className="mt-1">
                  <a href={a.evidence_url} target="_blank" rel="noreferrer" className="link text-sm">
                    See the evidence
                  </a>
                </dd>
              )}
            </div>
          )}
          {a.fix && (
            <div>
              <dt className="font-semibold">Proposed fix</dt>
              <dd className="mt-0.5 whitespace-pre-line">{a.fix}</dd>
            </div>
          )}
          {(a.owner || a.due_on) && (
            <div>
              <dt className="font-semibold">Who and when</dt>
              <dd className={`mt-0.5 ${late ? "font-medium text-danger" : ""}`}>
                {[a.owner, a.due_on ? `by ${formatDay(a.due_on)}` : null].filter(Boolean).join(", ")}
                {late ? ". Late" : ""}
              </dd>
            </div>
          )}
        </dl>

        {a.status !== "waiting" && (
          <p className="mt-4 text-sm text-muted">
            {a.status === "done" && a.done_at ? `Done on ${formatDay(dayInBeirut(a.done_at))}. ` : ""}
            {a.decided_at && a.status !== "dismissed"
              ? `Approved by ${decidedBy} on ${formatDay(dayInBeirut(a.decided_at))}`
              : ""}
            {a.decided_at && a.status === "dismissed"
              ? `Dismissed by ${decidedBy} on ${formatDay(dayInBeirut(a.decided_at))}`
              : ""}
            {a.decision_note ? `: "${a.decision_note}"` : a.decided_at ? "." : ""}
          </p>
        )}

        {a.status === "waiting" && canDecide && (
          <form
            action={decideAction.bind(null, slug, a.id)}
            className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-4"
          >
            <div className="w-full sm:w-auto sm:min-w-[200px] sm:flex-1">
              <label htmlFor={`note-${a.id}`} className="label text-[13px]">
                Note <span className="font-normal text-muted">(optional)</span>
              </label>
              <input id={`note-${a.id}`} name="note" maxLength={1000} className="field h-9" />
            </div>
            <div className="flex gap-3">
              <SubmitButton
                name="decision"
                value="approved"
                pendingText="Approving…"
                className="btn h-9 bg-ink text-paper hover:bg-ink/85"
              >
                Approve
              </SubmitButton>
              <SubmitButton name="decision" value="dismissed" pendingText="Dismissing…" className="btn btn-secondary h-9">
                Dismiss
              </SubmitButton>
            </div>
          </form>
        )}

        {a.status !== "waiting" && canEdit && (
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-4">
            {a.status === "approved" && (
              <form action={moveAction.bind(null, slug, a.id, "done")}>
                <SubmitButton pendingText="Saving…" className="btn btn-secondary h-9">
                  Mark done
                </SubmitButton>
              </form>
            )}
            <form action={moveAction.bind(null, slug, a.id, "waiting")}>
              <SubmitButton pendingText="Moving…" className="btn-quiet">
                Move back to waiting
              </SubmitButton>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}
