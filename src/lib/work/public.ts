import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { getCaseStudyProjects, getContent } from "@/lib/content/server";
import type { ProjectResource } from "@/content/types";
import type { AttachmentRow, ItemRow } from "@/lib/admin/types";

/*
 * PUBLIC WORK DATA — what visitors see in Research & Selected Work.
 * Always queried as an anonymous VISITOR (publishable key, no cookies), so the
 * database's row-level security returns PUBLISHED items only — even when the
 * administrator happens to be signed in in the same browser.
 */

export type PublicItem = Omit<ItemRow, "state" | "created_at"> & { coverUrl: string | null; href: string };
export type Result<T> = { ok: true; data: T } | { ok: false };

/** Visitor-level client (no session). Also used by the /work-media routes. */
export const visitorClient = () =>
  createClient(supabaseUrl, supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

const COLUMNS = "id, slug, title, category, summary, description, highlights, cover_path, cover_alt, work_status, sort_order, published_at, updated_at";

/** Slugs that have a rich hand-written page (case studies + the research note). */
async function richRoutes() {
  const [projects, research] = await Promise.all([getCaseStudyProjects(), getContent("research")]);
  return { projects: new Set(projects.map((p) => p.slug)), research: research.slug };
}
type RichRoutes = Awaited<ReturnType<typeof richRoutes>>;

const hrefFor = (slug: string, rich: RichRoutes) =>
  rich.projects.has(slug) ? `/projects/${slug}` : slug === rich.research ? `/research/${slug}` : `/work/${slug}`;

/** Items with a rich hand-written page keep their existing address; new items use /work/<slug>. */
export async function detailHref(slug: string) {
  return hrefFor(slug, await richRoutes());
}

const toPublic = (r: Omit<ItemRow, "state" | "created_at">, rich: RichRoutes): PublicItem => ({
  ...r,
  // ?v= changes whenever the item is saved, so a replaced cover is never served from cache.
  coverUrl: r.cover_path ? `/work-media/cover/${r.id}?v=${new Date(r.updated_at).getTime()}` : null,
  href: hrefFor(r.slug, rich),
});

/** All published items in the admin's order. */
export const getPublishedItems = cache(async (): Promise<Result<PublicItem[]>> => {
  if (!supabaseConfigured) return { ok: false };
  try {
    const { data, error } = await visitorClient().from("items").select(COLUMNS).eq("state", "published").order("sort_order").order("created_at");
    if (error) return { ok: false };
    const rich = await richRoutes();
    return { ok: true, data: (data ?? []).map((r) => toPublic(r, rich)) };
  } catch {
    return { ok: false };
  }
});

/** One published item (null = not found or not published) and its attachments. */
export const getPublishedItem = cache(async (slug: string): Promise<Result<{ item: PublicItem; attachments: AttachmentRow[] } | null>> => {
  if (!supabaseConfigured) return { ok: false };
  try {
    const sb = visitorClient();
    const { data, error } = await sb.from("items").select(COLUMNS).eq("slug", slug).eq("state", "published").maybeSingle();
    if (error) return { ok: false };
    if (!data) return { ok: true, data: null };
    const { data: atts, error: aErr } = await sb.from("attachments").select("*").eq("item_id", data.id).order("sort_order").order("created_at");
    if (aErr) return { ok: false };
    return { ok: true, data: { item: toPublic(data, await richRoutes()), attachments: (atts ?? []) as AttachmentRow[] } };
  } catch {
    return { ok: false };
  }
});

/** Attachments as resource rows. Links go through /work-media/file/<id>, which re-checks and signs on every click. */
export function attachmentResources(attachments: AttachmentRow[]): ProjectResource[] {
  return attachments.map((a) => ({
    title: a.title,
    fileType: a.kind,
    href: `/work-media/file/${a.id}`,
    downloadHref: `/work-media/file/${a.id}?download=1`,
    fileName: (a.storage_path.split("/").pop() ?? "").replace(/^[0-9a-f]{8}-/, ""),
    action: "open",
    ...(a.label ? { label: a.label } : {}),
  }));
}

/** "Next" link: the following published item (wraps around). */
export function nextItem(items: PublicItem[], slug: string) {
  const i = items.findIndex((x) => x.slug === slug);
  if (i < 0 || items.length < 2) return undefined;
  const n = items[(i + 1) % items.length];
  return { href: n.href, label: n.title };
}
