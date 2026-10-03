/**
 * HQ's charts: small, server-rendered, in ink and greys. Every mark has a tooltip on hover and
 * keyboard focus, and every number is also written out somewhere on the page (tooltips never
 * gate a value). Motion is one draw-in when the page opens; see globals.css.
 */

export const TONE = {
  ink: "#111111",
  mid: "#5C5952",
  soft: "#8A867D",
  track: "#E4E2DC",
} as const;

export type StatusCounts = { done: number; in_progress: number; waiting: number; not_started: number };

const STATUS_PARTS: { key: keyof StatusCounts; label: string; color: string }[] = [
  { key: "done", label: "done", color: TONE.ink },
  { key: "in_progress", label: "in progress", color: TONE.mid },
  { key: "waiting", label: "waiting", color: TONE.soft },
  { key: "not_started", label: "not started", color: TONE.track },
];

/** Legend for the status bars: the swatch mirrors the mark (a short bar). */
export function StatusLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted" aria-label="Legend">
      {STATUS_PARTS.map((p) => (
        <li key={p.key} className="flex items-center gap-2">
          <span aria-hidden className="h-2 w-4 rounded-[2px]" style={{ background: p.color }} />
          {p.label[0].toUpperCase() + p.label.slice(1)}
        </li>
      ))}
    </ul>
  );
}

/** Tasks by status as one bar: done, in progress, waiting, and what's left as the track. */
export function StatusBar({
  counts,
  label,
  delay = 0,
  height = 8,
}: {
  counts: StatusCounts;
  label: string;
  delay?: number;
  height?: number;
}) {
  const total = counts.done + counts.in_progress + counts.waiting + counts.not_started;
  const parts = STATUS_PARTS.filter((p) => counts[p.key] > 0);
  if (total === 0) {
    return <div className="rounded-[4px]" style={{ height, background: TONE.track }} aria-label={`${label}: no tasks yet`} />;
  }
  return (
    <div
      role="img"
      aria-label={`${label}: ${parts.map((p) => `${counts[p.key]} ${p.label}`).join(", ")}`}
      className="viz-reveal flex gap-[2px]"
      style={{ height, ["--d" as string]: `${delay}ms` }}
    >
      {parts.map((p, i) => (
        <span
          key={p.key}
          tabIndex={0}
          data-tip={`${counts[p.key]} ${p.label} of ${total}`}
          data-tip-align={i === 0 ? "start" : i === parts.length - 1 ? "end" : undefined}
          className={`viz-tip viz-mark block h-full min-w-[6px] ${i === 0 ? "rounded-l-[4px]" : ""} ${
            i === parts.length - 1 ? "rounded-r-[4px]" : ""
          }`}
          style={{ flexGrow: counts[p.key], flexBasis: 0, background: p.color }}
        />
      ))}
    </div>
  );
}

