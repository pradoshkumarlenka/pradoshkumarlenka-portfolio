import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mediaIdsIn } from "@/lib/media/paths";
import { CONTENT_TITLES } from "./content-data";
import type { ContentKey } from "@/lib/content/registry";

export interface MediaUse { key: string; title: string; draft: boolean }

/** Which content blocks use each library file (published content and drafts). Admin client required. */
export async function mediaUsage(supabase: SupabaseClient): Promise<Map<string, MediaUse[]>> {
  const [pub, drafts] = await Promise.all([
    supabase.from("content_published").select("key, data"),
    supabase.from("content_drafts").select("key, data"),
  ]);
  const usage = new Map<string, MediaUse[]>();
  const add = (rows: { key: string; data: unknown }[] | null, draft: boolean) => {
    for (const r of rows ?? []) for (const id of mediaIdsIn(r.data)) {
      const list = usage.get(id) ?? [];
      list.push({ key: r.key, title: CONTENT_TITLES[r.key as ContentKey] ?? r.key, draft });
      usage.set(id, list);
    }
  };
  add(pub.data, false);
  add(drafts.data, true);
  return usage;
}

/** Library ids from `ids` that do not exist (any more). */
export async function missingMedia(supabase: SupabaseClient, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { data } = await supabase.from("media").select("id").in("id", ids);
  const found = new Set((data ?? []).map((r) => r.id as string));
  return ids.filter((id) => !found.has(id));
}

/** Library ids from `ids` that exist but have not passed the privacy review yet. */
export async function unreviewedMedia(supabase: SupabaseClient, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { data } = await supabase.from("media").select("id, privacy_review").in("id", ids);
  return (data ?? []).filter((r) => r.privacy_review !== "approved").map((r) => r.id as string);
}
