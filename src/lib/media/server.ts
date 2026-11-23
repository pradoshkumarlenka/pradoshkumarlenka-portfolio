import "server-only";
import { cache } from "react";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

export const MEDIA_BUCKET = "site-media";

/** Visitor-level lookup: a file's path/type/size, only if PUBLISHED content uses it (public.media_public). */
export const getPublicMedia = cache(async (id: string): Promise<{ path: string; mime: string; bytes: number } | null> => {
  if (!supabaseConfigured) return null;
  try {
    const visitor = createClient(supabaseUrl, supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await visitor.rpc("media_public", { p_id: id }).abortSignal(AbortSignal.timeout(4000));
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row) return null;
    return { path: row.path, mime: row.mime, bytes: Number(row.bytes) };
  } catch {
    return null;
  }
});

/*
 * PREVIEW TOKENS — draft preview may show library files that are not published
 * yet. The draft source adds ?pt=<expiry>.<signature> to those paths (admin
 * preview only); the /media route accepts a valid, unexpired token for that id.
 * HMAC-SHA256 with a key derived from the server-only secret; valid 1 hour.
 */
const TOKEN_SECONDS = 3600;
function tokenKey(): Buffer | null {
  const secret = process.env.SUPABASE_SECRET_KEY;
  return secret ? createHmac("sha256", secret).update("site-media-preview-v1").digest() : null;
}
export function previewToken(id: string, now = Date.now()): string | null {
  const key = tokenKey();
  if (!key) return null;
  const exp = Math.floor(now / 1000) + TOKEN_SECONDS;
  return `${exp}.${createHmac("sha256", key).update(`${id}:${exp}`).digest("base64url")}`;
}
export function verifyPreviewToken(id: string, token: string | null, now = Date.now()): boolean {
  const key = tokenKey();
  const m = token ? /^(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(token) : null;
  if (!key || !m) return false;
  const exp = Number(m[1]);
  if (exp < Math.floor(now / 1000) || exp > Math.floor(now / 1000) + TOKEN_SECONDS + 60) return false;
  const expected = createHmac("sha256", key).update(`${id}:${exp}`).digest();
  const given = Buffer.from(m[2], "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Server-key read of one media record — ONLY after a valid preview token was verified. */
export async function mediaRecordForPreview(id: string): Promise<{ path: string; mime: string } | null> {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key || !supabaseConfigured) return null;
  const svc = createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await svc.from("media").select("path, mime").eq("id", id).maybeSingle();
  return data ?? null;
}
