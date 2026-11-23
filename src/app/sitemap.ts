import type { MetadataRoute } from "next";
import { getCaseStudyProjects, getContent, getSite } from "@/lib/content/server";
import { getPublishedItems } from "@/lib/work/public";

/** Re-generated at most every hour (and on each deploy). */
export const revalidate = 3600;

/** sitemap.xml — home page, case studies, the research note and published work items. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [site, projects, research, items] = await Promise.all([getSite(), getCaseStudyProjects(), getContent("research"), getPublishedItems()]);
  const url = (p: string) => new URL(p, site.url).toString();
  const paths = new Set<string>(["/", ...projects.map((p) => `/projects/${p.slug}`), `/research/${research.slug}`]);
  if (items.ok) for (const it of items.data) paths.add(it.href);
  return [...paths].map((p) => ({ url: url(p), changeFrequency: "monthly", priority: p === "/" ? 1 : 0.7 }));
}
