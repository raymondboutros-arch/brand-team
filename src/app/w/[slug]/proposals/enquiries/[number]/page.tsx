import type { Metadata } from "next";
import { PROPOSAL_STATE, StateTag } from "@/components/state-dot";
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
  getEnquiry,
  getPipeline,
  price,
} from "@/lib/proposals";
import { formatDay } from "@/lib/dates";
import { SubmitButton } from "@/components/submit-button";
import { EnquiryForm, StartProposalForm } from "../../forms";
import { setEnquiryStatus } from "../../mutations";

async function load(slug: string, raw: string) {
  if (!/^\d{1,5}$/.test(raw)) notFound();
  const workspace = await getWorkspace(slug);
  if (!workspace.isStudio || (workspace.role !== "owner" && workspace.role !== "team")) notFound();
  const enquiry = await getEnquiry(workspace.id, Number(raw));
  if (!enquiry) notFound();
  return { workspace, enquiry };
}

export async function generateMetadata({ params }: PageProps<"/w/[slug]/proposals/enquiries/[number]">): Promise<Metadata> {
  const { slug, number } = await params;
  const { enquiry } = await load(slug, number);
  return { title: `E${enquiry.number} ${enquiry.client}` };
}

export default async function EnquiryPage({ params }: PageProps<"/w/[slug]/proposals/enquiries/[number]">) {
  const { slug, number } = await params;
  const { workspace, enquiry: e } = await load(slug, number);
  const pipeline = await getPipeline(workspace.id);
  const proposals = pipeline.proposals.filter((p) => p.enquiry_id === e.id);
  const base = `/w/${slug}/proposals`;

  return (
    <div className="max-w-[880px]">
      <Link href={base} className="link text-sm">
        All enquiries
      </Link>

      <header className="mt-6 grid gap-x-5 sm:grid-cols-[auto_1fr]">
        <p className="ref-mark text-[44px] leading-none sm:text-[56px]">E{e.number}</p>
        <div className="mt-2 min-w-0 sm:mt-0">
          <h1 className="page-title">{e.client}</h1>
          <p className="mt-2 text-[15px] text-muted">
            {ENQUIRY_STATUS_LABEL[e.status]}, received {formatDay(e.received_on, { withYear: true })}
            {e.closed_note ? `. ${e.closed_note}` : ""}
          </p>
        </div>
      </header>

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-line py-5 sm:grid-cols-4">
        <Fact label="Who we spoke to">{e.contact}</Fact>
        <Fact label="Sector">{e.sector}</Fact>
        <Fact label="How they found us">{e.source ? SOURCE[e.source] : null}</Fact>
        <Fact label="Where they are">{MARKET_LABEL[e.market]}</Fact>
      </dl>

      <section className="mt-10">
        <h2 className="text-[22px] font-semibold tracking-[-0.01em]">What they told us</h2>
        <p className={`mt-3 max-w-[72ch] whitespace-pre-line text-[16px] leading-relaxed ${e.notes ? "" : "text-faint"}`}>
          {e.notes || "No notes yet. Write down what they asked for, in their words: our thinking is drafted from these."}
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-[22px] font-semibold tracking-[-0.01em]">Proposals</h2>
        {proposals.length === 0 ? (
          <p className="mt-2 text-muted">No proposal yet.</p>
        ) : (
          <ul className="mt-3 border-t border-line">
            {proposals.map((p) => {
              const t = pipeline.totalsFor(p.id);
              const project = p.project_id ? pipeline.projectNumber.get(p.project_id) : undefined;
              return (
                <li key={p.id} className="grid gap-x-4 border-b border-line py-3.5 sm:grid-cols-[56px_1fr_auto]">
                  <span className="ref-mark text-[22px] leading-none">Q{p.number}</span>
                  <span>
                    <Link href={`${base}/${p.number}`} className="link font-medium">
                      {p.title}
                    </Link>
                    <span className="mt-0.5 block text-[13px] text-muted">
                      <StateTag state={PROPOSAL_STATE[p.status]}>{PROPOSAL_STATUS_LABEL[p.status]}</StateTag>
                      {p.sent_on ? `, sent ${formatDay(p.sent_on)}` : `, dated ${formatDay(p.issued_on)}`}
                      {project ? (
                        <>
                          , now{" "}
                          <Link href={`/w/${slug}/projects/${project}`} className="link">
                            P{project}
                          </Link>
                        </>
                      ) : null}
                    </span>
                  </span>
                  <span className="text-[15px] sm:text-right">
                    {[t.once ? price(t.once) : null, t.month ? price(t.month, "month") : null].filter(Boolean).join(" + ")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {e.status !== "lost" && e.status !== "declined" && (
          <div className="card mt-5 p-5">
            <StartProposalForm slug={slug} enquiryId={e.id} offers={OFFERS.map((o) => [o, OFFER_LABEL[o]] as const)} />
            <p className="mt-3 text-[13px] text-muted">
              Starts with the decided wording for that offer and its price for {MARKET_LABEL[e.market]}. You can add the
              other options inside.
            </p>
          </div>
        )}
      </section>

      <section className="mt-12 border-t border-line pt-6">
        {e.status === "open" ? (
          <form action={setEnquiryStatus.bind(null, slug, e.id)} className="grid gap-3">
            <h2 className="text-[17px] font-semibold">Close it without a proposal</h2>
            <div className="max-w-[560px]">
              <label htmlFor="closed_note" className="label text-[13px]">
                Why <span className="font-normal text-muted">(optional)</span>
              </label>
              <input id="closed_note" name="closed_note" maxLength={1000} className="field h-9" placeholder="Wanted social media only" />
            </div>
            <div className="flex flex-wrap gap-3">
              <SubmitButton name="status" value="declined" pendingText="Saving…" className="btn btn-secondary h-9">
                Not for us
              </SubmitButton>
              <SubmitButton name="status" value="lost" pendingText="Saving…" className="btn btn-secondary h-9">
                They went elsewhere
              </SubmitButton>
            </div>
          </form>
        ) : e.status !== "won" ? (
          <form action={setEnquiryStatus.bind(null, slug, e.id)}>
            <SubmitButton name="status" value="open" pendingText="Opening…" className="btn-quiet">
              Open it again
            </SubmitButton>
          </form>
        ) : null}
      </section>

      <details className="mt-10">
        <summary className="btn btn-secondary w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          Edit the enquiry
        </summary>
        <div className="card mt-3 p-5 sm:p-7">
          <EnquiryForm
            slug={slug}
            enquiryId={e.id}
            values={e}
            sources={Object.entries(SOURCE)}
            submitLabel="Save changes"
            primary={false}
          />
        </div>
      </details>
    </div>
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
