@AGENTS.md

# LIVBRID HQ

LIVBRID's brand workspace (product working name: My Brand Team). One workspace per brand.
LIVBRID is the first workspace, Pro Ink the second. The product spec lives in the Claude doc
"My Brand Team: Product Spec v1"; read it before adding a module.

## Stack

- Next.js 16 (App Router, `src/`), TypeScript, Tailwind CSS v4. Middleware is `src/proxy.ts`.
- Supabase project `livbrid-hq` (ref `vvvzmwdwwhcgnvlxslsm`, Frankfurt): Postgres, Auth, Storage.
- Hosted on Vercel. Every push to `main` deploys.

## Rules that are not negotiable

1. **Every brand is walled off by the database.** Every table with brand data has a
   `workspace_id` and row level security using the helpers in the `private` schema:
   `private.can_read(ws)`, `private.can_edit(ws)`, `private.is_owner(ws)`. Screens are a
   convenience, never the protection.
2. **Owner and Team need two-step sign-in (aal2).** The helpers already check it. Don't
   write policies that bypass them.
3. **No passwords, ever.** Accounts connect through each platform's official sign-in (OAuth).
   Tokens go in an encrypted column, never shown back.
4. **Secrets never go in code, the repo or a chat.** Public values (`NEXT_PUBLIC_*`) live in
   Vercel env settings and `.env.local`. The app does not use the Supabase secret key.
5. **The AI proposes, people approve.** Nothing leaves the platform without a person approving.
6. **Everything is logged.** Add `private.log_change()`-style triggers for new tables so the
   activity log records who changed what. Requests from the Claude connector send the header
   `x-hq-via: claude` and are logged as "through Claude".
7. **Brand identity.** Black `#111111`, LIVBRID blue `#2447E0`, paper `#FAFAF7`. One blue
   element per screen (the primary button). Links stay black and underlined. Blue is a fill with
   white text, never text on black. Type: Schibsted Grotesk, Instrument Serif italic for accents.
8. **Writing.** Plain language, no em dashes, written like an experienced agency, not software.

## Database changes

- Add a new file in `supabase/migrations/` (timestamped) and apply the same SQL to the project.
- After any schema change, run the Supabase security and performance advisors and fix warnings.

## Build order (version 1)

Setup and sign-in (done) · Plan, tasks, decisions, action queue (16 Oct) · Brand and channels
(23 Oct) · Content, scorecard, audit (30 Oct) · Claude connector and Search Console (13 Nov) ·
Docs move into HQ (16 Nov). Module list and dates: `src/lib/modules.ts`.
