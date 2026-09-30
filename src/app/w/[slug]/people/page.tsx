import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatWhen, getViewer, getWorkspace, ROLE_LABEL, type Role } from "@/lib/hq";
import { InviteForm } from "./invite-form";
import { cancelInvite, changeRole, removePerson } from "./actions";

export const metadata: Metadata = { title: "People" };

const ROLE_HELP: { role: string; can: string }[] = [
  { role: "Owner", can: "Everything: invite people, connect accounts, approve guideline changes." },
  { role: "Team", can: "Edit the plan, content and channels. Propose guideline changes. Approve actions." },
  { role: "Client roles", can: "Approver and viewer, for client brands from 2027." },
];

export default async function PeoplePage({ params }: PageProps<"/w/[slug]/people">) {
  const { slug } = await params;
  const [viewer, workspace] = await Promise.all([getViewer(), getWorkspace(slug)]);
  const isOwner = workspace.role === "owner";
  const supabase = await createClient();

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("members")
      .select("user_id, role, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true }),
    isOwner
      ? supabase
          .from("invites")
          .select("id, email, role, created_at")
          .eq("workspace_id", workspace.id)
          .is("accepted_at", null)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; email: string; role: Role; created_at: string }[] }),
  ]);

  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", ids)
    : { data: [] as { id: string; email: string; full_name: string | null }[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (
    <div className="max-w-[880px]">
      <p className="eyebrow">{workspace.name}</p>
      <h1 className="mt-2 text-[34px] leading-[1.1] font-semibold tracking-[-0.015em]">People</h1>
      <p className="mt-3 text-muted">Everyone signs in with their own email and two-step sign-in. No shared logins.</p>

      <section className="mt-8 card overflow-hidden" aria-labelledby="members-h">
        <h2 id="members-h" className="px-5 pt-5 text-lg font-semibold">
          With access
        </h2>
        <ul className="mt-2 divide-y divide-line">
          {(members ?? []).map((m) => {
            const p = profileById.get(m.user_id);
            const isMe = m.user_id === viewer.id;
            return (
              <li key={m.user_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    {p?.full_name ?? p?.email ?? "Unknown"} {isMe && <span className="text-sm font-normal text-muted">(you)</span>}
                  </p>
                  {p?.full_name && <p className="text-sm text-muted truncate">{p.email}</p>}
                </div>
                {isOwner && !isMe ? (
                  <div className="flex items-center gap-3">
                    <form action={changeRole.bind(null, slug)} className="flex items-center gap-2">
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <label className="sr-only" htmlFor={`role-${m.user_id}`}>Role</label>
                      <select
                        id={`role-${m.user_id}`}
                        name="role"
                        defaultValue={m.role}
                        className="field h-9 w-auto pr-8 text-sm"
                      >
                        <option value="team">Team</option>
                        <option value="owner">Owner</option>
                      </select>
                      <button className="btn-quiet">Save</button>
                    </form>
                    <form action={removePerson.bind(null, slug)}>
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <button className="btn-quiet hover:text-danger">Remove</button>
                    </form>
                  </div>
                ) : (
                  <span className="text-sm text-muted">{ROLE_LABEL[m.role as Role]}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {isOwner && (
        <section className="mt-6 card p-5" aria-labelledby="invite-h">
          <h2 id="invite-h" className="text-lg font-semibold">Invite someone</h2>
          <p className="mt-1 mb-5 text-sm text-muted">
            HQ doesn’t send an email. Tell them to open HQ and sign in with the address you enter here.
          </p>
          <InviteForm slug={slug} />

          {invites && invites.length > 0 && (
            <div className="mt-6 border-t border-line pt-4">
              <h3 className="text-sm font-semibold">Waiting to sign in</h3>
              <ul className="mt-2 divide-y divide-line">
                {invites.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span>
                      {i.email} <span className="text-sm text-muted">· {ROLE_LABEL[i.role as Role]} · invited {formatWhen(i.created_at)}</span>
                    </span>
                    <form action={cancelInvite.bind(null, slug)}>
                      <input type="hidden" name="id" value={i.id} />
                      <button className="btn-quiet">Cancel invite</button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="mt-6" aria-labelledby="roles-h">
        <h2 id="roles-h" className="text-sm font-semibold">What each role can do</h2>
        <dl className="mt-2 grid gap-2 text-sm">
          {ROLE_HELP.map((r) => (
            <div key={r.role} className="flex gap-3">
              <dt className="w-28 shrink-0 font-medium">{r.role}</dt>
              <dd className="text-muted">{r.can}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
