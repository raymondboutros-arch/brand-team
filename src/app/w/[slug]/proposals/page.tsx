import type { Metadata } from "next";
import { PROPOSAL_STATE, StateDot } from "@/components/state-dot";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/hq";
import { SOURCE } from "@/lib/projects";
import {
  ENQUIRY_STATUS_LABEL,
  MARKET_LABEL,
  OFFERS,
  OFFER_LABEL,
  PROPOSAL_STATUS_LABEL,
  getPipeline,
  getPriceList,
  price,
  type Enquiry,
  type PriceItem,
  type Proposal,
} from "@/lib/proposals";
import { formatDay, todayInBeirut } from "@/lib/dates";
import { AddPriceItemForm, EnquiryForm, PriceItemForm } from "./forms";

export const metadata: Metadata = { title: "Proposals" };

type Tab = "open" | "won" | "lost" | "prices";
const TABS: { key: Tab; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "prices", label: "Price list" },
];

const EMPTY: Record<Exclude<Tab, "prices">, string> = {
  open: "No open enquiries. When someone gets in touch, add them here, even before there is a proposal.",
  won: "Nothing won yet through HQ. A won proposal becomes a project.",
  lost: "Nothing lost yet. When we lose one, the reason goes with it.",
};

export default async function ProposalsPage({ params, searchParams }: PageProps<"/w/[slug]/proposals">) {
  const { slug } = await params;
  const { show } = await searchParams;
  const workspace = await getWorkspace(slug);
  if (!workspace.isStudio || (workspace.role !== "owner" && workspace.role !== "team")) notFound();
  const isOwner = workspace.role === "owner";
  const tab = TABS.find((t) => t.key === show) ?? TABS[0];
  const base = `/w/${slug}/proposals`;

  const [pipeline, prices] = await Promise.all([getPipeline(workspace.id), getPriceList(workspace.id)]);
  const groups: Record<Exclude<Tab, "prices">, Enquiry[]> = {
    open: pipeline.enquiries.filter((e) => e.status === "open"),
    won: pipeline.enquiries.filter((e) => e.status === "won"),
    lost: pipeline.enquiries.filter((e) => e.status === "lost" || e.status === "declined"),
  };
  const proposalsOf = (e: Enquiry) => pipeline.proposals.filter((p) => p.enquiry_id === e.id);

  return (
    <div className="max-w-[1040px]">
      <h1 className="page-title">Proposals</h1>
      <p className="page-intro">
        Every enquiry, followed to won or lost. Proposals are built from the price list, approved by a person, and
        saved as a PDF in our layout. A won proposal becomes a project.
      </p>

      <details className="mt-8">
        <summary className="btn btn-secondary w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          Add an enquiry
        </summary>
        <div className="card mt-3 p-5 sm:p-7">
          <EnquiryForm
            slug={slug}
            enquiryId={null}
            values={{ received_on: todayInBeirut(), market: "lebanon" }}
            sources={Object.entries(SOURCE)}
            submitLabel="Add the enquiry"
          />
        </div>
      </details>

      <nav aria-label="Show" className="mt-8 flex flex-wrap gap-x-6 gap-y-1 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "open" ? base : `${base}?show=${t.key}`}
            aria-current={t.key === tab.key ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2.5 text-[15px] ${
              t.key === tab.key ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}{" "}
            {t.key !== "prices" && <span className="font-normal text-faint">{groups[t.key].length}</span>}
          </Link>
        ))}
      </nav>

      {tab.key === "prices" ? (
        <PriceList slug={slug} items={prices} isOwner={isOwner} />
      ) : groups[tab.key].length === 0 ? (
        <p className="mt-6 text-muted">{EMPTY[tab.key]}</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="hq-table w-full min-w-[720px] text-left text-[15px]">
            <thead>
              <tr>
                <th className="w-[56px]">
                  <span className="sr-only">Number</span>
                </th>
                <th>From</th>
                <th className="w-[130px]">Received</th>
                <th>Proposal</th>
                <th className="w-[160px] text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {groups[tab.key].map((e) => (
                <EnquiryRow
                  key={e.id}
                  e={e}
                  base={base}
                  proposals={proposalsOf(e)}
                  totalsFor={pipeline.totalsFor}
                  projectNumber={pipeline.projectNumber}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EnquiryRow({
  e,
  base,
  proposals,
  totalsFor,
  projectNumber,
}: {
  e: Enquiry;
  base: string;
  proposals: Proposal[];
  totalsFor: (id: string) => { once: number; month: number; unpriced: boolean; count: number };
  projectNumber: Map<string, number>;
}) {
  const latest = proposals[0];
  const t = latest ? totalsFor(latest.id) : null;
  const value = t
    ? [t.once ? price(t.once) : null, t.month ? price(t.month, "month") : null].filter(Boolean).join(" + ") ||
      (t.unpriced ? "Price to be set" : "")
    : "";
  const project = latest?.project_id ? projectNumber.get(latest.project_id) : undefined;

  return (
    <tr className="border-b border-line align-top">
      <td className="px-4 py-3.5">
        <span className="ref-mark text-[22px] leading-none">E{e.number}</span>
      </td>
      <td className="px-4 py-3.5">
        <Link href={`${base}/enquiries/${e.number}`} className="link font-medium">
          {e.client}
        </Link>
        <span className="mt-0.5 block text-[13px] text-muted">
          {[e.sector, e.source ? SOURCE[e.source] : null, MARKET_LABEL[e.market]].filter(Boolean).join(", ")}
        </span>
      </td>
      <td className="px-4 py-3.5 text-muted whitespace-nowrap">{formatDay(e.received_on)}</td>
      <td className="px-4 py-3.5">
        {latest ? (
          <>
            <span className="mr-1.5 inline-flex translate-y-[-1px]">
              <StateDot state={PROPOSAL_STATE[latest.status]} />
            </span>
            <Link href={`${base}/${latest.number}`} className="link">
              Q{latest.number}
            </Link>
            <span className="text-muted">
              , {PROPOSAL_STATUS_LABEL[latest.status].toLowerCase()}
              {latest.status === "sent" && latest.sent_on ? ` ${formatDay(latest.sent_on)}` : ""}
              {project ? `, now P${project}` : ""}
              {proposals.length > 1 ? `, ${proposals.length - 1} earlier` : ""}
            </span>
          </>
        ) : (
          <span className="text-muted">
            {e.status === "open" ? "No proposal yet" : ENQUIRY_STATUS_LABEL[e.status]}
            {e.closed_note ? `: ${e.closed_note}` : ""}
          </span>
        )}
      </td>
      <td className="px-4 py-3.5 text-right whitespace-nowrap">{value}</td>
    </tr>
  );
}

function PriceList({ slug, items, isOwner }: { slug: string; items: PriceItem[]; isOwner: boolean }) {
  return (
    <div className="mt-6">
      <p className="max-w-[72ch] text-[15px] leading-relaxed text-muted">
        The three offers with their options, and one custom line. Not a price for every kind of project: a long menu
        brings back work the strategy has stopped selling. These prices are for proposals only and never shown on
        the site, except the Diagnostic&apos;s. {isOwner ? "Only you can change them." : "Only the Owner changes them."}
      </p>

      {OFFERS.map((offer) => {
        const rows = items.filter((i) => i.offer === offer);
        if (rows.length === 0) return null;
        return (
          <section key={offer} className="mt-10">
            <h2 className="text-[22px] font-semibold tracking-[-0.01em]">{OFFER_LABEL[offer]}</h2>
            <ul className="mt-3 border-t border-line">
              {rows.map((i) => (
                <li key={i.id} className={`border-b border-line py-4 ${i.active ? "" : "opacity-60"}`}>
                  <div className="grid gap-x-6 gap-y-1 sm:grid-cols-[1fr_180px_200px]">
                    <p className="font-medium">
                      {i.label}
                      {!i.active && <span className="ml-2 text-[13px] font-normal text-muted">No longer offered</span>}
                    </p>
                    <p className="text-[15px] text-muted">{MARKET_LABEL[i.market]}</p>
                    <p className="text-[15px] sm:text-right">
                      {i.price_usd === null ? <span className="text-muted">Set in each proposal</span> : price(i.price_usd, i.per)}
                    </p>
                  </div>
                  {i.detail && <p className="mt-1.5 max-w-[72ch] text-[15px] leading-relaxed text-muted">{i.detail}</p>}
                  {isOwner && (
                    <details className="mt-2">
                      <summary className="btn-quiet cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                        Change
                      </summary>
                      <PriceItemForm slug={slug} item={i} />
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {isOwner && (
        <details className="mt-10">
          <summary className="btn btn-secondary w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            Add an option
          </summary>
          <div className="card mt-3 p-5 sm:p-6">
            <AddPriceItemForm slug={slug} offers={OFFERS.map((o) => [o, OFFER_LABEL[o]] as const)} />
          </div>
        </details>
      )}
    </div>
  );
}
