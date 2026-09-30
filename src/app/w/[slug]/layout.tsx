import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { getMyWorkspaces, getViewer, getWorkspace, ROLE_LABEL } from "@/lib/hq";
import { MODULES } from "@/lib/modules";
import { NavLink } from "./nav-link";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/w/[slug]">) {
  const { slug } = await params;
  const [viewer, workspace, all] = await Promise.all([getViewer(), getWorkspace(slug), getMyWorkspaces()]);
  const base = `/w/${workspace.slug}`;
  const displayName = viewer.name ?? viewer.email;

  const nav = (
    <nav aria-label="Workspace" className="flex flex-col gap-6">
      <div>
        <NavLink href={base} exact>Overview</NavLink>
        {MODULES.map((m) => (
          <NavLink key={m.key} href={`${base}/${m.key}`} note={m.ready ? undefined : m.lands.replace("Friday ", "")}>
            {m.label}
          </NavLink>
        ))}
      </div>
      <div>
        <p className="eyebrow px-3 mb-1.5 text-paper/45">Workspace</p>
        <NavLink href={`${base}/people`}>People</NavLink>
        <NavLink href={`${base}/activity`}>Activity</NavLink>
        <NavLink href={`${base}/account`}>Your account</NavLink>
      </div>
    </nav>
  );

  const switcher = (
    <div className="rounded-md border border-paper/15 px-3 py-2.5">
      <p className="text-[15px] font-semibold text-paper">{workspace.name}</p>
      <p className="text-xs text-paper/60">
        {ROLE_LABEL[workspace.role]}
        {all.length > 1 || viewer.isPlatformAdmin ? (
          <>
            {" · "}
            <Link href="/workspaces" className="underline underline-offset-2 hover:text-paper">
              Switch
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );

  const footer = (
    <div className="border-t border-paper/15 pt-4">
      <p className="truncate text-sm text-paper">{displayName}</p>
      <form action="/auth/sign-out" method="post">
        <button className="text-xs text-paper/60 underline underline-offset-2 hover:text-paper">Sign out</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex sticky top-0 h-screen flex-col gap-6 bg-ink px-4 py-6 overflow-y-auto">
        <Link href={base} className="px-3">
          <Wordmark tone="paper" />
        </Link>
        {switcher}
        <div className="flex-1">{nav}</div>
        {footer}
      </aside>

      {/* Phone and tablet */}
      <details className="lg:hidden group bg-ink text-paper">
        <summary className="flex items-center justify-between px-4 h-14 cursor-pointer list-none">
          <Wordmark tone="paper" />
          <span className="text-sm text-paper/80">
            <span className="group-open:hidden">Menu</span>
            <span className="hidden group-open:inline">Close</span>
          </span>
        </summary>
        <div className="flex flex-col gap-6 px-4 pb-6">
          {switcher}
          {nav}
          {footer}
        </div>
      </details>

      <main className="min-w-0 px-4 py-8 sm:px-8 lg:px-12 lg:py-10">{children}</main>
    </div>
  );
}
