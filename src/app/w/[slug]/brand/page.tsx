import type { Metadata } from "next";
import { CopyButton } from "@/components/copy-button";
import { Md } from "@/components/markdown";
import { getWorkspace } from "@/lib/hq";
import { formatDay } from "@/lib/dates";
import { getBrandLines, getSections } from "@/lib/plan";

export const metadata: Metadata = { title: "Brand strategy" };

const BIG = new Set(["headline", "subline"]);

export default async function BrandPage({ params }: PageProps<"/w/[slug]/brand">) {
  const { slug } = await params;
  const workspace = await getWorkspace(slug);
  const [{ list, byKey: s }, { lines, versions }] = await Promise.all([
    getSections(workspace.id, "strategy"),
    getBrandLines(workspace.id),
  ]);
  const steps = list.filter((x) => x.key.startsWith("step-"));

  return (
    <div className="max-w-[1040px]">
      <p className="eyebrow">{workspace.name}</p>
      <h1 className="mt-2 text-[34px] leading-[1.1] font-semibold tracking-[-0.015em]">Brand strategy</h1>
      <Md className="mt-4 text-[17px] text-muted">{s["how-to-read"]?.body_md}</Md>

      <section id="fixed-lines" className="mt-12 scroll-mt-6">
        <h2 className="text-[24px] font-semibold tracking-[-0.01em]">The lines that never change</h2>
        <p className="mt-2 text-muted">
          These go out word for word. Changing one means changing it everywhere in the same week. Only the
          Owner can change them, and every past version is kept.
        </p>
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {lines.map((l) => {
            const history = versions.filter((v) => v.line_id === l.id);
            return (
              <li key={l.id} className={`flex flex-col rounded-lg border border-line bg-card p-5 ${BIG.has(l.key) ? "md:col-span-2" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="eyebrow">{l.label}</p>
                  <CopyButton text={l.words} label={l.label} />
                </div>
                <p className={`mt-2 ${BIG.has(l.key) ? "text-[22px] leading-snug font-semibold tracking-[-0.01em]" : "text-[15px] leading-relaxed"}`}>
                  {l.words}
                </p>
                {l.where_used && <p className="mt-3 text-[13px] text-muted">Used on: {l.where_used}</p>}
                {history.length > 0 && (
                  <details className="mt-2 text-[13px] text-muted">
                    <summary className="cursor-pointer underline underline-offset-4">
                      {history.length} earlier {history.length === 1 ? "version" : "versions"}
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {history.map((v) => (
                        <li key={v.valid_until}>
                          <span className="block text-faint">Until {formatDay(v.valid_until.slice(0, 10), { withYear: true })}</span>
                          {v.words}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-[24px] font-semibold tracking-[-0.01em]">The six steps</h2>
        <div className="mt-5 overflow-x-auto rounded-lg border border-line bg-card">
          <table className="w-full text-left text-[15px]">
            <thead className="bg-wash text-[13px] text-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Step</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">What it settles</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {steps.map((st) => (
                <tr key={st.id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <a href={`#${st.key}`} className="link">{st.title.replace(/^Step /, "")}</a>
                  </td>
                  <td className="px-4 py-3 text-muted">{st.summary}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{st.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {steps.map((st) => (
        <section key={st.id} id={st.key} className="mt-14 scroll-mt-6 border-t border-line pt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[26px] font-semibold tracking-[-0.01em]">{st.title}</h2>
            <p className="text-sm text-muted">{st.status}</p>
          </div>
          <Md className="mt-4">{st.body_md}</Md>
        </section>
      ))}

      {s["open-items"] && (
        <section id="open-items" className="mt-14 scroll-mt-6 rounded-lg border border-line bg-card p-6">
          <h2 className="text-[20px] font-semibold">{s["open-items"].title}</h2>
          <Md className="mt-3">{s["open-items"].body_md}</Md>
        </section>
      )}
    </div>
  );
}
