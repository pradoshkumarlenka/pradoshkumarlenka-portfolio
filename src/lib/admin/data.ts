import "server-only";
import { createClient } from "@/lib/supabase/server";
import { BUCKET } from "@/lib/supabase/config";
import type { AttachmentRow, ItemRow } from "./types";

/** One item + its attachments + short-lived (1 hour) signed URLs for the admin's own previews. */
export async function getItemForAdmin(id: string) {
  const supabase = await createClient();
  const { data: item } = await supabase.from("items").select("*").eq("id", id).single<ItemRow>();
  if (!item) return null;
  const { data: atts } = await supabase.from("attachments").select("*").eq("item_id", id).order("sort_order").order("created_at");
  const attachments = (atts ?? []) as AttachmentRow[];
  const paths = [item.cover_path, ...attachments.map((a) => a.storage_path)].filter(Boolean) as string[];
  const signed = paths.length ? (await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)).data ?? [] : [];
  const byPath = Object.fromEntries(signed.filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));
  const coverUrl = item.cover_path ? byPath[item.cover_path] ?? null : null;
  const urls = Object.fromEntries(attachments.filter((a) => byPath[a.storage_path]).map((a) => [a.id, byPath[a.storage_path]]));
  return { item, attachments, coverUrl, urls };
}
