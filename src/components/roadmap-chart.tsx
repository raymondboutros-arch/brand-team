import type { RoadmapItem } from "@/lib/plan";
import { formatDay } from "@/lib/dates";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The plan's roadmap as a timeline: one row per stream of work, months across.
 * Single neutral colour; the launch is the one blue mark. Hover shows dates.
 */
export function RoadmapChart({ items, today }: { items: RoadmapItem[]; today: string }) {
  if (items.length === 0) return null;
  const t = (d: string) => Date.parse(d + "T00:00:00Z") / 86_400_000;
  const startIso = items.reduce((m, i) => (i.starts_on < m ? i.starts_on : m), items[0].starts_on);
  const endIso = items.reduce((m, i) => (i.ends_on > m ? i.ends_on : m), items[0].ends_on);
  const first = new Date(startIso.slice(0, 8) + "01T00:00:00Z");
  const lastMonth = new Date(endIso.slice(0, 8) + "01T00:00:00Z");
  const months: string[] = [];
  for (let d = new Date(first); d <= lastMonth; d.setUTCMonth(d.getUTCMonth() + 1)) {
    months.push(d.toISOString().slice(0, 10));
  }
  const endBound = new Date(lastMonth);
  endBound.setUTCMonth(endBound.getUTCMonth() + 1);
  const lo = t(months[0]);
  const hi = t(endBound.toISOString().slice(0, 10));

  const W = 880, LABEL_W = 200, PAD_R = 24, ROW = 30, TOP = 44;
  const plotW = W - LABEL_W - PAD_R;
  const X = (d: string) => LABEL_W + ((t(d) - lo) / (hi - lo)) * plotW;
  const H = TOP + items.length * ROW + 16;
  const showToday = today >= months[0] && today <= endBound.toISOString().slice(0, 10);

  return (
    <figure className="rounded-lg border border-line bg-card p-4 sm:p-5">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="min-w-[640px] w-full"
          role="img"
          aria-label={`Roadmap from ${formatDay(startIso, { withYear: true })} to ${formatDay(endIso, { withYear: true })}`}
        >
          {months.map((m) => (
            <g key={m}>
              <line x1={X(m)} x2={X(m)} y1={TOP - 12} y2={H - 8} stroke="#ece9e2" strokeWidth={1} />
              <text x={X(m) + 4} y={TOP - 20} fontSize={12} fill="#8a867d">
                {MONTH_SHORT[Number(m.slice(5, 7)) - 1]}
                {m.slice(5, 7) === "01" ? ` ${m.slice(0, 4)}` : ""}
              </text>
            </g>
          ))}
          {showToday && (
            <g>
              <line x1={X(today)} x2={X(today)} y1={TOP - 12} y2={H - 8} stroke="#111111" strokeWidth={1} opacity={0.55} />
              <text x={X(today) + 4} y={H - 10} fontSize={11} fill="#5c5952">Today</text>
            </g>
          )}
          {items.map((it, i) => {
            const y = TOP + i * ROW + ROW / 2;
            const one = it.starts_on === it.ends_on;
            const color = it.highlight ? "#2447E0" : "#3d3a35";
            const dates = one
              ? formatDay(it.starts_on, { withYear: true })
              : `${formatDay(it.starts_on, { withYear: true })} to ${formatDay(it.ends_on, { withYear: true })}`;
            return (
              <g key={it.id}>
                <title>{`${it.label}: ${dates}`}</title>
                <text x={0} y={y + 4} fontSize={13} fill="#111111" fontWeight={it.highlight ? 650 : 400}>
                  {it.label}
                </text>
                {one ? (
                  <>
                    <path d={`M${X(it.starts_on)} ${y - 7}l7 7l-7 7l-7 -7z`} fill={color} />
                    <text
                      x={X(it.starts_on) > W - PAD_R - 110 ? X(it.starts_on) - 12 : X(it.starts_on) + 12}
                      textAnchor={X(it.starts_on) > W - PAD_R - 110 ? "end" : "start"}
                      y={y + 4}
                      fontSize={12}
                      fill="#5c5952"
                      fontWeight={it.highlight ? 650 : 400}
                    >
                      {formatDay(it.starts_on)}
                    </text>
                  </>
                ) : (
                  <rect
                    x={X(it.starts_on)}
                    y={y - 5}
                    width={Math.max(X(it.ends_on) - X(it.starts_on), 6)}
                    height={10}
                    rx={4}
                    fill={color}
                    opacity={0.85}
                  />
                )}
                {/* Larger invisible target so hover works on thin bars */}
                <rect x={0} y={y - ROW / 2} width={W} height={ROW} fill="transparent" />
              </g>
            );
          })}
        </svg>
      </div>
      <details className="mt-3 text-sm text-muted">
        <summary className="cursor-pointer underline underline-offset-4">Show the dates as a list</summary>
        <ul className="mt-2 space-y-1">
          {items.map((it) => (
            <li key={it.id}>
              <span className="text-ink">{it.label}</span>:{" "}
              {it.starts_on === it.ends_on
                ? formatDay(it.starts_on, { withYear: true })
                : `${formatDay(it.starts_on, { withYear: true })} to ${formatDay(it.ends_on, { withYear: true })}`}
            </li>
          ))}
        </ul>
      </details>
    </figure>
  );
}
