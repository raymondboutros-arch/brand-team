import type { Metadata } from "next";
import { PROPOSAL_STATE, StateDot } from "@/components/state-dot";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/hq";
import { Md } from "@/components/markdown";
import { SubmitButton } from "@/components/submit-button";
import {
  MARKET_LABEL,
  OFFER_LABEL,
  PROPOSAL_STATUS_LABEL,
  getEnquiryById,
  getPriceList,
  getProposal,
  price,
  sums,
  type Proposal,
  type ProposalLine,
} from "@/lib/proposals";
import { dayInBeirut, formatDay } from "@/lib/dates";
import { AddLineForm, CloseProposalForm, LineForm, ProposalForm, StatusButton } from "../forms";
import { removeLine } from "../mutations";

async function load(slug: string, raw: string) {
  if (!/^\d{1,5}$/.test(raw)) notFound();
  const workspace = await getWorkspace(slug);
  if (!workspace.isStudio || (workspace.role !== "owner" && workspace.role !== "team")) notFound();
  const found = await getProposal(workspace.id, Number(raw));
  if (!found) notFound();
  return { workspace, ...found };
}

export async function generateMetadata({ params }: PageProps<"/w/[slug]/proposals/[number]">): Promise<Metadata> {
  const { slug, number } = await params;
  const { proposal } = await load(slug, number);
  return { title: `Q${proposal.number} ${proposal.client}` };
}

