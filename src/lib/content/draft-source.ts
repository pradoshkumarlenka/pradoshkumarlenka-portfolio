import "server-only";
import { cache } from "react";
import { draftMode } from "next/headers";
import { getAdminSession } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { ContentKey, ContentMap } from "./registry";
import type { ContentSource } from "./source";
import { isValidContent } from "./validate";
import { MEDIA_PATH } from "@/lib/media/paths";
import { previewToken } from "@/lib/media/server";

/** Library files in drafts may not be published yet: give their paths a short-lived preview token. */
function withPreviewTokens<T>(value: T): T {
  const map = (v: unknown): unknown => {
    if (typeof v === "string") {
      const id = MEDIA_PATH.exec(v)?.[1];
      const token = id ? previewToken(id) : null;
      return token ? `${v}?pt=${token}` : v;
    }
    if (Array.isArray(v)) return v.map(map);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, map(x)]));
    return v;
  };
  return map(value) as T;
}

/*
 * DRAFT PREVIEW SOURCE — unpublished drafts, for the administrator only.
 *
 * Active only when BOTH are true:
 *   1. Next.js Draft Mode is on for this request (cookie set by
 *      /admin/preview/enable after an admin check; its value changes every build);
 *   2. the request carries a valid administrator session (getAdminSession →
 *      Supabase Auth + is_admin()); drafts are read as that admin, so
 *      row-level security applies as well.
 * For everyone else this returns null immediately, without any query, and the
 * page renders from the published content as usual (static pages stay static).
 */

const loadDrafts = cache(async (): Promise<Map<string, unknown> | null> => {
  let enabled = false;
  try {
    enabled = (await draftMode()).isEnabled;
  } catch {
    return null; // outside a request (e.g. generateStaticParams)
  }
  if (!enabled) return null;
  const session = await getAdminSession();
  if (session.status !== "admin") return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("content_drafts").select("key, data").eq("schema_version", 1);
  if (error || !data) return null;
  return new Map(data.map((r) => [r.key as string, r.data as unknown]));
});

/** True when this request is an admin draft preview. */
export async function isDraftPreview() {
  return (await loadDrafts()) !== null;
}

export const draftSource: ContentSource = {
  name: "draft",
  async get<K extends ContentKey>(key: K): Promise<ContentMap[K] | null> {
    const drafts = await loadDrafts();
    if (!drafts?.has(key)) return null;
    const value = drafts.get(key);
    return isValidContent(key, value) ? withPreviewTokens(value as ContentMap[K]) : null;
  },
};
