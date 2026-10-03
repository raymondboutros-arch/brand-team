import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getViewer, getWorkspace } from "@/lib/hq";
import { dayInBeirut, formatDay, todayInBeirut } from "@/lib/dates";

export const metadata: Metadata = { title: "Activity" };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "14:05" in Beirut time. */
function timeInBeirut(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Beirut" }).format(
    new Date(iso),
  );
}

function dayLabel(day: string, today: string) {
  const diff = Math.round((Date.parse(today + "T00:00:00Z") - Date.parse(day + "T00:00:00Z")) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${WEEKDAYS[new Date(day + "T12:00:00Z").getUTCDay()]} ${formatDay(day)}`;
}

export default async function ActivityPage({ params }: PageProps<"/w/[slug]/activity">) {
  const { slug } = await params;
  const [workspace, viewer] = await Promise.all([getWorkspace(slug), getViewer()]);
  const supabase = await createClient();
  const today = todayInBeirut();

  const { data: rows } = await supabase
    .from("activity")
    .select("id, summary, via, created_at, actor_id")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const ids = Array.from(new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean))) as string[];
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", ids)
    : { data: [] as { id: string; email: string; full_name: string | null }[] };
  const personById = new Map((people ?? []).map((p) => [p.id, p]));

  // One group per Beirut day, newest first.
  const days: { day: string; items: NonNullable<typeof rows> }[] = [];
  for (const r of rows ?? []) {
    const d = dayInBeirut(r.created_at);
    const last = days[days.length - 1];
    if (last && last.day === d) last.items.push(r);
    else days.push({ day: d, items: [r] });
  }

  const who = (r: NonNullable<typeof rows>[number]) => {
    if (r.via === "system") return "HQ setup";
    if (r.actor_id === viewer.id) return "You";
    const p = r.actor_id ? personById.get(r.actor_id) : undefined;
    return p?.full_name ?? p?.email ?? "Someone";
  };

  return (
    <div className="max-w-[820px]">
      <h1 className="page-title">Activity</h1>
      <p className="page-intro">
        Every change, who made it and when. Changes made through Claude are marked, so the history always shows who
        asked for what.
      </p>

      {days.length === 0 && <p className="mt-8 text-muted">Nothing yet.</p>}

      {days.map(({ day, items }) => (
        <section key={day} className="mt-10" aria-labelledby={`d-${day}`}>
          <h2 id={`d-${day}`} className="flex items-baseline gap-3">
            <span className="font-serif text-[24px] italic leading-none">{dayLabel(day, today)}</span>
            <span className="text-[13px] text-muted">
              {items.length} {items.length === 1 ? "change" : "changes"}
            </span>
          </h2>
          <ol className="relative mt-4 ml-[5px] border-l border-line">
            {items.map((r) => (
              <li key={r.id} className="relative pb-5 pl-6 last:pb-1">
                <span
                  aria-hidden
                  className={`absolute -left-[5px] top-[7px] size-[9px] rounded-full ring-4 ring-paper ${
                    r.via === "claude" ? "bg-sky" : r.via === "system" ? "bg-line-strong" : "bg-blue"
                  }`}
                />
                <p className="text-[15px] leading-relaxed">{r.summary}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
                  <span>
                    {timeInBeirut(r.created_at)}, {who(r)}
                  </span>
                  {r.via === "claude" && (
                    <span className="rounded-full bg-sky-wash px-2 py-px text-[12px] text-ink">through Claude</span>
                  )}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