/** A share of a whole as a ring, with the percentage in the middle. */
export function Ring({
  value,
  total,
  size = 88,
  stroke = 8,
  label,
  delay = 0,
}: {
  value: number;
  total: number;
  size?: number;
  stroke?: number;
  label: string;
  delay?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const share = total > 0 ? value / total : 0;
  const pct = Math.round(share * 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${pct}%`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TONE.track} strokeWidth={stroke} />
        {value > 0 && (
          <circle
            className="viz-ring"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={TONE.ink}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - share)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ ["--full" as string]: `${c}`, ["--d" as string]: `${delay}ms` }}
          />
        )}
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[19px] font-semibold tracking-[-0.01em]">
        <span>
          <CountUp value={pct} delay={delay} />%
        </span>
      </span>
    </div>
  );
}

/** A single value against a limit: same-ramp track, ink fill. */
export function Meter({ value, max, label, delay = 0 }: { value: number; max: number; label: string; delay?: number }) {
  const share = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="h-2 w-full rounded-[4px]" style={{ background: TONE.track }} role="img" aria-label={`${label}: ${value} of ${max}`}>
      {value > 0 && (
        <span
          tabIndex={0}
          data-tip={`${value} of ${max}`}
          data-tip-align="start"
          className="viz-tip viz-reveal block h-full rounded-[4px]"
          style={{ width: `${share * 100}%`, minWidth: 6, background: TONE.ink, ["--d" as string]: `${delay}ms` }}
        />
      )}
    </div>
  );
}

/** A small trend line: history in the quiet grey, the latest point in ink. */
export function Sparkline({
  values,
  width = 132,
  height = 36,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  label: string;
}) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const pad = 5;
  const x = (i: number) => pad + (i * (width - pad * 2)) / (values.length - 1);
  const y = (v: number) => height - pad - (v / max) * (height - pad * 2);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const last = values.length - 1;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="viz-fade overflow-visible">
      <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke={TONE.track} strokeWidth={1} />
      <polyline points={pts} fill="none" stroke={TONE.soft} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last])} r={4} fill={TONE.ink} stroke="#ffffff" strokeWidth={2} />
    </svg>
  );
}

/** Columns over time (one series): <= 24px wide, 4px rounded tops, square at the baseline. */
export function Columns({
  points,
  unit,
  height = 140,
  label,
}: {
  points: { key: string; label: string; short?: string; value: number }[];
  unit: [string, string]; // singular, plural
  height?: number;
  label: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const top = niceMax(max);
  return (
    <figure className="m-0">
      <div className="flex gap-3">
        <div className="flex w-[3ch] flex-col justify-between text-right text-[11px] tabular-nums text-faint" style={{ height }} aria-hidden>
          <span className="-translate-y-1/2">{top.toLocaleString("en-US")}</span>
          <span className="translate-y-1/2">0</span>
        </div>
        <div className="relative flex-1">
          <div aria-hidden className="absolute inset-x-0 top-0 border-t border-line" />
          <div
            role="img"
            aria-label={label}
            className="relative flex items-end justify-between gap-1 border-b border-line-strong"
            style={{ height }}
          >
            {points.map((p, i) => (
              <span key={p.key} className="flex h-full flex-1 items-end justify-center">
                <span
                  tabIndex={0}
                  data-tip={`${p.value.toLocaleString("en-US")} ${p.value === 1 ? unit[0] : unit[1]}, ${p.label}`}
                  data-tip-align={i < 2 ? "start" : i > points.length - 3 ? "end" : undefined}
                  className="viz-tip viz-mark viz-rise block w-full max-w-[24px] rounded-t-[4px]"
                  style={{
                    height: p.value > 0 ? `${Math.max(3, (p.value / top) * 100)}%` : 2,
                    background: p.value > 0 ? TONE.ink : TONE.track,
                    ["--d" as string]: `${i * 35}ms`,
                  }}
                />
              </span>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between gap-1 text-[11px] text-faint" aria-hidden>
            {points.map((p) => (
              <span key={p.key} className="flex flex-1 justify-center">
                <span className="w-0 overflow-visible whitespace-nowrap">{p.short ?? ""}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}

function niceMax(v: number) {
  if (v <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

/** Progress toward the targets of one measure: the fill is now, ticks are the targets. */
export function TargetBar({
  now,
  targets,
  label,
  delay = 0,
}: {
  now: number;
  targets: { label: string; value: number }[];
  label: string;
  delay?: number;
}) {
  const max = Math.max(1, now, ...targets.map((t) => t.value));
  return (
    <div className="relative h-2.5 rounded-[4px]" style={{ background: TONE.track }} role="img" aria-label={`${label}: now ${now}; ${targets.map((t) => `${t.label} ${t.value}`).join(", ")}`}>
      {now > 0 && (
        <span
          className="viz-reveal absolute inset-y-0 left-0 rounded-[4px]"
          style={{ width: `${(now / max) * 100}%`, minWidth: 6, background: TONE.ink, ["--d" as string]: `${delay}ms` }}
        />
      )}
      {targets.map((t, i) => (
        <span
          key={t.label}
          tabIndex={0}
          data-tip={`${t.value} by ${t.label}`}
          data-tip-align={t.value / max > 0.85 ? "end" : t.value / max < 0.15 ? "start" : undefined}
          className="viz-tip absolute -top-1 -bottom-1 w-[3px] -translate-x-1/2 rounded-full"
          style={{
            left: `${(t.value / max) * 100}%`,
            background: i === targets.length - 1 ? TONE.ink : TONE.soft,
            boxShadow: "0 0 0 2px #ffffff",
          }}
        />
      ))}
    </div>
  );
}

/** A whole number that counts up from zero when the page opens (CSS only; see globals.css). */
export function CountUp({ value, delay = 0 }: { value: number; delay?: number }) {
  const n = Math.max(0, Math.round(value));
  return (
    <>
      <span aria-hidden className="count-up" style={{ ["--num" as string]: n, ["--d" as string]: `${delay}ms` }} />
      <span className="sr-only">{n}</span>
    </>
  );
}

/** A count of a whole as squares: one square per item, filled when it counts. */
export function SquareGrid({
  items,
  label,
  columns = 10,
  size = 14,
}: {
  items: { key: string; on: boolean; tip: string }[];
  label: string;
  columns?: number;
  size?: number;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className="grid w-fit gap-[3px]"
      style={{ gridTemplateColumns: `repeat(${columns}, ${size}px)` }}
    >
      {items.map((it, i) => (
        <span
          key={it.key}
          tabIndex={0}
          data-tip={it.tip}
          data-tip-align={i % columns < 3 ? "start" : i % columns > columns - 4 ? "end" : undefined}
          className="viz-tip viz-mark viz-fade block rounded-[3px]"
          style={{
            width: size,
            height: size,
            background: it.on ? TONE.ink : TONE.track,
            ["--d" as string]: `${150 + i * 25}ms`,
          }}
        />
      ))}
    </div>
  );
}

/** Small columns for a tile: the latest in ink, the history in grey (emphasis on now). */
export function MiniColumns({
  points,
  unit,
  height = 40,
  label,
}: {
  points: { key: string; label: string; value: number }[];
  unit: [string, string];
  height?: number;
  label: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div role="img" aria-label={label} className="flex items-end gap-[3px]" style={{ height }}>
      {points.map((p, i) => {
        const last = i === points.length - 1;
        return (
          <span
            key={p.key}
            tabIndex={0}
            data-tip={`${p.value} ${p.value === 1 ? unit[0] : unit[1]}, ${p.label}`}
            data-tip-align={i < 3 ? "start" : i > points.length - 4 ? "end" : undefined}
            className="viz-tip viz-mark viz-rise block w-[7px] rounded-t-[2px]"
            style={{
              height: p.value > 0 ? `${Math.max(12, (p.value / max) * 100)}%` : 2,
              background: p.value === 0 ? TONE.track : last ? TONE.ink : TONE.soft,
              ["--d" as string]: `${200 + i * 40}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

/** Ranked bars with the label on the left and the count at the tip (one series, one colour). */
export function HBars({
  rows,
  unit,
  label,
}: {
  rows: { key: string; label: string; value: number }[];
  unit: [string, string];
  label: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul aria-label={label} className="grid gap-2.5">
      {rows.map((r, i) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,11rem)_1fr] items-center gap-x-4 text-[14px]">
          <span className="truncate text-muted">{r.label}</span>
          <span className="flex items-center gap-2.5">
            <span
              tabIndex={0}
              data-tip={`${r.value} ${r.value === 1 ? unit[0] : unit[1]}`}
              data-tip-align="start"
              className="viz-tip viz-mark viz-reveal block h-3 rounded-r-[4px]"
              style={{
                width: `${(r.value / max) * 100}%`,
                minWidth: r.value > 0 ? 4 : 0,
                maxWidth: "calc(100% - 3ch)",
                background: TONE.ink,
                ["--d" as string]: `${120 + i * 60}ms`,
              }}
            />
            <span className="text-[13px] font-medium">{r.value}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
