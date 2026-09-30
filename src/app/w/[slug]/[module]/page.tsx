import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/hq";
import { findModule } from "@/lib/modules";

export async function generateMetadata({ params }: PageProps<"/w/[slug]/[module]">): Promise<Metadata> {
  const { module } = await params;
  return { title: findModule(module)?.label ?? "Not found" };
}

/** Placeholder for modules that haven't shipped yet. */
export default async function ModulePage({ params }: PageProps<"/w/[slug]/[module]">) {
  const { slug, module: key } = await params;
  const mod = findModule(key);
  if (!mod) notFound();
  await getWorkspace(slug);

  return (
    <div className="max-w-[720px]">
      <p className="eyebrow">Lands {mod.lands}</p>
      <h1 className="mt-2 text-[34px] leading-[1.1] font-semibold tracking-[-0.015em]">{mod.label}</h1>
      <p className="mt-4 text-[17px] leading-relaxed text-muted">{mod.summary}</p>

      <div className="mt-8 card p-6">
        {mod.until ? (
          <p className="prose-hq">
            Until it lands, keep working in the{" "}
            <a href={mod.until.href} target="_blank" rel="noreferrer">
              {mod.until.label}
            </a>{" "}
            doc. It moves into HQ on 16 November and becomes a read-only archive.
          </p>
        ) : (
          <p className="text-muted">Nothing to do here yet. This section starts empty when it lands.</p>
        )}
      </div>
    </div>
  );
}
