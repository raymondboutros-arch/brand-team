"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function VerifyTwoStep() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();

    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.[0];
    if (listError || !factor) {
      setBusy(false);
      setError("We couldn't find your authenticator. Sign out and sign in again.");
      return;
    }

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: code.replace(/\s/g, ""),
    });
    if (error) {
      setBusy(false);
      setError("That code didn't match. Try the newest code in your app.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-8">
      <label htmlFor="code" className="label">
        6-digit code
      </label>
      <div className="flex gap-2">
        <input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={7}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="field max-w-[160px] tracking-[0.2em] tabular-nums"
          placeholder="123456"
          aria-describedby={error ? "code-error" : undefined}
        />
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? "Checking…" : "Continue"}
        </button>
      </div>
      {error && (
        <p id="code-error" role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
