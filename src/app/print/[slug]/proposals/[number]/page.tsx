import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/hq";
import { getProposal } from "@/lib/proposals";
import { ProposalDocument } from "./proposal-document";

async function load(slug: string, raw: string) {
  if (!/^\d{1,5}$/.test(raw)) notFound();
  const workspace = await getWorkspace(slug);
  if (!workspace.isStudio || (workspace.role !== "owner" && workspace.role !== "team")) notFound();
  const found = await getProposal(workspace.id, Number(raw));
  if (!found) notFound();
  return found;
}

export async function generateMetadata({ params }: PageProps<"/print/[slug]/proposals/[number]">): Promise<Metadata> {
  const { slug, number } = await params;
  const { proposal } = await load(slug, number);
  // Also the PDF's file name.
  return { title: { absolute: `LIVBRID proposal Q${proposal.number}, ${proposal.client}` } };
}

export default async function ProposalPrint({ params }: PageProps<"/print/[slug]/proposals/[number]">) {
  const { slug, number } = await params;
  const { proposal, lines } = await load(slug, number);
  return <ProposalDocument proposal={proposal} lines={lines} backHref={`/w/${slug}/proposals/${proposal.number}`} />;
}
