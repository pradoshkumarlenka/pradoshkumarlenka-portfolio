import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { serviceStorage } from "@/lib/supabase/service";
import { visitorClient } from "@/lib/work/public";
import { UUID } from "@/lib/admin/validate";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Opens / downloads a public attachment.
 * 1. Looks the attachment up AS A VISITOR — row-level security only returns it
 *    when its parent item is published (drafts/archived → 404).
 * 2. Only then signs a 60-second URL for that one private file and redirects.
 * PDFs open in the browser; other formats (and ?download=1) download.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = serviceStorage();
  if (!UUID.test(id) || !supabaseConfigured || !store) return new NextResponse("Not found", { status: 404, headers: NO_STORE });
  const { data: att } = await visitorClient().from("attachments").select("storage_path, kind, title").eq("id", id).maybeSingle();
  if (!att) return new NextResponse("Not found", { status: 404, headers: NO_STORE });
  const ext = att.storage_path.split(".").pop();
  const name = `${att.title.replace(/[^\w .()-]+/g, "").trim() || "file"}.${ext}`;
  const download = request.nextUrl.searchParams.has("download") || att.kind !== "pdf";
  const { data, error } = await store.createSignedUrl(att.storage_path, 60, download ? { download: name } : undefined);
  if (error || !data) return new NextResponse("File unavailable", { status: 503, headers: NO_STORE });
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: NO_STORE });
}
