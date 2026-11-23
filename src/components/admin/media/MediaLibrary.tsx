"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMedia, finalizeMediaUpload, requestMediaUpload, setMediaReview, updateMediaDetails, type MediaResult } from "@/lib/admin/media-actions";
import { supabasePublishableKey } from "@/lib/supabase/config";
import { card, dangerBtn, field, label, primaryBtn, secondaryBtn } from "../styles";

export interface MediaItem {
  id: string;
  url: string;
  /** Signed display URL (img src / open file); `url` is what content stores and "copy" gives. */
  view: string;
  kind: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  title: string;
  alt: string;
  updatedAt: string;
  usedBy: { key: string; title: string; draft: boolean }[];
  /** Passed the privacy review (only approved files can be shown publicly). */
  approved: boolean;
}

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const ACCEPT = ".jpg,.jpeg,.png,.webp,.avif,.pdf,image/jpeg,image/png,image/webp,image/avif,application/pdf";

/** PUT to the signed upload URL with real progress. */
function put(url: string, file: File, contentType: string, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", contentType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("apikey", supabasePublishableKey);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.status === 413 ? "The file is larger than allowed." : `Upload failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(file);
  });
}

/** Upload one file (new, or replacing `replaceId`). */
async function uploadOne(file: File, onProgress: (pct: number) => void, replaceId?: string): Promise<MediaResult> {
  const ticket = await requestMediaUpload(file.name, file.size, replaceId);
  if (!ticket.ok) return { ok: false, error: ticket.error };
  await put(ticket.signedUrl, file, ticket.contentType, onProgress);
  return finalizeMediaUpload(ticket.id, ticket.path, { replace: Boolean(replaceId), title: file.name.replace(/\.[^.]+$/, "") });
}

