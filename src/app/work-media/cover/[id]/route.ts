import { NextResponse } from "next/server";
import sharp from "sharp";
import { supabaseConfigured } from "@/lib/supabase/config";
import { serviceStorage } from "@/lib/supabase/service";
import { visitorClient } from "@/lib/work/public";
import { UUID } from "@/lib/admin/validate";

/**
 * Cover image of a PUBLISHED item, resized to 1200 px WebP (fast on phones).
 * The item is looked up as a visitor first (row-level security), so covers of
 * drafts/archived items are never served. Short cache (60 s) so an unpublished
 * item's cover disappears promptly.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = serviceStorage();
  const notFound = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!UUID.test(id) || !supabaseConfigured || !store) return notFound();
  const { data: item } = await visitorClient().from("items").select("cover_path").eq("id", id).eq("state", "published").maybeSingle();
  if (!item?.cover_path) return notFound();
  const { data: file, error } = await store.download(item.cover_path);
  if (error || !file) return notFound();
  const img = await sharp(Buffer.from(await file.arrayBuffer())).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  return new NextResponse(new Uint8Array(img), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=60, s-maxage=60", "X-Content-Type-Options": "nosniff" },
  });
}
