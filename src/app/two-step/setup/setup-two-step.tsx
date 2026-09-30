"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Enrolment = { factorId: string; qr: string; secret: string };

export function SetupTwoStep() {
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const supabase = createClient();

    (async () => {
      // Clear any half-finished setup from an earlier visit.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const f of factors?.all ?? []) {
        if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `LIVBRID HQ ${new Date().toISOString().slice(0, 10)}`,
        issuer: "LIVBRID HQ",
      });
      if (error || !data) {
        setError("We couldn't start the setup. Reload the page to try again.");
        return;
      }
      setEnrolment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
  }, []);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolment) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrolment.factorId,
      code: code.replace(/\s/g, ""),
    });
    if (error) {
      setBusy(false);
      setError("That code didn't match. Check the time on your phone and try the newest code.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  if (!enrolment) {
    return (
      <div className="mt-8 card p-6 text-sm text-muted" aria-live="polite">
        {error ?? "Preparing your setup code…"}
      </div>
    );
  }

  return (
    <div className="mt-8 card p-6">
      <ol className="space-y-6 text-[15px]">
        <li>
          <p className="font-medium">1. Scan this with your authenticator app</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enrolment.qr}
            alt="QR code for your authenticator app"
            width={176}
            height={176}
            className="mt-3 rounded-md border border-line bg-white p-2"
          />
          <details className="mt-3 text-sm text-muted">
            <summary className="cursor-pointer underline underline-offset-4">Can’t scan? Enter this key instead</summary>
            <code className="mt-2 block break-all rounded bg-wash px-2 py-1.5 text-ink">{enrolment.secret}</code>
          </details>
        </li>
        <li>
          <form onSubmit={confirm}>
            <label htmlFor="code" className="font-medium block">
              2. Enter the 6-digit code it shows
            </label>
            <div className="mt-3 flex gap-2">
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="field max-w-[160px] tracking-[0.2em] tabular-nums"
                placeholder="123456"
                aria-describedby={error ? "code-error" : undefined}
              />
              <button type="submit" disabled={busy} className="btn btn-primary">
                {busy ? "Checking…" : "Turn on"}
              </button>
            </div>
            {error && (
              <p id="code-error" role="alert" className="mt-2 text-sm text-danger">
                {error}
              </p>
            )}
          </form>
        </li>
      </ol>
    </div>
  );
}
