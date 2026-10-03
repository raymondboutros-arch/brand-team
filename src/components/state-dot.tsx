/**
 * One meaning per colour, everywhere in HQ: saffron needs a person now, sky is moving,
 * cobalt is done, an empty ring is closed or not started. Always next to a word.
 */
export type State = "needs" | "moving" | "done" | "closed";

const CLASS: Record<State, string> = {
  needs: "bg-saffron",
  moving: "bg-sky",
  done: "bg-blue",
  closed: "border-[1.5px] border-line-strong",
};

export function StateDot({ state }: { state: State }) {
  return <span aria-hidden className={`inline-block size-2 shrink-0 rounded-full ${CLASS[state]}`} />;
}

/** A status word with its dot. */
export function StateTag({ state, children }: { state: State; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <StateDot state={state} />
      {children}
    </span>
  );
}

export const ACTION_STATE = { waiting: "needs", approved: "moving", done: "done", dismissed: "closed" } as const;
export const PROJECT_STATE = { signed: "moving", in_progress: "moving", delivered: "done", closed: "done", lost: "closed" } as const;
export const PROPOSAL_STATE = { draft: "needs", approved: "moving", sent: "moving", won: "done", lost: "closed" } as const;
export const ENQUIRY_STATE = { open: "needs", won: "done", lost: "closed", declined: "closed" } as const;
export const CHANNEL_STATE = { needs_update: "needs", to_claim: "needs", to_close: "needs", to_check: "closed", up_to_date: "done" } as const;
export const CONTENT_STATE = { idea: "closed", draft: "moving", approved: "moving", scheduled: "moving", live: "done", dropped: "closed" } as const;
