import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/hq";
import {
  CLIENT_TYPE,
  COST_CATEGORY,
  MONEY_KIND,
  OFFER,
  PROFIT_RANGE,
  PROJECT_OPTIONS,
  PROOF,
  SOURCE,
  STATUSES,
  STATUS_LABEL,
  YES_NO,
  getMoney,
  getProject,
  totals,
  usd,
  type Project,
} from "@/lib/projects";
import { formatDay, todayInBeirut } from "@/lib/dates";
import { getEnquiryById } from "@/lib/proposals";
import { SubmitButton } from "@/components/submit-button";
import { ProjectForm } from "../project-form";
import { removeHours, removeMoney, setProjectStatus } from "../mutations";
import { HoursForm, MoneyForm, PrivateForm } from "./money-forms";

async function load(slug: string, raw: string) {
  if (!/^\d{1,5}$/.test(raw)) notFound();
  const workspace = await getWorkspace(slug);
  if (!workspace.isStudio || (workspace.role !== "owner" && workspace.role !== "team")) notFound();
  const project = await getProject(workspace.id, Number(raw));
  if (!project) notFound();
  return { workspace, project };
}

export async function generateMetadata({ params }: PageProps<"/w/[slug]/projects/[number]">): Promise<Metadata> {
  const { slug, number } = await params;
  const { project } = await load(slug, number);
  return { title: `P${project.number} ${project.client}` };
}

