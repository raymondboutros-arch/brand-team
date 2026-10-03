"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { openSearch } from "./command";

/**
 * A slim bar over the top of every page. At the top it is invisible; once the page scrolls it
 * turns to frosted glass, shows where you are, and the page slides underneath it.
 */
export function TopBar({ slug, workspace, titles }: { slug: string; workspace: string; titles: Record<string, string> }) {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  // The shortcut as this computer writes it (the server assumes a Mac).
  const mac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => true,
  );

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrolled(window.scrollY > 16));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const segment = path.replace(`/w/${slug}`, "").split("/")[1] ?? "";
  const title = titles[segment] ?? "";

  return (
    <div
      className={`top-bar sticky top-0 z-30 hidden h-14 items-center justify-between gap-6 px-14 lg:flex ${
        scrolled ? "glass-bar" : ""
      }`}
    >
      <p
        aria-hidden={!scrolled}
        className={`min-w-0 truncate text-[15px] transition-opacity duration-200 ${scrolled ? "opacity-100" : "opacity-0"}`}
      >
        <span className="font-semibold">{title}</span>
        <span className="text-muted">, {workspace}</span>
      </p>
      <button
        type="button"
        onClick={() => openSearch()}
        className="flex h-9 shrink-0 items-center gap-2.5 rounded-full border border-line bg-card/80 pl-3.5 pr-2 text-[14px] text-muted transition-colors hover:border-ink hover:text-ink"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="7" cy="7" r="4.75" />
          <path d="m10.5 10.5 3.25 3.25" strokeLinecap="round" />
        </svg>
        Search
        <kbd className="rounded-md border border-line px-1.5 text-[11px] leading-5 text-faint">{mac ? "⌘K" : "Ctrl K"}</kbd>
      </button>
    </div>
  );
}
