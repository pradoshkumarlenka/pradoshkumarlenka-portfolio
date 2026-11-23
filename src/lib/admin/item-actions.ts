"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "./auth";
import { parseItemForm, UUID } from "./validate";
import type { ActionResult, ItemState } from "./types";

/*
 * ITEM ACTIONS. Every action starts with assertAdmin() (server-side check), and
 * every query runs as the signed-in user, so the database's row-level security
 * checks the same thing again. Nothing here uses the secret key.
 */

const fail = (error: string, fields?: Record<string, string>): ActionResult => ({ ok: false, error, fields });
const dbError = (e: { code?: string; message?: string }) =>
  e.code === "23505" ? fail("Please fix the highlighted field.", { slug: "This URL slug is already used by another item." }) : fail("The change could not be saved. Please try again.");

function refresh(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/", "layout"); // public site: listing + detail pages update immediately
  if (id) revalidatePath(`/admin/items/${id}`);
}

export async function createItem(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  const { data, fields } = parseItemForm(form);
  if (!data) return fail("Please fix the highlighted fields.", fields);
  const { data: last } = await supabase.from("items").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const sort_order = (last?.[0]?.sort_order ?? 0) + 10;
  const { data: row, error } = await supabase.from("items").insert({ ...data, state: "draft", sort_order }).select("id").single();
  if (error) return dbError(error);
  refresh();
  redirect(`/admin/items/${row.id}?created=1`);
}

export async function updateItem(id: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!UUID.test(id)) return fail("Unknown item.");
  const { data, fields } = parseItemForm(form);
  if (!data) return fail("Please fix the highlighted fields.", fields);
  const { error, count } = await supabase.from("items").update(data, { count: "exact" }).eq("id", id);
  if (error) return dbError(error);
  if (!count) return fail("This item no longer exists.");
  refresh(id);
  return { ok: true, message: "Saved." };
}

const STATES: ItemState[] = ["draft", "published", "archived"];

/** Publish, unpublish (back to draft) or archive. */
export async function setItemState(id: string, state: ItemState): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!UUID.test(id) || !STATES.includes(state)) return fail("Invalid request.");
  const { error, count } = await supabase.from("items").update({ state }, { count: "exact" }).eq("id", id);
  if (error || !count) return fail("The status could not be changed.");
  refresh(id);
  return { ok: true, message: state === "published" ? "Published." : state === "archived" ? "Archived." : "Moved back to draft." };
}

/** Moves an item one place up or down in the list (swaps sort order with its neighbour). */
export async function moveItem(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!UUID.test(id)) return fail("Invalid request.");
  const { data: rows, error } = await supabase.from("items").select("id, sort_order").order("sort_order").order("created_at");
  if (error || !rows) return fail("The order could not be changed.");
  const i = rows.findIndex((r) => r.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return { ok: true };
  // Renumber everything in steps of 10 with the two swapped (robust even if values were equal).
  const order = rows.map((r) => r.id);
  [order[i], order[j]] = [order[j], order[i]];
  for (const [k, rid] of order.entries()) {
    const target = (k + 1) * 10;
    if (rows.find((r) => r.id === rid)?.sort_order !== target) {
      const { error: e } = await supabase.from("items").update({ sort_order: target }).eq("id", rid);
      if (e) return fail("The order could not be fully saved. Please refresh.");
    }
  }
  refresh();
  return { ok: true };
}

/**
 * Deletes ONE item record (its attachment records go with it via ON DELETE CASCADE).
 * - Typed confirmation (the slug) and, for a published item, an explicit acknowledgement.
 * - Concurrency: only deletes the exact version the admin was looking at (updated_at);
 *   if it was edited, published or deleted in another tab meanwhile, nothing happens.
 * - Stored files are never deleted automatically: they stay private (no record points
 *   to them, so no public route serves them) until “Clean up unused files” is run.
 */
export async function deleteItem(id: string, confirmSlug: string, expectedUpdatedAt: string, confirmPublished = false): Promise<ActionResult> {
  const { supabase } = await assertAdmin();
  if (!UUID.test(id) || typeof expectedUpdatedAt !== "string" || !expectedUpdatedAt) return fail("Invalid request.");
  const { data: item } = await supabase.from("items").select("slug, state, updated_at").eq("id", id).maybeSingle();
  if (!item) return fail("This item no longer exists.");
  if (confirmSlug.trim() !== item.slug) return fail(`Type the slug “${item.slug}” to confirm.`);
  if (new Date(item.updated_at).getTime() !== new Date(expectedUpdatedAt).getTime())
    return fail("This item was changed since you opened it (perhaps in another tab). Reload the page, check it, then delete again.");
  if (item.state === "published" && confirmPublished !== true) return fail("This item is live on the website. Tick the confirmation to delete it.");
  const { error, count } = await supabase.from("items").delete({ count: "exact" }).eq("id", id).eq("updated_at", item.updated_at);
  if (error) return fail("The item could not be deleted.");
  if (count !== 1) return fail("This item was changed or deleted meanwhile. Nothing was deleted — reload the page.");
  refresh();
  redirect("/admin?deleted=1");
}
