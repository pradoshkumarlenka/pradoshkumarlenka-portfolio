import type { MetadataRoute } from "next";
import { getSite } from "@/lib/content/server";

/** robots.txt — the public site is indexable; the private admin and sign-in routes are not. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSite();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/auth", "/media/", "/healthz"] }],
    sitemap: new URL("/sitemap.xml", site.url).toString(),
  };
}
