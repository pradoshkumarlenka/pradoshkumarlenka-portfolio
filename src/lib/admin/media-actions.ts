"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { assertAdmin } from "./auth";
import { extOf, safeFileName, UUID } from "./validate";
import { MEDIA_BUCKET, previewToken } from "@/lib/media/server";
import { mediaUrl, mediaViewUrl } from "@/lib/media/paths";
import { mediaUsage } from "./media-data";

/*
 * MEDIA LIBRARY ACTIONS (admin only). Same model as the work-file uploads:
 *   1. requestMediaUpload  — admin check + declared type/size → signed upload URL
 *                            for media/<id>/<random>-<safe name> in the PRIVATE bucket;
 *   2. the browser uploads straight to storage (bucket: 15 MB, images + PDF only);
 *   3. finalizeMediaUpload — downloads the stored file, checks real size and
 *                            content ("magic numbers"), reads image dimensions,
 *                            strips photo metadata (EXIF/GPS) from JPEG/PNG/WebP,
 *                            and only then writes the record. Failures delete the file.
 * All queries run as the signed-in admin: row-level security and the storage
 * policies (supabase/media.sql) check the same again. No secret key here.
 */

export type MediaResult = { ok: true; message: string; id?: string } | { ok: false; error: string };
export type MediaTicket = { ok: true; id: string; path: string; signedUrl: string; contentType: string } | { ok: false; error: string };

const MB = 1024 * 1024;
const TYPES: Record<string, { mime: string; kind: "image" | "pdf"; max: number }> = {
  jpg: { mime: "image/jpeg", kind: "image", max: 10 * MB },
  jpeg: { mime: "image/jpeg", kind: "image", max: 10 * MB },
  png: { mime: "image/png", kind: "image", max: 10 * MB },
  webp: { mime: "image/webp", kind: "image", max: 10 * MB },
  avif: { mime: "image/avif", kind: "image", max: 10 * MB },
  pdf: { mime: "application/pdf", kind: "pdf", max: 15 * MB },
};
const fail = (error: string): MediaResult => ({ ok: false, error });
const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");

function refresh(publicToo = false) {
  revalidatePath("/admin/media");
  if (publicToo) revalidatePath("/", "layout");
}

/** Does the file's content really match its extension? */
function contentMatches(ext: string, b: Buffer) {
  const starts = (...x: number[]) => b.subarray(0, x.length).equals(Buffer.from(x));
  switch (ext) {
    case "jpg": case "jpeg": return starts(0xff, 0xd8, 0xff);
    case "png": return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "webp": return starts(0x52, 0x49, 0x46, 0x46) && b.subarray(8, 12).toString("latin1") === "WEBP";
    case "avif": return b.subarray(4, 8).toString("latin1") === "ftyp" && ["avif", "avis"].includes(b.subarray(8, 12).toString("latin1"));
    case "pdf": return starts(0x25, 0x50, 0x44, 0x46, 0x2d); // %PDF-
    default: return false;
  }
}

/** Step 1: a signed upload URL (new file, or a replacement for `replaceId`). */
export async function requestMediaUpload(name: string, size: number, replaceId?: string): Promise<MediaTicket> {
  const { supabase } = await assertAdmin();
  const t = TYPES[extOf(String(name))];
  if (!t) return { ok: false, error: "Allowed files: JPG, PNG, WebP, AVIF images and PDF documents." };
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: "The file is empty." };
  if (size > t.max) return { ok: false, error: `${t.kind === "pdf" ? "PDFs" : "Images"} can be at most ${t.max / MB} MB.` };
  let id: string = randomUUID();
  if (replaceId !== undefined) {
    if (!UUID.test(replaceId)) return { ok: false, error: "Invalid request." };
    const { data: row } = await supabase.from("media").select("kind").eq("id", replaceId).maybeSingle();
    if (!row) return { ok: false, error: "This file no longer exists." };
    if (row.kind !== t.kind) return { ok: false, error: `Replace ${row.kind === "pdf" ? "a PDF with a PDF" : "an image with an image"}.` };
    id = replaceId;
  }
  const path = `media/${id}/${randomBytes(4).toString("hex")}-${safeFileName(name)}`;
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "The upload could not be started. Please try again." };
  return { ok: true, id, path, signedUrl: data.signedUrl, contentType: t.mime };
}

