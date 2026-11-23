"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
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
  /** Object path inside the private storage bucket (media/<id>/<file>). */
  storagePath: string;
  /** Upload time and last change, formatted on the server. */
  uploaded: string;
  changed: string | null;
  usedBy: { key: string; title: string; draft: boolean }[];
  /** Passed the privacy review (only approved files can be shown publicly). */
  approved: boolean;
}

type Usage = "live" | "published-hidden" | "draft" | "unused";
/** Where a file stands. Visitors can load a file only when it is approved AND used by published content. */
function usageOf(m: MediaItem): Usage {
  if (m.usedBy.some((u) => !u.draft)) return m.approved ? "live" : "published-hidden";
  return m.usedBy.length ? "draft" : "unused";
}
const USAGE: Record<Usage, { chip: string; text: string; tone: string }> = {
  live: { chip: "Published · live", text: "Used by published content and approved: visitors can see it on the site.", tone: "border-positive/50 text-positive" },
  "published-hidden": { chip: "Published · hidden", text: "Used by published content but not approved, so visitors cannot load it. Approve it to show it.", tone: "border-negative/50 text-negative" },
  draft: { chip: "Draft only", text: "Used only in unpublished drafts: private (visible to you in the preview).", tone: "border-lavender/50 text-lavender" },
  unused: { chip: "Unused", text: "Not used anywhere yet: private.", tone: "border-line text-fg-muted" },
};
const FILTERS: { id: "all" | Usage | "pending"; label: string; test: (m: MediaItem) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "unused", label: "Unused", test: (m) => usageOf(m) === "unused" },
  { id: "draft", label: "In drafts", test: (m) => m.usedBy.some((u) => u.draft) },
  { id: "live", label: "Published", test: (m) => m.usedBy.some((u) => !u.draft) },
  { id: "pending", label: "Review pending", test: (m) => !m.approved },
];

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

export function MediaLibrary({ items, bucket }: { items: MediaItem[]; bucket: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [view, setView] = useState<(typeof FILTERS)[number]["id"]>("all");

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

  const active = FILTERS.find((f) => f.id === view) ?? FILTERS[0];
  const shown = items.filter((m) => active.test(m) && (!filter || `${m.title} ${m.alt} ${m.storagePath}`.toLowerCase().includes(filter.toLowerCase())));
  return (
    <div className="mt-8 space-y-6">
      <details className={`${card} p-5 text-sm text-fg-muted`}>
        <summary className="cursor-pointer font-medium text-fg">How to use uploaded files</summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5">
          <li>Upload an image or PDF below. It is stored in the private <code className="font-mono text-xs text-fg">{bucket}</code> bucket and starts as <em>Review pending</em>. Uploading never publishes anything.</li>
          <li>Open the file, check it for personal details, tick the checklist and choose <em>Approve for publication</em>. Approval alone does not publish it either.</li>
          <li>Go to <Link href="/admin/content" className="text-fg underline underline-offset-2">Content</Link>, open a section (for example Hero or Contact) and press <em>Library</em> next to an image or file field to choose the file. You can also paste its site path (<em>Copy path</em>) into the field.</li>
          <li>Save the draft, check it with <em>Preview</em>, then <em>Publish</em>. Only then can visitors see the file, and only while it stays approved.</li>
        </ol>
        <p className="mt-3 text-xs text-fg-subtle">The site path (<code className="font-mono">/media/…</code>) is what content stores. Copying it never gives access: the site serves a file to visitors only once it is approved and used by published content, and the storage bucket itself is private.</p>
      </details>

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
        <div role="radiogroup" aria-label="Show files" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={view === f.id} onClick={() => setView(f.id)}
              className={`rounded-chip border px-3 py-1 text-xs ${view === f.id ? "border-violet bg-violet text-on-violet" : "border-line text-fg-muted hover:text-fg"}`}>
              {f.label} <span className="font-mono opacity-70">{items.filter(f.test).length}</span>
            </button>
          ))}
        </div>
        <input aria-label="Search files" placeholder="Search by title, alt text or path" className={`${field} max-w-xs`} value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      {shown.length === 0 ? (
        <p className={`${card} p-8 text-center text-sm text-fg-muted`}>{items.length ? "No files match." : "No files yet."}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((m) => <MediaCard key={m.id} item={m} bucket={bucket} onChanged={() => router.refresh()} />)}
        </ul>
      )}
    </div>
  );
}

function MediaCard({ item, bucket, onChanged }: { item: MediaItem; bucket: string; onChanged: () => void }) {
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
  const copy = async (text: string, what: string) => { try { await navigator.clipboard.writeText(text); setMsg({ text: `${what} copied.` }); } catch { setMsg({ text }); } };
  const state = usageOf(item);
  const usage = USAGE[state];

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
        <div className="flex flex-wrap gap-1.5">
          <span className={`rounded-chip border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${usage.tone}`} data-usage={state}>{usage.chip}</span>
          <span className={`rounded-chip border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${item.approved ? "border-positive/50 text-positive" : "border-lavender/50 text-lavender"}`} data-review={item.approved ? "approved" : "pending"}>
            {item.approved ? "Approved" : "Review pending"}
          </span>
          <span className="rounded-chip border border-positive/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-positive">Uploaded</span>
        </div>
        <p className="font-mono text-[11px] text-fg-subtle">
          {item.mime.replace("image/", "").replace("application/", "").toUpperCase()} · {kb(item.bytes)}{item.width ? ` · ${item.width}×${item.height}` : ""}
        </p>
        <p className="text-[11px] text-fg-subtle">Uploaded {item.uploaded}{item.changed ? ` · last changed ${item.changed}` : ""}</p>
        <dl className="space-y-1.5 rounded-control border border-line bg-canvas/40 p-3 text-[11px]">
          <div>
            <dt className="text-fg-subtle">Bucket (private)</dt>
            <dd className="font-mono text-fg" data-bucket>{bucket}</dd>
          </div>
          <div>
            <dt className="text-fg-subtle">Storage path</dt>
            <dd className="break-all font-mono text-fg" data-storage-path>{item.storagePath}</dd>
          </div>
          <div>
            <dt className="text-fg-subtle">Site path (use this in content)</dt>
            <dd className="break-all font-mono text-fg" data-site-path>{item.url}</dd>
          </div>
        </dl>
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
        <div className="text-xs text-fg-subtle" data-media-usage>
          <p>{usage.text}</p>
          {used && (
            <ul className="mt-1.5 space-y-1">
              {item.usedBy.map((u) => (
                <li key={`${u.key}-${u.draft}`}>
                  <Link href={`/admin/content/${encodeURIComponent(u.key)}`} className="text-fg underline-offset-2 hover:underline">{u.title}</Link>{" "}
                  <span className={u.draft ? "text-lavender" : "text-positive"}>({u.draft ? "draft" : "published"})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
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
          <button type="button" className={secondaryBtn} onClick={() => copy(item.url, "Site path")} title="Copy the site path to paste into a content field">Copy path</button>
          <button type="button" className={secondaryBtn} onClick={() => copy(`${bucket}/${item.storagePath}`, "Storage path")} title="Bucket and storage path, for reference (the bucket is private)">Copy storage path</button>
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
