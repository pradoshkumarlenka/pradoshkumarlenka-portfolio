import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

/**
 * GET /healthz — for uptime monitors (e.g. a free UptimeRobot check every 5–15 min).
 * 200 + {"status":"ok"} when the site runs; "database" says whether published
 * content can be read (visitor key, 3 s limit). When it is "unreachable" the site
 * still works from its bundled content. Regular checks also keep a free Supabase
 * project from pausing. Reveals nothing private.
 */
export async function GET() {
  let database: "ok" | "unreachable" | "not-configured" = "not-configured";
  if (supabaseConfigured) {
    try {
      const visitor = createClient(supabaseUrl, supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error } = await visitor.from("content_published").select("key", { head: true, count: "exact" }).abortSignal(AbortSignal.timeout(3000));
      database = error ? "unreachable" : "ok";
    } catch {
      database = "unreachable";
    }
  }
  return NextResponse.json({ status: "ok", database, time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
