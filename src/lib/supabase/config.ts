/**
 * Public Supabase settings (safe in the browser: the publishable key only
 * grants what the database's row-level security allows).
 * The SECRET key is never read here — see docs/BACKEND_SETUP.md.
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** False when the variables are missing (e.g. a deployment without them): the admin area then shows a notice. */
export const supabaseConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(supabaseUrl) && supabasePublishableKey.length > 20;

/** Private storage bucket for item covers and attachments (see supabase/schema.sql). */
export const BUCKET = "work-files";
