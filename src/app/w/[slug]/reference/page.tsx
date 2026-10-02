import type { Metadata } from "next";
import { Md } from "@/components/markdown";
import { getWorkspace } from "@/lib/hq";
import { getSections } from "@/lib/plan";

export const metadata: Metadata = { title: "Reference" };

export default async function ReferencePage({ params }: PageProps<"/w/[slug]/reference">) {
  const { slug } = await params;
  const workspace = await getWorkspace(slug);
  const { list, byKey } = await getSections(workspace.id, "reference");
  const parts = list.filter((x) => x.key !== "intro");

  return (
    <div className="max-w-[1040px]">
      <h1 className="page-title">Reference</h1>
      <Md className="page-intro">{byKey.intro?.body_md}</Md>

      <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-y border-line py-3 text-sm">
        {parts.map((p) => (
          <a key={p.id} href={`#${p.key}`} className="link">
            {p.title}
          </a>
        ))}
      </nav>

      {parts.map((p) => (
        <section key={p.id} id={p.key} className="mt-12 scroll-mt-6">
          <h2 className="text-[24px] font-semibold tracking-[-0.01em]">{p.title}</h2>
          <Md className="mt-3">{p.body_md}</Md>
        </section>
      ))}
    </div>
  );
}
