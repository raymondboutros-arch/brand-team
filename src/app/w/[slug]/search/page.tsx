import type { Metadata } from "next";
import Link from "next/link";
import { getWorkspace } from "@/lib/hq";
import { KIND_LABEL, searchHQ, type Hit, type Kind } from "@/lib/search";

export const metadata: Metadata = { title: "Search" };

const ORDER: Kind[] = ["page", "project", "proposal", "enquiry", "decision", "action", "channel", "task", "workstream", "line", "metric"];

/** Wraps every search word in the text in a <mark>. */
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!text) return null;
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="search-hit">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export default async function SearchPage({ params, searchParams }: PageProps<"/w/[slug]/search">) {
  const { slug } = await params;
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q ?? "").slice(0, 120).trim();
  const workspace = await getWorkspace(slug);
  const { terms, hits } = query ? await searchHQ(workspace.id, query) : { terms: [], hits: [] as Hit[] };
  const base = `/w/${slug}`;

  const groups = ORDER.map((k) => ({ kind: k, hits: hits.filter((h) => h.kind === k) })).filter((g) => g.hits.length);

  return (
    <div className="max-w-[880px]">
      <h1 className="page-title">Search</h1>
      <form action={`${base}/search`} method="get" role="search" className="mt-6 flex gap-3">
        <label htmlFor="q" className="sr-only">
          Search {workspace.name} HQ
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          autoFocus={!query}
          placeholder="A name, a client, a decision, a word from a note"
          className="field h-12 flex-1 text-[17px]"
        />
        <button type="submit" className="btn btn-primary h-12 px-5">
          Search
        </button>
      </form>

      {query && terms.length === 0 && (
        <p className="mt-8 text-muted">Type at least two letters to search.</p>
      )}

      {terms.length > 0 && hits.length === 0 && (
        <div className="mt-10 max-w-[60ch]">
          <p className="text-[17px]">
            Nothing in HQ matches <span className="font-semibold">{query}</span>.
          </p>
          <p className="mt-2 text-muted">
            Every word has to appear in the same place. Try fewer words, or one name like Moe, Clutch or Massoud.
          </p>
        </div>
      )}

      {hits.length > 0 && (
        <>
          <p className="mt-6 text-sm text-muted">
            {hits.length} {hits.length === 1 ? "result" : "results"} for{" "}
            <span className="font-medium text-ink">{query}</span>
          </p>
          <nav aria-label="Jump to" className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-b border-line pb-3 text-sm">
            {groups.map((g) => (
              <a key={g.kind} href={`#k-${g.kind}`} className="link">
                {KIND_LABEL[g.kind]} <span className="text-faint no-underline">{g.hits.length}</span>
              </a>
            ))}
          </nav>
          {groups.map((g) => (
            <section key={g.kind} id={`k-${g.kind}`} className="mt-10 scroll-mt-6" aria-labelledby={`h-${g.kind}`}>
              <h2 id={`h-${g.kind}`} className="text-[13px] font-medium text-muted">
                {KIND_LABEL[g.kind]}
              </h2>
              <ul className="mt-2 divide-y divide-line border-y border-line">
                {g.hits.map((h) => (
                  <li key={h.id}>
                    <Link
                      href={`${base}/${h.href}`}
                      className={`group py-4 ${h.mark ? "grid grid-cols-[44px_1fr] gap-x-3 sm:grid-cols-[56px_1fr]" : "block"}`}
                    >
                      {h.mark && <span className="ref-mark text-[24px] leading-[1.1] text-ink">{h.mark}</span>}
                      <span className="block min-w-0">
                        <span className="block font-medium leading-snug group-hover:underline group-hover:underline-offset-4">
                          <Highlight text={h.title} terms={terms} />
                        </span>
                        {h.meta && <span className="mt-0.5 block text-[13px] text-muted">{h.meta}</span>}
                        {h.snippet && (
                          <span className="mt-1.5 block max-w-[72ch] text-[15px] leading-relaxed text-muted">
                            <Highlight text={h.snippet} terms={terms} />
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {!query && (
        <p className="mt-8 max-w-[60ch] text-muted">
          Searches the plan, decisions, tasks, the Action queue, brand strategy, Reference and the Scorecard. Press{" "}
          <kbd className="rounded border border-line-strong px-1.5 text-[13px]">/</kbd> anywhere in HQ to search.
        </p>
      )}
    </div>
  );
}
