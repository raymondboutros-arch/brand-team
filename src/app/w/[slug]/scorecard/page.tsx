import type { Metadata } from "next";
import { Md } from "@/components/markdown";
import { getWorkspace } from "@/lib/hq";
import { formatDay, formatMonth } from "@/lib/dates";
import { getScorecard, getSections } from "@/lib/plan";

export const metadata: Metadata = { title: "Scorecard" };

const TARGET_DATES = ["2026-12-31", "2027-03-31", "2027-06-30"];

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
  const [{ byKey: s }, sc] = await Promise.all([getSections(workspace.id, "plan"), getScorecard(workspace.id)]);

  const goals = sc.metrics
    .filter((m) => m.goal_label)
    .sort((a, b) => (a.goal_position ?? 0) - (b.goal_position ?? 0));
  const target = (metricId: string, date: string) =>
    sc.targets.find((t) => t.metric_id === metricId && t.on_date === date)?.value;
  const value = (metricId: string, month: string) =>
    sc.values.find((v) => v.metric_id === metricId && v.month === month);
  const rows = months("2026-09-01", "2027-06-01");

  return (
    <div className="max-w-[1040px]">
      <p className="eyebrow">{workspace.name}</p>
      <h1 className="mt-2 text-[34px] leading-[1.1] font-semibold tracking-[-0.015em]">Scorecard</h1>

      <section className="mt-8">
        <h2 className="text-[24px] font-semibold tracking-[-0.01em]">{s.goal?.title ?? "The goal"}</h2>
        <Md className="mt-2 text-muted">{s.goal?.body_md}</Md>
        <div className="mt-5 overflow-x-auto rounded-lg border border-line bg-card">
          <table className="w-full text-left text-[15px]">
            <thead className="bg-wash text-[13px] text-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Measure</th>
                <th scope="col" className="px-4 py-2.5 font-semibold whitespace-nowrap">Now</th>
                {TARGET_DATES.map((d) => (
                  <th key={d} scope="col" className="px-4 py-2.5 font-semibold whitespace-nowrap">
                    {formatDay(d, { withYear: true })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {goals.map((m) => (
                <tr key={m.id}>
                  <th scope="row" className="px-4 py-3 text-left font-normal min-w-[24ch]">{m.goal_label}</th>
                  <td className="px-4 py-3"><Value v={m.baseline} /></td>
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
            <thead className="bg-wash text-[13px] text-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold whitespace-nowrap">Month</th>
                {sc.metrics.map((m) => (
                  <th key={m.id} scope="col" className="px-4 py-2.5 font-semibold min-w-[11ch]">
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
      </section>
    </div>
  );
}
