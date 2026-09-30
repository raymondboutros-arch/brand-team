import type { Metadata } from "next";
import { Wordmark } from "@/components/wordmark";
import { SetupTwoStep } from "./setup-two-step";

export const metadata: Metadata = { title: "Set up two-step sign-in" };

export default function SetupPage() {
  return (
    <main className="min-h-screen grid place-items-center px-4 py-16">
      <div className="w-full max-w-[440px]">
        <Wordmark />
        <p className="eyebrow mt-10">One-time setup</p>
        <h1 className="mt-2 text-[28px] leading-[1.15] font-semibold tracking-[-0.01em]">
          Protect HQ with two-step sign-in
        </h1>
        <p className="mt-3 text-muted">
          HQ holds every account and plan for the brand, so a second step is required. Use any
          authenticator app: Google Authenticator, Microsoft Authenticator or 1Password.
        </p>
        <SetupTwoStep />
        <form action="/auth/sign-out" method="post" className="mt-10">
          <button className="btn-quiet">Sign out</button>
        </form>
      </div>
    </main>
  );
}
