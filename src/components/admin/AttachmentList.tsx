"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveAttachment, removeAttachment, removeCover, updateAttachment } from "@/lib/admin/file-actions";
import type { ActionResult, AttachmentRow } from "@/lib/admin/types";
import { LIMITS } from "@/lib/admin/validate";
import { FileUploader } from "./FileUploader";
import { dangerBtn, field, secondaryBtn } from "./styles";

const ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx";
const KIND_LABEL: Record<string, string> = { pdf: "Read Report", doc: "Read Report", docx: "Read Report", ppt: "View Presentation", pptx: "View Presentation", xls: "Open Financial Model", xlsx: "Open Financial Model" };
const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function Row({ a, first, last, viewUrl }: { a: AttachmentRow; first: boolean; last: boolean; viewUrl?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const [title, setTitle] = useState(a.title);
  const [label, setLabel] = useState(a.label ?? "");
  const [confirm, setConfirm] = useState(false);
  const run = (fn: () => Promise<ActionResult>) => start(async () => { const r = await fn(); setMsg(r); if (r.ok) router.refresh(); });
  const small = "inline-flex h-8 w-8 items-center justify-center rounded-control border border-line text-fg-muted hover:border-lavender hover:text-fg disabled:opacity-30";

  return (
    <li className="grid gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-[6px] border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-muted">{a.kind}</span>
        <span className="text-xs text-fg-subtle">{size(a.size_bytes)}</span>
        {viewUrl && <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-lavender hover:text-fg">Open ↗</a>}
        <span className="ml-auto flex gap-1">
          <button type="button" className={small} disabled={first || pending} onClick={() => run(() => moveAttachment(a.id, "up"))} aria-label={`Move “${a.title}” up`}>↑</button>
          <button type="button" className={small} disabled={last || pending} onClick={() => run(() => moveAttachment(a.id, "down"))} aria-label={`Move “${a.title}” down`}>↓</button>
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_14rem_auto]">
        <input aria-label="File title" value={title} maxLength={LIMITS.fileTitle} onChange={(e) => setTitle(e.target.value)} className={field} />
        <input aria-label="Button text (optional)" placeholder={KIND_LABEL[a.kind]} value={label} maxLength={LIMITS.label} onChange={(e) => setLabel(e.target.value)} className={field} />
        <button type="button" className={secondaryBtn} disabled={pending || (title === a.title && label === (a.label ?? ""))} onClick={() => run(() => updateAttachment(a.id, title, label))}>Save</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FileUploader itemId={a.item_id} purpose="replace" replaceId={a.id} accept={ACCEPT} buttonLabel="Replace file" />
        {confirm ? (
          <>
            <button type="button" className={dangerBtn} disabled={pending} onClick={() => run(() => removeAttachment(a.id))}>Confirm remove</button>
            <button type="button" className={secondaryBtn} onClick={() => setConfirm(false)}>Cancel</button>
          </>
        ) : (
          <button type="button" className={dangerBtn} onClick={() => setConfirm(true)}>Remove</button>
        )}
        <span role="status" aria-live="polite" className={`text-xs ${msg && !msg.ok ? "text-negative" : "text-positive"}`}>{msg ? (msg.ok ? msg.message ?? "" : msg.error) : ""}</span>
      </div>
    </li>
  );
}

export function AttachmentList({ itemId, attachments, urls }: { itemId: string; attachments: AttachmentRow[]; urls: Record<string, string> }) {
  return (
    <div className="space-y-5">
      {attachments.length === 0 ? (
        <p className="text-sm text-fg-muted">No files yet. The item&apos;s page will show its written overview only.</p>
      ) : (
        <ol className="divide-y divide-line">
          {attachments.map((a, i) => <Row key={a.id} a={a} first={i === 0} last={i === attachments.length - 1} viewUrl={urls[a.id]} />)}
        </ol>
      )}
      <FileUploader itemId={itemId} purpose="attachment" accept={ACCEPT} buttonLabel="+ Add files" multiple />
      <p className="text-xs text-fg-subtle">PDF, PowerPoint, Word or Excel · up to 25 MB each · never upload confidential or employer-restricted material.</p>
    </div>
  );
}

export function CoverRemove({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className={dangerBtn} disabled={pending} onClick={() => start(async () => { const r = await removeCover(itemId); if (r.ok) router.refresh(); })}>
      Remove cover
    </button>
  );
}