export default async function ProposalPage({ params }: PageProps<"/w/[slug]/proposals/[number]">) {
  const { slug, number } = await params;
  const { workspace, proposal: p, lines } = await load(slug, number);
  const isOwner = workspace.role === "owner";
  const editable = p.status === "draft" || p.status === "approved";
  const supabase = await createClient();

  const [enquiry, priceList, approver, project] = await Promise.all([
    getEnquiryById(workspace.id, p.enquiry_id),
    editable ? getPriceList(workspace.id) : Promise.resolve([]),
    p.approved_by
      ? supabase.from("profiles").select("full_name, email").eq("id", p.approved_by).maybeSingle()
      : Promise.resolve({ data: null }),
    p.project_id
      ? supabase.from("projects").select("number").eq("id", p.project_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const approverName = approver.data
    ? ((approver.data.full_name as string | null) ?? String(approver.data.email).split("@")[0])
    : "a person";
  const t = sums(lines);
  const pdf = `/print/${slug}/proposals/${p.number}`;

  const missing = [
    !p.our_thinking?.trim() && "our thinking",
    !p.scope?.trim() && "the scope",
    lines.length === 0 && "a line from the price list",
    t.unpriced && (isOwner ? "a price on every line" : "a price on every line, set by the Owner"),
  ].filter(Boolean) as string[];

  const items = priceList
    .filter((i) => i.active && (i.market === p.market || i.market === "any"))
    .map(
      (i) =>
        [
          i.id,
          `${OFFER_LABEL[i.offer]}: ${i.label}${i.market === "any" ? "" : `, ${MARKET_LABEL[i.market]}`}, ${
            i.price_usd === null ? "priced by the Owner" : price(i.price_usd, i.per)
          }`,
        ] as const,
    );

  return (
    <div className="max-w-[880px]">
      {enquiry && (
        <Link href={`/w/${slug}/proposals/enquiries/${enquiry.number}`} className="link text-sm">
          E{enquiry.number}, {enquiry.client}
        </Link>
      )}

      <header className="mt-6 grid gap-x-5 sm:grid-cols-[auto_1fr]">
        <p className="ref-mark text-[44px] leading-none sm:text-[56px]">Q{p.number}</p>
        <div className="mt-2 min-w-0 sm:mt-0">
          <h1 className="page-title">{p.title}</h1>
          <p className="mt-2 text-[15px] text-muted">
            For {p.client}, dated {formatDay(p.issued_on, { withYear: true })}
            {p.valid_until ? `, valid until ${formatDay(p.valid_until, { withYear: true })}` : ""}. Prices for{" "}
            {MARKET_LABEL[p.market]}.
          </p>
        </div>
      </header>

      <section aria-label="Where it stands" className="mt-8 border-y border-line py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <p className="text-[17px]">
            <span className="mr-2 inline-flex translate-y-[-2px]">
              <StateDot state={PROPOSAL_STATE[p.status]} />
            </span>
            <span className="font-semibold">{PROPOSAL_STATUS_LABEL[p.status]}</span>
            <span className="text-muted">{statusLine(p, approverName, project.data?.number as number | undefined)}</span>
          </p>
          <a href={pdf} target="_blank" rel="noreferrer" className="link text-[15px]">
            {p.status === "draft" ? "Preview the PDF" : "Open the PDF"}
          </a>
        </div>

        {p.status === "draft" && (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {missing.length === 0 ? (
              <>
                <StatusButton slug={slug} proposalId={p.id} status="approved" label="Approve" pendingLabel="Approving…" tone="ink" />
                <p className="text-[13px] text-muted">Approving is a person&apos;s decision. Claude can draft, never approve.</p>
              </>
            ) : (
              <p className="text-[15px] text-muted">Before it can be approved, it needs {joinAnd(missing)}.</p>
            )}
          </div>
        )}
        {p.status === "approved" && (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <StatusButton slug={slug} proposalId={p.id} status="sent" label="Mark as sent" pendingLabel="Saving…" tone="ink" />
            <StatusButton slug={slug} proposalId={p.id} status="draft" label="Back to draft" pendingLabel="Saving…" tone="quiet" />
          </div>
        )}
        {p.status === "sent" && (
          <div className="mt-5 grid gap-5">
            <CloseProposalForm slug={slug} proposalId={p.id} />
            <div className="flex flex-wrap items-center gap-4 border-t border-line pt-4">
              <StatusButton slug={slug} proposalId={p.id} status="draft" label="Back to draft to change it" pendingLabel="Saving…" tone="quiet" />
            </div>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-[22px] font-semibold tracking-[-0.01em]">Price</h2>
        <Lines slug={slug} lines={lines} editable={editable} isOwner={isOwner} />
        <dl className="mt-4 flex flex-wrap justify-end gap-x-10 gap-y-2 text-right">
          {t.once > 0 && (
            <div>
              <dt className="text-[13px] text-muted">One-off total</dt>
              <dd className="mt-0.5 text-[22px] font-semibold tracking-[-0.01em]">{price(t.once)}</dd>
            </div>
          )}
          {t.month > 0 && (
            <div>
              <dt className="text-[13px] text-muted">Every month</dt>
              <dd className="mt-0.5 text-[22px] font-semibold tracking-[-0.01em]">{price(t.month, "month")}</dd>
            </div>
          )}
        </dl>
        {editable && (
          <div className="card mt-5 p-5">
            <AddLineForm slug={slug} proposalId={p.id} items={items} />
            {!isOwner && (
              <p className="mt-3 text-[13px] text-muted">Prices come from the price list. Only the Owner changes a price.</p>
            )}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-[22px] font-semibold tracking-[-0.01em]">The proposal</h2>
        {p.status === "approved" && (
          <p className="mt-2 text-[15px] text-muted">Saving a change sends it back to draft, to be approved again.</p>
        )}
        <div className="mt-5">
          {editable ? (
            <ProposalForm
              slug={slug}
              proposalId={p.id}
              claudeDraft={p.thinking_by === "claude"}
              values={{
                title: p.title,
                client: p.client,
                market: p.market,
                issued_on: p.issued_on,
                valid_until: p.valid_until,
                intro: p.intro,
                our_thinking: p.our_thinking,
                scope: p.scope,
                not_included: p.not_included,
                timeline: p.timeline,
                payment_terms: p.payment_terms,
              }}
            />
          ) : (
            <ReadOnly p={p} />
          )}
        </div>
      </section>
    </div>
  );
}

function statusLine(p: Proposal, approver: string, project?: number) {
  switch (p.status) {
    case "draft":
      return ". Not seen by the client.";
    case "approved":
      return `, by ${approver} on ${formatDay(dayInBeirut(p.approved_at!))}. Save the PDF and send it, then mark it as sent.`;
    case "sent":
      return `, ${p.sent_on ? formatDay(p.sent_on) : ""}. When they answer, mark it won or lost.`;
    case "won":
      return `, ${p.closed_on ? formatDay(p.closed_on) : ""}${project ? `. It is now project P${project}.` : "."}`;
    default:
      return `, ${p.closed_on ? formatDay(p.closed_on) : ""}${project ? `. The reasons are on P${project} in Projects.` : "."}`;
  }
}

function joinAnd(parts: string[]) {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function Lines({ slug, lines, editable, isOwner }: { slug: string; lines: ProposalLine[]; editable: boolean; isOwner: boolean }) {
  if (lines.length === 0) return <p className="mt-2 text-muted">No lines yet. Add one from the price list below.</p>;
  return (
    <ul className="mt-3 border-t border-line">
      {lines.map((l) => (
        <li key={l.id} className="border-b border-line py-4">
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-[1fr_auto]">
            <p>
              <span className="font-medium">{l.label}</span>
              <span className="ml-2 text-[13px] text-muted">{OFFER_LABEL[l.offer]}</span>
            </p>
            <p className={`text-[16px] sm:text-right ${l.price_usd === null ? "text-danger" : ""}`}>
              {l.price_usd === null ? (isOwner ? "Set the price" : "Price to be set by the Owner") : price(l.price_usd, l.per)}
            </p>
          </div>
          {l.detail && <p className="mt-1 max-w-[72ch] text-[15px] leading-relaxed text-muted">{l.detail}</p>}
          {editable && (
            <div className="mt-2 flex flex-wrap items-start gap-x-5 gap-y-2">
              <details className="min-w-0 flex-1">
                <summary className="btn-quiet cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  {isOwner ? "Change the wording or price" : "Change the wording"}
                </summary>
                <LineForm slug={slug} lineId={l.id} label={l.label} detail={l.detail} price={l.price_usd} canPrice={isOwner} />
              </details>
              <form action={removeLine.bind(null, slug, l.id)}>
                <SubmitButton pendingText="Removing…" className="btn-quiet">
                  Remove
                </SubmitButton>
              </form>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function ReadOnly({ p }: { p: Proposal }) {
  const parts: [string, string | null][] = [
    ["Intro", p.intro],
    ["Our thinking", p.our_thinking],
    ["Scope", p.scope],
    ["Not included", p.not_included],
    ["Timeline", p.timeline],
    ["Payment terms", p.payment_terms],
  ];
  return (
    <div className="grid gap-8">
      {parts
        .filter(([, v]) => v)
        .map(([label, v]) => (
          <div key={label}>
            <h3 className="text-[15px] font-semibold">{label}</h3>
            <Md className="mt-1.5">{v}</Md>
          </div>
        ))}
    </div>
  );
}
