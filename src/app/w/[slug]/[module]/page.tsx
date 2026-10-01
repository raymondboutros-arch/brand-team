import type { Metadata } from "next";
import Link from "next/link";
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
  if (!mod || mod.ready) notFound();
  await getWorkspace(slug);

  return (
    <div className="max-w-[720px]">
      <p className="eyebrow">Lands {mod.lands}</p>
      <h1 className="mt-2 text-[34px] leading-[1.1] font-semibold tracking-[-0.015em]">{mod.label}</h1>
      <p className="mt-4 text-[17px] leading-relaxed text-muted">{mod.summary}</p>
      {mod.until && (
        <div className="mt-8 card p-6">
          <p>
            {mod.until.text}{" "}
            <Link href={`/w/${slug}/${mod.until.path}`} className="link">
              {mod.until.label}
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
