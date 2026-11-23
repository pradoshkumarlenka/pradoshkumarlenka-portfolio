"use client";

import { useEffect, useRef, useState } from "react";
import { listMediaForPicker } from "@/lib/admin/media-actions";
import { field, secondaryBtn } from "../styles";

type Item = Awaited<ReturnType<typeof listMediaForPicker>>[number];

/** "Library" button + dialog: choose a media-library file for a content field. */
export function MediaPicker({ kind, onPick }: { kind: "image" | "pdf" | "any"; onPick: (url: string, alt: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    listMediaForPicker().then((r) => { if (alive) setItems(r); }, () => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [open]);

  const show = () => { setOpen(true); dialog.current?.showModal(); };
  const close = () => { dialog.current?.close(); setOpen(false); };
  const list = (items ?? []).filter((m) => (kind === "any" || m.kind === kind) && (!q || `${m.title} ${m.alt}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <button type="button" className={`${secondaryBtn} shrink-0`} onClick={show}>Library</button>
      <dialog ref={dialog} onClose={() => setOpen(false)} className="m-auto w-[min(56rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-fg backdrop:bg-black/70">
        <div className="flex items-center gap-3 border-b border-line p-4">
          <h2 className="flex-1 font-display text-2xl">Choose a file</h2>
          <input aria-label="Search files" placeholder="Search" className={`${field} max-w-xs`} value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" className={secondaryBtn} onClick={close}>Close</button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto p-4">
          {error && <p role="alert" className="text-sm text-negative">The library could not be loaded.</p>}
          {!items && !error && <p className="text-sm text-fg-muted">Loading…</p>}
          {items && list.length === 0 && <p className="text-sm text-fg-muted">No files. Upload them in Media first.</p>}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {list.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => { onPick(m.url, m.alt); close(); }} className="group block w-full overflow-hidden rounded-control border border-line text-left hover:border-lavender focus-visible:border-lavender">
                  <span className="block aspect-[3/2] bg-canvas/60">
                    {m.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element -- private admin thumbnail
                      <img src={m.view} alt="" loading="lazy" className="h-full w-full object-contain" />
                    ) : (
                      <span className="flex h-full items-center justify-center font-mono text-xs text-fg-muted">PDF</span>
                    )}
                  </span>
                  <span className="block truncate px-2 py-1.5 text-xs text-fg-muted group-hover:text-fg">{m.title || "Untitled"}</span>
                  {!m.approved && <span className="block px-2 pb-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-lavender">Review pending — approve in Media before publishing</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}
