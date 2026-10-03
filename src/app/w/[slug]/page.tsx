import type { Metadata } from "next";
import Link from "next/link";
import { TaskTable } from "@/components/task-table";
import { CountUp, MiniColumns, Ring, SquareGrid, StatusBar, StatusLegend } from "@/components/viz";
import { AREA_LABEL, IMPACT_LABEL, getActions } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { firstName, formatWhen, getViewer, getWorkspace } from "@/lib/hq";
import { daysBetween, formatDay, todayInBeirut } from "@/lib/dates";
import { countStatuses, getPlan, getSections, isLate, type RoadmapItem } from "@/lib/plan";
import { ASSISTANT_LABEL, getVisibility } from "@/lib/visibility";
import { setTaskStatus } from "./plan/actions";

export const metadata: Metadata = { title: "Overview" };

const LAUNCH = "2026-12-01";
const PLAN_START = "2026-10-01";
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Beirut" }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const weekday = (iso: string) => WEEKDAYS[new Date(iso + "T12:00:00Z").getUTCDay()];

export default async function OverviewPage({ params }: PageProps<"/w/[slug]">) {
  const { slug } = await params;
  const [viewer, workspace] = await Promise.all([getViewer(), getWorkspace(slug)]);
  const supabase = await createClient();
  const today = todayInBeirut();
  const base = `/w/${workspace.slug}`;
  const canEdit = workspace.role === "owner" || workspace.role === "team";
  const studio = workspace.isStudio && canEdit;

  const [plan, { byKey: s }, { count: memberCount }, { data: activity }, queue, vis] = await Promise.all([
    getPlan(workspace.id),
    getSections(workspace.id, "plan"),
    supabase.from("members").select("user_id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    supabase
      .from("activity")
      .select("id, summary, via, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(6),
    getActions(workspace.id),
    studio ? getVisibility(workspace.id) : Promise.resolve(null),
  ]);
  const waiting = queue.byStatus.waiting;

  const thisWeek = plan.tasks.filter((t) => t.this_week);
  const lateAll = plan.tasks.filter((t) => isLate(t, today));
  const late = plan.tasks.filter((t) => !t.this_week && isLate(t, today));
  const comingUp = plan.tasks
    .filter((t) => !t.this_week && t.status !== "done" && !isLate(t, today))
    .slice(0, 6);
  const decisionsDue = plan.openDecisions
    .filter((d) => d.due_on && daysBetween(today, d.due_on) <= 21)
    .sort((a, b) => (a.due_on ?? "").localeCompare(b.due_on ?? ""));
  const daysToLaunch = daysBetween(today, LAUNCH);
  const wsById = new Map(plan.workstreams.map((w) => [w.id, w]));
  const save = canEdit ? setTaskStatus.bind(null, slug) : undefined;

  const all = countStatuses(plan.tasks);
  const total = plan.tasks.length;
  const streams = plan.workstreams.map((w) => {
    const tasks = plan.tasks.filter((t) => t.workstream_id === w.id);
    return { w, counts: countStatuses(tasks), total: tasks.length };
  });

  // What needs a person today, in one sentence.
  const thisWeekOpen = thisWeek.filter((t) => t.status !== "done").length;
  const dueSoon = plan.openDecisions.filter((d) => d.due_on && daysBetween(today, d.due_on) <= 7).length;
  const asks = [
    waiting.length > 0 && {
      href: `${base}/actions`,
      text: `${waiting.length} ${waiting.length === 1 ? "finding waits" : "findings wait"} for a decision`,
    },
    dueSoon > 0 && {
      href: `${base}/plan#decisions`,
      text: `${dueSoon} ${dueSoon === 1 ? "decision is" : "decisions are"} due within a week`,
    },
    thisWeekOpen > 0 && {
      href: `${base}/plan#this-week`,
      text: `${thisWeekOpen} of this week's ${thisWeek.length} tasks are still open`,
    },
    lateAll.length > 0 && { href: `${base}/plan`, text: `${lateAll.length} late` },
  ].filter(Boolean) as { href: string; text: string }[];
  const left = total - all.done;
  const leftPct = total > 0 ? Math.round((left / total) * 100) : 0;

  // Visibility, studio only: weeks in date order, and buyer prompts that name us in the latest AI check.
  const weeks = vis ? [...vis.google].reverse().slice(-13) : [];
  const clicks13 = weeks.reduce((n, w) => n + w.clicks, 0);
  const nonbrand13 = weeks.reduce((n, w) => n + (w.nonbrand_clicks ?? 0), 0);
  const aiPrompts = new Map<number, string>();
  for (const a of vis?.answers ?? []) {
    if (a.kind !== "discovery" || !a.named) continue;
    const who = ASSISTANT_LABEL[a.assistant];
    const cur = aiPrompts.get(a.prompt_no);
    if (!cur) aiPrompts.set(a.prompt_no, who);
    else if (!cur.includes(who)) aiPrompts.set(a.prompt_no, `${cur} and ${who}`);
  }
  const aiNamed = aiPrompts.size;

  return (
    <div className="max-w-[1120px]">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <h1 className="page-title">
          {greeting()}
          {viewer.name ? (
            <>
              , <span className="font-serif italic font-normal">{firstName(viewer)}</span>
            </>
          ) : null}
        </h1>
        <p className="pb-1.5 text-[15px] text-muted">
          {weekday(today)} {formatDay(today)}
        </p>
      </div>
      <p className="mt-3 max-w-[70ch] text-[17px] leading-relaxed text-muted">
        {asks.length === 0 ? (
          "Nothing waits for you today."
        ) : (
          <>
            Today:{" "}
            {asks.map((a, i) => (
              <span key={a.href + i}>
                {i > 0 ? (i === asks.length - 1 ? " and " : ", ") : ""}
                <Link href={a.href} className="link text-ink">
                  {a.text}
                </Link>
              </span>
            ))}
            .
          </>
        )}
      </p>

      {daysToLaunch > 0 && (
        <section
          aria-label="Launch"
          className="rise-in mt-8 grid items-center gap-x-12 gap-y-7 rounded-[20px] bg-blue px-6 py-7 text-white sm:px-9 sm:py-8 lg:grid-cols-[auto_1fr]"
        >
          <p className="flex items-baseline gap-4">
            <span className="text-[72px] font-semibold leading-[0.9] tracking-[-0.045em] sm:text-[88px]">
              <CountUp value={daysToLaunch} delay={150} />
            </span>
            <span className="max-w-[15ch] text-[17px] leading-snug text-white/85">
              days until livbrid.com goes live on 1 December
            </span>
          </p>
          <Runway roadmap={plan.roadmap} today={today} />
        </section>
      )}

      <section aria-label="At a glance" className={`mt-4 grid gap-4 sm:grid-cols-2 ${studio ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <Tile href={`${base}/plan`} label="The plan" delay={60}>
          <div className="flex items-center gap-5">
            <Ring value={all.done} total={total} label="Tasks done" delay={250} />
            <div>
              <p className="text-[34px] font-semibold leading-none tracking-[-0.03em]">
                <CountUp value={left} delay={250} />
                <span className="text-[15px] font-normal text-muted"> to go</span>
              </p>
              <p className="mt-1.5 text-[13px] leading-snug text-muted">
                {leftPct}% of {total} tasks left, {all.in_progress} in progress
                {lateAll.length > 0 ? (
                  <>
                    , <span className="font-medium text-danger">{lateAll.length} late</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </Tile>

        <Tile href={`${base}/actions`} label="Waiting for a decision" delay={120}>
          <div className="flex items-end justify-between gap-3">
            <p className="text-[44px] font-semibold leading-none tracking-[-0.03em]">
              <CountUp value={waiting.length} delay={300} />
            </p>
            {waiting.length > 0 && (
              <SquareGrid
                columns={Math.min(5, waiting.length)}
                size={16}
                label={`Waiting findings by impact: ${waiting.map((a) => `A${a.number} ${IMPACT_LABEL[a.impact].toLowerCase()}`).join(", ")}`}
                items={waiting.slice(0, 10).map((a) => ({
                  key: a.id,
                  on: a.impact === "high",
                  tip: `A${a.number}, ${IMPACT_LABEL[a.impact].toLowerCase()}: ${a.title}`,
                }))}
              />
            )}
          </div>
          <p className="mt-2 text-[13px] text-muted">
            {waiting.length === 0
              ? "Nothing in the action queue"
              : `${waiting.filter((a) => a.impact === "high").length} high impact (dark squares), ${waiting.filter((a) => a.source === "claude").length} from Claude`}
          </p>
        </Tile>

        {studio && vis ? (
          <>
            <Tile href={`${base}/visibility#google`} label="Google clicks, last 13 weeks" delay={180}>
              <div className="flex items-end justify-between gap-3">
                <p className="text-[44px] font-semibold leading-none tracking-[-0.03em]">
                  <CountUp value={clicks13} delay={350} />
                </p>
                <MiniColumns
                  points={weeks.map((w) => ({ key: w.week_of, label: `week of ${formatDay(w.week_of)}`, value: w.clicks }))}
                  unit={["click", "clicks"]}
                  label={`Clicks per week: ${weeks.map((w) => w.clicks).join(", ")}`}
                />
              </div>
              <p className="mt-2 text-[13px] text-muted">{nonbrand13} from searches without our name</p>
            </Tile>
            <Tile href={`${base}/visibility#ai`} label="AI answers that name us" delay={240}>
              <div className="flex items-end justify-between gap-3">
                <p className="text-[44px] font-semibold leading-none tracking-[-0.03em]">
                  <CountUp value={aiNamed} delay={400} />
                  <span className="text-[17px] font-normal text-muted"> of 20</span>
                </p>
                <SquareGrid
                  columns={10}
                  size={10}
                  label={`Buyer prompts that name LIVBRID: ${aiNamed} of 20`}
                  items={Array.from({ length: 20 }, (_, i) => {
                    const no = i + 1;
                    const hit = aiPrompts.get(no);
                    return {
                      key: String(no),
                      on: Boolean(hit),
                      tip: hit ? `Prompt ${no}: named by ${hit}` : `Prompt ${no}: not named`,
                    };
                  })}
                />
              </div>
              <p className="mt-2 text-[13px] text-muted">buyer prompts, one square each</p>
            </Tile>
          </>
        ) : (
          <Tile href={`${base}/plan#decisions`} label="Decisions due soon" delay={180}>
            <p className="text-[44px] font-semibold leading-none tracking-[-0.03em]">
              <CountUp value={decisionsDue.length} delay={350} />
            </p>
            <p className="mt-2 text-[13px] text-muted">in the next three weeks</p>
          </Tile>
        )}
      </section>

      {streams.length > 0 && (
        <section className="mt-12" aria-labelledby="ws-h">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h2 id="ws-h" className="text-lg font-semibold">
              Where the plan stands
            </h2>
            <StatusLegend />
          </div>
          <ul className="mt-4 grid gap-1">
            {streams.map(({ w, counts, total: n }, i) => (
              <li key={w.id}>
                <Link
                  href={`${base}/plan#ws-${w.number}`}
                  className="group grid items-center gap-x-5 gap-y-1.5 rounded-lg px-3 py-2.5 -mx-3 hover:bg-card sm:grid-cols-[minmax(0,300px)_1fr_auto]"
                >
                  <span className="flex min-w-0 items-baseline gap-3">
                    <span className="ref-mark w-5 shrink-0 text-[20px] leading-none">{w.number}</span>
                    <span className="truncate text-[15px] group-hover:underline group-hover:underline-offset-4">{w.title}</span>
                  </span>
                  <StatusBar counts={counts} label={`Workstream ${w.number}`} delay={120 + i * 60} />
                  <span className="flex items-baseline justify-end gap-2 text-right whitespace-nowrap sm:w-[13ch]">
                    <span className="text-[15px] font-semibold">{n > 0 ? Math.round((counts.done / n) * 100) : 0}%</span>
                    <span className="text-[13px] text-muted">{n - counts.done} left</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(decisionsDue.length > 0 || waiting.length > 0) && (
        <div className="mt-12 grid gap-10 lg:grid-cols-2">
          {decisionsDue.length > 0 && (
            <section aria-labelledby="dec-h">
              <div className="flex items-baseline justify-between">
                <h2 id="dec-h" className="text-lg font-semibold">
                  Decisions due
                </h2>
                <Link href={`${base}/plan#decisions`} className="link text-sm">
                  All decisions
                </Link>
              </div>
              <ul className="mt-3 grid gap-2">
                {decisionsDue.map((d) => {
                  const overdue = d.due_on! < today;
                  return (
                    <li key={d.id}>
                      <Link
                        href={`${base}/plan#${d.code?.toLowerCase()}`}
                        className="flex items-start gap-4 rounded-xl border border-line bg-card p-4 transition-colors hover:border-ink"
                      >
                        <span className="font-serif text-[26px] italic leading-none">{d.code}</span>
                        <span className="flex-1">
                          <span className="block font-medium">{d.title}</span>
                          <span className={`mt-0.5 block text-sm ${overdue ? "text-danger" : "text-muted"}`}>
                            Due {formatDay(d.due_on)}
                            {overdue ? ", late" : ""}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {waiting.length > 0 && (
            <section aria-labelledby="aq-h">
              <div className="flex items-baseline justify-between">
                <h2 id="aq-h" className="text-lg font-semibold">
                  Waiting for a decision
                </h2>
                <Link href={`${base}/actions`} className="link text-sm">
                  {waiting.length > 4 ? `All ${waiting.length}` : "Action queue"}
                </Link>
              </div>
              <ul className="mt-3 grid gap-2">
                {waiting.slice(0, 4).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`${base}/actions#a${a.number}`}
                      className="flex items-start gap-4 rounded-xl border border-line bg-card p-4 transition-colors hover:border-ink"
                    >
                      <span className="font-serif text-[26px] italic leading-none">A{a.number}</span>
                      <span className="flex-1">
                        <span className="block font-medium">{a.title}</span>
                        <span className="mt-0.5 block text-sm text-muted">
                          {AREA_LABEL[a.area]}, {IMPACT_LABEL[a.impact].toLowerCase()}
                          {a.source === "claude" ? ", from Claude" : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <section className="mt-12" aria-labelledby="week-h">
        <div className="flex items-baseline justify-between">
          <h2 id="week-h" className="text-lg font-semibold">
            {s["this-week"]?.title ?? "This week"}
          </h2>
          <Link href={`${base}/plan#this-week`} className="link text-sm">
            Open the plan
          </Link>
        </div>
        <div className="mt-3">
          <TaskTable tasks={thisWeek} today={today} save={save} workstreams={plan.workstreams} />
        </div>
      </section>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-card p-6" aria-labelledby="next-h">
          <h2 id="next-h" className="text-lg font-semibold">
            Coming up
          </h2>
          {late.length > 0 && (
            <p className="mt-1 text-sm text-danger">
              {late.length} {late.length === 1 ? "task is" : "tasks are"} late.{" "}
              <Link href={`${base}/plan`} className="underline underline-offset-4">
                See the plan
              </Link>
            </p>
          )}
          <ul className="mt-3 divide-y divide-line">
            {comingUp.map((t) => {
              const ws = t.workstream_id ? wsById.get(t.workstream_id) : undefined;
              return (
                <li key={t.id} className="flex items-baseline justify-between gap-4 py-3">
                  <span>
                    {t.title}
                    <span className="block text-[13px] text-faint">
                      {[t.owner, ws ? `${ws.number}. ${ws.title}` : null].filter(Boolean).join(", ")}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-sm text-muted">{formatDay(t.due_on)}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-card p-6" aria-labelledby="activity-h">
          <div className="flex items-baseline justify-between">
            <h2 id="activity-h" className="text-lg font-semibold">
              Latest changes
            </h2>
            <Link href={`${base}/activity`} className="link text-sm">
              All activity
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {(activity ?? []).map((a) => (
              <li key={a.id} className="py-3">
                <span className="line-clamp-2">{a.summary}</span>
                <span className="mt-0.5 block text-[13px] text-faint">
                  {formatWhen(a.created_at)}
                  {a.via === "claude" ? ", through Claude" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {workspace.role === "owner" && memberCount === 1 && (
        <p className="mt-10 text-sm text-muted">
          You&apos;re the only one here for now.{" "}
          <Link href={`${base}/people`} className="link">
            Invite Tony and Moe
          </Link>{" "}
          once email sending is set up.
        </p>
      )}
    </div>
  );
}

function Tile({
  href,
  label,
  delay = 0,
  children,
}: {
  href: string;
  label: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{ ["--d" as string]: `${delay}ms` }}
      className="rise-in group flex flex-col justify-between gap-4 rounded-[20px] border border-line bg-card p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-ink hover:shadow-[0_10px_30px_-18px_rgba(17,17,17,0.35)]"
    >
      <p className="text-[13px] font-medium text-muted group-hover:text-ink">{label}</p>
      <div>{children}</div>
    </Link>
  );
}

/** The road to launch: time gone in ink, time left as the track, milestones as dots. */
function Runway({ roadmap, today }: { roadmap: RoadmapItem[]; today: string }) {
  const span = Math.max(1, daysBetween(PLAN_START, LAUNCH));
  const at = (iso: string) => Math.min(100, Math.max(0, (daysBetween(PLAN_START, iso) / span) * 100));
  const byDate = new Map<string, string[]>();
  for (const r of roadmap) {
    if (r.key === "launch" || r.ends_on < PLAN_START || r.ends_on >= LAUNCH) continue;
    byDate.set(r.ends_on, [...(byDate.get(r.ends_on) ?? []), r.label]);
  }
  const milestones = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  const next = milestones.find(([d]) => d >= today);
  const now = at(today);

  // Drawn on the blue launch card: white for what's done and today, a pale line for what's left.
  const onBlue = { track: "rgba(255,255,255,0.28)", done: "#ffffff", ahead: "rgba(255,255,255,0.7)", blue: "#2447E0" };
  return (
    <div className="min-w-0">
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full" style={{ background: onBlue.track }} />
        <div
          className="viz-reveal absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full"
          style={{ width: `${now}%`, background: onBlue.done, ["--d" as string]: "300ms" }}
        />
        {milestones.map(([d, labels]) => (
          <span
            key={d}
            tabIndex={0}
            data-tip={`${labels.join(" and ")}, ${formatDay(d)}`}
            data-tip-align={at(d) > 75 ? "end" : at(d) < 25 ? "start" : undefined}
            className="viz-tip absolute top-1/2 size-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${at(d)}%`,
              background: d < today ? onBlue.done : onBlue.blue,
              boxShadow: `inset 0 0 0 2px ${d < today ? onBlue.done : onBlue.ahead}`,
            }}
          />
        ))}
        <span
          tabIndex={0}
          data-tip={`Today, ${formatDay(today)}`}
          data-tip-align={now < 25 ? "start" : undefined}
          className="viz-tip absolute top-1/2 size-[16px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${now}%`, background: onBlue.done, boxShadow: `0 0 0 4px ${onBlue.blue}` }}
        />
        <span
          tabIndex={0}
          data-tip="livbrid.com goes live, 1 December"
          data-tip-align="end"
          className="viz-tip absolute right-0 top-1/2 size-[14px] translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[3px]"
          style={{ background: onBlue.done }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[12px] text-white/70">
        <span>1 October</span>
        <span>1 December</span>
      </div>
      {next && (
        <p className="mt-4 text-[15px]">
          <span className="text-white/70">Next:</span> {next[1].join(" and ")}, by {weekday(next[0])} {formatDay(next[0])}
        </p>
      )}
    </div>
  );
}
