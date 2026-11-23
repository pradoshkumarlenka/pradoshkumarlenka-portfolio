"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertAdmin } from "./auth";
import { BUCKET } from "@/lib/supabase/config";
import { ATTACHMENT_TYPES, COVER_TYPES, extOf, LIMITS, MAX_COVER_BYTES, MAX_FILE_BYTES, safeFileName, UUID } from "./validate";
import type { ActionResult, FileKind } from "./types";

/*
 * FILE ACTIONS — uploads go straight from the browser to the PRIVATE bucket
 * through a one-off signed upload URL (so large files never pass through this
 * server and the browser can show real progress). The flow:
 *   1. requestUpload  — server checks admin + declared name/type/size, picks a safe
 *                       path inside items/<item id>/, returns a signed upload URL.
 *   2. browser PUTs the file (the bucket enforces 25 MB + allowed MIME types).
 *   3. finalizeUpload — server re-checks the stored file: real size and its first
 *                       bytes ("magic numbers"), so a renamed .exe is rejected and
 *                       deleted. Only then is the database record written.
 * Storage policies (supabase/schema.sql) allow all of this for the admin only.
 */

type Purpose = "attachment" | "cover" | "replace";
export type UploadTicket = { ok: true; path: string; signedUrl: string; contentType: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const refresh = (itemId: string) => {
  revalidatePath("/admin");
  revalidatePath("/", "layout"); // public site: listing + detail pages update immediately
  revalidatePath(`/admin/items/${itemId}`);
};

function checkDeclared(purpose: Purpose, name: string, size: number): { contentType: string; kind?: FileKind } | { error: string } {
  const ext = extOf(name);
  if (purpose === "cover") {
    const mime = COVER_TYPES[ext];
    if (!mime) return { error: "Cover images must be JPG, PNG or WebP." };
    if (size > MAX_COVER_BYTES) return { error: "Cover images can be at most 5 MB." };
    return { contentType: mime };
  }
  const t = ATTACHMENT_TYPES[ext];
  if (!t) return { error: "Allowed files: PDF, PPT, PPTX, DOC, DOCX, XLS, XLSX." };
  if (size > MAX_FILE_BYTES) return { error: "Files can be at most 25 MB." };
  return { contentType: t.mime[0], kind: t.kind };
}

/** Step 1: a signed upload URL for one file in the item's own folder. */
export async function requestUpload(itemId: string, purpose: Purpose, name: string, size: number): Promise<UploadTicket> {
  const { supabase } = await assertAdmin();
  if (!UUID.test(itemId) || !["attachment", "cover", "replace"].includes(purpose)) return { ok: false, error: "Invalid request." };
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: "The file is empty." };
  const declared = checkDeclared(purpose, name, size);
  if ("error" in declared) return { ok: false, error: declared.error };
  const { data: item } = await supabase.from("items").select("id").eq("id", itemId).single();
  if (!item) return { ok: false, error: "This item no longer exists." };
  const path = `items/${itemId}/${randomBytes(4).toString("hex")}-${safeFileName(name)}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "The upload could not be started. Please try again." };
  return { ok: true, path, signedUrl: data.signedUrl, contentType: declared.contentType };
}

/** Reads the stored file's real size and first/last bytes (via a 60-second signed URL). */
async function inspect(supabase: SupabaseClient, path: string) {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
  if (!data) return null;
  const head = await fetch(data.signedUrl, { headers: { Range: "bytes=0-15" }, cache: "no-store" });
  if (!head.ok) return null;
  const first = Buffer.from(await head.arrayBuffer());
  const total = Number(head.headers.get("content-range")?.split("/")[1] ?? head.headers.get("content-length") ?? 0);
  let tail = Buffer.alloc(0);
  if (first.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    const t = await fetch(data.signedUrl, { headers: { Range: "bytes=-65536" }, cache: "no-store" });
    if (t.ok) tail = Buffer.from(await t.arrayBuffer());
  }
  return { first, tail, total };
}

/** Does the content really match the extension? */
function contentMatches(ext: string, first: Buffer, tail: Buffer) {
  const starts = (...b: number[]) => first.subarray(0, b.length).equals(Buffer.from(b));
  const ole = starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1); // legacy Office (doc/xls/ppt)
  const zip = starts(0x50, 0x4b, 0x03, 0x04); // Office Open XML is a zip…
  const zipHas = (folder: string) => tail.includes(Buffer.from(folder)); // …whose directory names its parts
  switch (ext) {
    case "pdf": return starts(0x25, 0x50, 0x44, 0x46); // %PDF
    case "doc": case "xls": case "ppt": return ole;
    case "docx": return zip && zipHas("word/");
    case "xlsx": return zip && zipHas("xl/");
    case "pptx": return zip && zipHas("ppt/");
    case "jpg": case "jpeg": return starts(0xff, 0xd8, 0xff);
    case "png": return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "webp": return starts(0x52, 0x49, 0x46, 0x46) && first.subarray(8, 12).toString("latin1") === "WEBP";
    default: return false;
  }
}

/** Step 3: verify the uploaded file, then record it (new attachment, replacement or cover). */
export async function finalizeUpload(itemId: string, purpose: Purpose, path: string, opts: { title?: string; replaceId?: string } = {}): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const prefix = `items/${itemId}/`;
  if (!UUID.test(itemId) || !path.startsWith(prefix) || !/^[A-Za-z0-9._-]+$/.test(path.slice(prefix.length))) return fail("Invalid request.");
  const discard = async (error: string) => {
    await supabase.storage.from(BUCKET).remove([path]);
    return fail(error);
  };
  const ext = extOf(path);
  const declared = checkDeclared(purpose, path, 1);
  if ("error" in declared) return discard(declared.error);
  const info = await inspect(supabase, path);
  if (!info || info.total <= 0) return discard("The upload did not complete. Please try again.");
  if (info.total > (purpose === "cover" ? MAX_COVER_BYTES : MAX_FILE_BYTES)) return discard("The file is larger than allowed.");
  if (!contentMatches(ext, info.first, info.tail)) return discard(`This file's content is not a real .${ext} file, so it was rejected.`);

  if (purpose === "cover") {
    const { data: item } = await supabase.from("items").select("cover_path").eq("id", itemId).single();
    if (!item) return discard("This item no longer exists.");
    const { error } = await supabase.from("items").update({ cover_path: path }).eq("id", itemId);
    if (error) return discard("The cover could not be saved.");
    if (item.cover_path && item.cover_path !== path) await supabase.storage.from(BUCKET).remove([item.cover_path]);
    refresh(itemId);
    return { ok: true, message: "Cover updated." };
  }

  const kind = declared.kind!;
  if (purpose === "replace") {
    if (!opts.replaceId || !UUID.test(opts.replaceId)) return discard("Invalid request.");
    const { data: old } = await supabase.from("attachments").select("storage_path").eq("id", opts.replaceId).eq("item_id", itemId).single();
    if (!old) return discard("That attachment no longer exists.");
    const { error } = await supabase.from("attachments").update({ storage_path: path, kind, size_bytes: info.total, preview_path: null }).eq("id", opts.replaceId);
    if (error) return discard("The file could not be replaced.");
    await supabase.storage.from(BUCKET).remove([old.storage_path]);
    refresh(itemId);
    return { ok: true, message: "File replaced." };
  }

  const title = (opts.title ?? "").trim().slice(0, LIMITS.fileTitle) || path.slice(prefix.length + 9).replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  const { data: last } = await supabase.from("attachments").select("sort_order").eq("item_id", itemId).order("sort_order", { ascending: false }).limit(1);
  const { error } = await supabase.from("attachments").insert({ item_id: itemId, title, kind, storage_path: path, size_bytes: info.total, sort_order: (last?.[0]?.sort_order ?? 0) + 10 });
  if (error) return discard("The file could not be attached.");
  refresh(itemId);
  return { ok: true, message: "File added." };
}

