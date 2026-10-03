"use client";

import { useOptimistic, useTransition } from "react";

type Status = "not_started" | "in_progress" | "waiting" | "done";

const LABEL: Record<Status, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  waiting: "Waiting",
  done: "Done",
};

export function StatusDot({ status }: { status: Status }) {
  // The HQ palette: cobalt done, sky in progress, saffron waiting on someone, an empty ring not started.
  const style: Record<Status, string> = {
    not_started: "border-[1.5px] border-line-strong",
    waiting: "bg-saffron",
    in_progress: "bg-sky",
    done: "bg-blue",
  };
  return <span aria-hidden className={`inline-block size-2.5 shrink-0 rounded-full ${style[status]}`} />;
}

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-muted">
      <StatusDot status={status} />
      {LABEL[status]}
    </span>
  );
}

/** A status the team can change in place. Saves as soon as it changes. */
export function TaskStatusSelect({
  taskId,
  status,
  title,
  save,
}: {
  taskId: string;
  status: Status;
  title: string;
  save: (taskId: string, status: Status) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const [shown, setShown] = useOptimistic(status);

  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted">
      <StatusDot status={shown} />
      <span className="sr-only">Status of {title}</span>
      <select
        value={shown}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as Status;
          start(async () => {
            setShown(next);
            await save(taskId, next);
          });
        }}
        className="cursor-pointer appearance-none bg-transparent pr-1 text-sm text-muted hover:text-ink focus:text-ink disabled:opacity-60"
      >
        {(Object.keys(LABEL) as Status[]).map((s) => (
          <option key={s} value={s}>
            {LABEL[s]}
          </option>
        ))}
      </select>
    </label>
  );
}
