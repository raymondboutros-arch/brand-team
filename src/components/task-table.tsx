import { formatDay } from "@/lib/dates";
import { isLate, type Task, type Workstream } from "@/lib/plan";
import { StatusPill, TaskStatusSelect } from "./task-status";

type Save = (taskId: string, status: Task["status"]) => Promise<void>;

/** Tasks as a table: what, who, when, status. Status is editable for Owner and Team. */
export function TaskTable({
  tasks,
  today,
  save,
  workstreams,
}: {
  tasks: Task[];
  today: string;
  save?: Save;
  workstreams?: Workstream[];
}) {
  if (tasks.length === 0) return <p className="text-sm text-muted">No tasks.</p>;
  const wsById = new Map((workstreams ?? []).map((w) => [w.id, w]));

  return (
    <>
    {/* Phones: one card per task */}
    <ul className="divide-y divide-line rounded-lg border border-line bg-card sm:hidden">
      {tasks.map((t) => {
        const late = isLate(t, today);
        const ws = t.workstream_id ? wsById.get(t.workstream_id) : undefined;
        return (
          <li key={t.id} className={`px-4 py-3 ${t.status === "done" ? "text-muted" : ""}`}>
            <p className={t.status === "done" ? "line-through decoration-line-strong" : ""}>{t.title}</p>
            <p className="mt-1 text-[13px] text-muted">
              {t.owner}
              {t.due_on && (
                <>
                  {" · "}
                  <span className={late ? "text-danger font-medium" : ""}>
                    {formatDay(t.due_on)}
                    {late ? ", late" : ""}
                  </span>
                </>
              )}
              {workstreams && (ws ? ` · ${ws.number}. ${ws.title}` : " · This week only")}
            </p>
            <div className="mt-2">
              {save ? <TaskStatusSelect taskId={t.id} status={t.status} title={t.title} save={save} /> : <StatusPill status={t.status} />}
            </div>
          </li>
        );
      })}
    </ul>
    <div className="hidden overflow-x-auto rounded-lg border border-line bg-card sm:block">
      <table className="w-full text-left text-[15px]">
        <thead className="text-[13px] text-muted">
          <tr>
            <th scope="col" className="px-4 pt-3 pb-2.5 font-medium border-b border-line">Task</th>
            <th scope="col" className="px-4 pt-3 pb-2.5 font-medium border-b border-line whitespace-nowrap">Owner</th>
            <th scope="col" className="px-4 pt-3 pb-2.5 font-medium border-b border-line whitespace-nowrap">Due</th>
            <th scope="col" className="px-4 pt-3 pb-2.5 font-medium border-b border-line whitespace-nowrap">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {tasks.map((t) => {
            const late = isLate(t, today);
            const ws = t.workstream_id ? wsById.get(t.workstream_id) : undefined;
            return (
              <tr key={t.id} className={t.status === "done" ? "text-muted" : ""}>
                <td className="px-4 py-3 align-top min-w-[22ch]">
                  <span className={t.status === "done" ? "line-through decoration-line-strong" : ""}>{t.title}</span>
                  {workstreams && (
                    <span className="mt-0.5 block text-[13px] text-faint">
                      {ws ? (
                        <a href={`#ws-${ws.number}`} className="hover:text-ink">
                          {ws.number}. {ws.title}
                        </a>
                      ) : (
                        "This week only"
                      )}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 align-top text-muted min-w-[10ch]">{t.owner}</td>
                <td className={`px-4 py-3 align-top whitespace-nowrap ${late ? "text-danger font-medium" : "text-muted"}`}>
                  {formatDay(t.due_on)}
                  {late && <span className="block text-[12px] font-normal">Late</span>}
                </td>
                <td className="px-4 py-3 align-top whitespace-nowrap">
                  {save ? <TaskStatusSelect taskId={t.id} status={t.status} title={t.title} save={save} /> : <StatusPill status={t.status} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}
