"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
  exact = false,
  note,
}: {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
  note?: string;
}) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center justify-between rounded-md px-3 h-9 text-[15px] transition-colors ${
        active ? "bg-paper text-ink font-medium" : "text-paper/80 hover:text-paper hover:bg-paper/10"
      }`}
    >
      <span>{children}</span>
      {note && <span className={`text-xs ${active ? "text-muted" : "text-paper/45"}`}>{note}</span>}
    </Link>
  );
}
