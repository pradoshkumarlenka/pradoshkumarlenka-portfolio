import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /admin/content/export — downloads every published block and draft as one
 * JSON file (a portable backup the owner can keep). Administrator only; read
 * as the signed-in admin, so row-level security applies too. Never cached.
 */
export async function GET() {
  const session = await getAdminSession();
  if (session.status !== "admin") return new NextResponse("Not authorised.", { status: 403 });
  const supabase = await createClient();
  const [pub, drafts] = await Promise.all([
    supabase.from("content_published").select("key, data, version, updated_at, content_hash").order("key"),
    supabase.from("content_drafts").select("key, data, base_version, updated_at, content_hash").order("key"),
  ]);
  if (pub.error || drafts.error) return new NextResponse("The content could not be read.", { status: 500 });
  const now = new Date();
  const body = {
    exportedAt: now.toISOString(),
    note: "Published content and drafts of the portfolio site. Each block has the same shape as its file in /content.",
    published: Object.fromEntries((pub.data ?? []).map((r) => [r.key, { version: r.version, updatedAt: r.updated_at, sha256: r.content_hash, data: r.data }])),
    drafts: Object.fromEntries((drafts.data ?? []).map((r) => [r.key, { baseVersion: r.base_version, updatedAt: r.updated_at, sha256: r.content_hash, data: r.data }])),
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="site-content-${now.toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
