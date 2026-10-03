"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Page = { label: string; href: string; note?: string };
type Hit = { id: string; group: string; title: string; mark: string | null; meta: string | null; href: string };
type Row = { key: string; group: string; title: string; mark?: string | null; meta?: string | null; href: string };

/** Ask HQ's search palette to open, optionally with words already typed. */
export function openSearch(q = "") {
  window.dispatchEvent(new CustomEvent("hq:search", { detail: { q } }));
}

/**
 * The search palette: Cmd/Ctrl+K or "/" from anywhere. Empty, it lists HQ's pages to jump to;
 * typed, it searches the workspace as you type. It floats over the page on frosted glass.
 */
export function CommandPalette({ slug, pages }: { slug: string; pages: Page[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  // Results belong to the words they answer, so stale ones never show for new words.
  const [result, setResult] = useState<{ term: string; hits: Hit[] } | null>(null);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  const show = useCallback((initial = "") => {
    returnTo.current = document.activeElement as HTMLElement | null;
    setQ(initial);
    setActive(0);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    returnTo.current?.focus?.();
  }, []);

  // Keyboard shortcut and the "open" event from the sidebar box and the top bar.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
      const isK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      const isSlash = e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey;
      if (isK || isSlash) {
        e.preventDefault();
        if (open && isK) close();
        else show();
      }
    }
    function onOpen(e: Event) {
      show((e as CustomEvent<{ q?: string }>).detail?.q ?? "");
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("hq:search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("hq:search", onOpen);
    };
  }, [open, show, close]);

  // While open: focus the box and keep the page behind it still.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    input.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Search as you type, a beat after the last key.
  const term = q.trim();
  const searching = term.length >= 2;
  const hits = result && result.term === term ? result.hits : null;
  const loading = open && searching && hits === null;
  useEffect(() => {
    if (!open || term.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/w/${slug}/search/live?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { hits: Hit[] };
        setResult({ term, hits: data.hits });
        setActive(0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResult({ term, hits: [] });
      }
    }, 160);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [term, open, slug]);

  const rows: Row[] = useMemo(() => {
    if (!searching) {
      const f = term.toLowerCase();
      return pages
        .filter((p) => !f || p.label.toLowerCase().includes(f))
        .map((p) => ({ key: p.href, group: "Go to", title: p.label, meta: p.note, href: p.href }));
    }
    const found: Row[] = (hits ?? []).map((h) => ({ key: h.id, group: h.group, title: h.title, mark: h.mark, meta: h.meta, href: h.href }));
    return [
      ...found,
      { key: "all", group: "", title: `See every result for "${term}"`, href: `/w/${slug}/search?q=${encodeURIComponent(term)}` },
    ];
  }, [term, searching, hits, pages, slug]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-row="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(row: Row | undefined) {
    if (!row) return;
    setOpen(false);
    router.push(row.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(rows.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(rows[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" onKeyDown={onKeyDown}>
      <div aria-hidden className="palette-backdrop absolute inset-0" onClick={close} />
      <div role="dialog" aria-modal="true" aria-label="Search HQ" className="glass palette-in relative w-full max-w-[640px] overflow-hidden rounded-[22px]">
        <div className="flex items-center gap-3 border-b border-ink/10 px-5">
          <svg aria-hidden viewBox="0 0 16 16" className="size-[18px] shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="7" cy="7" r="4.75" />
            <path d="m10.5 10.5 3.25 3.25" strokeLinecap="round" />
          </svg>
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            role="combobox"
            aria-expanded="true"
            aria-controls="hq-palette-list"
            aria-activedescendant={rows[active] ? `hq-row-${active}` : undefined}
            aria-autocomplete="list"
            placeholder="Search HQ, or jump to a page"
            className="palette-input h-16 w-full bg-transparent text-[18px] text-ink placeholder:text-faint"
          />
          {loading && <span aria-hidden className="palette-spinner size-4 shrink-0 rounded-full border-2 border-ink/15 border-t-ink/60" />}
          <kbd className="hidden shrink-0 rounded-md border border-ink/15 px-1.5 text-[11px] leading-5 text-muted sm:block">Esc</kbd>
        </div>

        <ul id="hq-palette-list" ref={list} role="listbox" aria-label="Results" className="max-h-[52vh] overflow-y-auto p-2">
          {rows.length === 0 && <li className="px-3 py-6 text-center text-[15px] text-muted">No page by that name.</li>}
          {searching && hits !== null && hits.length === 0 && (
            <li className="px-3 pb-2 pt-4 text-[15px] text-muted">Nothing found for &ldquo;{term}&rdquo; yet.</li>
          )}
          {rows.map((r, i) => {
            const heading = r.group && (i === 0 || rows[i - 1].group !== r.group) ? r.group : null;
            return (
              <li key={r.key} role="presentation">
                {heading && <p className="px-3 pb-1 pt-3 text-[12px] font-medium text-muted">{heading}</p>}
                <a
                  id={`hq-row-${i}`}
                  data-row={i}
                  role="option"
                  aria-selected={i === active}
                  href={r.href}
                  onClick={(e) => {
                    e.preventDefault();
                    go(r);
                  }}
                  onMouseMove={() => setActive(i)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] ${
                    i === active ? "bg-ink/[0.07] text-ink" : "text-ink/85"
                  } ${r.key === "all" ? "mt-1 font-medium" : ""}`}
                >
                  {r.mark && <span className="ref-mark w-9 shrink-0 text-[18px] leading-none">{r.mark}</span>}
                  <span className="min-w-0 flex-1 truncate">{r.title}</span>
                  {r.meta && <span className="shrink-0 truncate text-[13px] text-muted">{r.meta}</span>}
                  {i === active && (
                    <span aria-hidden className="shrink-0 text-[12px] text-muted">
                      Enter
                    </span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>

        <p className="hidden border-t border-ink/10 px-5 py-2.5 text-[12px] text-muted sm:block">
          Arrow keys to move, Enter to open, Esc to close.
        </p>
      </div>
    </div>
  );
}
