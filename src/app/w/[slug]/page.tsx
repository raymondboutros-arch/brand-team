import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { firstName, formatWhen, getViewer, getWorkspace } from "@/lib/hq";
import { MODULES } from "@/lib/modules";

export const metadata: Metadata = { title: "Overview" };

const MILESTONES = [
  { label: "Setup, sign-in and workspaces", when: "Live", done: true },
  { label: "Plan, tasks, decisions and the action queue", when: "16 Oct" },
  { label: "Brand and channels", when: "23 Oct" },
  { label: "Content, scorecard and audit", when: "30 Oct" },
  { label: "Claude connector and Search Console", when: "13 Nov" },
  { label: "The two docs move into HQ", when: "16 Nov" },
  { label: "livbrid.com goes live", when: "1 Dec" },
];

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

  const [{ data: activity }, { count: memberCount }] = await Promise.all([
    supabase
      .from("activity")
      .select("id, summary, via, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("members").select("user_id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
  ]);

  const base = `/w/${workspace.slug}`;
  const docs = Array.from(
    new Map(MODULES.filter((m) => m.until).map((m) => [m.until!.href, m.until!])).values(),
  );

  return (
    <div className="max-w-[1080px]">
      <p className="eyebrow">{workspace.name}</p>
      <h1 className="mt-2 text-[34px] leading-[1.1] font-semibold tracking-[-0.015em]">
        {greeting()}, <span className="font-serif italic font-normal">{firstName(viewer)}</span>
      </h1>
      <p className="mt-3 max-w-[60ch] text-muted">
        HQ is being built one module a week. Each one is usable on the Friday it lands. Until then,
        the docs below stay the source of truth.
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <section className="card p-6" aria-labelledby="build-h">
          <h2 id="build-h" className="text-lg font-semibold">Build progress</h2>
          <ol className="mt-4 divide-y divide-line">
            {MILESTONES.map((m) => (
              <li key={m.label} className="flex items-center gap-3 py-3">
                <span
                  aria-hidden
                  className={`size-2.5 shrink-0 rounded-full ${m.done ? "bg-ink" : "border border-line-strong"}`}
                />
                <span className={`flex-1 ${m.done ? "font-medium" : "text-muted"}`}>{m.label}</span>
                <span className={`text-sm tabular-nums ${m.done ? "text-ok font-medium" : "text-faint"}`}>
                  {m.when}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <div className="flex flex-col gap-6">
          <section className="card p-6" aria-labelledby="docs-h">
            <h2 id="docs-h" className="text-lg font-semibold">Until then, work here</h2>
            <ul className="mt-3 space-y-2 prose-hq">
              {docs.map((d) => (
                <li key={d.href}>
                  <a href={d.href} target="_blank" rel="noreferrer">
                    {d.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-6" aria-labelledby="people-h">
            <h2 id="people-h" className="text-lg font-semibold">People</h2>
            <p className="mt-1 text-sm text-muted">
              {memberCount ?? 0} {memberCount === 1 ? "person has" : "people have"} access to {workspace.name}.
            </p>
            {workspace.role === "owner" ? (
              <Link href={`${base}/people`} className="btn btn-primary mt-4">
                Invite people
              </Link>
            ) : (
              <Link href={`${base}/people`} className="link mt-3 inline-block text-sm">
                See who’s here
              </Link>
            )}
          </section>
        </div>
      </div>

      <section className="mt-6 card p-6" aria-labelledby="activity-h">
        <div className="flex items-baseline justify-between">
          <h2 id="activity-h" className="text-lg font-semibold">Latest changes</h2>
          <Link href={`${base}/activity`} className="link text-sm">
            All activity
          </Link>
        </div>
        {activity && activity.length > 0 ? (
          <ul className="mt-3 divide-y divide-line">
            {activity.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                <span>
                  {a.summary}
                  {a.via === "claude" && <span className="ml-2 text-xs text-muted">through Claude</span>}
                </span>
                <span className="text-sm text-faint">{formatWhen(a.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">Nothing yet.</p>
        )}
      </section>
    </div>
  );
}
