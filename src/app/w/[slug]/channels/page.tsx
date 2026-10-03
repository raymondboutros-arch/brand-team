import type { Metadata } from "next";
import Link from "next/link";
import { CHANNEL_STATE, StateDot, StateTag } from "@/components/state-dot";
import { SubmitButton } from "@/components/submit-button";
import {
  CHANNEL_KINDS,
  CHANNEL_STATUS,
  CHANNEL_STATUS_LABEL,
  CONNECTION_LABEL,
  NEEDS_WORK,
  getChannels,
  shortUrl,
  type Channel,
} from "@/lib/channels";
import { dayInBeirut, formatDay } from "@/lib/dates";
import { getWorkspace } from "@/lib/hq";
import { ChannelForm } from "./forms";
import { removeChannel, setChannelStatus } from "./mutations";

export const metadata: Metadata = { title: "Channels" };

type Tab = "all" | "work" | "check" | "done";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "work", label: "Needs work" },
  { key: "check", label: "Not checked" },
  { key: "done", label: "Up to date" },
];

const EMPTY: Record<Tab, string> = {
  all: "No channels yet. Add the first account the brand has: its Instagram, its Google profile, a directory listing.",
  work: "Nothing needs work on the platforms right now.",
  check: "Every channel has been checked.",
  done: "No channel is marked up to date yet.",
};

const KINDS = CHANNEL_KINDS.map((k) => [k.value, k.label] as const);
const STATUSES = CHANNEL_STATUS.map((s) => [s.value, s.label] as const);

function inTab(c: Channel, tab: Tab) {
  if (tab === "work") return NEEDS_WORK.includes(c.status);
  if (tab === "check") return c.status === "to_check";
  if (tab === "done") return c.status === "up_to_date";
  return true;
}

