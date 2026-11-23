"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { assertAdmin } from "./auth";
import { CONTENT_REGISTRY, type ContentKey } from "@/lib/content/registry";
import { contentIssues, localAssetPaths, type ContentIssue } from "@/lib/content/validate";
import { CONTENT_SCHEMA_VERSION } from "@/lib/content/database-source";
import { MEDIA_PATH, mediaIdsIn } from "@/lib/media/paths";
import { missingMedia, unreviewedMedia } from "./media-data";

/*
 * SITE CONTENT ACTIONS (admin only). Same model as the item actions:
 *   1. assertAdmin()       — server-side check of the session and is_admin();
 *   2. full validation      — schema + safety rules, on the server, every time;
 *   3. queries run as the signed-in admin, so row-level security checks again;
 *   4. publishing goes through public.content_publish(), which refuses to
 *      overwrite a version someone else published in the meantime.
 * Nothing here uses the secret key.
 */

export type ContentActionResult =
  | { ok: true; message: string; version?: number }
  | { ok: false; error: string; issues?: ContentIssue[] };

const isKey = (k: string): k is ContentKey => Object.prototype.hasOwnProperty.call(CONTENT_REGISTRY, k);
const fail = (error: string, issues?: ContentIssue[]): ContentActionResult => ({ ok: false, error, issues });
const MAX_TEXT = 1_100_000;

function refreshAdmin(key: string) {
  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/${key}`);
}

/** Saves a draft (never visible to visitors). `json` is the whole block as JSON text. */
export async function saveContentDraft(key: string, json: string, baseVersion: number | null): Promise<ContentActionResult> {
  const { supabase } = await assertAdmin();
  if (!isKey(key)) return fail("Unknown content block.");
  if (typeof json !== "string" || json.length > MAX_TEXT) return fail("This block is too large.");
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return fail("The content is not valid JSON.");
  }
  const issues = contentIssues(key, data);
  if (issues.length) return fail(`Not saved — ${issues.length} problem${issues.length === 1 ? "" : "s"} to fix.`, issues);
  const { error } = await supabase
    .from("content_drafts")
    .upsert({ key, data, base_version: Number.isInteger(baseVersion) ? baseVersion : null, schema_version: CONTENT_SCHEMA_VERSION }, { onConflict: "key" });
  if (error) return fail("The draft could not be saved. Please try again.");
  refreshAdmin(key);
  const assets = localAssetPaths(key, data);
  const missing = [
    ...(await missingFiles(assets.filter((p) => !MEDIA_PATH.test(p)))),
    ...(await missingMedia(supabase, mediaIdsIn(data))).map((id) => `library file ${id.slice(0, 8)}… (deleted)`),
  ];
  return {
    ok: true,
    message: missing.length
      ? `Draft saved. Check before publishing — these files were not found on the site: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? " …" : ""}`
      : "Draft saved. Visitors still see the published version.",
  };
}

/**
 * Paths (already validated as local /public paths) that the site does not
 * serve. Only the site's own origin is ever requested. Best effort: on any
 * network problem nothing is reported.
 */
async function missingFiles(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const h = await headers();
  const host = h.get("host");
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? (host ? `${h.get("x-forwarded-proto") ?? "http"}://${host}` : null);
  if (!origin) return [];
  const out: string[] = [];
  const list = paths.slice(0, 80);
  for (let i = 0; i < list.length; i += 8) {
    await Promise.all(list.slice(i, i + 8).map(async (p) => {
      try {
        const r = await fetch(new URL(encodeURI(p), origin), { method: "HEAD", cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(4000) });
        if (r.status === 404) out.push(p);
      } catch { /* unknown: do not warn */ }
    }));
  }
  return out;
}

