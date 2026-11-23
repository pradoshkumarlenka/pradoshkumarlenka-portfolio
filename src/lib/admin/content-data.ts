import "server-only";
import { createClient } from "@/lib/supabase/server";
import { CONTENT_REGISTRY, STATIC_CONTENT, type ContentKey } from "@/lib/content/registry";

/*
 * Admin reads of the content tables, as the signed-in administrator (RLS applies).
 * Pages call requireAdminPage() before using these.
 */

export interface PublishedRow { data: unknown; version: number; updated_at: string; content_hash: string }
export interface DraftRow { data: unknown; base_version: number | null; updated_at: string; content_hash: string }

export const CONTENT_KEYS = Object.keys(CONTENT_REGISTRY) as ContentKey[];
export const isContentKey = (k: string): k is ContentKey => (CONTENT_KEYS as string[]).includes(k);

/** Friendly names for the dashboard. */
export const CONTENT_TITLES: Record<ContentKey, string> = {
  site: "Site & SEO", sections: "Sections & navigation", hero: "Hero & intro video", proof: "Proof Bar",
  experience: "Experience", research: "Featured research", leadership: "Leadership", honours: "Honours & credentials",
  beyond: "Beyond the Classroom", resume: "Résumé Library", contact: "Contact", footer: "Footer",
  ui: "Labels & messages", design: "Design: colours & corners", animation: "Animation settings", projects: "Case studies",
};

export type ContentOverview = { key: ContentKey; title: string; usedBy: string; published: { version: number; updated_at: string } | null; draft: { updated_at: string; base_version: number | null } | null };

export async function getContentOverview(): Promise<{ ok: boolean; rows: ContentOverview[] }> {
  const supabase = await createClient();
  const [pub, drafts] = await Promise.all([
    supabase.from("content_published").select("key, version, updated_at"),
    supabase.from("content_drafts").select("key, updated_at, base_version"),
  ]);
  const ok = !pub.error && !drafts.error;
  const p = new Map((pub.data ?? []).map((r) => [r.key as string, r]));
  const d = new Map((drafts.data ?? []).map((r) => [r.key as string, r]));
  return {
    ok,
    rows: CONTENT_KEYS.map((key) => ({
      key,
      title: CONTENT_TITLES[key],
      usedBy: CONTENT_REGISTRY[key].usedBy,
      published: p.get(key) ? { version: p.get(key)!.version, updated_at: p.get(key)!.updated_at } : null,
      draft: d.get(key) ? { updated_at: d.get(key)!.updated_at, base_version: d.get(key)!.base_version } : null,
    })),
  };
}

export async function getContentForEdit(key: ContentKey) {
  const supabase = await createClient();
  const [pub, draft] = await Promise.all([
    supabase.from("content_published").select("data, version, updated_at, content_hash").eq("key", key).maybeSingle(),
    supabase.from("content_drafts").select("data, base_version, updated_at, content_hash").eq("key", key).maybeSingle(),
  ]);
  return {
    ok: !pub.error && !draft.error,
    published: (pub.data ?? null) as PublishedRow | null,
    draft: (draft.data ?? null) as DraftRow | null,
    /** The bundled JSON: what visitors see when nothing is published. */
    fallback: STATIC_CONTENT[key] as unknown,
  };
}