export default async function ProjectPage({ params }: PageProps<"/w/[slug]/projects/[number]">) {
  const { slug, number } = await params;
  const { workspace, project: p } = await load(slug, number);
  const isOwner = workspace.role === "owner";
  const [money, enquiry] = await Promise.all([
    isOwner ? getMoney(workspace.id, p.id) : Promise.resolve(null),
    p.enquiry_id ? getEnquiryById(workspace.id, p.enquiry_id) : Promise.resolve(null),
  ]);
  const today = todayInBeirut();

  const showCloseOut =
    p.status === "delivered" ||
    p.status === "closed" ||
    [p.referred, p.came_back, p.five_more, p.brand_to_website, p.proof, p.result, p.testimonial].some(Boolean);
  const showLost = p.status === "lost" || Boolean(p.lost_said || p.lost_think);

  return (
    <div className="max-w-[880px]">
      <Link href={`/w/${slug}/projects`} className="link text-sm">
        All projects
      </Link>

      <header className="mt-6 grid gap-x-5 sm:grid-cols-[auto_1fr]">
        <p className="ref-mark text-[44px] leading-none sm:text-[56px]">P{p.number}</p>
        <div className="mt-2 min-w-0 sm:mt-0">
          <h1 className="page-title">{p.client}</h1>
          <p className="mt-2 text-[15px] text-muted">
            {[p.sector, p.client_type ? CLIENT_TYPE[p.client_type] : null, p.year].filter(Boolean).join(", ")}
            {enquiry && (
              <>
                {". From enquiry "}
                <Link href={`/w/${slug}/proposals/enquiries/${enquiry.number}`} className="link">
                  E{enquiry.number}
                </Link>
              </>
            )}
          </p>
        </div>
      </header>

      <form
        action={setProjectStatus.bind(null, slug, p.id)}
        className="mt-8 flex flex-wrap items-end gap-3 border-y border-line py-4"
      >
        <div>
          <label htmlFor="move-status" className="label text-[13px]">
            Status
          </label>
          <select id="move-status" name="status" defaultValue={p.status} className="field h-9 w-auto pr-8">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton pendingText="Saving…" className="btn btn-secondary h-9">
          Change status
        </SubmitButton>
        <p className="w-full text-[13px] text-muted sm:ml-auto sm:w-auto">
          Last changed {formatDay(p.updated_at.slice(0, 10))}
        </p>
      </form>

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
        <Fact label="Price">{usd(p.price_usd, { per: p.price_per })}</Fact>
        <Fact label="What we sold">{p.offer ? OFFER[p.offer] : null}</Fact>
        <Fact label="Signed">{p.signed_on ? formatDay(p.signed_on, { withYear: true }) : null}</Fact>
        <Fact label="Timeline">{timeline(p)}</Fact>
        <Fact label="How they found us">{p.source ? SOURCE[p.source] : null}</Fact>
        <Fact label="Who buys and decides">{p.buyer}</Fact>
        <Fact label="Who leads it for us">{p.lead_person}</Fact>
        <Fact label="Client name">
          {p.may_name ? "We may name them" : "Not without written permission"}
        </Fact>
      </dl>

      <Section title="The work">
        <Text label="What they asked for">{p.brief}</Text>
        <Text label="What they really needed">{p.real_need}</Text>
        <Text label="What we deliver">{p.deliverables}</Text>
      </Section>

      {showCloseOut && (
        <Section title="Close-out">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <Fact label="Referred someone">{yn(p.referred)}</Fact>
            <Fact label="Came back">{yn(p.came_back)}</Fact>
            <Fact label="Five more like them">{yn(p.five_more)}</Fact>
            <Fact label="Brand led to a website">{yn(p.brand_to_website)}</Fact>
          </dl>
          <Text label="What we can show">{p.proof ? PROOF[p.proof] : null}</Text>
          <Text label="The measurable result">{p.result}</Text>
          {p.testimonial && (
            <div>
              <h3 className="text-[15px] font-semibold">The testimonial</h3>
              <blockquote className="mt-2 border-l-2 border-ink pl-4 font-serif text-[21px] leading-snug italic">
                {p.testimonial}
              </blockquote>
              {!p.may_name && (
                <p className="mt-2 text-[13px] text-muted">
                  Not for the site or proposals until we have written permission.
                </p>
              )}
            </div>
          )}
          {p.may_name && p.may_name_note && <Text label="Where the permission is">{p.may_name_note}</Text>}
        </Section>
      )}

      {showLost && (
        <Section title="Why we lost it">
          <Text label="What they said">{p.lost_said}</Text>
          <Text label="Why we think we lost">{p.lost_think}</Text>
        </Section>
      )}

      {p.notes && (
        <Section title="Notes">
          <p className="max-w-[72ch] whitespace-pre-line text-[16px] leading-relaxed">{p.notes}</p>
        </Section>
      )}

      <details className="mt-10">
        <summary className="btn btn-secondary w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          Edit the project
        </summary>
        <div className="card mt-3 p-5 sm:p-7">
          <ProjectForm
            slug={slug}
            projectId={p.id}
            values={p}
            options={PROJECT_OPTIONS}
            submitLabel="Save changes"
          />
        </div>
      </details>

      {isOwner && money && <OwnerMoney slug={slug} p={p} money={money} today={today} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-[22px] font-semibold tracking-[-0.01em]">{title}</h2>
      <div className="mt-5 grid gap-6">{children}</div>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className={`mt-1 text-[16px] ${children ? "" : "text-faint"}`}>{children || "Not recorded"}</dd>
    </div>
  );
}

function Text({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[15px] font-semibold">{label}</h3>
      <p className={`mt-1 max-w-[72ch] whitespace-pre-line text-[16px] leading-relaxed ${children ? "" : "text-faint"}`}>
        {children || "Not recorded yet."}
      </p>
    </div>
  );
}

const yn = (v: string | null) => (v ? YES_NO[v] : null);

function timeline(p: Project) {
  const dates =
    p.starts_on && p.ends_on
      ? `${formatDay(p.starts_on, { withYear: true })} to ${formatDay(p.ends_on, { withYear: true })}`
      : p.starts_on
        ? `From ${formatDay(p.starts_on, { withYear: true })}`
        : p.ends_on
          ? `Until ${formatDay(p.ends_on, { withYear: true })}`
          : null;
  return [dates, p.duration].filter(Boolean).join(", ") || null;
}

type Money = Awaited<ReturnType<typeof getMoney>>;

/** Owner only. Row level security returns none of this to the Team. */
function OwnerMoney({ slug, p, money, today }: { slug: string; p: Project; money: Money; today: string }) {
  const t = totals(money.lines, money.hours);
  const priv = money.private[0] ?? null;
  const figures: [string, string][] = [
    ["Price", usd(p.price_usd, { per: p.price_per }) || "Not set"],
    ["Invoiced", usd(t.invoiced)],
    ["Paid", usd(t.paid)],
    ["Still owed", usd(t.owed)],
    ["Outside costs", usd(t.costs)],
    ["Left after outside costs", usd(t.left)],
  ];

  return (
    <section aria-labelledby="money-title" className="mt-16 border-t-2 border-ink pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="money-title" className="text-[22px] font-semibold tracking-[-0.01em]">
          Money and hours
        </h2>
        <p className="text-[13px] text-muted">Only the Owner sees this part of the page.</p>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
        {figures.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[13px] text-muted">{label}</dt>
            <dd className="mt-1 text-[22px] font-semibold tracking-[-0.01em]">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 max-w-[72ch] text-[14px] leading-relaxed text-muted">
        {t.perHour !== null
          ? `${t.hours} hours logged, so ${usd(t.perHour)} an hour after outside costs.`
          : "No hours logged yet, so no figure per hour. Log the hours below to see what the project really paid."}
      </p>

      <h3 className="mt-10 text-[17px] font-semibold">Invoices, payments and outside costs</h3>
      {money.lines.length === 0 ? (
        <p className="mt-2 text-[15px] text-muted">Nothing recorded yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="hq-table w-full min-w-[560px] text-left text-[15px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>What</th>
                <th className="text-right">Amount</th>
                <th>Note</th>
                <th>
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {money.lines.map((l) => (
                <tr key={l.id} className="border-b border-line align-top">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDay(l.on_date)}</td>
                  <td className="px-4 py-3">
                    {MONEY_KIND[l.kind]}
                    {l.kind === "cost" && l.category ? `, ${COST_CATEGORY[l.category].toLowerCase()}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{usd(l.amount_usd, { cents: l.amount_usd % 1 !== 0 })}</td>
                  <td className="px-4 py-3 text-muted">{l.note}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={removeMoney.bind(null, slug, l.id)}>
                      <SubmitButton pendingText="Removing…" className="btn-quiet">
                        Remove
                      </SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="card mt-4 p-5">
        <MoneyForm slug={slug} projectId={p.id} today={today} categories={Object.entries(COST_CATEGORY)} />
      </div>

      <h3 className="mt-10 text-[17px] font-semibold">Hours</h3>
      {money.hours.length === 0 ? (
        <p className="mt-2 text-[15px] text-muted">No hours logged yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="hq-table w-full min-w-[480px] text-left text-[15px]">
            <thead>
              <tr>
                <th>Week of</th>
                <th>Who</th>
                <th className="text-right">Hours</th>
                <th>Note</th>
                <th>
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {money.hours.map((h) => (
                <tr key={h.id} className="border-b border-line align-top">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDay(h.week_of)}</td>
                  <td className="px-4 py-3">{h.person}</td>
                  <td className="px-4 py-3 text-right">{h.hours}</td>
                  <td className="px-4 py-3 text-muted">{h.note}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={removeHours.bind(null, slug, h.id)}>
                      <SubmitButton pendingText="Removing…" className="btn-quiet">
                        Remove
                      </SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="card mt-4 p-5">
        <HoursForm slug={slug} projectId={p.id} today={today} />
      </div>

      <h3 className="mt-10 text-[17px] font-semibold">Profit</h3>
      <p className="mt-1 max-w-[72ch] text-[14px] text-muted">
        {priv?.profit_range
          ? `Set to ${PROFIT_RANGE[priv.profit_range].toLowerCase()}.`
          : "Not set."}{" "}
        Once payments and hours are recorded, the figures above are the real answer. The range is for projects
        from before we kept them.
      </p>
      <div className="card mt-4 p-5">
        <PrivateForm
          slug={slug}
          projectId={p.id}
          ranges={Object.entries(PROFIT_RANGE)}
          range={priv?.profit_range ?? null}
          note={priv?.note ?? null}
        />
      </div>
    </section>
  );
}
