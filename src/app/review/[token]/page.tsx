import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { Md } from "@/components/markdown";
import { dayInBeirut, formatDay } from "@/lib/dates";

/**
 * A draft opened by its review link, without signing in. The link is a 64-character random token;
 * the database returns that one draft (title and text only) while it is a draft or approved, and
 * nothing else. No brief, no internal notes, no other content, no way back into HQ.
 */

export const metadata: Metadata = {
  title: { absolute: "Draft for review" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

type Review = {
  brand: string;
  number: number;
  title: string;
  format: string;
  body_md: string | null;
  stage: string;
  updated_at: string;
};

async function load(token: string): Promise<Review | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("content_for_review", { p_token: token });
  if (error || !Array.isArray(data) || data.length === 0) return null;
  return data[0] as Review;
}

export default async function ReviewPage({ params }: PageProps<"/review/[token]">) {
  const { token } = await params;
  const draft = await load(token);

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-[720px] px-4 py-10 sm:px-8 sm:py-16">
        {!draft ? (
          <>
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.015em]">This link doesn&apos;t open a draft</h1>
            <p className="mt-3 max-w-[56ch] text-[17px] leading-relaxed text-muted">
              It may have been replaced with a new one, or the piece has moved past review. Ask the person who sent
              it for the current link.
            </p>
          </>
        ) : (
          <>
            <p className="text-[15px] text-muted">
              {draft.brand}, draft for review, last changed {formatDay(dayInBeirut(draft.updated_at), { withYear: true })}
            </p>
            <h1 className="mt-4 text-[34px] font-semibold leading-[1.08] tracking-[-0.02em] sm:text-[42px]">{draft.title}</h1>
            <article className="mt-10">
              {draft.body_md?.trim() ? (
                <Md className="md-read">{draft.body_md}</Md>
              ) : (
                <p className="text-muted">The text hasn&apos;t been written yet.</p>
              )}
            </article>
            <p className="mt-16 border-t border-line pt-5 text-[13px] leading-relaxed text-muted">
              A draft shared for review, not for publishing. Please keep the link to yourself and send your comments
              to the person who shared it.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
