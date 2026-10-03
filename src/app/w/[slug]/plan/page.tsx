import type { Metadata } from "next";
import Link from "next/link";
import { Md } from "@/components/markdown";
import { RoadmapChart } from "@/components/roadmap-chart";
import { TaskTable } from "@/components/task-table";
import { getWorkspace } from "@/lib/hq";
import { daysBetween, formatDay, todayInBeirut } from "@/lib/dates";
import { countStatuses, getPlan, getSections } from "@/lib/plan";
import { Ring, StatusBar, StatusLegend } from "@/components/viz";
import { setTaskStatus } from "./actions";

export const metadata: Metadata = { title: "Plan" };

const LAUNCH = "2026-12-01";

export default async function PlanPage({ params }: PageProps<"/w/[slug]/plan">) {
  const { slug } = await params;
  const workspace = await getWorkspace(slug);
  const [{ byKey: s }, plan] = await Promise.all([getSections(workspace.id, "plan"), getPlan(workspace.id)]);
  const today = todayInBeirut();
  const canEdit = workspace.role === "owner" || workspace.role === "team";
  const save = canEdit ? setTaskStatus.bind(null, slug) : undefined;

  const thisWeek = plan.tasks.filter((t) => t.this_week);
  const byWorkstream = new Map<string, typeof plan.tasks>();
  for (const t of plan.tasks) {
    if (!t.workstream_id) continue;
    byWorkstream.set(t.workstream_id, [...(byWorkstream.get(t.workstream_id) ?? []), t]);
  }
  const daysToLaunch = daysBetween(today, LAUNCH);
  const all = countStatuses(plan.tasks);

  return (
    <div className="max-w-[1040px]">
      <h1 className="page-title">
        {s.intro?.title ?? "Plan"}
      </h1>
      <Md className="page-intro">{s.intro?.body_md}</Md>
      <section
        aria-label="Progress"
        className="mt-8 grid items-center gap-x-8 gap-y-5 rounded-2xl border border-line bg-card p-6 sm:grid-cols-[auto_1fr]"
      >
        <Ring value={all.done} total={plan.tasks.length} size={96} label="Tasks done" />
        <div className="min-w-0">
          <p className="text-[17px]">
            <span className="font-semibold">
              {all.done} of {plan.tasks.length} tasks done,{" "}
              {plan.tasks.length > 0 ? Math.round(((plan.tasks.length - all.done) / plan.tasks.length) * 100) : 0}% still to
              do.
            </span>{" "}
            <span className="text-muted">
              {all.in_progress} in progress, {all.waiting} waiting, {all.not_started} not started.{" "}
              {daysToLaunch > 0 ? `${daysToLaunch} days to launch, ` : ""}
              {plan.openDecisions.length} open {plan.openDecisions.length === 1 ? "decision" : "decisions"}.
            </span>
          </p>
          <div className="mt-4">
            <StatusBar counts={all} label="All tasks" height={10} delay={100} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <StatusLegend />
            <Link href={`/w/${slug}/scorecard`} className="link text-sm">
              The 2027 goal and scorecard
            </Link>
          </div>
        </div>
      </section>

      <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-y border-line py-3 text-sm">
        <a href="#this-week" className="link">This week</a>
        <a href="#decisions" className="link">Decisions</a>
        <a href="#roadmap" className="link">Roadmap</a>
        {plan.workstreams.map((w) => (
          <a key={w.id} href={`#ws-${w.number}`} className="link">
            {w.number}. {w.title.split(":")[0]}
          </a>
        ))}
        <a href="#decision-log" className="link">Decision log</a>
      </nav>

      <section id="this-week" className="mt-12 scroll-mt-6">
        <h2 className="text-[24px] font-semibold tracking-[-0.01em]">{s["this-week"]?.title ?? "This week"}</h2>
        <Md className="mt-2 text-muted">{s["this-week"]?.body_md}</Md>
        <div className="mt-5">
          <TaskTable tasks={thisWeek} today={today} save={save} workstreams={plan.workstreams} />
        </div>
      </section>

      <section id="decisions" className="mt-14 scroll-mt-6">
        <h2 className="text-[24px] font-semibold tracking-[-0.01em]">{s.decisions?.title ?? "Decisions"}</h2>
        <Md className="mt-2 text-muted">{s.decisions?.body_md}</Md>
        <div className="mt-5 grid gap-3">
          {plan.openDecisions.map((d) => {
            const late = d.due_on && d.due_on < today;
            return (
              <article
                key={d.id}
                id={d.code?.toLowerCase() ?? d.id}
                className="scroll-mt-6 rounded-lg border border-line bg-card p-5 target:border-ink target:ring-1 target:ring-ink sm:grid sm:grid-cols-[64px_1fr_auto] sm:gap-5"
              >
                <p className="font-serif text-[30px] italic leading-none">{d.code}</p>
                <div className="mt-2 sm:mt-0">
                  <h3 className="text-[17px] font-semibold">{d.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
                    <span className="font-medium text-ink">Recommendation: </span>
                    {d.recommendation}
                  </p>
                </div>
                <p className={`mt-3 whitespace-nowrap text-sm sm:mt-0 sm:text-right ${late ? "text-danger font-medium" : "text-muted"}`}>
                  Due {formatDay(d.due_on)}
                  {late && <span className="block">Late</span>}
                </p>
              </article>
            );
          })}
        </div>
        {s.decisions?.summary && <p className="mt-3 text-sm text-muted">{s.decisions.summary}</p>}
      </section>

      <section id="roadmap" className="mt-14 scroll-mt-6">
        <h2 className="text-[24px] font-semibold tracking-[-0.01em]">{s.roadmap?.title ?? "Roadmap"}</h2>
        <Md className="mt-2 mb-5 text-muted">{s.roadmap?.body_md}</Md>
        <RoadmapChart items={plan.roadmap} today={today} />
      </section>

      {plan.workstreams.map((w) => {
        const tasks = byWorkstream.get(w.id) ?? [];
        const counts = countStatuses(tasks);
        return (
          <section key={w.id} id={`ws-${w.number}`} className="mt-14 scroll-mt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="flex items-baseline gap-3 text-[24px] font-semibold tracking-[-0.01em]">
                <span className="ref-mark text-[32px] leading-none">{w.number}</span>
                <span>{w.title}</span>
              </h2>
              <p className="text-sm text-muted">
                <span className="font-semibold text-ink">
                  {tasks.length > 0 ? Math.round((counts.done / tasks.length) * 100) : 0}% done
                </span>
                , {tasks.length - counts.done} of {tasks.length} left
              </p>
            </div>
            <div className="mt-3 max-w-[560px]">
              <StatusBar counts={counts} label={`Workstream ${w.number}`} height={6} />
            </div>
            <Md className="mt-2 text-muted">{w.summary_md}</Md>
            {w.extra_md && <Md className="mt-4">{w.extra_md}</Md>}
            <div className="mt-5">
              <TaskTable tasks={tasks} today={today} save={save} />
            </div>
          </section>
        );
      })}

      <section id="decision-log" className="mt-14 scroll-mt-6">
        <h2 className="text-[24px] font-semibold tracking-[-0.01em]">Decision log</h2>
        <p className="mt-2 text-muted">Decisions already made, newest first.</p>
        <div className="mt-5 overflow-x-auto rounded-lg border border-line bg-card">
          <table className="w-full text-left text-[15px]">
            <thead className="text-[13px] text-muted">
              <tr>
                <th scope="col" className="px-4 pt-3 pb-2.5 font-medium border-b border-line">Decision</th>
                <th scope="col" className="px-4 pt-3 pb-2.5 font-medium border-b border-line whitespace-nowrap">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {plan.decided.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 align-top">
                    {d.code && <span className="mr-2 font-semibold">{d.code}</span>}
                    {d.title}
                    {d.outcome && <span className="mt-1 block text-muted">{d.outcome}</span>}
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-muted">
                    {d.decided_on ? formatDay(d.decided_on, { withYear: true }) : d.decided_label}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <details id="how-to-use" className="mt-14 rounded-lg border border-line bg-card p-5">
        <summary className="cursor-pointer font-semibold">{s["how-to-use"]?.title ?? "How to use this plan"}</summary>
        <Md className="mt-3">{s["how-to-use"]?.body_md}</Md>
      </details>
    </div>
  );
}