/** Publishes the saved draft. `expectedVersion` = the published version the editor was showing. */
export async function publishContent(key: string, expectedVersion: number | null, note: string): Promise<ContentActionResult> {
  const { supabase } = await assertAdmin();
  if (!isKey(key)) return fail("Unknown content block.");
  const { data: draft, error: readError } = await supabase.from("content_drafts").select("data").eq("key", key).maybeSingle();
  if (readError) return fail("The draft could not be read. Please try again.");
  if (!draft) return fail("There is no saved draft to publish.");
  const issues = contentIssues(key, draft.data); // re-check: rules may have changed since it was saved
  if (issues.length) return fail("The saved draft has problems and was not published.", issues);
  const gone = await missingMedia(supabase, mediaIdsIn(draft.data));
  if (gone.length) return fail(`The draft uses ${gone.length} library file${gone.length === 1 ? "" : "s"} that no longer exist${gone.length === 1 ? "s" : ""}. Choose another file, then publish.`);
  const pending = await unreviewedMedia(supabase, mediaIdsIn(draft.data));
  if (pending.length) return fail(`The draft uses ${pending.length} library file${pending.length === 1 ? "" : "s"} not yet approved in the privacy review (Media). Review ${pending.length === 1 ? "it" : "them"}, then publish.`);
  const { data: version, error } = await supabase.rpc("content_publish", {
    p_key: key,
    p_expected_version: expectedVersion,
    p_note: typeof note === "string" && note.trim() ? note.trim().slice(0, 500) : null,
  });
  if (error) {
    if (error.code === "40001") return fail("Someone published this block after you opened it. Reload to see the latest version, then publish again.");
    return fail("The draft could not be published. Please try again.");
  }
  refreshAdmin(key);
  revalidatePath("/", "layout"); // public pages pick up the new content now
  return { ok: true, message: `Published as version ${version}. The site is updated.`, version: version as number };
}

/**
 * Restores an earlier published version. It becomes a NEW version (history is
 * never rewritten). The old content is validated against today's rules first.
 */
export async function restoreContentVersion(key: string, toVersion: number, expectedVersion: number): Promise<ContentActionResult> {
  const { supabase } = await assertAdmin();
  if (!isKey(key) || !Number.isInteger(toVersion) || !Number.isInteger(expectedVersion)) return fail("Invalid request.");
  const { data: old, error: readError } = await supabase
    .from("content_versions").select("data").eq("key", key).eq("version", toVersion).neq("operation", "DELETE").maybeSingle();
  if (readError || !old) return fail("That version could not be found.");
  const issues = contentIssues(key, old.data);
  if (issues.length) return fail("That version no longer passes today's checks, so it was not restored.", issues);
  if ((await missingMedia(supabase, mediaIdsIn(old.data))).length) return fail("That version uses library files that have since been deleted, so it was not restored.");
  if ((await unreviewedMedia(supabase, mediaIdsIn(old.data))).length) return fail("That version uses library files that are not approved in the privacy review, so it was not restored.");
  const { data: version, error } = await supabase.rpc("content_rollback", {
    p_key: key, p_to_version: toVersion, p_expected_version: expectedVersion, p_note: `Restored version ${toVersion}`,
  });
  if (error) {
    if (error.code === "40001") return fail("Someone published this block in the meantime. Reload and try again.");
    return fail("The version could not be restored. Please try again.");
  }
  refreshAdmin(key);
  revalidatePath(`/admin/content/${key}/history`);
  revalidatePath("/", "layout");
  return { ok: true, message: `Version ${toVersion} restored as version ${version}. The site is updated.`, version: version as number };
}

/** Deletes the draft; the published version is untouched. */
export async function discardContentDraft(key: string): Promise<ContentActionResult> {
  const { supabase } = await assertAdmin();
  if (!isKey(key)) return fail("Unknown content block.");
  const { error } = await supabase.from("content_drafts").delete().eq("key", key);
  if (error) return fail("The draft could not be discarded. Please try again.");
  refreshAdmin(key);
  return { ok: true, message: "Draft discarded." };
}
