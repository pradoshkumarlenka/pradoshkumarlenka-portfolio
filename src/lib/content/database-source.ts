import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import type { ContentKey, ContentMap } from "./registry";
import type { ContentSource } from "./source";
import { isValidContent } from "./validate";

/*
 * DATABASE CONTENT SOURCE — published blocks from public.content_published.
 *
 * - Read as an anonymous VISITOR (publishable key, no cookies, no session):
 *   row-level security only ever returns published content. The secret key
 *   is never used here.
 * - One query per render loads every published block (React cache), so a
 *   page costs one request however many blocks it uses. Pages keep their
 *   existing caching (ISR, revalidate = 60; admin saves call revalidatePath).
 * - Each block is checked by ./validate (the same JSON schema as the files in
 *   /content, plus link and file-path safety rules), and must have the shape version this code understands.
 *   Missing, invalid, other shape version, slow (> 2.5 s) or unreachable → null, and
 *   getContent() falls back to the bundled JSON. Visitors never see an error.
 */

/**
 * Visitors never wait more than 2.5 s for the database (then the bundled JSON is used).
 * During `next build`, pages are pre-rendered on a busy machine and nobody is waiting, so
 * the limit is longer and one retry is made — otherwise a slow moment at build time would
 * bake the JSON fallback into the deployed pages until their first refresh.
 */
const BUILDING = process.env.NEXT_PHASE === "phase-production-build";
const TIMEOUT_MS = BUILDING ? 10000 : 2500;
const ATTEMPTS = BUILDING ? 2 : 1;
/** The JSON shape this code understands. Blocks saved in another shape version are ignored (JSON used). */
export const CONTENT_SCHEMA_VERSION = 1;


const warn = (msg: string) => {
  if (process.env.NODE_ENV !== "production") console.warn(`[content] database: ${msg}`);
};

/** All published blocks, once per render. null = database unavailable (use JSON). */
const loadPublished = cache(async (): Promise<Map<string, unknown> | null> => {
  if (!supabaseConfigured) return null;
  try {
    const client = createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    let data: { key: unknown; data: unknown }[] | null = null;
    let error: { code?: string } | null = null;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      try {
        ({ data, error } = await client.from("content_published").select("key, data").eq("schema_version", CONTENT_SCHEMA_VERSION).abortSignal(AbortSignal.timeout(TIMEOUT_MS)));
      } catch {
        data = null;
        error = { code: "timeout" };
      }
      if (!error && data) break;
    }
    if (error || !data) {
      warn(`unavailable (${error?.code ?? "no data"}) — using JSON`);
      return null;
    }
    return new Map(data.map((r) => [r.key as string, r.data as unknown]));
  } catch {
    warn("unreachable — using JSON");
    return null;
  }
});

export const databaseSource: ContentSource = {
  name: "database",
  async get<K extends ContentKey>(key: K): Promise<ContentMap[K] | null> {
    const blocks = await loadPublished();
    if (!blocks || !blocks.has(key)) return null;
    const value = blocks.get(key);
    if (!isValidContent(key, value)) {
      warn(`"${key}" failed schema validation — using JSON`);
      return null;
    }
    return value as ContentMap[K];
  },
};
