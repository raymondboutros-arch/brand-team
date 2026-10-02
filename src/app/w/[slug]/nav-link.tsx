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
      onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
      className={`relative flex items-center justify-between rounded-md px-3 h-9 text-[15px] transition-colors ${
        active
          ? "bg-paper/[0.09] text-paper font-medium before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:rounded-full before:bg-paper"
          : "text-paper/70 hover:text-paper hover:bg-paper/[0.05]"
      }`}
    >
      <span>{children}</span>
      {note && <span className={`text-xs ${active ? "text-paper/70" : "text-paper/45"}`}>{note}</span>}
    </Link>
  );
}
