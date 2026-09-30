import type { Metadata } from "next";
import { Wordmark } from "@/components/wordmark";
import { VerifyTwoStep } from "./verify-two-step";

export const metadata: Metadata = { title: "Enter your code" };

export default function VerifyPage() {
  return (
    <main className="min-h-screen grid place-items-center px-4 py-16">
      <div className="w-full max-w-[400px]">
        <Wordmark />
        <h1 className="mt-10 text-[28px] leading-[1.15] font-semibold tracking-[-0.01em]">
          Enter your code
        </h1>
        <p className="mt-3 text-muted">Open your authenticator app and type the code for LIVBRID HQ.</p>
        <VerifyTwoStep />
        <form action="/auth/sign-out" method="post" className="mt-10">
          <button className="btn-quiet">Sign in with a different email</button>
        </form>
      </div>
    </main>
  );
}