/** Step 3: verify the stored file, clean it, then create or update the record. */
export async function finalizeMediaUpload(id: string, path: string, opts: { title?: string; alt?: string; replace?: boolean } = {}): Promise<MediaResult> {
  const { supabase } = await assertAdmin();
  const prefix = `media/${id}/`;
  if (!UUID.test(id) || typeof path !== "string" || !path.startsWith(prefix) || !/^[A-Za-z0-9._-]+$/.test(path.slice(prefix.length))) return fail("Invalid request.");
  const store = supabase.storage.from(MEDIA_BUCKET);
  const discard = async (error: string) => { await store.remove([path]); return fail(error); };
  const ext = extOf(path);
  const t = TYPES[ext];
  if (!t) return discard("This file type is not allowed.");

  const { data: blob, error: dlError } = await store.download(path);
  if (dlError || !blob) return discard("The upload did not complete. Please try again.");
  let bytes: Buffer = Buffer.from(await blob.arrayBuffer());
  if (bytes.length <= 0 || bytes.length > t.max) return discard("The file is empty or larger than allowed.");
  if (!contentMatches(ext, bytes)) return discard(`This file's content is not a real .${ext} file, so it was rejected.`);

  let width: number | null = null, height: number | null = null;
  if (t.kind === "image") {
    try {
      const meta = await sharp(bytes).metadata();
      const rotated = (meta.orientation ?? 1) >= 5;
      width = (rotated ? meta.height : meta.width) ?? null;
      height = (rotated ? meta.width : meta.height) ?? null;
      if (!width || !height || width > 20000 || height > 20000) return discard("The image could not be read or is too large.");
      // Strip EXIF/GPS and other metadata (privacy) — re-encode at high quality, keeping orientation.
      if (ext !== "avif") {
        const img = sharp(bytes).rotate();
        const out = ext === "png" ? await img.png({ compressionLevel: 9 }).toBuffer() : ext === "webp" ? await img.webp({ quality: 92 }).toBuffer() : await img.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
        const { error: upError } = await store.upload(path, out, { contentType: t.mime, upsert: true });
        if (upError) return discard("The image could not be processed. Please try again.");
        bytes = out;
      }
    } catch {
      return discard("The image could not be read.");
    }
  }

  const fields = { path, kind: t.kind, mime: t.mime, bytes: bytes.length, width, height };
  if (opts.replace) {
    const { data: old } = await supabase.from("media").select("path").eq("id", id).maybeSingle();
    if (!old) return discard("This file no longer exists.");
    const { error } = await supabase.from("media").update(fields).eq("id", id);
    if (error) return discard("The file could not be replaced.");
    if (old.path !== path) await store.remove([old.path]); // allowed now: no record points to it
    refresh(true);
    return { ok: true, message: "File replaced. Pages using it show the new file within a few minutes (images can take up to a few hours to refresh everywhere).", id };
  }
  const { error } = await supabase.from("media").insert({ id, ...fields, title: clean(opts.title, 200) || path.slice(prefix.length + 9).replace(/\.[^.]+$/, ""), alt: clean(opts.alt, 300) });
  if (error) return discard("The file could not be saved.");
  refresh();
  return { ok: true, message: "Uploaded.", id };
}

/** Title and alternative text (alt text is what screen readers announce). */
export async function updateMediaDetails(id: string, title: string, alt: string): Promise<MediaResult> {
  const { supabase } = await assertAdmin();
  if (!UUID.test(id)) return fail("Invalid request.");
  const { error, count } = await supabase.from("media").update({ title: clean(title, 200), alt: clean(alt, 300) }, { count: "exact" }).eq("id", id);
  if (error || !count) return fail("The details could not be saved.");
  refresh();
  return { ok: true, message: "Saved." };
}

/** Deletes a file that nothing uses (published content or drafts). */
export async function deleteMedia(id: string): Promise<MediaResult> {
  const { supabase } = await assertAdmin();
  if (!UUID.test(id)) return fail("Invalid request.");
  const usage = (await mediaUsage(supabase)).get(id) ?? [];
  if (usage.length) return fail(`This file is still used (${usage.map((u) => `${u.title}${u.draft ? " — draft" : ""}`).join(", ")}). Remove it there first.`);
  const { data: row } = await supabase.from("media").select("path").eq("id", id).maybeSingle();
  if (!row) return fail("This file no longer exists.");
  const { error } = await supabase.from("media").delete().eq("id", id); // the database refuses if still in use
  if (error) return fail(error.code === "23503" ? "This file is still used by the site." : "The file could not be deleted.");
  const { data: removed, error: rmError } = await supabase.storage.from(MEDIA_BUCKET).remove([row.path]);
  refresh();
  // The record is gone (the file is no longer usable); report honestly if the stored copy could not be removed.
  if (rmError || !removed?.length) return { ok: true, message: "Deleted from the library. The stored copy could not be removed right now — it is private and unused." };
  return { ok: true, message: "Deleted." };
}

/** Files for the picker in the content editor. */
export async function listMediaForPicker(): Promise<{ id: string; url: string; view: string; title: string; alt: string; kind: string; width: number | null; height: number | null; approved: boolean }[]> {
  const { supabase } = await assertAdmin();
  const { data } = await supabase.from("media").select("id, path, title, alt, kind, width, height, privacy_review").order("created_at", { ascending: false }).limit(500);
  return (data ?? []).map((m) => ({ id: m.id, url: mediaUrl(m.id, m.path), view: mediaViewUrl(m.id, m.path, previewToken(m.id)), title: m.title, alt: m.alt, kind: m.kind, width: m.width, height: m.height, approved: m.privacy_review === "approved" }));
}

/**
 * Privacy review: approve a file for publication (after checking that no signatures,
 * enrolment/roll numbers, certificate codes, dates of birth or other personal IDs are
 * visible) or send it back to "pending". Replacing a file resets it to pending (database).
 */
export async function setMediaReview(id: string, approve: boolean, confirmed: boolean): Promise<MediaResult> {
  const { supabase } = await assertAdmin();
  if (!UUID.test(id)) return fail("Invalid request.");
  if (approve && confirmed !== true) return fail("Confirm the privacy checklist first.");
  if (!approve) {
    const usage = (await mediaUsage(supabase)).get(id) ?? [];
    if (usage.some((u) => !u.draft)) return fail("This file is used by published content; remove it there before withdrawing approval.");
  }
  const { error, count } = await supabase.from("media").update({ privacy_review: approve ? "approved" : "pending" }, { count: "exact" }).eq("id", id);
  if (error || !count) return fail("The review could not be saved.");
  refresh(true);
  return { ok: true, message: approve ? "Approved for publication." : "Moved back to review." };
}
