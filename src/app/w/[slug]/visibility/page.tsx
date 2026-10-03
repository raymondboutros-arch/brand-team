import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/hq";
import { Columns, CountUp, TONE } from "@/components/viz";
import { formatDay } from "@/lib/dates";
import {
  ASSISTANTS,
  ASSISTANT_LABEL,
  KIND_LABEL,
  VERDICT_LABEL,
  getVisibility,
  topNames,
  topQueries,
  topSources,
  type AiAnswer,
  type GoogleWeek,
} from "@/lib/visibility";

export const metadata: Metadata = { title: "Visibility" };

const n = (v: number) => v.toLocaleString("en-US");

export default async function VisibilityPage({ params }: PageProps<"/w/[slug]/visibility">) {
  const { slug } = await params;
  const workspace = await getWorkspace(slug);
  if (!workspace.isStudio || (workspace.role !== "owner" && workspace.role !== "team")) notFound();
  const v = await getVisibility(workspace.id);

  const fullWeeks = v.google.filter((w) => w.days === 7);
  const lastWeek = fullWeeks[0];
  const quarter = v.google.slice(0, 13);
  const quarterClicks = quarter.reduce((s, w) => s + w.clicks, 0);
  const quarterNonbrand = quarter.reduce((s, w) => s + (w.nonbrand_clicks ?? 0), 0);

  const discovery = v.answers.filter((a) => a.kind === "discovery");
  const namedPrompts = new Set(discovery.filter((a) => a.named).map((a) => a.prompt_no));
  const namedBy = new Set(discovery.filter((a) => a.named).map((a) => a.assistant));

  return (
    <div className="max-w-[1040px]">
      <h1 className="page-title">Visibility</h1>
      <p className="page-intro">
        Where LIVBRID stands on Google, in AI answers and on other sites. Checked weekly, not daily: Search Console
        runs two days behind and the site gets about 20 Google clicks a quarter, so a daily view would be mostly
        zeros.
      </p>

      <dl className="mt-8 grid gap-x-8 gap-y-6 border-y border-line py-6 sm:grid-cols-3">
        <div>
          <dt className="text-[13px] text-muted">Google clicks, last 13 weeks</dt>
          <dd className="mt-1 text-[28px] font-semibold tracking-[-0.015em]">
            <CountUp value={quarterClicks} delay={100} />
          </dd>
          <dd className="mt-1 text-[14px] text-muted">
            {quarterNonbrand} from searches without our name
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted">Buyer prompts where AI names us</dt>
          <dd className="mt-1 text-[28px] font-semibold tracking-[-0.015em]">
            {v.latest ? (
              <>
                <CountUp value={namedPrompts.size} delay={200} /> of 20
              </>
            ) : (
              "Not checked"
            )}
          </dd>
          <dd className="mt-1 text-[14px] text-muted">
            {v.latest
              ? namedBy.size === 0
                ? "No assistant named us"
                : `Only ${[...namedBy].map((a) => ASSISTANT_LABEL[a]).join(" and ")}`
              : "The AI check has not run yet"}
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted">Sites linking to us</dt>
          <dd className="mt-1 text-[28px] font-semibold tracking-[-0.015em]">
            {v.sites[0]?.referring_domains ?? "Not checked"}
          </dd>
          <dd className="mt-1 text-[14px] text-muted">
            {v.sites[0] ? `Week of ${formatDay(v.sites[0].week_of)}` : "Waits for the Ahrefs decision"}
          </dd>
        </div>
      </dl>

      <GoogleSection weeks={v.google} lastWeek={lastWeek} />

      <section className="mt-16" aria-labelledby="ai">
        <h2 id="ai" className="text-[26px] font-semibold tracking-[-0.01em]">
          AI answers
        </h2>
        {!v.latest ? (
          <p className="mt-3 text-muted">The AI check has not run yet.</p>
        ) : (
          <AiSection run={v.latest} answers={v.answers} />
        )}
      </section>

      <section className="mt-16" aria-labelledby="sites">
        <h2 id="sites" className="text-[26px] font-semibold tracking-[-0.01em]">
          Other sites
        </h2>
        {v.sites.length === 0 ? (
          <p className="mt-3 max-w-[72ch] text-[16px] leading-relaxed text-muted">
            Links and mentions from Ahrefs: how many sites link to livbrid.com, and where LIVBRID is mentioned without a
            link. Not checked yet, because each check uses Ahrefs credits and that decision is yours. The AI answers
            above already show the sites AI trusts most: Sortlist and Clutch, where LIVBRID has no profile yet (A5).
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="hq-table w-full min-w-[560px] text-left text-[15px]">
              <thead>
                <tr>
                  <th>Week of</th>
                  <th className="text-right">Sites linking</th>
                  <th className="text-right">Links</th>
                  <th className="text-right">Mentions</th>
                  <th className="text-right">Domain rating</th>
                </tr>
              </thead>
              <tbody>
                {v.sites.map((s) => (
                  <tr key={s.week_of} className="border-b border-line">
                    <td className="px-4 py-3">{formatDay(s.week_of)}</td>
                    <td className="px-4 py-3 text-right">{s.referring_domains ?? ""}</td>
                    <td className="px-4 py-3 text-right">{s.backlinks ?? ""}</td>
                    <td className="px-4 py-3 text-right">{s.mentions ?? ""}</td>
                    <td className="px-4 py-3 text-right">{s.domain_rating ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-16 border-t border-line pt-6" aria-labelledby="how">
        <h2 id="how" className="text-[17px] font-semibold">
          How this page stays current
        </h2>
        <ul className="mt-3 grid max-w-[72ch] gap-2 text-[15px] leading-relaxed text-muted">
          <li>
            Google: Claude reads Search Console and adds each finished week. Until the direct connection lands on 13
            November, ask Claude in chat to update Visibility. The Check now button comes with that connection.
          </li>
          <li>
            AI answers: the prompt list is asked in temporary chats, twice per assistant, with no account history.
            Weekly runs need each assistant&apos;s own API, which costs money per check; until you decide, it runs about
            once a month through Claude.
          </li>
          <li>Every update is in the activity log, marked as through Claude.</li>
        </ul>
      </section>
    </div>
  );
}

function GoogleSection({ weeks, lastWeek }: { weeks: GoogleWeek[]; lastWeek?: GoogleWeek }) {
  const max = Math.max(1, ...weeks.map((w) => w.impressions));
  const queries = topQueries(weeks.slice(0, 4), 8);
  return (
    <section className="mt-14" aria-labelledby="google">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="google" className="text-[26px] font-semibold tracking-[-0.01em]">
          Google
        </h2>
        <p className="text-[13px] text-muted">From Search Console. A week starts on Monday.</p>
      </div>
      {weeks.length === 0 ? (
        <p className="mt-3 text-muted">No weeks recorded yet.</p>
      ) : (
        <>
          {lastWeek && (
            <p className="mt-3 max-w-[72ch] text-[16px] leading-relaxed">
              Last full week, from {formatDay(lastWeek.week_of)}: {n(lastWeek.clicks)}{" "}
              {lastWeek.clicks === 1 ? "click" : "clicks"} from {n(lastWeek.impressions)} appearances in results,
              {" "}
              {lastWeek.nonbrand_clicks ?? 0} from searches without our name. Average position{" "}
              {lastWeek.avg_position ?? "unknown"}: page {Math.ceil((lastWeek.avg_position ?? 10) / 10)} of the results.
            </p>
          )}
          <WeekCharts weeks={[...weeks].reverse()} />
          <details className="mt-6">
            <summary className="btn-quiet cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              Show the numbers week by week
            </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="hq-table w-full min-w-[640px] text-left text-[15px]">
              <thead>
                <tr>
                  <th className="w-[130px]">Week of</th>
                  <th className="w-[80px] text-right">Clicks</th>
                  <th className="w-[150px] text-right">Without our name</th>
                  <th>Appearances</th>
                  <th className="w-[110px] text-right">Position</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.week_of} className="border-b border-line">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {formatDay(w.week_of)}
                      {w.days < 7 && <span className="text-muted">, {w.days} days</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">{w.clicks}</td>
                    <td className="px-4 py-2.5 text-right">{w.nonbrand_clicks ?? ""}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-3">
                        <span className="w-[3.5ch] shrink-0 text-right">{n(w.impressions)}</span>
                        <span
                          aria-hidden
                          className="h-1.5 rounded-full bg-sky"
                          style={{ width: `${Math.max(2, (w.impressions / max) * 100) * 0.6}%` }}
                        />
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">{w.avg_position ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </details>
          {weeks.some((w) => w.note) && (
            <p className="mt-2 text-[13px] text-muted">{weeks.find((w) => w.note)?.note}</p>
          )}

          {queries.length > 0 && (
            <div className="mt-10">
              <h3 className="text-[17px] font-semibold">Searches without our name, last four weeks</h3>
              <p className="mt-1 max-w-[72ch] text-[14px] text-muted">
                What people typed when livbrid.com appeared. Most clicks come from searches Google keeps private, so
                this list shows where we appear more than where we get clicked.
              </p>
              <ol className="mt-3 border-t border-line">
                {queries.map((q) => (
                  <li key={q.query} className="grid grid-cols-[1fr_auto_auto] gap-x-6 border-b border-line py-2.5 text-[15px]">
                    <span>{q.query}</span>
                    <span className="text-muted">{n(q.impressions)} appearances</span>
                    <span className="w-[11ch] text-right text-muted">
                      {q.position ? `position ${Math.round(q.position)}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function cell(list: AiAnswer[]) {
  if (list.length === 0) return null;
  return list
    .sort((a, b) => a.attempt - b.attempt)
    .map((a) =>
      a.kind === "brand"
        ? a.verdict
          ? VERDICT_LABEL[a.verdict]
          : "Answered"
        : a.named
          ? a.position
            ? `#${a.position}`
            : "Yes"
          : "No",
    )
    .join(" / ");
}

function AiSection({ run, answers }: { run: { label: string; checked_on: string; note: string | null; complete: boolean }; answers: AiAnswer[] }) {
  const prompts = [...new Map(answers.map((a) => [a.prompt_no, { no: a.prompt_no, prompt: a.prompt, kind: a.kind }])).values()].sort(
    (a, b) => a.no - b.no,
  );
  const answering = answers.filter((a) => a.kind !== "brand");
  const names = topNames(answering, 10);
  const sources = topSources(answers.filter((a) => a.kind !== "brand"), 10);

  const byAssistant = ASSISTANTS.map((as) => {
    const mine = answers.filter((a) => a.assistant === as);
    const disc = mine.filter((a) => a.kind === "discovery");
    const discPrompts = new Set(disc.map((a) => a.prompt_no));
    const namedPrompts = new Set(disc.filter((a) => a.named).map((a) => a.prompt_no));
    const brand = mine.filter((a) => a.kind === "brand");
    const brandPrompts = new Set(brand.map((a) => a.prompt_no));
    const rightPrompts = new Set(brand.filter((a) => a.verdict === "accurate").map((a) => a.prompt_no));
    return { as, answers: mine.length, discPrompts: discPrompts.size, named: namedPrompts.size, brandPrompts: brandPrompts.size, right: rightPrompts.size };
  });

  return (
    <>
      <p className="mt-3 max-w-[72ch] text-[16px] leading-relaxed">
        <span className="font-semibold">{run.label}</span>, checked {formatDay(run.checked_on, { withYear: true })}.{" "}
        {run.complete ? "" : <span className="text-muted">Not complete yet. </span>}
        <span className="text-muted">{run.note}</span>
      </p>

      <Matrix answers={answers} prompts={prompts} />

      <div className="mt-10 overflow-x-auto">
        <table className="hq-table w-full min-w-[640px] text-left text-[15px]">
          <thead>
            <tr>
              <th>Assistant</th>
              <th className="text-right">Buyer prompts naming us</th>
              <th className="text-right">Questions about us answered right</th>
              <th className="text-right">Answers read</th>
            </tr>
          </thead>
          <tbody>
            {byAssistant.map((r) => (
              <tr key={r.as} className="border-b border-line">
                <td className="px-4 py-3 font-medium">{ASSISTANT_LABEL[r.as]}</td>
                <td className="px-4 py-3 text-right">
                  {r.discPrompts ? (
                    <>
                      <span className={r.named ? "font-semibold" : ""}>{r.named}</span>
                      <span className="text-muted"> of {r.discPrompts} asked</span>
                    </>
                  ) : (
                    <span className="text-faint">Not asked yet</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.brandPrompts ? (
                    <>
                      {r.right}
                      <span className="text-muted"> of {r.brandPrompts} asked</span>
                    </>
                  ) : (
                    <span className="text-faint">Not asked yet</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-muted">{r.answers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-2">
        <div>
          <h3 className="text-[17px] font-semibold">Who AI names instead</h3>
          <p className="mt-1 text-[14px] text-muted">Answers to buyer prompts that name each agency.</p>
          <ol className="mt-3 border-t border-line">
            {names.map((x) => (
              <li key={x.label} className="flex justify-between gap-6 border-b border-line py-2 text-[15px]">
                <span>{x.label}</span>
                <span className="text-muted">{x.n}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="text-[17px] font-semibold">Where AI gets its answers</h3>
          <p className="mt-1 text-[14px] text-muted">Answers to buyer prompts that cite each site.</p>
          <ol className="mt-3 border-t border-line">
            {sources.map((x) => (
              <li key={x.host} className="flex justify-between gap-6 border-b border-line py-2 text-[15px]">
                <span>{x.host}</span>
                <span className="text-muted">{x.n}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <h3 className="mt-12 text-[17px] font-semibold">Prompt by prompt</h3>
      <p className="mt-1 max-w-[72ch] text-[14px] text-muted">
        Each assistant was asked twice where it could be. For buyer prompts, #2 means LIVBRID came second in the
        list. Open a prompt to read what each assistant said.
      </p>
      {(["discovery", "brand", "language"] as const).map((kind) => {
        const rows = prompts.filter((p) => p.kind === kind);
        if (rows.length === 0) return null;
        return (
          <div key={kind} className="mt-6 overflow-x-auto">
            <table className="hq-table w-full min-w-[860px] text-left text-[14px]">
              <thead>
                <tr>
                  <th>{KIND_LABEL[kind]}</th>
                  {ASSISTANTS.map((as) => (
                    <th key={as} className="w-[112px]">
                      {ASSISTANT_LABEL[as]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const mine = answers.filter((a) => a.prompt_no === p.no);
                  const notes = mine.filter((a) => a.note);
                  return (
                    <tr key={p.no} className="border-b border-line align-top">
                      <td className="px-4 py-2.5">
                        {notes.length > 0 ? (
                          <details>
                            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                              <span className="ref-mark mr-2 text-[16px]">{p.no}</span>
                              <span dir="auto" className="underline decoration-line-strong underline-offset-4">
                                {p.prompt}
                              </span>
                            </summary>
                            <ul className="mt-2 grid gap-1.5 text-[13px] leading-relaxed text-muted">
                              {notes.map((a) => (
                                <li key={`${a.assistant}-${a.attempt}`}>
                                  <span className="font-medium text-ink">
                                    {ASSISTANT_LABEL[a.assistant]}, try {a.attempt}:
                                  </span>{" "}
                                  {a.note}
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : (
                          <>
                            <span className="ref-mark mr-2 text-[16px]">{p.no}</span>
                            <span dir="auto">{p.prompt}</span>
                          </>
                        )}
                      </td>
                      {ASSISTANTS.map((as) => {
                        const c = cell(mine.filter((a) => a.assistant === as));
                        const good = mine.some(
                          (a) => a.assistant === as && (a.kind === "brand" ? a.verdict === "accurate" : a.named),
                        );
                        return (
                          <td key={as} className={`px-4 py-2.5 whitespace-nowrap ${c ? (good ? "font-semibold" : "") : "text-faint"}`}>
                            {c ?? "Not asked"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Two small charts side by side (never one chart with two scales): clicks, and appearances. */
function WeekCharts({ weeks }: { weeks: GoogleWeek[] }) {
  const pts = (pick: (w: GoogleWeek) => number) =>
    weeks.map((w, i) => {
      const m = Number(w.week_of.slice(5, 7)) - 1;
      const newMonth = i === 0 || w.week_of.slice(5, 7) !== weeks[i - 1].week_of.slice(5, 7);
      return {
        key: w.week_of,
        label: `week of ${formatDay(w.week_of)}${w.days < 7 ? ` (${w.days} days)` : ""}`,
        short: newMonth ? MONTHS_LONG[m] : "",
        value: pick(w),
      };
    });
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  const range = first && last ? `${formatDay(first.week_of)} to ${formatDay(last.week_of)}` : "";
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="text-[15px] font-semibold">Clicks each week</p>
        <p className="mb-5 text-[13px] text-muted">People who came to livbrid.com from Google</p>
        <Columns points={pts((w) => w.clicks)} unit={["click", "clicks"]} label={`Clicks per week, ${range}`} />
      </div>
      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="text-[15px] font-semibold">Appearances each week</p>
        <p className="mb-5 text-[13px] text-muted">Times livbrid.com showed in Google results</p>
        <Columns points={pts((w) => w.impressions)} unit={["appearance", "appearances"]} label={`Appearances per week, ${range}`} />
      </div>
    </div>
  );
}

type Cell = "good" | "partly" | "no" | "none";
const CELL_STYLE: Record<Cell, React.CSSProperties> = {
  good: { background: TONE.cobalt },
  partly: { background: TONE.sky },
  no: { background: TONE.track },
  none: { background: "transparent", boxShadow: "inset 0 0 0 1px #CFCCC4" },
};
const CELL_LABEL: Record<Cell, string> = {
  good: "Named us, or answered right",
  partly: "Partly right",
  no: "Did not name us, or got it wrong",
  none: "Not asked yet",
};

/** Every prompt against every assistant, one square each: the whole check at a glance. */
function Matrix({ answers, prompts }: { answers: AiAnswer[]; prompts: { no: number; prompt: string; kind: AiAnswer["kind"] }[] }) {
  const groups = (["discovery", "brand", "language"] as const)
    .map((k) => ({ kind: k, items: prompts.filter((p) => p.kind === k) }))
    .filter((g) => g.items.length > 0);
  const state = (no: number, as: string): { cell: Cell; text: string } => {
    const list = answers.filter((a) => a.prompt_no === no && a.assistant === as);
    if (list.length === 0) return { cell: "none", text: "not asked yet" };
    const text = cell(list) ?? "";
    if (list.some((a) => (a.kind === "brand" ? a.verdict === "accurate" : a.named))) return { cell: "good", text };
    if (list.some((a) => a.verdict === "partly")) return { cell: "partly", text };
    return { cell: "no", text };
  };
  const total = prompts.length;
  return (
    <figure className="mt-6 rounded-2xl border border-line bg-card p-5 sm:p-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <span className="text-[15px] font-semibold">Every answer at a glance</span>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted" aria-label="Legend">
          {(Object.keys(CELL_LABEL) as Cell[]).map((c) => (
            <li key={c} className="flex items-center gap-1.5">
              <span aria-hidden className="size-3 rounded-[3px]" style={CELL_STYLE[c]} />
              {CELL_LABEL[c]}
            </li>
          ))}
        </ul>
      </figcaption>
      <div className="mt-5 overflow-x-auto pb-1">
        <div className="inline-grid gap-y-[3px]" style={{ gridTemplateColumns: "128px auto" }}>
          <span />
          <div className="flex gap-4 pb-1 text-[11px] text-faint">
            {groups.map((g) => (
              <span key={g.kind} style={{ width: g.items.length * 19 - 3 }} className="truncate">
                {g.kind === "discovery" ? "Buyers looking" : g.kind === "brand" ? "About us" : "Arabic, French"}
              </span>
            ))}
          </div>
          {ASSISTANTS.map((as, row) => (
            <div key={as} className="contents">
              <span className="pr-3 text-[13px] leading-4">{ASSISTANT_LABEL[as]}</span>
              <div className="flex gap-4">
                {groups.map((g) => (
                  <div key={g.kind} className="flex gap-[3px]">
                    {g.items.map((p) => {
                      const st = state(p.no, as);
                      const idx = p.no;
                      return (
                        <span
                          key={p.no}
                          tabIndex={0}
                          data-tip={`${p.no}. ${ASSISTANT_LABEL[as]}: ${st.text}`}
                          data-tip-align={idx <= 6 ? "start" : idx > total - 6 ? "end" : undefined}
                          className="viz-tip viz-mark viz-fade block size-4 rounded-[3px]"
                          style={{ ...CELL_STYLE[st.cell], ["--d" as string]: `${row * 60 + idx * 12}ms` }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <span />
          <div className="flex gap-4 pt-1 text-[11px] tabular-nums text-faint" aria-hidden>
            {groups.map((g) => (
              <div key={g.kind} className="flex gap-[3px]">
                {g.items.map((p) => (
                  <span key={p.no} className="w-4 text-center">
                    {p.no === g.items[0].no || p.no === g.items[g.items.length - 1].no ? p.no : ""}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-[13px] text-muted">
        Hover or tab to a square to see the answer. The table below has the same results in words.
      </p>
    </figure>
  );
}
