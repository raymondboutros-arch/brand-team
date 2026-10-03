"use client";

import { openSearch } from "./command";

/**
 * The sidebar search. Without JavaScript it is a plain GET form to the search page; with it,
 * clicking or tabbing into it opens the search palette instead ("/" and Cmd/Ctrl+K do too).
 */
export function SearchBox({ slug, place }: { slug: string; place: "side" | "menu" }) {
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
        onFocus={(e) => {
          const q = e.currentTarget.value;
          e.currentTarget.blur();
          e.currentTarget.closest("details")?.removeAttribute("open");
          openSearch(q);
        }}
        className="h-9 w-full cursor-pointer rounded-md border border-paper/15 bg-paper/[0.06] pl-9 pr-9 text-[14px] text-paper placeholder:text-paper/50 hover:border-paper/30 focus:border-paper/60 focus:bg-paper/10 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-paper/20 px-1.5 text-[11px] leading-[18px] text-paper/50">
        /
      </kbd>
    </form>
  );
}
