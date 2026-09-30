"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function sendSignInLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = String(formData.get("next") ?? "/");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Enter a full email address.", email };
  }

  const supabase = await createClient();
  const callback = new URL("/auth/callback", await siteOrigin());
  if (next.startsWith("/") && next !== "/") callback.searchParams.set("next", next);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callback.toString() },
  });

  if (error) {
    const text = error.message.toLowerCase();
    if (text.includes("not authorized")) {
      return {
        status: "error",
        email,
        message: "HQ can't email this address yet. Ask Ray to finish the email setup, then try again.",
      };
    }
    // Hourly cap on sign-in emails (Supabase's built-in sender allows very few per hour).
    if (error.code === "over_email_send_rate_limit" || text.includes("email rate limit")) {
      return {
        status: "error",
        email,
        message:
          "HQ has sent its limit of sign-in emails for this hour. Use the last link you received, or try again in an hour.",
      };
    }
    // Per-address wait between two requests, usually under a minute.
    const wait = text.match(/after (\d+) seconds?/);
    if (wait || error.status === 429 || text.includes("security purposes")) {
      return {
        status: "error",
        email,
        message: wait
          ? `A link was just sent. You can ask for another in ${wait[1]} seconds.`
          : "Too many requests. Wait a few minutes and try again.",
      };
    }
    return { status: "error", email, message: "We couldn't send the link. Try again in a moment." };
  }

  return { status: "sent", email };
}
