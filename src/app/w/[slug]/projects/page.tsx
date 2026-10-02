import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/hq";
import {
  PROFIT_RANGE,
  PROJECT_OPTIONS,
  SOURCE,
  STATUS_LABEL,
  getMoney,
  getProjects,
  totals,
  usd,
  type Project,
  type ProjectStatus,
} from "@/lib/projects";
import { todayInBeirut } from "@/lib/dates";
import { ProjectForm } from "./project-form";

export const metadata: Metadata = { title: "Projects" };

type Tab = "active" | "delivered" | "closed" | "lost" | "all";

const TABS: { key: Tab; label: string; statuses: ProjectStatus[] | null }[] = [
  { key: "active", label: "Active", statuses: ["signed", "in_progress"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  { key: "closed", label: "Closed", statuses: ["closed"] },
  { key: "lost", label: "Lost pitches", statuses: ["lost"] },
  { key: "all", label: "All", statuses: null },
];

const EMPTY: Record<Tab, string> = {
  active: "Nothing signed or in progress. A won proposal, or a project added here, shows up in this list.",
  delivered: "Nothing delivered and waiting to close.",
  closed: "No closed projects yet.",
  lost: "No lost pitches recorded. When we lose one, write down what they said and why we think we lost.",
  all: "No projects yet.",
};

export default async function ProjectsPage({ params, searchParams }: PageProps<"/w/[slug]/projects">) {
  const { slug } = await params;
  const { show } = await searchParams;
  const workspace = await getWorkspace(slug);
  if (!workspace.isStudio) notFound();
  const canEdit = workspace.role === "owner" || workspace.role === "team";
  if (!canEdit) notFound();
  const isOwner = workspace.role === "owner";

  const tab = TABS.find((t) => t.key === show) ?? TABS[0];
  const base = `/w/${slug}/projects`;

  const [projects, money] = await Promise.all([
    getProjects(workspace.id),
    isOwner ? getMoney(workspace.id) : Promise.resolve(null),
  ]);
  const inTab = (t: (typeof TABS)[number]) => projects.filter((p) => !t.statuses || t.statuses.includes(p.status));
  const list = inTab(tab);

  return (
    <div className="max-w-[1040px]">
      <h1 className="page-title">Projects</h1>
      <p className="page-intro">
        Every project from signed to closed: what they asked for, what they really needed, what we deliver, and
        the facts when it closes. Lost pitches stay here too, with the reason.
      </p>

      {isOwner && money && <OwnerSummary projects={projects} money={money} />}

      <details className="mt-8">
        <summary className="btn btn-secondary w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          Add a project
        </summary>
        <div className="card mt-3 p-5 sm:p-7">
          <ProjectForm
            slug={slug}
            projectId={null}
            values={{ status: "signed", year: Number(todayInBeirut().slice(0, 4)) }}
            options={PROJECT_OPTIONS}
            submitLabel="Add the project"
          />
        </div>
      </details>

      <nav aria-label="Show" className="mt-8 flex flex-wrap gap-x-6 gap-y-1 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "active" ? base : `${base}?show=${t.key}`}
            aria-current={t.key === tab.key ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2.5 text-[15px] ${
              t.key === tab.key ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label} <span className="font-normal text-faint">{inTab(t).length}</span>
          </Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <p className="mt-6 text-muted">{EMPTY[tab.key]}</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="hq-table w-full min-w-[720px] text-left text-[15px]">
            <thead>
              <tr>
                <th className="w-[56px]">
                  <span className="sr-only">Number</span>
                </th>
                <th>Client</th>
                <th>What we deliver</th>
                <th className="w-[70px]">Year</th>
                <th className="w-[120px] text-right">Price</th>
                {tab.key === "all" && <th className="w-[110px]">Status</th>}
                {isOwner && <th className="w-[150px]">Profit</th>}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <Row
                  key={p.id}
                  p={p}
                  href={`${base}/${p.number}`}
                  showStatus={tab.key === "all"}
                  profit={isOwner && money ? profitFor(p, money) : null}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ p, href, showStatus, profit }: { p: Project; href: string; showStatus: boolean; profit: string | null }) {
  return (
    <tr className="border-b border-line align-top">
      <td className="px-4 py-3.5">
        <span className="ref-mark text-[22px] leading-none">P{p.number}</span>
      </td>
      <td className="px-4 py-3.5">
        <Link href={href} className="link font-medium">
          {p.client}
        </Link>
        <span className="mt-0.5 block text-[13px] text-muted">
          {[p.sector, p.source ? SOURCE[p.source] : null].filter(Boolean).join(", ")}
        </span>
      </td>
      <td className="max-w-[340px] px-4 py-3.5 text-muted">
        <span className="line-clamp-2">{p.deliverables ?? p.brief ?? ""}</span>
      </td>
      <td className="px-4 py-3.5 text-muted">{p.year ?? ""}</td>
      <td className="px-4 py-3.5 text-right whitespace-nowrap">{usd(p.price_usd)}</td>
      {showStatus && <td className="px-4 py-3.5 text-muted">{STATUS_LABEL[p.status]}</td>}
      {profit !== null && <td className="px-4 py-3.5 text-muted">{profit}</td>}
    </tr>
  );
}

type Money = Awaited<ReturnType<typeof getMoney>>;

/** What's left after outside costs when payments are recorded, else the range from the audit. */
function profitFor(p: Project, money: Money) {
  const lines = money.lines.filter((l) => l.project_id === p.id);
  const hours = money.hours.filter((h) => h.project_id === p.id);
  if (lines.some((l) => l.kind === "paid")) return `${usd(totals(lines, hours).left)} left`;
  const range = money.private.find((r) => r.project_id === p.id)?.profit_range;
  return range ? PROFIT_RANGE[range] : "";
}

/** Owner only: the money across all projects. Row level security keeps it from the Team. */
function OwnerSummary({ projects, money }: { projects: Project[]; money: Money }) {
  const year = Number(todayInBeirut().slice(0, 4));
  const won = projects.filter((p) => p.status !== "lost");
  const thisYear = won.filter((p) => p.year === year);
  const signedThisYear = thisYear.reduce((s, p) => s + (p.price_usd ?? 0), 0);
  const t = totals(money.lines, money.hours);
  const ranges = Object.entries(PROFIT_RANGE)
    .map(([k, label]) => [label, money.private.filter((r) => r.profit_range === k).length] as const)
    .filter(([, n]) => n > 0);

  const figures: [string, string][] = [
    [`Signed in ${year}`, `${usd(signedThisYear)}`],
    ["Invoiced", usd(t.invoiced)],
    ["Paid", usd(t.paid)],
    ["Still owed", usd(t.owed)],
    ["Outside costs", usd(t.costs)],
  ];

  return (
    <section aria-labelledby="money-title" className="mt-8 border-y border-line py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="money-title" className="text-[15px] font-semibold">
          Money
        </h2>
        <p className="text-[13px] text-muted">Only the Owner sees this part of the page.</p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
        {figures.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[13px] text-muted">{label}</dt>
            <dd className="mt-1 text-[20px] font-semibold tracking-[-0.01em]">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 max-w-[72ch] text-[14px] leading-relaxed text-muted">
        {money.lines.length === 0
          ? "No invoices or payments recorded yet. Add them on each project as they happen. "
          : ""}
        {ranges.length > 0 &&
          `Profit from the audit, ${money.private.filter((r) => r.profit_range).length} projects: ${ranges
            .map(([label, n]) => `${label.toLowerCase()} ${n}`)
            .join(", ")}.`}
        {` ${thisYear.length} ${thisYear.length === 1 ? "project" : "projects"} signed in ${year}.`}
      </p>
    </section>
  );
}
