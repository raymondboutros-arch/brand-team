import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { countWaiting } from "@/lib/actions";
import { getMyWorkspaces, getViewer, getWorkspace, ROLE_LABEL } from "@/lib/hq";
import { modulesFor } from "@/lib/modules";
import { CommandPalette } from "./command";
import { NavLink } from "./nav-link";
import { SearchBox } from "./search-box";
import { TopBar } from "./top-bar";

const shortDate = (lands: string) => lands.replace("Friday ", "").replace(/(\d+) (\w{3})\w*/, "$1 $2");

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/w/[slug]">) {
  const { slug } = await params;
  const [viewer, workspace, all] = await Promise.all([getViewer(), getWorkspace(slug), getMyWorkspaces()]);
  const waiting = await countWaiting(workspace.id);
  const base = `/w/${workspace.slug}`;
  const displayName = viewer.name ?? viewer.email;
  const modules = modulesFor(workspace.isStudio);
  const ready = modules.filter((m) => m.ready);
  const extras = [
    { key: "people", label: "People" },
    { key: "activity", label: "Activity" },
    { key: "account", label: "Your account" },
    { key: "search", label: "Search" },
  ];
  // Page names for the top bar, and the "Go to" list of the search palette.
  const titles: Record<string, string> = {
    "": "Overview",
    ...Object.fromEntries(modules.map((m) => [m.key, m.label])),
    ...Object.fromEntries(extras.map((e) => [e.key, e.label])),
  };
  const pages = [
    { label: "Overview", href: base },
    ...ready.map((m) => ({ label: m.label, href: `${base}/${m.key}` })),
    ...modules.filter((m) => !m.ready).map((m) => ({ label: m.label, href: `${base}/${m.key}`, note: m.lands ? `Lands ${shortDate(m.lands)}` : undefined })),
    ...extras.filter((e) => e.key !== "search").map((e) => ({ label: e.label, href: `${base}/${e.key}` })),
  ];

  const nav = (
    <nav aria-label="Workspace" className="flex flex-col gap-6">
      <div>
        <NavLink href={base} exact>Overview</NavLink>
        {modules.filter((m) => m.ready).map((m) => (
          <NavLink
            key={m.key}
            href={`${base}/${m.key}`}
            note={m.key === "actions" && waiting > 0 ? `${waiting} waiting` : undefined}
          >
            {m.label}
          </NavLink>
        ))}
      </div>
      <div>
        <p className="px-3 mb-1 font-serif text-[17px] italic text-paper/55">Coming next</p>
        {modules.filter((m) => !m.ready).map((m) => (
          <NavLink key={m.key} href={`${base}/${m.key}`} note={m.lands ? shortDate(m.lands) : undefined}>
            {m.label}
          </NavLink>
        ))}
      </div>
      <div>
        <p className="px-3 mb-1 font-serif text-[17px] italic text-paper/55">Workspace</p>
        <NavLink href={`${base}/people`}>People</NavLink>
        <NavLink href={`${base}/activity`}>Activity</NavLink>
        <NavLink href={`${base}/account`}>Your account</NavLink>
      </div>
    </nav>
  );

  const switcher = (
    <div className="border-y border-paper/12 px-3 py-3">
      <p className="text-[15px] font-semibold tracking-[0.01em] text-paper">{workspace.name}</p>
      <p className="mt-0.5 text-xs text-paper/60">
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
    <div className="border-t border-paper/12 px-3 pt-4">
      <p className="truncate text-sm text-paper">{displayName}</p>
      <form action="/auth/sign-out" method="post">
        <button className="text-xs text-paper/60 underline underline-offset-2 hover:text-paper">Sign out</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      {/* Desktop sidebar */}
      <div className="hidden lg:block bg-ink">
        <aside className="sticky top-0 flex h-screen flex-col gap-5 px-4 py-6 overflow-y-auto">
          <Link href={base} className="px-3 pt-1">
            <Wordmark tone="paper" />
          </Link>
          <SearchBox slug={workspace.slug} place="side" />
          {switcher}
          <div className="flex-1">{nav}</div>
          {footer}
        </aside>
      </div>

      {/* Phone and tablet: a dark glass bar that stays on top; the menu opens over the page. */}
      <details className="group sticky top-0 z-40 text-paper lg:hidden">
        <summary className="glass-dark flex h-14 cursor-pointer list-none items-center justify-between px-4 [&::-webkit-details-marker]:hidden">
          <Wordmark tone="paper" />
          <span className="text-sm text-paper/80">
            <span className="group-open:hidden">Menu</span>
            <span className="hidden group-open:inline">Close</span>
          </span>
        </summary>
        <div className="glass-dark absolute inset-x-0 top-14 flex max-h-[calc(100dvh-3.5rem)] flex-col gap-6 overflow-y-auto border-t border-paper/10 px-4 pb-8 pt-4">
          <SearchBox slug={workspace.slug} place="menu" />
          {switcher}
          {nav}
          {footer}
        </div>
      </details>

      <div className="min-w-0">
        <TopBar slug={workspace.slug} workspace={workspace.name} titles={titles} />
        <main className="min-w-0 px-4 py-8 sm:px-8 lg:px-14 lg:pb-14 lg:pt-3">{children}</main>
      </div>
      <CommandPalette slug={workspace.slug} pages={pages} />
    </div>
  );
}
