import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { serviceStorage } from "@/lib/supabase/service";
import { getAdminSession } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { MEDIA_BUCKET, getPublicMedia, mediaRecordForPreview, verifyPreviewToken } from "@/lib/media/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * GET /media/<id>/<name> — a media-library file from the PRIVATE site-media bucket.
 * Served only when one of these holds:
 *   1. published content uses the file (checked as a visitor: public.media_public) → cacheable;
 *   2. the request carries a valid draft-preview token for this id → private;
 *   3. the request comes from the signed-in administrator → private.
 * Anything else (unused, draft-only, deleted, unknown) → 404, never cached.
 * Files are sent with their verified type and nosniff (images also with a locked-down CSP).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; name: string }> }) {
  const { id } = await params;
  const notFound = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const store = serviceStorage(MEDIA_BUCKET);
  if (!UUID.test(id) || !supabaseConfigured || !store) return notFound();

  let file: { path: string; mime: string } | null = await getPublicMedia(id);
  let shared = Boolean(file);
  if (!file) {
    const tokenOk = verifyPreviewToken(id, request.nextUrl.searchParams.get("pt"));
    const admin = tokenOk ? null : await getAdminSession();
    if (tokenOk || admin?.status === "admin") {
      // The record: read as the admin (RLS), or with the server key after a verified preview token.
      file = admin?.status === "admin"
        ? (await (await createClient()).from("media").select("path, mime").eq("id", id).maybeSingle()).data
        : await mediaRecordForPreview(id);
      shared = false;
    }
  }
  if (!file || !file.path.startsWith(`media/${id}/`)) return notFound();
  const { data: blob, error } = await store.download(file.path);
  if (error || !blob) return notFound();
  const name = file.path.split("/").pop() ?? "file";
  return new NextResponse(new Uint8Array(await blob.arrayBuffer()), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `inline; filename="${name}"`,
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
      // Images: fully locked down. PDFs: no sandbox (it would stop the browser PDF viewer); type is verified on upload.
      "Content-Security-Policy": file.mime.startsWith("image/") ? "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox; frame-ancestors 'self'" : "frame-ancestors 'self'",
      "Cache-Control": shared ? "public, max-age=300, s-maxage=300, stale-while-revalidate=86400" : "private, no-store",
    },
  });
}
