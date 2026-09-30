import type { Metadata } from "next";
import { Wordmark } from "@/components/wordmark";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link: "That sign-in link has expired or was opened in a different browser. Ask for a new one below.",
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next, error } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") ? next : "/";
  const errorText = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="min-h-screen grid place-items-center px-4 py-16">
      <div className="w-full max-w-[400px]">
        <Wordmark />
        <h1 className="mt-10 text-[32px] leading-[1.1] font-semibold tracking-[-0.01em]">
          Sign in to <span className="font-serif italic font-normal">your</span> brand workspace
        </h1>
        <p className="mt-3 text-muted">
          We email you a link. No password to remember.
        </p>
        {errorText && (
          <p role="alert" className="mt-6 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {errorText}
          </p>
        )}
        <SignInForm next={nextPath} />
        <p className="mt-10 text-sm text-faint">
          HQ is for the LIVBRID team. If you should have access, ask Ray to invite your email.
        </p>
      </div>
    </main>
  );
}
