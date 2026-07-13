import { createClient } from "@supabase/supabase-js";
import { USE_CASES } from "../../app/utils/useCases";

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const siteUrl = (
    (config.public.siteUrl as string) || "https://www.lumiar.site"
  ).replace(/\/$/, "");

  const urls: SitemapUrl[] = [];

  // --- Static, indexable pages ---
  urls.push(
    { loc: `${siteUrl}/`, changefreq: "daily", priority: "1.0" },
    { loc: `${siteUrl}/explore`, changefreq: "hourly", priority: "0.9" },
    { loc: `${siteUrl}/prompt-library`, changefreq: "weekly", priority: "0.7" },
    { loc: `${siteUrl}/ai`, changefreq: "weekly", priority: "0.8" },
    { loc: `${siteUrl}/terms`, changefreq: "yearly", priority: "0.2" },
    { loc: `${siteUrl}/policy`, changefreq: "yearly", priority: "0.2" },
  );

  // --- Use-case landing pages ---
  for (const uc of USE_CASES) {
    urls.push({
      loc: `${siteUrl}/ai/${uc.slug}`,
      changefreq: "weekly",
      priority: "0.8",
    });
  }

  // --- Dynamic content (shared generations + public profiles) ---
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    (config.supabaseServiceRoleKey as string | undefined);

  if (supabaseUrl && serviceRoleKey) {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const [{ data: gens }, { data: profiles }] = await Promise.all([
      supabase
        .from("generations")
        .select("id, created_at")
        .eq("is_shared", true)
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase
        .from("profiles")
        .select("username, updated_at")
        .not("username", "is", null)
        .limit(5000),
    ]);

    for (const g of (gens ?? []) as { id: string; created_at: string }[]) {
      urls.push({
        loc: `${siteUrl}/generation/${g.id}`,
        lastmod: g.created_at
          ? new Date(g.created_at).toISOString()
          : undefined,
        changefreq: "monthly",
        priority: "0.6",
      });
    }

    for (const p of (profiles ?? []) as {
      username: string;
      updated_at: string;
    }[]) {
      if (!p.username) continue;
      urls.push({
        loc: `${siteUrl}/profile/${encodeURIComponent(p.username)}`,
        lastmod: p.updated_at
          ? new Date(p.updated_at).toISOString()
          : undefined,
        changefreq: "weekly",
        priority: "0.5",
      });
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => {
    const parts = [`    <loc>${escapeXml(u.loc)}</loc>`];
    if (u.lastmod) parts.push(`    <lastmod>${u.lastmod}</lastmod>`);
    if (u.changefreq) parts.push(`    <changefreq>${u.changefreq}</changefreq>`);
    if (u.priority) parts.push(`    <priority>${u.priority}</priority>`);
    return `  <url>\n${parts.join("\n")}\n  </url>`;
  })
  .join("\n")}
</urlset>`;

  setHeader(event, "content-type", "application/xml; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=3600, s-maxage=3600");
  return body;
});
