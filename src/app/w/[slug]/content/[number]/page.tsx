import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { Md } from "@/components/markdown";
import { StateDot, type State } from "@/components/state-dot";
import { SubmitButton } from "@/components/submit-button";
import { FORMAT_LABEL, STAGES, getContentItem, waitingForApproval, type ContentItem } from "@/lib/content";
import { dayInBeirut, formatDay, todayInBeirut } from "@/lib/dates";
import { getWorkspace } from "@/lib/hq";
import { AskForChanges, ContentForm, MoveForm, SendForApproval } from "../forms";
import { newReviewLink } from "../mutations";

async function load(slug: string, raw: string) {
  if (!/^\d{1,5}$/.test(raw)) notFound();
  const workspace = await getWorkspace(slug);
  const found = await getContentItem(workspace.id, Number(raw));
  if (!found) notFound();
  return { workspace, ...found };
}

export async function generateMetadata({ params }: PageProps<"/w/[slug]/content/[number]">): Promise<Metadata> {
  const { slug, number } = await params;
  const { item } = await load(slug, number);
  return { title: `C${item.number} ${item.title}` };
}

function stepState(item: ContentItem, step: string): State {
  const order = STAGES.map((s) => s.value as string);
  const at = order.indexOf(item.stage);
  const i = order.indexOf(step);
  if (item.stage === "dropped") return "closed";
  if (i < at) return "done";
  if (i === at) return waitingForApproval(item) ? "needs" : item.stage === "live" ? "done" : "moving";
  return "closed";
}

