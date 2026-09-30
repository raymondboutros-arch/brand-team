import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { createClient } from "@/lib/supabase/server";
import { getMyWorkspaces, getViewer, ROLE_LABEL } from "@/lib/hq";
import { NewWorkspaceForm } from "./new-workspace-form";

export const metadata: Metadata = { title: "Workspaces" };

export default async function WorkspacesPage() {
  await (await createClient()).rpc("claim_invites");
  const [viewer, workspaces] = await Promise.all([getViewer(), getMyWorkspaces()]);

  return (
    <main className="mx-auto max-w-[640px] px-4 py-14">
      <div className="flex items-center justify-between">
        <Wordmark />
        <form action="/auth/sign-out" method="post">
          <button className="btn-quiet">Sign out</button>
        </form>
      </div>

      <h1 className="mt-12 text-[28px] font-semibold tracking-[-0.01em]">Workspaces</h1>
      <p className="mt-2 text-muted">Signed in as {viewer.email}</p>

      {workspaces.length === 0 ? (
        <div className="mt-8 card p-6">
          <p className="font-medium">You’re not part of a workspace yet</p>
          <p className="mt-1 text-sm text-muted">
            Ask Ray to invite {viewer.email}. Once he does, reload this page.
          </p>
        </div>
      ) : (
        <ul className="mt-8 card divide-y divide-line">
          {workspaces.map((ws) => (
            <li key={ws.id}>
              <Link href={`/w/${ws.slug}`} className="flex items-center justify-between px-5 py-4 hover:bg-wash">
                <span className="font-medium">{ws.name}</span>
                <span className="text-sm text-muted">{ROLE_LABEL[ws.role]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {viewer.isPlatformAdmin && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold">New brand workspace</h2>
          <p className="mt-1 text-sm text-muted">
            For a client brand such as Pro Ink. You become its Owner and can invite people after.
          </p>
          <NewWorkspaceForm />
        </section>
      )}
    </main>
  );
}
