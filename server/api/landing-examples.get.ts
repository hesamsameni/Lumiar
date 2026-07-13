import { getServiceRoleClient } from "../utils/supabaseAdmin";

interface Example {
  id: string;
  imageUrl: string;
  caption: string;
  linkUrl: string | null;
  aspectRatio: string | null;
}

/**
 * Returns example images for a use-case landing page.
 *
 * Admin-curated images from `landing_page_examples` are shown first, then the
 * remaining slots are topped up with recent publicly-shared community
 * generations matching `tag` — always aiming for `limit` images total.
 *
 * Server-rendered so the images (and their links) are crawlable for SEO.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const slug = typeof query.slug === "string" ? query.slug.trim() : "";
  const tag = typeof query.tag === "string" ? query.tag.trim() : "";
  const limitRaw = typeof query.limit === "string" ? parseInt(query.limit) : 9;
  const limit = Math.min(Math.max(Number.isNaN(limitRaw) ? 9 : limitRaw, 1), 24);

  const supabase = getServiceRoleClient();
  if (!supabase) return { examples: [] as Example[], source: "none" };

  // Admin edits should show immediately on client-side navigation.
  setHeader(event, "cache-control", "no-store");

  const seenImageUrls = new Set<string>();
  const examples: Example[] = [];
  let curatedCount = 0;
  let autoCount = 0;

  // --- 1. Admin-curated images take priority ---
  if (slug) {
    const { data: curated } = await supabase
      .from("landing_page_examples")
      .select("id, image_url, caption, link_url")
      .eq("use_case_slug", slug)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(limit);

    for (const c of (curated ?? []) as Record<string, unknown>[]) {
      const imageUrl = c.image_url as string;
      if (!imageUrl || seenImageUrls.has(imageUrl)) continue;
      seenImageUrls.add(imageUrl);
      examples.push({
        id: c.id as string,
        imageUrl,
        caption: (c.caption as string) ?? "",
        linkUrl: (c.link_url as string) || null,
        aspectRatio: null,
      });
      curatedCount++;
      if (examples.length >= limit) break;
    }
  }

  // --- 2. Top up the remaining slots with community generations by tag ---
  const remaining = limit - examples.length;
  if (remaining > 0 && tag) {
    // Over-fetch a little so de-duplication against curated images still
    // leaves enough to fill the remaining slots.
    const { data } = await supabase
      .from("generations")
      .select("id, output_image_url, prompt, aspect_ratio")
      .eq("is_shared", true)
      .contains("metadata", { tags: [tag] })
      .order("created_at", { ascending: false })
      .limit(remaining + seenImageUrls.size + 5);

    for (const g of (data ?? []) as Record<string, unknown>[]) {
      const imageUrl = g.output_image_url as string;
      if (!imageUrl || seenImageUrls.has(imageUrl)) continue;
      seenImageUrls.add(imageUrl);
      examples.push({
        id: g.id as string,
        imageUrl,
        caption: (g.prompt as string) ?? "",
        linkUrl: `/generation/${g.id as string}`,
        aspectRatio: (g.aspect_ratio as string) ?? "1:1",
      });
      autoCount++;
      if (examples.length >= limit) break;
    }
  }

  const source =
    curatedCount > 0 && autoCount > 0
      ? "mixed"
      : curatedCount > 0
        ? "curated"
        : autoCount > 0
          ? "auto"
          : "none";

  return { source, examples };
});
