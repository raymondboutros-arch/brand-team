import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getViewer, getWorkspace } from "@/lib/hq";
import { NameForm } from "./name-form";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage({ params }: PageProps<"/w/[slug]/account">) {
  const { slug } = await params;
  const [viewer] = await Promise.all([getViewer(), getWorkspace(slug)]);
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp?.[0];

  return (
    <div className="max-w-[640px]">
      <h1 className="text-[34px] leading-[1.1] font-semibold tracking-[-0.015em]">Your account</h1>

      <section className="mt-8 card p-6" aria-labelledby="name-h">
        <h2 id="name-h" className="text-lg font-semibold">Your name</h2>
        <p className="mt-1 mb-4 text-sm text-muted">Shown to the rest of the team and in the activity log.</p>
        <NameForm initial={viewer.name ?? ""} />
      </section>

      <section className="mt-6 card p-6" aria-labelledby="signin-h">
        <h2 id="signin-h" className="text-lg font-semibold">Sign-in</h2>
        <dl className="mt-3 grid gap-3 text-[15px]">
          <div className="flex gap-3">
            <dt className="w-36 shrink-0 text-muted">Email</dt>
            <dd>{viewer.email}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-36 shrink-0 text-muted">Two-step sign-in</dt>
            <dd>
              {totp ? (
                <>
                  On, with an authenticator app
                  <span className="block text-sm text-muted">
                    Lost your phone? Ask Ray to reset it from the Supabase dashboard.
                  </span>
                </>
              ) : (
                "Off"
              )}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