export function MediaLibrary({ items }: { items: MediaItem[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  const uploadFiles = async (files: FileList | File[]) => {
    const list = [...files];
    if (!list.length) return;
    setBusy(true);
    const errors: string[] = [];
    for (const [i, f] of list.entries()) {
      setStatus({ text: `Uploading ${f.name} (${i + 1}/${list.length})…` });
      try {
        const r = await uploadOne(f, (pct) => setStatus({ text: `Uploading ${f.name} (${i + 1}/${list.length}) — ${pct}%` }));
        if (!r.ok) errors.push(`${f.name}: ${r.error}`);
      } catch (e) {
        errors.push(`${f.name}: ${(e as Error).message}`);
      }
    }
    setBusy(false);
    setStatus(errors.length ? { text: errors.join(" · "), error: true } : { text: `${list.length} file${list.length === 1 ? "" : "s"} uploaded.` });
    router.refresh();
  };

  const shown = items.filter((m) => !filter || `${m.title} ${m.alt}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="mt-8 space-y-6">
      <div
        className={`${card} flex flex-col items-center gap-3 border-dashed p-8 text-center`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (!busy) void uploadFiles(e.dataTransfer.files); }}
      >
        <p className="text-sm text-fg-muted">Drop images or PDFs here, or</p>
        <button type="button" className={primaryBtn} disabled={busy} onClick={() => input.current?.click()}>{busy ? "Uploading…" : "Choose files"}</button>
        <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { if (e.target.files) void uploadFiles(e.target.files); e.target.value = ""; }} />
        {status && <p role={status.error ? "alert" : "status"} className={`text-sm ${status.error ? "text-negative" : "text-fg-muted"}`}>{status.text}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">{items.length} file{items.length === 1 ? "" : "s"} · {items.filter((m) => m.usedBy.length).length} in use</p>
        <input aria-label="Search files" placeholder="Search by title or alt text" className={`${field} max-w-xs`} value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      {shown.length === 0 ? (
        <p className={`${card} p-8 text-center text-sm text-fg-muted`}>{items.length ? "No files match." : "No files yet."}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((m) => <MediaCard key={m.id} item={m} onChanged={() => router.refresh()} />)}
        </ul>
      )}
    </div>
  );
}

function MediaCard({ item, onChanged }: { item: MediaItem; onChanged: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [alt, setAlt] = useState(item.alt);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [checked, setChecked] = useState(false);
  const [pending, start] = useTransition();
  const replaceInput = useRef<HTMLInputElement>(null);
  const dirty = title !== item.title || alt !== item.alt;
  const used = item.usedBy.length > 0;
  const run = (fn: () => Promise<MediaResult>) => start(async () => {
    try {
      const r = await fn();
      setMsg(r.ok ? { text: r.message } : { text: r.error, error: true });
      if (r.ok) onChanged();
    } catch {
      setMsg({ text: "Not authorised, or the connection failed.", error: true });
    }
  });
  const copy = async () => { try { await navigator.clipboard.writeText(item.url); setMsg({ text: "Path copied." }); } catch { setMsg({ text: item.url }); } };

  return (
    <li className={`${card} flex flex-col overflow-hidden`}>
      <a href={item.view} target="_blank" rel="noreferrer" className="block aspect-[3/2] bg-canvas/60" title="Open file">
        {item.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element -- private admin thumbnail (served only to the admin)
          <img src={`${item.view}${item.view.includes("?") ? "&" : "?"}v=${new Date(item.updatedAt).getTime()}`} alt={item.alt || item.title} loading="lazy" className="h-full w-full object-contain" />
        ) : (
          <span className="flex h-full items-center justify-center font-mono text-sm text-fg-muted">PDF</span>
        )}
      </a>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className={`self-start rounded-chip border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${item.approved ? "border-positive/50 text-positive" : "border-lavender/50 text-lavender"}`}>
          {item.approved ? "Approved" : "Review pending"}
        </p>
        <p className="font-mono text-[11px] text-fg-subtle">
          {item.mime.replace("image/", "").replace("application/", "").toUpperCase()} · {kb(item.bytes)}{item.width ? ` · ${item.width}×${item.height}` : ""}
        </p>
        <div>
          <label htmlFor={`t-${item.id}`} className={label}>Title</label>
          <input id={`t-${item.id}`} className={field} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        {item.kind === "image" && (
          <div>
            <label htmlFor={`a-${item.id}`} className={label}>Alt text</label>
            <textarea id={`a-${item.id}`} className={`${field} min-h-16`} maxLength={300} value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Describe the image for screen readers" />
          </div>
        )}
        <p className="text-xs text-fg-subtle">
          {used ? <>Used in: {item.usedBy.map((u) => `${u.title}${u.draft ? " (draft)" : ""}`).join(", ")}</> : "Not used yet (private)."}
        </p>
        {item.approved ? (
          <button type="button" className="self-start text-xs text-fg-muted underline-offset-2 hover:text-fg hover:underline disabled:opacity-40" disabled={pending}
            onClick={() => { if (confirm("Withdraw approval? The file will not be shown publicly until approved again.")) run(() => setMediaReview(item.id, false, false)); }}>
            Withdraw approval
          </button>
        ) : (
          <div className="rounded-control border border-lavender/30 bg-lavender/5 p-3">
            <label className="flex items-start gap-2 text-xs text-fg-muted">
              <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              <span>I opened this file and checked it: no signatures, enrolment or roll numbers, certificate codes, dates of birth or other personal IDs are visible.</span>
            </label>
            <button type="button" className={`${secondaryBtn} mt-2`} disabled={!checked || pending} onClick={() => run(() => setMediaReview(item.id, true, checked))}>Approve for publication</button>
          </div>
        )}
        {msg && <p role={msg.error ? "alert" : "status"} className={`text-xs ${msg.error ? "text-negative" : "text-positive"}`}>{msg.text}</p>}
        <div className="mt-auto flex flex-wrap gap-2">
          <button type="button" className={secondaryBtn} disabled={!dirty || pending} onClick={() => run(() => updateMediaDetails(item.id, title, alt))}>Save</button>
          <button type="button" className={secondaryBtn} onClick={copy}>Copy path</button>
          <button type="button" className={secondaryBtn} disabled={pending} onClick={() => replaceInput.current?.click()}>Replace…</button>
          <input ref={replaceInput} type="file" accept={item.kind === "pdf" ? ".pdf,application/pdf" : ".jpg,.jpeg,.png,.webp,.avif,image/*"} className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) run(() => uploadOne(f, (pct) => setMsg({ text: `Uploading… ${pct}%` }), item.id)); }} />
          <button type="button" className={dangerBtn} disabled={used || pending} title={used ? "Remove it from the content first" : undefined}
            onClick={() => { if (confirm(`Delete “${item.title}”? This cannot be undone.`)) run(() => deleteMedia(item.id)); }}>Delete</button>
        </div>
      </div>
    </li>
  );
}
