/**
 * The HQ sections, in sidebar order. Ready ones first, then the ones still to come
 * with the Friday each one lands (source: My Brand Team, Product Spec v1, "Build order").
 * When a module ships, set `ready: true` and give it its own page under /w/[slug]/<key>.
 */
export type Module = {
  key: string;
  label: string;
  summary: string;
  lands?: string; // Friday it becomes usable, for modules not ready yet
  ready: boolean;
  /** Where this information lives in HQ until the module ships (path inside the workspace). */
  until?: { text: string; path: string; label: string };
};

export const MODULES: Module[] = [
  {
    key: "plan",
    label: "Plan",
    summary: "This week, decisions, the roadmap, eight workstreams with their tasks, and the decision log.",
    ready: true,
  },
  {
    key: "brand",
    label: "Brand strategy",
    summary: "The fixed lines with copy buttons, and the six steps from foundation to governance.",
    ready: true,
  },
  {
    key: "scorecard",
    label: "Scorecard",
    summary: "The 2027 goal and the monthly numbers against it.",
    ready: true,
  },
  {
    key: "reference",
    label: "Reference",
    summary: "The project audit, the Clarity Diagnostic, the build spec, the AI baseline and prompt log, the sitemap and service names.",
    ready: true,
  },
  {
    key: "actions",
    label: "Action queue",
    summary: "Findings, each with evidence, a proposed fix, and approve or dismiss. Added by the team or by Claude.",
    lands: "Friday 16 October",
    ready: false,
    until: { text: "Until it lands, findings become tasks in the", label: "Plan", path: "plan" },
  },
  {
    key: "channels",
    label: "Channels",
    summary: "Every account: platform, username, link, owner, two-step sign-in on or off, and connection status. No passwords.",
    lands: "Friday 23 October",
    ready: false,
    until: { text: "Until it lands, the five channels and their owners are in", label: "Plan, workstream 5", path: "plan#ws-5" },
  },
  {
    key: "content",
    label: "Content",
    summary: "Idea bank and calendar. Each item moves from idea to draft, approved, scheduled and live, with a review link on every draft.",
    lands: "Friday 30 October",
    ready: false,
    until: { text: "Until it lands, the launch articles are tracked in", label: "Plan, workstream 4", path: "plan#ws-4" },
  },
  {
    key: "audit",
    label: "Audit",
    summary: "The 30-project audit, imported from the sheet.",
    lands: "Friday 30 October",
    ready: false,
    until: { text: "Until it lands, the audit findings are in", label: "Reference", path: "reference#project-audit" },
  },
  {
    key: "connections",
    label: "Connections",
    summary: "Google Search Console: clicks, impressions and top searches, monthly. Plus the Claude connector.",
    lands: "Friday 13 November",
    ready: false,
    until: { text: "Until it lands, the Google baseline is in", label: "Reference", path: "reference#ai-visibility" },
  },
];

export function findModule(key: string) {
  return MODULES.find((m) => m.key === key);
}