export default async function ChannelsPage({ params, searchParams }: PageProps<"/w/[slug]/channels">) {
  const { slug } = await params;
  const { show } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === show) ? (show as Tab) : "all";

  const workspace = await getWorkspace(slug);
  const { channels, byStatus, names, count } = await getChannels(workspace.id);
  const canEdit = workspace.role === "owner" || workspace.role === "team";
  const isOwner = workspace.role === "owner";
  const base = `/w/${slug}/channels`;
  const tabCount: Record<Tab, number> = {
    all: count.all,
    work: count.needsWork,
    check: count.toCheck,
    done: count.upToDate,
  };

  const groups = CHANNEL_KINDS.map((k) => ({
    ...k,
    list: byStatus(channels.filter((c) => c.kind === k.value && inTab(c, tab))),
  })).filter((g) => g.list.length > 0);

  return (
    <div className="max-w-[1040px]">
      <h1 className="page-title">Channels</h1>
      <p className="page-intro">
        Every account the brand has, who looks after it, which email it is under and whether its sign-in is safe.
        Passwords never go here: they stay in the password manager.
      </p>

      {count.all > 0 && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="card p-5">
            <p className="font-semibold">On the platforms</p>
            <p className="mt-1 text-[15px] leading-relaxed text-muted">
              {count.all} {count.all === 1 ? "account" : "accounts"}. {count.needsWork} need work, {count.toCheck} not
              checked yet, {count.upToDate} up to date.
            </p>
          </div>
          <div className={`rounded-lg border p-5 ${count.safetyUnknown > 0 || count.twoStepOff > 0 ? "border-sand-line bg-sand" : "border-line bg-card"}`}>
            <p className="flex items-center gap-2 font-semibold">
              {(count.safetyUnknown > 0 || count.twoStepOff > 0) && <StateDot state="needs" />}
              Sign-in
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-muted">
              {count.safetyUnknown === count.all
                ? `Not filled in yet on any of the ${count.all}. Open each one and add the login email, whether two-step sign-in is on and whether the login is in the password manager.`
                : `Two-step sign-in is on for ${count.twoStepOn}${count.twoStepOff > 0 ? ` and off for ${count.twoStepOff}` : ""}. ${count.inVault} ${count.inVault === 1 ? "login is" : "logins are"} in the password manager.${count.safetyUnknown > 0 ? ` Still to fill in on ${count.safetyUnknown}.` : ""}`}
            </p>
          </div>
        </div>
      )}

      {canEdit && (
        <details className="mt-6">
          <summary className="btn btn-secondary w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            Add a channel
          </summary>
          <div className="card mt-3 max-w-[760px] p-5 sm:p-6">
            <ChannelForm slug={slug} channelId={null} values={{}} kinds={KINDS} statuses={STATUSES} submitLabel="Add the channel" primary />
          </div>
        </details>
      )}

      <nav aria-label="Show" className="mt-8 flex flex-wrap gap-x-6 gap-y-1 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? base : `${base}?show=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2.5 text-[15px] ${
              t.key === tab ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label} <span className="font-normal text-faint">{tabCount[t.key]}</span>
          </Link>
        ))}
      </nav>

      {groups.length === 0 ? (
        <p className="mt-6 text-muted">{EMPTY[tab]}</p>
      ) : (
        groups.map((g) => (
          <section key={g.value} className="mt-8" aria-labelledby={`kind-${g.value}`}>
            <h2 id={`kind-${g.value}`} className="text-[19px] font-semibold">
              {g.plural} <span className="font-normal text-faint">{g.list.length}</span>
            </h2>
            <div className="mt-3 overflow-hidden rounded-lg border border-line bg-card">
              <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_minmax(0,0.6fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] gap-4 border-b border-line px-4 pb-2.5 pt-3 text-[13px] font-medium text-muted md:grid">
                <span>Account</span>
                <span>Link</span>
                <span>Who</span>
                <span>Status</span>
                <span>Sign-in</span>
              </div>
              {g.list.map((c) => (
                <ChannelRow key={c.id} c={c} slug={slug} canEdit={canEdit} isOwner={isOwner} names={names} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function SignIn({ c }: { c: Channel }) {
  if (c.two_step === null && c.in_vault === null) return <span className="text-faint">Not filled in</span>;
  return (
    <span className="grid gap-0.5">
      <StateTag state={c.two_step === true ? "done" : c.two_step === false ? "needs" : "closed"}>
        {c.two_step === true ? "Two-step on" : c.two_step === false ? "Two-step off" : "Two-step not filled in"}
      </StateTag>
      <span className="pl-3.5 text-muted">
        {c.in_vault === true ? "In the manager" : c.in_vault === false ? "Not in the manager" : "Manager not filled in"}
      </span>
    </span>
  );
}

function ChannelRow({
  c,
  slug,
  canEdit,
  isOwner,
  names,
}: {
  c: Channel;
  slug: string;
  canEdit: boolean;
  isOwner: boolean;
  names: Map<string, string>;
}) {
  const changedBy = (c.updated_by && names.get(c.updated_by)) || "the team";
  const name = [c.shown_name, c.handle].filter(Boolean).join(", ");

  return (
    <details id={`ch-${c.id}`} className="group scroll-mt-6 border-b border-line last:border-b-0 target:bg-sky-wash">
      <summary className="grid cursor-pointer list-none gap-x-4 gap-y-1.5 px-4 py-3.5 text-[15px] hover:bg-wash md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_minmax(0,0.6fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span aria-hidden className="mr-1.5 inline-block w-2 text-faint transition-transform group-open:rotate-90">
            ›
          </span>
          <span className="font-semibold">{c.platform}</span>
          {name && <span className="text-muted">, {name}</span>}
          {c.note && <span className="mt-0.5 block truncate pl-3.5 text-[13px] text-muted group-open:hidden">{c.note}</span>}
        </span>
        <span className="min-w-0 truncate text-sm">
          {c.url ? (
            <a href={c.url} target="_blank" rel="noreferrer" className="link">
              {shortUrl(c.url)}
            </a>
          ) : (
            <span className="text-faint">No link yet</span>
          )}
        </span>
        <span className="text-sm">{c.owner ?? <span className="text-faint">Nobody yet</span>}</span>
        <span className="text-sm">
          <StateTag state={CHANNEL_STATE[c.status]}>{CHANNEL_STATUS_LABEL[c.status]}</StateTag>
        </span>
        <span className="text-sm">
          <SignIn c={c} />
        </span>
      </summary>

      <div className="grid gap-4 border-t border-line bg-paper px-4 py-5 md:pl-8">
        {c.note && <p className="max-w-[72ch] whitespace-pre-line text-[15px] leading-relaxed">{c.note}</p>}
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="text-muted">Login email</dt>
          <dd>{c.login_email ?? <span className="text-faint">Not filled in</span>}</dd>
          <dt className="text-muted">Connection</dt>
          <dd>
            {CONNECTION_LABEL[c.connection]}
            {c.connection === "not_connected" && (
              <span className="text-muted">. Connecting through the platform&apos;s own sign-in comes later.</span>
            )}
          </dd>
          {c.checked_on && (
            <>
              <dt className="text-muted">Last checked</dt>
              <dd>{formatDay(c.checked_on)}</dd>
            </>
          )}
          <dt className="text-muted">Last changed</dt>
          <dd>
            {formatDay(dayInBeirut(c.updated_at))}, by {changedBy}
          </dd>
        </dl>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-4">
            {c.status !== "up_to_date" && (
              <form action={setChannelStatus.bind(null, slug, c.id, "up_to_date")}>
                <SubmitButton pendingText="Saving…" className="btn btn-secondary h-9">
                  Mark up to date
                </SubmitButton>
              </form>
            )}
            {c.status === "up_to_date" && (
              <form action={setChannelStatus.bind(null, slug, c.id, "needs_update")}>
                <SubmitButton pendingText="Saving…" className="btn-quiet">
                  Something changed: needs update
                </SubmitButton>
              </form>
            )}
          </div>
        )}

        {canEdit && (
          <details className="group/edit">
            <summary className="btn-quiet w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              Change the details
            </summary>
            <div className="card mt-3 max-w-[760px] p-5 sm:p-6">
              <ChannelForm
                slug={slug}
                channelId={c.id}
                values={c}
                kinds={KINDS}
                statuses={STATUSES}
                submitLabel="Save changes"
              />
              {isOwner && (
                <details className="mt-6 border-t border-line pt-4">
                  <summary className="btn-quiet w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    Remove this channel
                  </summary>
                  <form action={removeChannel.bind(null, slug, c.id)} className="mt-3 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-muted">
                      This removes it from HQ only, not from {c.platform}. Use &quot;To close&quot; if the account itself should go.
                    </p>
                    <SubmitButton pendingText="Removing…" className="btn h-9 border border-danger text-danger hover:bg-danger hover:text-white">
                      Remove from HQ
                    </SubmitButton>
                  </form>
                </details>
              )}
            </div>
          </details>
        )}
      </div>
    </details>
  );
}
