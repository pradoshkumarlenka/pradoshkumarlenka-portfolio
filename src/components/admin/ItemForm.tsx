"use client";

import { useActionState, useState } from "react";
import type { ActionResult, ItemRow } from "@/lib/admin/types";
import { LIMITS, slugify } from "@/lib/admin/validate";
import { field, label, primaryBtn } from "./styles";

type Action = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

/** Create / edit form for an item. Server validates again; errors show next to each field. */
export function ItemForm({ action, item, submitLabel }: { action: Action; item?: ItemRow; submitLabel: string }) {
  const [state, submit, pending] = useActionState<ActionResult | null, FormData>(action, null);
  const [title, setTitle] = useState(item?.title ?? "");
  const [slug, setSlug] = useState(item?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(item));
  const fieldErr = (k: string) => (state && !state.ok ? state.fields?.[k] : undefined);
  const err = (k: string) => (fieldErr(k) ? <p id={`${k}-err`} className="mt-1 text-xs text-negative">{fieldErr(k)}</p> : null);
  const aria = (k: string) => ({ "aria-invalid": Boolean(fieldErr(k)) || undefined, "aria-describedby": fieldErr(k) ? `${k}-err` : undefined });

  return (
    <form action={submit} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="title" className={label}>Title *</label>
          <input id="title" name="title" required maxLength={LIMITS.title} value={title} className={field} {...aria("title")}
            onChange={(e) => { setTitle(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} />
          {err("title")}
        </div>
        <div>
          <label htmlFor="slug" className={label}>URL slug *</label>
          <input id="slug" name="slug" required maxLength={LIMITS.slug} value={slug} className={`${field} font-mono`} {...aria("slug")}
            onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); }} />
          <p className="mt-1 text-xs text-fg-subtle">Used in the item&apos;s page address.</p>
          {err("slug")}
        </div>
        <div>
          <label htmlFor="category" className={label}>Category</label>
          <input id="category" name="category" maxLength={LIMITS.category} defaultValue={item?.category} placeholder="e.g. Fixed income" className={field} {...aria("category")} />
          {err("category")}
        </div>
        <div>
          <label htmlFor="work_status" className={label}>Status shown on the card</label>
          <input id="work_status" name="work_status" maxLength={LIMITS.workStatus} defaultValue={item?.work_status ?? "Completed"} list="work-status-options" className={field} {...aria("work_status")} />
          <datalist id="work-status-options"><option value="Completed" /><option value="Ongoing" /><option value="In review" /></datalist>
          {err("work_status")}
        </div>
      </div>
      <div>
        <label htmlFor="summary" className={label}>Card summary</label>
        <textarea id="summary" name="summary" rows={3} maxLength={LIMITS.summary} defaultValue={item?.summary} className={field} {...aria("summary")} />
        {err("summary")}
      </div>
      <div>
        <label htmlFor="description" className={label}>Overview (detail page)</label>
        <textarea id="description" name="description" rows={8} maxLength={LIMITS.description} defaultValue={item?.description} className={field} {...aria("description")} />
        <p className="mt-1 text-xs text-fg-subtle">Shown on the item&apos;s page. Blank lines start new paragraphs.</p>
        {err("description")}
      </div>
      <div>
        <label htmlFor="highlights" className={label}>Highlights (optional, one per line)</label>
        <textarea id="highlights" name="highlights" rows={4} defaultValue={item?.highlights.join("\n")} className={field} {...aria("highlights")} />
        {err("highlights")}
      </div>
      <div>
        <label htmlFor="cover_alt" className={label}>Cover image description (for screen readers)</label>
        <input id="cover_alt" name="cover_alt" maxLength={LIMITS.coverAlt} defaultValue={item?.cover_alt} className={field} {...aria("cover_alt")} />
        {err("cover_alt")}
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={primaryBtn}>{pending ? "Saving…" : submitLabel}</button>
        <p role="status" aria-live="polite" className={`text-sm ${state && !state.ok ? "text-negative" : "text-positive"}`}>
          {state ? (state.ok ? state.message : state.error) : ""}
        </p>
      </div>
    </form>
  );
}