export default async function ContentItemPage({ params }: PageProps<"/w/[slug]/content/[number]">) {
  const { slug, number } = await params;
  const { workspace, item: c, channels, channelName, names } = await load(slug, number);
  const canEdit = workspace.role === "owner" || workspace.role === "team";
  const canApprove = workspace.role === "owner" || workspace.role === "client_approver";
  const base = `/w/${slug}/content`;
  const today = todayInBeirut();
  const wait = waitingForApproval(c);
  const hasText = Boolean(c.body_md?.trim());
  const needsFact = c.format === "article" && !c.fact?.trim();
  const who = (id: string | null) => (id && names.get(id)) || "someone";

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "livbrid-hq.vercel.app";
  const reviewUrl = `https://${host}/review/${c.review_token}`;
  const reviewOpen = c.stage === "draft" || c.stage === "approved";

  const kind = [FORMAT_LABEL[c.format], c.series, c.channel_id ? `for ${channelName.get(c.channel_id) ?? "a channel"}` : null]
    .filter(Boolean)
    .join(", ");

  let standing = "";
  if (c.stage === "idea") standing = "An idea in the bank. Nobody has started the draft.";
  if (c.stage === "draft") {
    standing = wait
      ? `Waiting for approval since ${formatDay(dayInBeirut(c.review_requested_at!))}, sent by ${who(c.review_requested_by)}.`
      : c.review_note
        ? "Sent back with changes to make."
        : hasText
          ? "Being written. Send it for approval when it's ready."
          : "Started, with no text yet.";
  }
  if (c.stage === "approved") {
    standing = `Approved by ${who(c.approved_by)} on ${formatDay(dayInBeirut(c.approved_at!))}. ${c.publish_on ? `Planned for ${formatDay(c.publish_on)}.` : "No date yet."}`;
  }
  if (c.stage === "scheduled") {
    standing =
      c.publish_on && c.publish_on < today
        ? `Was due out on ${formatDay(c.publish_on)}. Mark it live once it's out, or move the date.`
        : `Goes out on ${formatDay(c.publish_on)}. Approved by ${who(c.approved_by)}.`;
  }
  if (c.stage === "live") standing = `Live since ${formatDay(c.publish_on)}.`;
  if (c.stage === "dropped") standing = "Dropped. It stays here in case it comes back.";

  return (
    <div className="max-w-[1040px]">
      <Link href={base} className="link text-sm">
        Content
      </Link>

      <header className="mt-6 grid gap-x-5 sm:grid-cols-[auto_1fr]">
        <p className="ref-mark text-[44px] leading-none sm:text-[56px]">C{c.number}</p>
        <div className="mt-2 min-w-0 sm:mt-0">
          <h1 className="page-title">{c.title}</h1>
          <p className="mt-2 text-[15px] text-muted">
            {kind}
            {c.owner ? `. Drafted by ${c.owner}` : ""}
            {c.source === "claude" ? ". Added through Claude" : ""}.
          </p>
        </div>
      </header>

      <section aria-label="Where it stands" className="mt-8 border-y border-line py-5">
        <ol className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px]">
          {STAGES.map((s) => {
            const st = stepState(c, s.value);
            return (
              <li key={s.value} className={`flex items-center gap-2 ${c.stage === s.value ? "font-semibold" : "text-muted"}`}>
                <StateDot state={st} />
                {s.label}
              </li>
            );
          })}
          {c.stage === "dropped" && (
            <li className="flex items-center gap-2 font-semibold">
              <StateDot state="closed" />
              Dropped
            </li>
          )}
        </ol>
        <p className="mt-3 text-[15px]">{standing}</p>
        {c.stage === "draft" && c.review_note && !wait && (
          <blockquote className="mt-3 max-w-[72ch] border-l-2 border-saffron pl-3 text-[15px] whitespace-pre-line">
            {c.review_note}
          </blockquote>
        )}

        <div className="mt-4 grid gap-4">
          {c.stage === "idea" && canEdit && (
            <div className="flex flex-wrap items-center gap-4">
              <MoveForm slug={slug} contentId={c.id} to="draft" label="Start the draft" pendingLabel="Starting…" tone="ink" />
              <MoveForm slug={slug} contentId={c.id} to="dropped" label="Drop it" pendingLabel="Dropping…" tone="quiet" />
            </div>
          )}

          {c.stage === "draft" && (
            <>
              {canApprove && (
                <div className="flex flex-wrap items-center gap-4">
                  {hasText && !needsFact ? (
                    <>
                      <MoveForm slug={slug} contentId={c.id} to="approved" label="Approve" pendingLabel="Approving…" tone="primary" />
                      <p className="text-[13px] text-muted">Approving is a person&apos;s decision. Claude can draft, never approve.</p>
                    </>
                  ) : (
                    <p className="text-[15px] text-muted">
                      Before it can be approved, it needs {!hasText ? "the draft itself" : "the first-hand fact"}.
                    </p>
                  )}
                </div>
              )}
              {canApprove && hasText && (
                <details>
                  <summary className="btn-quiet w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    Send it back with changes
                  </summary>
                  <div className="mt-3 max-w-[560px]">
                    <AskForChanges slug={slug} contentId={c.id} />
                  </div>
                </details>
              )}
              {canEdit && (
                <div className="flex flex-wrap items-center gap-4">
                  {workspace.role === "team" && !wait && hasText && <SendForApproval slug={slug} contentId={c.id} />}
                  {workspace.role === "team" && wait && <p className="text-[15px] text-muted">The Owner approves it next.</p>}
                  <MoveForm slug={slug} contentId={c.id} to="idea" label="Back to the ideas" pendingLabel="Moving…" tone="quiet" />
                  <MoveForm slug={slug} contentId={c.id} to="dropped" label="Drop it" pendingLabel="Dropping…" tone="quiet" />
                </div>
              )}
            </>
          )}

          {c.stage === "approved" && canEdit && (
            <div className="grid gap-5 sm:grid-cols-2">
              <MoveForm
                slug={slug}
                contentId={c.id}
                to="scheduled"
                label="Schedule it"
                pendingLabel="Scheduling…"
                tone="ink"
                ask="publish"
                defaults={{ publish_on: c.publish_on }}
              />
              <MoveForm
                slug={slug}
                contentId={c.id}
                to="live"
                label="It's out: mark it live"
                pendingLabel="Saving…"
                ask="live"
                defaults={{ live_url: c.live_url }}
              />
              <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                <MoveForm slug={slug} contentId={c.id} to="draft" label="Back to draft" pendingLabel="Moving…" tone="quiet" />
                <MoveForm slug={slug} contentId={c.id} to="dropped" label="Drop it" pendingLabel="Dropping…" tone="quiet" />
              </div>
            </div>
          )}

          {c.stage === "scheduled" && canEdit && (
            <div className="grid gap-5 sm:grid-cols-2">
              <MoveForm
                slug={slug}
                contentId={c.id}
                to="live"
                label="It's out: mark it live"
                pendingLabel="Saving…"
                tone="ink"
                ask="live"
                defaults={{ live_url: c.live_url }}
              />
              <MoveForm
                slug={slug}
                contentId={c.id}
                to="scheduled"
                label="Move the date"
                pendingLabel="Saving…"
                ask="publish"
                defaults={{ publish_on: c.publish_on }}
              />
              <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                <MoveForm slug={slug} contentId={c.id} to="draft" label="Back to draft" pendingLabel="Moving…" tone="quiet" />
              </div>
            </div>
          )}

          {c.stage === "dropped" && canEdit && (
            <div>
              <MoveForm slug={slug} contentId={c.id} to="idea" label="Bring it back as an idea" pendingLabel="Moving…" />
            </div>
          )}
        </div>
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-label="The draft" className="min-w-0">
          {hasText ? (
            <article className="card px-5 py-6 sm:px-8 sm:py-8">
              <Md>{c.body_md}</Md>
            </article>
          ) : (
            <p className="text-muted">
              {c.stage === "idea" ? "No draft yet. Start the draft to write it here." : "No text yet. Write it below."}
            </p>
          )}
        </section>

        <aside className="grid content-start gap-6 text-[15px]">
          <dl className="grid gap-4">
            {c.brief && (
              <div>
                <dt className="font-semibold">What it says, and for whom</dt>
                <dd className="mt-0.5 whitespace-pre-line text-muted">{c.brief}</dd>
              </div>
            )}
            <div>
              <dt className="font-semibold">The first-hand fact</dt>
              <dd className={`mt-0.5 whitespace-pre-line ${c.fact ? "text-muted" : "text-faint"}`}>
                {c.fact ?? (c.format === "article" ? "Not yet. Articles need one before approval." : "None")}
              </dd>
            </div>
            {(c.due_on || c.publish_on) && (
              <div>
                <dt className="font-semibold">Dates</dt>
                <dd className="mt-0.5 text-muted">
                  {[c.due_on && `Draft due ${formatDay(c.due_on)}`, c.publish_on && `goes out ${formatDay(c.publish_on)}`]
                    .filter(Boolean)
                    .join(", ")}
                </dd>
              </div>
            )}
            {c.live_url && (
              <div>
                <dt className="font-semibold">Live at</dt>
                <dd className="mt-0.5 break-all">
                  <a href={c.live_url} target="_blank" rel="noreferrer" className="link">
                    {c.live_url.replace(/^https?:\/\/(www\.)?/, "")}
                  </a>
                </dd>
              </div>
            )}
          </dl>

          {reviewOpen && canEdit && (
            <div className="rounded-lg border border-line bg-card p-4">
              <p className="font-semibold">Review link</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Anyone with this link can read the draft, without signing in, and nothing else. It stops working once
                the item is scheduled. Comments come back to you by message.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <CopyButton text={reviewUrl} label="Review link" />
                <a href={`/review/${c.review_token}`} target="_blank" rel="noreferrer" className="link text-sm">
                  Open it
                </a>
              </div>
              <form action={newReviewLink.bind(null, slug, c.id)} className="mt-3">
                <SubmitButton pendingText="Making a new link…" className="btn-quiet">
                  Make a new link and turn this one off
                </SubmitButton>
              </form>
            </div>
          )}

          <p className="text-[13px] text-muted">
            Last changed {formatDay(dayInBeirut(c.updated_at))}, by {who(c.updated_by)}.
          </p>
        </aside>
      </div>

      {canEdit && c.stage !== "live" && (
        <details className="mt-10" open={c.stage === "draft" && !hasText}>
          <summary className="btn btn-secondary w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            {hasText ? "Edit the draft and details" : "Write the draft"}
          </summary>
          <div className="card mt-3 p-5 sm:p-6">
            <ContentForm
              slug={slug}
              contentId={c.id}
              stage={c.stage}
              channels={channels}
              values={{
                title: c.title,
                format: c.format,
                series: c.series,
                channel_id: c.channel_id,
                owner: c.owner,
                due_on: c.due_on,
                publish_on: c.publish_on,
                live_url: c.live_url,
                brief: c.brief,
                fact: c.fact,
                body_md: c.body_md,
              }}
            />
          </div>
        </details>
      )}
      {c.stage === "live" && canEdit && (
        <p className="mt-10 text-sm text-muted">Live items are kept as they went out. For a new version, add a new idea.</p>
      )}
    </div>
  );
}
