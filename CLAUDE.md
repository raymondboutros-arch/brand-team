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
7. **Brand identity.** Black `#111111`, LIVBRID blue `#2447E0`, paper `#FAFAF7`. HQ's second
   palette, for HQ only (decided 3 Oct, option B "cobalt and saffron"; livbrid.com stays black, blue and paper): sky `#8EA6F2`, saffron `#E9A23B`, sky
   wash `#EEF1FD`, sand wash `#FBF3E4`. Cobalt marks progress and done, sky marks in progress and
   history, saffron marks what needs someone (waiting, high impact), the sand wash tints a card
   that needs attention. One blue *button* per screen. Colour lives in marks, never in text: links
   stay black and underlined. Blue is a fill with white text, never text on black. Type: Schibsted
   Grotesk, Instrument Serif italic for accents.
8. **Writing.** Plain language, no em dashes, written like an experienced agency, not software.

## Database changes

- Add a new file in `supabase/migrations/` (timestamped) and apply the same SQL to the project.
- After any schema change, run the Supabase security and performance advisors and fix warnings.

## Updating HQ from a Claude chat (until the connector ships)

Ray asks in chat; Claude writes through the Supabase connector with SQL, acting as Ray so the
activity log reads "Ray, through Claude". Start every write with:

```sql
select set_config('request.jwt.claims', '{"sub":"<Ray user id>","role":"authenticated","aal":"aal2"}', true);
select set_config('request.headers', '{"x-hq-via":"claude"}', true);
```

Bulk maintenance (imports, test accounts) adds `select set_config('app.skip_log', 'on', true);`
and writes one summary line to `activity` instead of one per row.

`aal2` matters: the action queue's guard trigger checks the role through `private.can_edit`, which
needs two-step. To add a finding, insert into `public.actions` (workspace_id, title, area, impact,
finding, evidence_url, fix, owner, due_on). The number (A1, A2...) and `source = 'claude'` are set
by the database from the header; findings start as waiting and only a person approves them.

Proposals follow the same rule: Claude may draft `our_thinking` (marked `thinking_by = 'claude'`), but the
database refuses an approval that comes through Claude. Close a proposal with `select public.close_proposal(id,
'won' | 'lost', said, think)` so the project is created with it.

Content: add an idea by inserting into `public.content_items` (workspace_id, title, format, series, channel_id, owner,
due_on, brief, fact; stage 'idea' or 'draft'). The number (C1, C2...), `source = 'claude'` and the review token are set by
the database. Claude may write `body_md` and send a draft for approval (`review_requested_at`), but the database refuses
an approval through Claude, and only the Owner or a client approver can approve. Changing approved words sends it back
to draft. The review link `/review/<token>` opens one draft or approved item, read only, through
`public.content_for_review()`, the only function anon can call.

Visibility is filled through Claude until the connections land: a finished week of Search Console goes in
`visibility_google` (week_of is a Monday; brand searches are those containing livbrid or creative couple), and an AI
check is one `visibility_ai_runs` row with one `visibility_ai_answers` row per prompt, assistant and attempt.

## Build order (version 1)

Done: setup and sign-in (30 Sep); Plan, Brand strategy, Scorecard and Reference, imported from
the Claude docs on 1 Oct; Action queue (2 Oct, planned for 16 Oct); Projects with Owner-only money, hours and
profit (2 Oct, planned for 30 Oct); Proposals with the price list, enquiries and the PDF (2 Oct, planned for
6 Nov); Visibility with 13 weeks of Search Console and the AI baseline (3 Oct; the direct Search Console
connection, Check now and the Claude connector stay on 13 Nov); Channels (3 Oct, planned for 23 Oct: every account with its
owner, login email, two-step and password manager flags, no password column; platform connections come later); Content (3 Oct,
planned for 30 Oct: idea bank, board and calendar, review links). Version 1 modules are all in; next are the 13 Nov
connections (Search Console, Check now, the Claude connector).
Prices live only in the database (`price_list`), never in a migration file: the repo may be public.
Module list: `src/lib/modules.ts`.

Projects, Proposals and Visibility come from Ray's list of 1 October; the spec section
"Studio modules: Ray's list, 1 October" has the fields and rules. Studio money (payments, costs,
hours, profit) is Owner only (`private.is_owner`) and lives only in the LIVBRID workspace, never in
a client's. Close-out answers are facts (hours, invoiced, paid, outside costs), not 1 to 5 scores.
