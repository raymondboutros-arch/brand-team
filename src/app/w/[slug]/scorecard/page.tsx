import type { Metadata } from "next";
import { Md } from "@/components/markdown";
import { TargetBar } from "@/components/viz";
import { getWorkspace } from "@/lib/hq";
import { formatDay, formatMonth, todayInBeirut } from "@/lib/dates";
import { AUTO_FROM, AUTO_METRICS, getScorecard, getScorecardAuto, getSections } from "@/lib/plan";

export const metadata: Metadata = { title: "Scorecard" };

const TARGET_DATES = ["2026-12-31", "2027-03-31", "2027-06-30"];
const TARGET_SHORT: Record<string, string> = { "2026-12-31": "December", "2027-03-31": "March", "2027-06-30": "June" };

/** The number at the start of a value ("6 (Google 6, Clutch 0)" is 6), or null for words. */
function num(v: string | null | undefined) {
  if (!v) return null;
  const m = v.trim().match(/^-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** Placeholders written as [fill] show as quiet text, so real numbers stand out. */
function Value({ v }: { v: string | undefined | null }) {
  if (!v) return <span className="text-faint">·</span>;
  if (v.startsWith("[") && v.endsWith("]")) {
    const text = v.slice(1, -1);
    return <span className="text-faint italic">{text === "fill" ? "to fill" : text}</span>;
  }
  return <span className="tabular-nums">{v}</span>;
}

function months(from: string, to: string) {
  const out: string[] = [];
  const d = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

export default async function ScorecardPage({ params }: PageProps<"/w/[slug]/scorecard">) {
  const { slug } = await params;
  const workspace = await getWorkspace(slug);
  const thisMonth = todayInBeirut().slice(0, 8) + "01";
  const [{ byKey: s }, sc, auto] = await Promise.all([
    getSections(workspace.id, "plan"),
    getScorecard(workspace.id),
    workspace.isStudio ? getScorecardAuto(workspace.id, thisMonth) : Promise.resolve(new Map<string, string>()),
  ]);
  const isAuto = (key: string) => auto.size > 0 && (AUTO_METRICS as readonly string[]).includes(key);

  const goals = sc.metrics
    .filter((m) => m.goal_label)
    .sort((a, b) => (a.goal_position ?? 0) - (b.goal_position ?? 0));
  const target = (metricId: string, date: string) =>
    sc.targets.find((t) => t.metric_id === metricId && t.on_date === date)?.value;
  const stored = (metricId: string, month: string) =>
    sc.values.find((v) => v.metric_id === metricId && v.month === month);
  // From October 2026 the sales numbers come from Proposals and Projects, not by hand.
  const value = (metricId: string, month: string) => {
    const m = sc.metrics.find((x) => x.id === metricId);
    if (m && isAuto(m.key) && month >= AUTO_FROM && auto.has(`${m.key}|${month}`)) {
      return { value: auto.get(`${m.key}|${month}`)!, note: null };
    }
    return stored(metricId, month);
  };
  const now = (m: { id: string; key: string; baseline: string | null }) =>
    isAuto(m.key) && auto.has(`${m.key}|${thisMonth}`) ? auto.get(`${m.key}|${thisMonth}`)! : m.baseline;
  const rows = months("2026-09-01", "2027-06-01");

  return (
    <div className="max-w-[1040px]">
      <h1 className="page-title">Scorecard</h1>

      <section className="mt-8">
        <h2 className="text-[24px] font-semibold tracking-[-0.01em]">{s.goal?.title ?? "The goal"}</h2>
        <Md className="mt-2 text-muted">{s.goal?.body_md}</Md>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((m, i) => {
            const nowValue = num(now(m));
            const marks = TARGET_DATES.map((d) => ({ label: TARGET_SHORT[d], value: num(target(m.id, d)) })).filter(
              (t): t is { label: string; value: number } => t.value !== null,
            );
            return (
              <li key={m.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-line bg-card p-5">
                <p className="text-[14px] leading-snug text-muted">{m.goal_label}</p>
                <div>
                  <p className="text-[36px] font-semibold leading-none tracking-[-0.03em]">
                    {nowValue ?? <span className="text-[15px] font-normal text-faint">Not measured yet</span>}
                    {nowValue !== null && marks.length > 0 && (
                      <span className="text-[15px] font-normal text-muted">
                        {" "}
                        of {marks[marks.length - 1].value} by {marks[marks.length - 1].label}
                      </span>
                    )}
                  </p>
                  {nowValue !== null && marks.length > 0 && (
                    <div className="mt-4">
                      <TargetBar now={nowValue} targets={marks} label={m.goal_label ?? m.label} delay={100 + i * 80} />
                      <p className="mt-2.5 text-[12px] text-faint">
                        {marks.map((t) => `${t.value} by ${t.label}`).join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-card">
          <table className="w-full text-left text-[15px]">
            <thead className="text-[13px] text-muted">
              <tr>
                <th scope="col" className="px-4 pt-3 pb-2.5 font-medium border-b border-line">Measure</th>
                <th scope="col" className="px-4 pt-3 pb-2.5 font-medium border-b border-line whitespace-nowrap">Now</th>
                {TARGET_DATES.map((d) => (
                  <th key={d} scope="col" className="px-4 pt-3 pb-2.5 font-medium border-b border-line whitespace-nowrap">
                    {formatDay(d, { withYear: true })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {goals.map((m) => (
                <tr key={m.id}>
                  <th scope="row" className="px-4 py-3 text-left font-normal min-w-[24ch]">{m.goal_label}</th>
                  <td className="px-4 py-3"><Value v={now(m)} /></td>
                  {TARGET_DATES.map((d) => (
                    <td key={d} className="px-4 py-3"><Value v={target(m.id, d)} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {s.goal?.summary && <p className="mt-3 text-sm text-muted">{s.goal.summary}</p>}
      </section>

      <section className="mt-14">
        <h2 className="text-[24px] font-semibold tracking-[-0.01em]">{s.scorecard?.title ?? "Monthly scorecard"}</h2>
        <Md className="mt-2 text-muted">{s.scorecard?.body_md}</Md>
        <div className="mt-5 overflow-x-auto rounded-lg border border-line bg-card">
          <table className="w-full text-left text-[15px]">
            <thead className="text-[13px] text-muted">
              <tr>
                <th scope="col" className="px-4 pt-3 pb-2.5 font-medium border-b border-line whitespace-nowrap">Month</th>
                {sc.metrics.map((m) => (
                  <th key={m.id} scope="col" className="px-4 pt-3 pb-2.5 font-medium border-b border-line min-w-[11ch]">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((month) => {
                const baseline = sc.metrics.some((m) => value(m.id, month)?.note === "Baseline");
                return (
                  <tr key={month}>
                    <th scope="row" className="px-4 py-3 text-left font-normal whitespace-nowrap">
                      {formatMonth(month)}
                      {baseline && <span className="text-muted">, baseline</span>}
                    </th>
                    {sc.metrics.map((m) => (
                      <td key={m.id} className="px-4 py-3"><Value v={value(m.id, month)?.value} /></td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {s.scorecard?.summary && <p className="mt-3 text-sm text-muted">{s.scorecard.summary}</p>}
        {auto.size > 0 && (
          <p className="mt-2 text-sm text-muted">
            From October 2026, enquiries, Diagnostics sold, Builds signed after a Diagnostic and Keep plans active fill
            themselves from Proposals and Projects.
          </p>
        )}
      </section>
    </div>
  );
}