/** Rename an attachment or change its button text (blank = automatic label). */
export async function updateAttachment(id: string, title: string, label: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const t = title.trim(), l = label.trim();
  if (!UUID.test(id) || !t || t.length > LIMITS.fileTitle || l.length > LIMITS.label) return fail(`Title is required (max ${LIMITS.fileTitle}); button text max ${LIMITS.label} characters.`);
  const { data, error } = await supabase.from("attachments").update({ title: t, label: l || null }).eq("id", id).select("item_id").single();
  if (error || !data) return fail("The change could not be saved.");
  refresh(data.item_id);
  return { ok: true, message: "Saved." };
}

export async function moveAttachment(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!UUID.test(id)) return fail("Invalid request.");
  const { data: me } = await supabase.from("attachments").select("item_id").eq("id", id).single();
  if (!me) return fail("That attachment no longer exists.");
  const { data: rows } = await supabase.from("attachments").select("id, sort_order").eq("item_id", me.item_id).order("sort_order").order("created_at");
  if (!rows) return fail("The order could not be changed.");
  const i = rows.findIndex((r) => r.id === id), j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) return { ok: true };
  const order = rows.map((r) => r.id);
  [order[i], order[j]] = [order[j], order[i]];
  for (const [k, rid] of order.entries()) await supabase.from("attachments").update({ sort_order: (k + 1) * 10 }).eq("id", rid);
  refresh(me.item_id);
  return { ok: true };
}

