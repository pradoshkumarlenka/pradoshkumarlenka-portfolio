"use client";

import { useState, useTransition } from "react";
import { deleteItem, moveItem, setItemState } from "@/lib/admin/item-actions";
import type { ActionResult, ItemState } from "@/lib/admin/types";
import { dangerBtn, field, secondaryBtn } from "./styles";

function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (fn: () => Promise<ActionResult>) => start(async () => setResult(await fn()));
  return { pending, result, run };
}

const Status = ({ result }: { result: ActionResult | null }) => (
  <span role="status" aria-live="polite" className={`text-xs ${result && !result.ok ? "text-negative" : "text-positive"}`}>
    {result ? (result.ok ? result.message ?? "" : result.error) : ""}
  </span>
);

/** ↑ / ↓ buttons in the items list. */
export function MoveButtons({ id, title, first, last }: { id: string; title: string; first: boolean; last: boolean }) {
  const { pending, result, run } = useAction();
  const btn = "inline-flex h-8 w-8 items-center justify-center rounded-control border border-line text-fg-muted hover:border-lavender hover:text-fg disabled:opacity-30";
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" className={btn} disabled={first || pending} onClick={() => run(() => moveItem(id, "up"))} aria-label={`Move “${title}” up`}>↑</button>
      <button type="button" className={btn} disabled={last || pending} onClick={() => run(() => moveItem(id, "down"))} aria-label={`Move “${title}” down`}>↓</button>
      {result && !result.ok && <Status result={result} />}
    </span>
  );
}

/** Publish / unpublish / archive buttons on the edit page. */
export function StateButtons({ id, state }: { id: string; state: ItemState }) {
  const { pending, result, run } = useAction();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {state !== "published" && <button type="button" className={secondaryBtn} disabled={pending} onClick={() => run(() => setItemState(id, "published"))}>Publish</button>}
      {state === "published" && <button type="button" className={secondaryBtn} disabled={pending} onClick={() => run(() => setItemState(id, "draft"))}>Unpublish (back to draft)</button>}
      {state !== "archived" && <button type="button" className={secondaryBtn} disabled={pending} onClick={() => run(() => setItemState(id, "archived"))}>Archive</button>}
      {state === "archived" && <button type="button" className={secondaryBtn} disabled={pending} onClick={() => run(() => setItemState(id, "draft"))}>Restore to draft</button>}
      <Status result={result} />
    </div>
  );
}

/** Delete with a typed confirmation (the item's slug). */
export function DeleteItem({ id, slug, title, state, updatedAt }: { id: string; slug: string; title: string; state: ItemState; updatedAt: string }) {
  const { pending, result, run } = useAction();
  const [typed, setTyped] = useState("");
  const [ack, setAck] = useState(false);
  const live = state === "published";
  const ready = typed === slug && (!live || ack);
  const submit = () => {
    if (!confirm(`Permanently delete “${title}”${live ? " — it is LIVE on the website" : ""}? This cannot be undone.`)) return;
    run(() => deleteItem(id, typed, updatedAt, ack));
  };
  return (
    <div className="space-y-3">
      {live && (
        <p role="note" className="rounded-control border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-fg">
          This item is <strong>published</strong>: deleting it removes it from the website immediately and its page will show “not found”.
          Consider <em>Unpublish</em> or <em>Archive</em> instead.
        </p>
      )}
      <label htmlFor="confirm-delete" className="block text-sm text-fg-muted">
        Type <span className="font-mono text-fg">{slug}</span> to permanently delete this item and its attachment list.
        Uploaded files are not deleted automatically — they stay private and can be removed later with “Clean up unused files”.
      </label>
      {live && (
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I understand this removes a live item from the website.
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <input id="confirm-delete" value={typed} onChange={(e) => setTyped(e.target.value)} className={`${field} max-w-xs font-mono`} autoComplete="off" />
        <button type="button" className={dangerBtn} disabled={pending || !ready} onClick={submit}>
          {pending ? "Deleting…" : "Delete permanently"}
        </button>
      </div>
      <Status result={result} />
    </div>
  );
}
