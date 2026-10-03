import type { NextRequest } from "next/server";
import { getWorkspace } from "@/lib/hq";
import { KIND_LABEL, searchHQ } from "@/lib/search";

/**
 * Live results for the search palette. Runs as the signed-in person, so row level security
 * decides what they can find, exactly as on the search page.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/w/[slug]/search/live">) {
  const { slug } = await ctx.params;
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 120);
  const workspace = await getWorkspace(slug);
  const { hits } = await searchHQ(workspace.id, q);
  return Response.json(
    {
      hits: hits.slice(0, 12).map((h) => ({
        id: h.id,
        group: KIND_LABEL[h.kind],
        title: h.title,
        mark: h.mark ?? null,
        meta: h.meta ?? null,
        href: `/w/${slug}/${h.href}`,
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