export async function removeAttachment(id: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!UUID.test(id)) return fail("Invalid request.");
  const { data, error } = await supabase.from("attachments").delete().eq("id", id).select("item_id, storage_path, preview_path").single();
  if (error || !data) return fail("The file could not be removed.");
  await supabase.storage.from(BUCKET).remove([data.storage_path, data.preview_path].filter(Boolean) as string[]);
  refresh(data.item_id);
  return { ok: true, message: "File removed." };
}

export async function removeCover(itemId: string): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!UUID.test(itemId)) return fail("Invalid request.");
  const { data: item } = await supabase.from("items").select("cover_path").eq("id", itemId).single();
  if (!item?.cover_path) return { ok: true };
  const { error } = await supabase.from("items").update({ cover_path: null }).eq("id", itemId);
  if (error) return fail("The cover could not be removed.");
  await supabase.storage.from(BUCKET).remove([item.cover_path]);
  refresh(itemId);
  return { ok: true, message: "Cover removed." };
}

/**
 * Removes files nothing uses any more: whole folders of deleted items, and files
 * older than an hour that no attachment or cover points to (e.g. an upload whose
 * tab was closed before it was verified). Recent files are left alone so an
 * upload in progress is never touched.
 */
export async function cleanUpUnusedFiles(): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const store = supabase.storage.from(BUCKET);
  const { data: folders, error } = await store.list("items", { limit: 1000 });
  if (error) return fail("Storage could not be checked.");
  const [{ data: items }, { data: atts }] = await Promise.all([
    supabase.from("items").select("id, cover_path"),
    supabase.from("attachments").select("storage_path, preview_path"),
  ]);
  const itemIds = new Set((items ?? []).map((i) => i.id));
  const used = new Set([...(items ?? []).map((i) => i.cover_path), ...(atts ?? []).flatMap((a) => [a.storage_path, a.preview_path])].filter(Boolean));
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const remove: string[] = [];
  for (const folder of folders ?? []) {
    if (!UUID.test(folder.name)) continue;
    const { data: files } = await store.list(`items/${folder.name}`, { limit: 1000 });
    for (const f of files ?? []) {
      const p = `items/${folder.name}/${f.name}`;
      const old = new Date(f.created_at ?? 0).getTime() < hourAgo;
      if (!itemIds.has(folder.name) || (!used.has(p) && old)) remove.push(p);
    }
  }
  if (remove.length) {
    const { error: rmError } = await store.remove(remove);
    if (rmError) return fail("Some files could not be removed.");
  }
  revalidatePath("/admin");
  return { ok: true, message: remove.length ? `Removed ${remove.length} unused file${remove.length === 1 ? "" : "s"}.` : "No unused files found." };
}
