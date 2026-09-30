/**
 * The HQ sections, in sidebar order, with the Friday each one lands.
 * Source: My Brand Team, Product Spec v1, "Build order".
 * When a module ships, set `ready: true` and give it its own page.
 */
export type Module = {
  key: string;
  label: string;
  summary: string;
  lands: string; // Friday it becomes usable
  ready: boolean;
  /** Where this information lives until the module ships. */
  until?: { label: string; href: string };
};

const PLAN_DOC = "https://claude.ai/code/artifact/d7b58e29-0808-4cd7-be6b-1acec7f54e96";
const STRATEGY_DOC = "https://claude.ai/code/artifact/9c38f78b-8b20-44f3-b283-1495c8a73db5";

export const MODULES: Module[] = [
  {
    key: "plan",
    label: "Plan",
    summary: "Phases, workstreams, tasks with owner, due date and status, and decisions with a recommendation.",
    lands: "Friday 16 October",
    ready: false,
    until: { label: "Plan and Tracker", href: PLAN_DOC },
  },
  {
    key: "actions",
    label: "Action queue",
    summary: "Findings, each with evidence, a proposed fix, and approve or dismiss. Added by the team or by Claude.",
    lands: "Friday 16 October",
    ready: false,
    until: { label: "Plan and Tracker", href: PLAN_DOC },
  },
  {
    key: "brand",
    label: "Brand",
    summary: "Fixed lines with copy buttons, voice rules, colours, type and logo files, with version history. Changes need Owner approval.",
    lands: "Friday 23 October",
    ready: false,
    until: { label: "Brand Strategy", href: STRATEGY_DOC },
  },
  {
    key: "channels",
    label: "Channels",
    summary: "Every account: platform, username, link, owner, two-step sign-in on or off, and connection status. No passwords.",
    lands: "Friday 23 October",
    ready: false,
  },
  {
    key: "content",
    label: "Content",
    summary: "Idea bank and calendar. Each item moves from idea to draft, approved, scheduled and live, with a review link on every draft.",
    lands: "Friday 30 October",
    ready: false,
  },
  {
    key: "scorecard",
    label: "Scorecard",
    summary: "Monthly numbers against the 2027 targets, with a chart.",
    lands: "Friday 30 October",
    ready: false,
    until: { label: "Plan and Tracker", href: PLAN_DOC },
  },
  {
    key: "audit",
    label: "Audit",
    summary: "The 30-project audit, imported from the sheet.",
    lands: "Friday 30 October",
    ready: false,
  },
  {
    key: "connections",
    label: "Connections",
    summary: "Google Search Console: clicks, impressions and top searches, monthly. Plus the Claude connector.",
    lands: "Friday 13 November",
    ready: false,
  },
];

export function findModule(key: string) {
  return MODULES.find((m) => m.key === key);
}
