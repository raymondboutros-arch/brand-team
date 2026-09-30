import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages anyone can open without signing in.
const PUBLIC_PATHS = ["/sign-in", "/auth/callback"];
// Pages for someone who is signed in but hasn't finished two-step sign-in.
const TWO_STEP_PATHS = ["/two-step/setup", "/two-step/verify", "/auth/sign-out"];

function startsWithAny(path: string, prefixes: string[]) {
  return prefixes.some((p) => path === p || path.startsWith(p + "/"));
}

/**
 * Runs before every page. It keeps the session fresh and sends people to the
 * right step: sign in, set up two-step sign-in, or enter a code.
 * This is a convenience check only. The database enforces access on its own.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Do not add code between creating the client and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;

  const redirectTo = (to: string, keepNext = false) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = "";
    if (keepNext && path !== "/") url.searchParams.set("next", path);
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!signedIn) {
    return startsWithAny(path, PUBLIC_PATHS) ? response : redirectTo("/sign-in", true);
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsSetup = aal?.nextLevel !== "aal2";
  const needsCode = aal?.currentLevel !== "aal2" && aal?.nextLevel === "aal2";

  if (needsSetup) {
    return startsWithAny(path, ["/two-step/setup", "/auth"]) ? response : redirectTo("/two-step/setup");
  }
  if (needsCode) {
    return startsWithAny(path, ["/two-step/verify", "/auth"]) ? response : redirectTo("/two-step/verify");
  }
  if (path === "/sign-in" || startsWithAny(path, TWO_STEP_PATHS.slice(0, 2))) {
    return redirectTo("/");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
