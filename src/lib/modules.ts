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
  /** Runs the studio itself: shown only in the studio's own workspace (LIVBRID), never in a client's. */
  studioOnly?: boolean;
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
      "Every project from signed to closed: brief and real need, deliverables, timeline, price, and the close-out facts. Payments, outside costs, hours and profit are for the Owner only.",
    ready: true,
    studioOnly: true,
  },
  {
    key: "proposals",
    label: "Proposals",
    summary:
      "Every enquiry followed to won or lost. The price list for the Clarity Diagnostic, the Build and the Keep plan, and proposals built from it: approved by a person, saved as a PDF, and turned into a project when won.",
    ready: true,
    studioOnly: true,
  },
  {
    key: "visibility",
    label: "Visibility",
    summary:
      "Where LIVBRID stands on Google, in AI answers and on other sites: Search Console week by week, the prompt-by-prompt AI check, and links and mentions.",
    ready: true,
    studioOnly: true,
  },
];

export function findModule(key: string) {
  return MODULES.find((m) => m.key === key);
}

/** The modules a workspace shows: studio modules only in the studio's own workspace. */
export function modulesFor(isStudio: boolean) {
  return MODULES.filter((m) => isStudio || !m.studioOnly);
}
