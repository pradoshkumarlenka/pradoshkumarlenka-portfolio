"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { finalizeUpload, requestUpload } from "@/lib/admin/file-actions";
import { supabasePublishableKey } from "@/lib/supabase/config";
import { secondaryBtn } from "./styles";

type Purpose = "attachment" | "cover" | "replace";
type Status = { kind: "idle" } | { kind: "uploading"; name: string; pct: number } | { kind: "checking"; name: string } | { kind: "done"; text: string } | { kind: "error"; text: string };

/** PUT the file to the signed upload URL with real progress (fetch cannot report upload progress). */
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

/** Choose (or drop) one or more files → upload with progress → server verifies → list refreshes. */
export function FileUploader({ itemId, purpose, accept, buttonLabel, replaceId, multiple = false }: { itemId: string; purpose: Purpose; accept: string; buttonLabel: string; replaceId?: string; multiple?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [over, setOver] = useState(false);
  const busy = status.kind === "uploading" || status.kind === "checking";

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    let added = 0;
    for (const file of Array.from(files)) {
      setStatus({ kind: "uploading", name: file.name, pct: 0 });
      const ticket = await requestUpload(itemId, purpose, file.name, file.size).catch(() => ({ ok: false as const, error: "You are not signed in, or your session expired." }));
      if (!ticket.ok) { setStatus({ kind: "error", text: `${file.name}: ${ticket.error}` }); return; }
      try {
        await put(ticket.signedUrl, file, ticket.contentType, (pct) => setStatus({ kind: "uploading", name: file.name, pct }));
      } catch (e) {
        setStatus({ kind: "error", text: `${file.name}: ${(e as Error).message}` });
        return;
      }
      setStatus({ kind: "checking", name: file.name });
      const result = await finalizeUpload(itemId, purpose, ticket.path, { replaceId }).catch(() => ({ ok: false as const, error: "The file could not be verified." }));
      if (!result.ok) { setStatus({ kind: "error", text: `${file.name}: ${result.error}` }); return; }
      added++;
    }
    setStatus({ kind: "done", text: purpose === "cover" ? "Cover updated." : purpose === "replace" ? "File replaced." : `${added} file${added === 1 ? "" : "s"} added.` });
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) handle(e.dataTransfer.files); }}
      className={purpose === "replace" ? "inline-block" : `rounded-card border border-dashed p-4 transition-colors ${over ? "border-lavender bg-violet/10" : "border-line-strong"}`}
    >
      <input ref={input} type="file" accept={accept} multiple={multiple} className="sr-only" id={`up-${purpose}-${replaceId ?? itemId}`} onChange={(e) => handle(e.target.files)} disabled={busy} />
      <label htmlFor={`up-${purpose}-${replaceId ?? itemId}`} className={`${secondaryBtn} cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>{buttonLabel}</label>
      {purpose !== "replace" && <span className="ml-3 text-xs text-fg-subtle">or drop files here</span>}
      <div role="status" aria-live="polite" className="mt-2 text-xs">
        {status.kind === "uploading" && (
          <div className="max-w-sm">
            <p className="text-fg-muted">Uploading {status.name} — {status.pct}%</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true"><div className="h-full bg-violet transition-[width]" style={{ width: `${status.pct}%` }} /></div>
          </div>
        )}
        {status.kind === "checking" && <p className="text-fg-muted">Checking {status.name}…</p>}
        {status.kind === "done" && <p className="text-positive">{status.text}</p>}
        {status.kind === "error" && <p className="text-negative">{status.text}</p>}
      </div>
    </div>
  );
}
