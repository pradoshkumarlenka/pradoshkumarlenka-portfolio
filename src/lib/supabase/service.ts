import "server-only";
import { createClient } from "@supabase/supabase-js";
import { BUCKET, supabaseUrl } from "./config";

/**
 * SERVER-ONLY storage client with the SECRET key. Used only to READ files the
 * visitor is allowed to see, AFTER that has been confirmed:
 *  - "work-files": a published item's cover / attachment (checked as a visitor, RLS);
 *  - "site-media": a library file used by published content (public.media_public),
 *    or requested by the administrator / with a valid preview token.
 * Never import this from client code.
 */
export function serviceStorage(bucket: string = BUCKET) {
  const key = process.env.SUPABASE_SECRET_KEY ?? "";
  if (!key) return null;
  return createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(bucket);
}
