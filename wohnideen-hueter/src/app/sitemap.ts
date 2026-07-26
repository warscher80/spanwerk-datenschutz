import type { MetadataRoute } from "next";
import { categories, publishedProjects } from "@/lib/site";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: "/", priority: 1.0 },
    ...categories.map((c) => ({ path: `/${c.slug}`, priority: 0.8 })),
    { path: "/planung-service", priority: 0.8 },
    { path: "/projekte", priority: 0.8 },
    ...publishedProjects().map((p) => ({ path: `/projekte/${p.slug}`, priority: 0.6 })),
    { path: "/marken", priority: 0.7 },
    { path: "/ueber-uns", priority: 0.7 },
    { path: "/kontakt", priority: 0.9 },
    { path: "/impressum", priority: 0.3 },
    { path: "/datenschutz", priority: 0.3 },
    { path: "/barrierefreiheit", priority: 0.3 },
  ];
  return routes.map((r) => ({
    url: `${SITE_URL}${r.path === "/" ? "/" : r.path}`,
    changeFrequency: "monthly",
    priority: r.priority,
  }));
}
