"use client";

import { useEffect } from "react";

/**
 * The sidebar search. Plain GET form, so it works without JavaScript; with it,
 * "/" or Cmd/Ctrl+K jumps to the box from anywhere in HQ.
 */
export function SearchBox({ slug, place }: { slug: string; place: "side" | "menu" }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
      const isSlash = e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey;
      const isK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (!isSlash && !isK) return;
      const boxes = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-hq-search]"));
      const visible = boxes.find((b) => b.offsetParent !== null);
      if (!visible) return;
      e.preventDefault();
      visible.focus();
      visible.select();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form action={`/w/${slug}/search`} method="get" role="search" className="relative">
      <label htmlFor={`hq-search-${place}`} className="sr-only">
        Search HQ
      </label>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-paper/50"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <circle cx="7" cy="7" r="4.75" />
        <path d="m10.5 10.5 3.25 3.25" strokeLinecap="round" />
      </svg>
      <input
        id={`hq-search-${place}`}
        data-hq-search
        name="q"
        type="search"
        autoComplete="off"
        placeholder="Search HQ"
        className="h-9 w-full rounded-md border border-paper/15 bg-paper/[0.06] pl-9 pr-9 text-[14px] text-paper placeholder:text-paper/50 focus:border-paper/60 focus:bg-paper/10 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-paper/20 px-1.5 text-[11px] leading-[18px] text-paper/50">
        /
      </kbd>
    </form>
  );
}
