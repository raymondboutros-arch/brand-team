import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Md } from "@/components/markdown";
import { dayInBeirut, formatDay } from "@/lib/dates";
import { getWorkspace } from "@/lib/hq";
import { findModule } from "@/lib/modules";
import { getSections } from "@/lib/plan";

export async function generateMetadata({ params }: PageProps<"/w/[slug]/[module]">): Promise<Metadata> {
  const { module } = await params;
  return { title: findModule(module)?.label ?? "Not found" };
}

/**
 * Placeholder for modules that haven't shipped yet. When the information lives in a
 * Reference section until then, that section is shown here too (read only; edits stay in Reference).
 */
export default async function ModulePage({ params }: PageProps<"/w/[slug]/[module]">) {
  const { slug, module: key } = await params;
  const mod = findModule(key);
  if (!mod || mod.ready) notFound();
  const workspace = await getWorkspace(slug);

  const refKey = mod.until?.path.startsWith("reference#") ? mod.until.path.slice("reference#".length) : null;
  const section = refKey ? (await getSections(workspace.id, "reference")).byKey[refKey] : undefined;

  return (
    <div className={section ? "max-w-[1040px]" : "max-w-[720px]"}>
      <p className="eyebrow">Lands {mod.lands}</p>
      <h1 className="mt-3 page-title">{mod.label}</h1>
      <p className="page-intro">{mod.summary}</p>
      {mod.until && (
        <div className="mt-8 max-w-[720px] card p-6">
          <p>
            {mod.until.text}{" "}
            <Link href={`/w/${slug}/${mod.until.path}`} className="link">
              {mod.until.label}
            </Link>
            .{section ? " It's copied below. Make changes there." : ""}
          </p>
        </div>
      )}
      {section && (
        <section className="mt-12">
          <h2 className="text-[24px] font-semibold tracking-[-0.01em]">{section.title}</h2>
          <p className="mt-1 text-sm text-muted">
            From Reference, last updated {formatDay(dayInBeirut(section.updated_at), { withYear: true })}
          </p>
          <Md className="mt-4">{section.body_md}</Md>
        </section>
      )}
    </div>
  );
}
