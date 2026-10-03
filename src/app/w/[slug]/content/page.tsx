import type { Metadata } from "next";
import Link from "next/link";
import { CONTENT_STATE, StateDot, StateTag } from "@/components/state-dot";
import {
  FORMAT_LABEL,
  STAGES,
  STAGE_LABEL,
  getContent,
  waitingForApproval,
  type ContentItem,
} from "@/lib/content";
import { formatDay, formatMonth, todayInBeirut } from "@/lib/dates";
import { getWorkspace } from "@/lib/hq";
import { AddContentForm } from "./forms";

export const metadata: Metadata = { title: "Content" };

type View = "board" | "calendar" | "dropped";

export default async function ContentPage({ params, searchParams }: PageProps<"/w/[slug]/content">) {
  const { slug } = await params;
  const { view: rawView, month: rawMonth } = await searchParams;
  const view: View = rawView === "calendar" || rawView === "dropped" ? rawView : "board";

  const workspace = await getWorkspace(slug);
  const { items, channels, channelName } = await getContent(workspace.id);
  const canEdit = workspace.role === "owner" || workspace.role === "team";
  const canApprove = workspace.role === "owner" || workspace.role === "client_approver";
  const base = `/w/${slug}/content`;
  const today = todayInBeirut();

  const active = items.filter((i) => i.stage !== "dropped");
  const dropped = items.filter((i) => i.stage === "dropped");
  const waiting = active.filter(waitingForApproval);

  return (
    <div className="max-w-[1200px]">
      <h1 className="page-title">Content</h1>
      <p className="page-intro">
        Every idea, draft and post, from the first line to live. The team drafts, the Owner approves, and nothing
        is published from here: whoever puts it out marks it live.
      </p>

      {waiting.length > 0 && (
        <div className="mt-8 max-w-[880px] rounded-lg border border-sand-line bg-sand p-5">
          <p className="flex items-center gap-2 font-semibold">
            <StateDot state="needs" />
            {waiting.length === 1 ? "One draft is" : `${waiting.length} drafts are`} waiting for approval
          </p>
          <ul className="mt-2 grid gap-1 text-[15px]">
            {waiting.map((i) => (
              <li key={i.id}>
                <Link href={`${base}/${i.number}`} className="link">
                  C{i.number}, {i.title}
                </Link>
                {!canApprove && <span className="text-muted">. The Owner approves it.</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {canEdit && (
        <details className="mt-6 max-w-[880px]">
          <summary className="btn btn-secondary w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            Add an idea
          </summary>
          <div className="card mt-3 p-5 sm:p-6">
            <AddContentForm slug={slug} channels={channels} />
          </div>
        </details>
      )}

      <nav aria-label="View" className="mt-8 flex flex-wrap gap-x-6 gap-y-1 border-b border-line">
        {(
          [
            ["board", "By stage", active.length],
            ["calendar", "Calendar", null],
            ["dropped", "Dropped", dropped.length],
          ] as const
        ).map(([key, label, n]) => (
          <Link
            key={key}
            href={key === "board" ? base : `${base}?view=${key}`}
            aria-current={key === view ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2.5 text-[15px] ${
              key === view ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {label} {n !== null && <span className="font-normal text-faint">{n}</span>}
          </Link>
        ))}
      </nav>

      {view === "board" && <Board items={active} base={base} today={today} channelName={channelName} />}
      {view === "calendar" && <Calendar items={active} base={base} today={today} rawMonth={rawMonth} />}
      {view === "dropped" &&
        (dropped.length === 0 ? (
          <p className="mt-6 text-muted">Nothing dropped.</p>
        ) : (
          <ul className="mt-6 grid max-w-[880px] gap-2">
            {dropped.map((i) => (
              <li key={i.id} className="text-[15px]">
                <Link href={`${base}/${i.number}`} className="link">
                  C{i.number}, {i.title}
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

function whenLine(i: ContentItem, today: string) {
  if (i.stage === "live") return i.publish_on ? `Live since ${formatDay(i.publish_on)}` : "Live";
  if (i.stage === "scheduled" && i.publish_on) {
    return i.publish_on < today ? `Was due out ${formatDay(i.publish_on)}` : `Goes out ${formatDay(i.publish_on)}`;
  }
  if (i.stage === "approved") return i.publish_on ? `Planned for ${formatDay(i.publish_on)}` : "No date yet";
  if (i.due_on) return `Draft due ${formatDay(i.due_on)}`;
  return null;
}

function isLate(i: ContentItem, today: string) {
  if ((i.stage === "idea" || i.stage === "draft") && i.due_on) return i.due_on < today;
  if (i.stage === "scheduled" && i.publish_on) return i.publish_on < today;
  return false;
}

function Card({
  i,
  base,
  today,
  channelName,
}: {
  i: ContentItem;
  base: string;
  today: string;
  channelName: Map<string, string>;
}) {
  const wait = waitingForApproval(i);
  const late = isLate(i, today);
  const when = whenLine(i, today);
  const kind = [FORMAT_LABEL[i.format], i.series, i.channel_id ? channelName.get(i.channel_id) : null]
    .filter(Boolean)
    .join(", ");
  return (
    <li>
      <Link
        href={`${base}/${i.number}`}
        className={`block rounded-lg border p-4 transition-colors hover:border-ink ${
          wait ? "border-sand-line bg-sand" : "border-line bg-card"
        }`}
      >
        <p className="flex items-baseline gap-2">
          <span className="ref-mark text-[19px] leading-none">C{i.number}</span>
          <span className="text-[13px] text-muted">{kind}</span>
        </p>
        <p className="mt-1.5 text-[15px] font-semibold leading-snug">{i.title}</p>
        {wait && (
          <p className="mt-2 text-[13px]">
            <StateTag state="needs">Waiting for approval</StateTag>
          </p>
        )}
        {!wait && i.stage === "draft" && i.review_note && (
          <p className="mt-2 text-[13px] text-muted">Changes asked</p>
        )}
        {(i.owner || when) && (
          <p className="mt-2 text-[13px] text-muted">
            {[i.owner, when].filter(Boolean).join(", ")}
            {late && <span className="font-medium text-danger">. Late</span>}
          </p>
        )}
      </Link>
    </li>
  );
}

function Board({
  items,
  base,
  today,
  channelName,
}: {
  items: ContentItem[];
  base: string;
  today: string;
  channelName: Map<string, string>;
}) {
  if (items.length === 0) {
    return <p className="mt-6 text-muted">No ideas yet. Add the first one: a question an owner asked you this month is a good start.</p>;
  }
  const sortKey = (i: ContentItem) => i.publish_on ?? i.due_on ?? "9999";
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-5 md:gap-3">
      {STAGES.map((s) => {
        const list = items.filter((i) => i.stage === s.value).sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || a.number - b.number);
        return (
          <section key={s.value} aria-labelledby={`stage-${s.value}`} className="min-w-0">
            <h2 id={`stage-${s.value}`} className="flex items-center gap-2 border-b border-line pb-2 text-[15px] font-semibold">
              <StateDot state={CONTENT_STATE[s.value]} />
              {s.plural} <span className="font-normal text-faint">{list.length}</span>
            </h2>
            {list.length === 0 ? (
              <p className="mt-3 text-[13px] text-faint">Nothing here.</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {list.map((i) => (
                  <Card key={i.id} i={i} base={base} today={today} channelName={channelName} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

type Entry = { day: string; item: ContentItem; kind: "out" | "due" };

function entriesFor(items: ContentItem[]): Entry[] {
  const out: Entry[] = [];
  for (const i of items) {
    if (i.publish_on && (i.stage === "approved" || i.stage === "scheduled" || i.stage === "live")) {
      out.push({ day: i.publish_on, item: i, kind: "out" });
    } else if (i.due_on && (i.stage === "idea" || i.stage === "draft")) {
      out.push({ day: i.due_on, item: i, kind: "due" });
    }
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || a.item.number - b.item.number);
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Calendar({
  items,
  base,
  today,
  rawMonth,
}: {
  items: ContentItem[];
  base: string;
  today: string;
  rawMonth: string | string[] | undefined;
}) {
  const entries = entriesFor(items);
  const fallback =
    entries.find((e) => e.day >= today.slice(0, 7) + "-01")?.day.slice(0, 7) ?? today.slice(0, 7);
  const month = typeof rawMonth === "string" && /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : fallback;
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  const inMonth = entries.filter((e) => e.day.startsWith(month));
  const byDay = new Map<string, Entry[]>();
  for (const e of inMonth) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  const undated = items.filter((i) => !entriesFor([i]).length).length;

  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, d) => `${month}-${String(d + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const label = (e: Entry) => (e.kind === "due" ? "draft due" : e.item.stage === "live" ? "live" : "goes out");

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[22px] font-semibold tracking-[-0.01em]">{formatMonth(`${month}-01`)}</h2>
        <p className="flex gap-5 text-[15px]">
          <Link href={`${base}?view=calendar&month=${prev}`} className="link">
            Earlier
          </Link>
          <Link href={`${base}?view=calendar&month=${next}`} className="link">
            Later
          </Link>
        </p>
      </div>
      <p className="mt-1 text-sm text-muted">
        Drafts show on their due date, approved work on the day it goes out.
        {undated > 0 && ` ${undated} ${undated === 1 ? "item has" : "items have"} no date yet.`}
      </p>

      <div className="mt-4 hidden overflow-hidden rounded-lg border border-line bg-card md:block">
        <div className="grid grid-cols-7 border-b border-line text-[13px] font-medium text-muted">
          {WEEKDAYS.map((d) => (
            <span key={d} className="px-2.5 py-2">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, n) => (
            <div
              key={n}
              className={`min-h-[104px] border-line p-2 ${n % 7 !== 6 ? "border-r" : ""} ${n < cells.length - 7 ? "border-b" : ""} ${
                day === null ? "bg-wash/60" : ""
              }`}
            >
              {day && (
                <>
                  <p className={`text-[13px] ${day === today ? "font-semibold text-ink" : "text-faint"}`}>
                    {Number(day.slice(8))}
                    {day === today && <span className="sr-only"> (today)</span>}
                  </p>
                  <ul className="mt-1 grid gap-1">
                    {(byDay.get(day) ?? []).map((e) => (
                      <li key={e.item.id + e.kind}>
                        <Link
                          href={`${base}/${e.item.number}`}
                          className={`block rounded px-1.5 py-1 text-[12px] leading-snug hover:bg-wash ${
                            e.kind === "due" ? "border border-dashed border-line-strong" : "bg-sky-wash"
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            <StateDot state={waitingForApproval(e.item) ? "needs" : CONTENT_STATE[e.item.stage]} />
                            <span className="font-medium">C{e.item.number}</span>
                            <span className="text-muted">{label(e)}</span>
                          </span>
                          <span className="mt-0.5 line-clamp-2 block">{e.item.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 md:hidden">
        {inMonth.length === 0 ? (
          <p className="text-muted">Nothing dated this month.</p>
        ) : (
          <ul className="grid gap-2">
            {inMonth.map((e) => (
              <li key={e.item.id + e.kind} className="text-[15px]">
                <span className="text-muted">{formatDay(e.day)}, {label(e)}: </span>
                <Link href={`${base}/${e.item.number}`} className="link">
                  C{e.item.number}, {e.item.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
        {STAGES.map((s) => (
          <StateTag key={s.value} state={CONTENT_STATE[s.value]}>
            {STAGE_LABEL[s.value]}
          </StateTag>
        ))}
        <StateTag state="needs">Waiting for approval</StateTag>
      </p>
    </div>
  );
}
