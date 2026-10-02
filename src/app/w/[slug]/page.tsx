import type { Metadata } from "next";
import Link from "next/link";
import { TaskTable } from "@/components/task-table";
import { AREA_LABEL, IMPACT_LABEL, getActions } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { firstName, formatWhen, getViewer, getWorkspace } from "@/lib/hq";
import { daysBetween, formatDay, todayInBeirut } from "@/lib/dates";
import { getPlan, getSections, isLate } from "@/lib/plan";
import { setTaskStatus } from "./plan/actions";

export const metadata: Metadata = { title: "Overview" };

const LAUNCH = "2026-12-01";

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Beirut" }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function OverviewPage({ params }: PageProps<"/w/[slug]">) {
  const { slug } = await params;
  const [viewer, workspace] = await Promise.all([getViewer(), getWorkspace(slug)]);
  const supabase = await createClient();
  const today = todayInBeirut();
  const base = `/w/${workspace.slug}`;
  const canEdit = workspace.role === "owner" || workspace.role === "team";

  const [plan, { byKey: s }, { count: memberCount }, { data: activity }, queue] = await Promise.all([
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
  ]);
  const waiting = queue.byStatus.waiting;

  const thisWeek = plan.tasks.filter((t) => t.this_week);
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

  return (
    <div className="max-w-[1080px]">
      <h1 className="page-title">
        {greeting()}
        {viewer.name ? (
          <>
            , <span className="font-serif italic font-normal">{firstName(viewer)}</span>
          </>
        ) : null}
      </h1>
      <p className="page-intro">
        {daysToLaunch > 0 ? (
          <>
            <span className="text-ink font-medium">{daysToLaunch} days</span> until livbrid.com goes live on 1 December.{" "}
          </>
        ) : null}
        {decisionsDue.length > 0
          ? `${decisionsDue.length} decisions are due soon, and ${thisWeek.filter((t) => t.status !== "done").length} tasks are open this week.`
          : `${thisWeek.filter((t) => t.status !== "done").length} tasks are open this week.`}
      </p>

      {decisionsDue.length > 0 && (
        <section className="mt-10" aria-labelledby="dec-h">
          <div className="flex items-baseline justify-between">
            <h2 id="dec-h" className="text-lg font-semibold">Decisions due</h2>
            <Link href={`${base}/plan#decisions`} className="link text-sm">All decisions</Link>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {decisionsDue.map((d) => {
              const overdue = d.due_on! < today;
              return (
                <li key={d.id}>
                  <Link
                    href={`${base}/plan#${d.code?.toLowerCase()}`}
                    className="flex h-full items-start gap-4 rounded-lg border border-line bg-card p-4 hover:border-ink"
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
        <section className="mt-10" aria-labelledby="aq-h">
          <div className="flex items-baseline justify-between">
            <h2 id="aq-h" className="text-lg font-semibold">Waiting for a decision</h2>
            <Link href={`${base}/actions`} className="link text-sm">
              {waiting.length > 4 ? `All ${waiting.length} in the action queue` : "Action queue"}
            </Link>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {waiting.slice(0, 4).map((a) => (
              <li key={a.id}>
                <Link
                  href={`${base}/actions#a${a.number}`}
                  className="flex h-full items-start gap-4 rounded-lg border border-line bg-card p-4 hover:border-ink"
                >
                  <span className="font-serif text-[26px] italic leading-none">A{a.number}</span>
                  <span className="flex-1">
                    <span className="block font-medium">{a.title}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {AREA_LABEL[a.area]} · {IMPACT_LABEL[a.impact]}
                      {a.source === "claude" ? " · from Claude" : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10" aria-labelledby="week-h">
        <div className="flex items-baseline justify-between">
          <h2 id="week-h" className="text-lg font-semibold">{s["this-week"]?.title ?? "This week"}</h2>
          <Link href={`${base}/plan#this-week`} className="link text-sm">Open the plan</Link>
        </div>
        <div className="mt-3">
          <TaskTable tasks={thisWeek} today={today} save={save} workstreams={plan.workstreams} />
        </div>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="card p-6" aria-labelledby="next-h">
          <h2 id="next-h" className="text-lg font-semibold">Coming up</h2>
          {late.length > 0 && (
            <p className="mt-1 text-sm text-danger">
              {late.length} {late.length === 1 ? "task is" : "tasks are"} late.{" "}
              <Link href={`${base}/plan`} className="underline underline-offset-4">See the plan</Link>
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
                      {t.owner}
                      {ws ? ` · ${ws.number}. ${ws.title}` : ""}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-sm text-muted">{formatDay(t.due_on)}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card p-6" aria-labelledby="activity-h">
          <div className="flex items-baseline justify-between">
            <h2 id="activity-h" className="text-lg font-semibold">Latest changes</h2>
            <Link href={`${base}/activity`} className="link text-sm">All activity</Link>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {(activity ?? []).map((a) => (
              <li key={a.id} className="py-3">
                <span className="line-clamp-2">{a.summary}</span>
                <span className="mt-0.5 block text-[13px] text-faint">
                  {formatWhen(a.created_at)}
                  {a.via === "claude" ? " · through Claude" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {workspace.role === "owner" && memberCount === 1 && (
        <p className="mt-10 text-sm text-muted">
          You&apos;re the only one here for now.{" "}
          <Link href={`${base}/people`} className="link">Invite Tony and Moe</Link> once email sending is set up.
        </p>
      )}
    </div>
  );
}
