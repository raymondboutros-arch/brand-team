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
    summary:
      "The project audit, the Clarity Diagnostic, the build spec, the AI baseline and prompt log, the sitemap, service names and the client permission request.",
    ready: true,
  },
  {
    key: "actions",
    label: "Action queue",
    summary: "Findings, each with evidence, a proposed fix, and approve or dismiss. Added by the team or by Claude.",
    ready: true,
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
    key: "projects",
    label: "Projects",
    summary:
      "Every project from signed to closed: brief and real need, deliverables, timeline, price, and the close-out answers, so the next audit is already filled. Payments, outside costs, hours and profit are for the Owner only. Starts with the 30 projects and the lost pitches from the audit sheet.",
    lands: "Friday 30 October",
    ready: false,
    until: { text: "Until it lands, the audit findings are in", label: "Reference", path: "reference#project-audit" },
  },
  {
    key: "proposals",
    label: "Proposals",
    summary:
      "Prices for the Clarity Diagnostic, the Build and the Keep plan, and a proposal builder: intro, date, title, our thinking, scope, timeline and price, saved as a PDF. Every enquiry and proposal is followed to won or lost, and a won proposal becomes a project.",
    lands: "Friday 6 November",
    ready: false,
    until: { text: "Until it lands, the prices and timeline are D1 to D3 in the", label: "decision log", path: "plan#decision-log" },
  },
  {
    key: "visibility",
    label: "Visibility",
    summary:
      "Where LIVBRID stands on Google, in AI answers and on other sites: Search Console, the 20-prompt AI check and Ahrefs, saved every Monday, with a check-now button. Search Console and the Claude connector are connected here.",
    lands: "Friday 13 November",
    ready: false,
    until: { text: "Until it lands, the Google and AI baseline is in", label: "Reference", path: "reference#ai-visibility" },
  },
];

export function findModule(key: string) {
  return MODULES.find((m) => m.key === key);
}
