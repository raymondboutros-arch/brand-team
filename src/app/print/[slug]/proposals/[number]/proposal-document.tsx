import Link from "next/link";
import { Md } from "@/components/markdown";
import {
  keepBreaks,
  price,
  sums,
  type Proposal,
  type ProposalLine,
} from "@/lib/proposals";
import { formatDay } from "@/lib/dates";
import { PrintButton } from "./print-button";

/**
 * A proposal in LIVBRID's layout, made to be saved as a PDF from the browser.
 * A4, Schibsted Grotesk with Instrument Serif italic for the section names, and one blue
 * element: the total. A draft says so on every copy.
 */
export function ProposalDocument({
  proposal: p,
  lines,
  backHref,
}: {
  proposal: Pick<
    Proposal,
    | "number"
    | "title"
    | "client"
    | "issued_on"
    | "valid_until"
    | "intro"
    | "our_thinking"
    | "scope"
    | "not_included"
    | "timeline"
    | "payment_terms"
    | "status"
  >;
  lines: ProposalLine[];
  backHref: string;
}) {
  const t = sums(lines);
  const draft = p.status === "draft";
  const sections: [string, string | null][] = [
    ["Our thinking", p.our_thinking],
    ["Scope", p.scope],
    ["Not included", p.not_included],
    ["Timeline", p.timeline],
  ];

  return (
    <div className="proposal-print min-h-screen bg-wash print:bg-white">
      <style>{PRINT_CSS}</style>

      <div className="no-print mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-4 px-4 py-5">
        <Link href={backHref} className="link text-sm">
          Back to Q{p.number}
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-[13px] text-muted">
            In the print window, choose Save as PDF.
          </p>
          <PrintButton />
        </div>
      </div>

      <div className="sheet mx-auto max-w-[210mm] bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <td>
                <div className="h-[14mm]" />
              </td>
            </tr>
          </thead>
          <tfoot>
            <tr>
              <td>
                {/* Keeps room on every printed page for the footer below. */}
                <div className="h-[18mm]" />
              </td>
            </tr>
          </tfoot>
          <tbody>
            <tr>
              <td className="px-[18mm] align-top">
                {draft && (
                  <p className="mb-[8mm] border border-ink px-4 py-2.5 text-[10pt] font-medium">
                    Draft. Not approved yet, so not for sending.
                  </p>
                )}

                <header className="border-b border-ink pb-[9mm]">
                  <div className="flex items-baseline justify-between gap-6">
                    <span className="text-[17pt] font-bold tracking-[0.04em]">
                      LIVBRID
                    </span>
                    <span className="text-[9.5pt] text-muted">
                      Proposal Q{p.number},{" "}
                      {formatDay(p.issued_on, { withYear: true })}
                    </span>
                  </div>
                  <h1 className="mt-[16mm] max-w-[30ch] text-[27pt] font-semibold leading-[1.08] tracking-[-0.02em]">
                    {p.title}
                  </h1>
                  <p className="mt-[5mm] font-serif text-[17pt] italic leading-snug">
                    Prepared for {p.client}
                  </p>
                </header>

                {p.intro && (
                  <Md className="proposal-text proposal-lead mt-[9mm]">
                    {keepBreaks(p.intro)}
                  </Md>
                )}

                {sections
                  .filter(([, v]) => v)
                  .map(([label, v]) => (
                    <Section key={label} label={label}>
                      <Md className="proposal-text">{keepBreaks(v)}</Md>
                    </Section>
                  ))}

                {/* The money starts on its own page, so the price is never split across two. */}
                <Section label="Price" newPage>
                  <table className="w-full border-collapse text-[10.5pt]">
                    <tbody>
                      {lines.map((l) => (
                        <tr
                          key={l.id}
                          className="break-inside-avoid border-b border-line align-top"
                        >
                          <td className="py-[3mm] pr-6">
                            <span className="font-semibold">{l.label}</span>
                            {l.detail && (
                              <span className="mt-1 block leading-snug text-muted">
                                {l.detail}
                              </span>
                            )}
                          </td>
                          <td className="py-[3mm] text-right whitespace-nowrap">
                            {price(l.price_usd, l.per)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="total mt-[5mm] flex break-inside-avoid flex-wrap items-baseline justify-between gap-x-8 gap-y-1 bg-blue px-[6mm] py-[4.5mm] text-white">
                    <span className="text-[10.5pt]">
                      {t.once > 0 ? "Total" : "Every month"}
                    </span>
                    <span className="text-right">
                      <span className="block text-[17pt] font-semibold tracking-[-0.01em]">
                        {t.once > 0 ? price(t.once) : price(t.month, "month")}
                      </span>
                      {t.once > 0 && t.month > 0 && (
                        <span className="block text-[10pt]">
                          then {price(t.month, "month")}
                        </span>
                      )}
                    </span>
                  </div>
                  {p.valid_until && (
                    <p className="mt-[3mm] text-[9.5pt] text-muted">
                      These prices hold until{" "}
                      {formatDay(p.valid_until, { withYear: true })}.
                    </p>
                  )}
                </Section>

                {p.payment_terms && (
                  <Section label="Payment">
                    <Md className="proposal-text">
                      {keepBreaks(p.payment_terms)}
                    </Md>
                  </Section>
                )}
              </td>
            </tr>
          </tbody>
        </table>
        <footer className="sheet-footer flex items-start justify-between gap-6 bg-white px-[18mm] pb-[8mm] text-[8.5pt] text-muted">
          <span>
            <span className="font-bold tracking-[0.04em] text-ink">
              LIVBRID
            </span>
            , Beirut
          </span>
          <span>info@livbrid.com&nbsp;&nbsp;&nbsp;livbrid.com</span>
        </footer>
      </div>
      <div className="no-print h-16" />
    </div>
  );
}

function Section({
  label,
  children,
  newPage = false,
}: {
  label: string;
  children: React.ReactNode;
  newPage?: boolean;
}) {
  return (
    <section
      className={`mt-[10mm] flex gap-x-[6mm] ${newPage ? "print:mt-0 print:break-before-page" : ""}`}
    >
      <h2 className="w-[34mm] shrink-0 font-serif text-[15pt] italic leading-tight">
        {label}
      </h2>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

const PRINT_CSS = `
@page { size: A4; margin: 0; }
.proposal-print .sheet { outline: 1px solid var(--color-line); }
.proposal-print .proposal-text { font-size: 10.5pt; line-height: 1.55; }
.proposal-print .proposal-text > * + * { margin-top: 0.7em; }
.proposal-print .proposal-lead { font-size: 13pt; line-height: 1.5; }
.proposal-print .proposal-text ul { padding-left: 1.1em; }
.proposal-print .proposal-text li + li { margin-top: 0.25em; }
@media print {
  html, body { background: #fff !important; }
  .no-print { display: none !important; }
  .proposal-print .sheet, .proposal-print .sheet-footer { outline: none; max-width: none; }
  .proposal-print .sheet-footer { position: fixed; left: 0; right: 0; bottom: 0; height: 16mm; max-width: none; padding-bottom: 0; align-items: center; }
  .proposal-print .total, .proposal-print .sheet { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .proposal-print h1, .proposal-print h2 { break-after: avoid; }
  .proposal-print p, .proposal-print li { orphans: 3; widows: 3; }
}
`;
