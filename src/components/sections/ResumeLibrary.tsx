"use client";

import dynamic from "next/dynamic";
import { useRef, useState, type KeyboardEvent } from "react";
import { track } from "@vercel/analytics";
import type { ResumeFile, ResumeVariant } from "@/content/types";
import { fill } from "@/lib/content/selectors";
import { ViewerStatus } from "@/components/viewers/ViewerModal";
import { useNearViewport } from "@/lib/useNearViewport";

const PdfViewer = dynamic(() => import("@/components/viewers/PdfViewer").then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => <ViewerStatus kind="loading">Loading document…</ViewerStatus>,
});

type FileInfo = { src: string | null; size: string | null };

/**
 * RÉSUMÉ LIBRARY — the real résumé PDFs (content/resume.json), rendered page by
 * page with PDF.js inside a document panel, plus Download and Open actions.
 *
 * With `variants` in the content, a role selector (radio group: arrow keys,
 * Home/End) switches between role-specific versions. A version without a real
 * PDF yet is listed honestly as "awaiting" and offers the Master Résumé instead —
 * nothing is invented or duplicated. Without variants it shows the Master only.
 * `src` is null when a file is missing: an honest notice is shown instead.
 */
export function ResumeLibrary({ resume, src, size, variantInfo = {} }: { resume: ResumeFile; src: string | null; size: string | null; variantInfo?: Record<string, FileInfo> }) {
  const variants: ResumeVariant[] = resume.variants?.length ? resume.variants : [];
  const firstReady = variants.find((v) => variantInfo[v.id]?.src) ?? variants[0];
  const [selected, setSelected] = useState(firstReady?.id ?? "");
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const panel = useRef<HTMLDivElement>(null);
  const near = useNearViewport(panel);

  const current = variants.find((v) => v.id === selected);
  const info: FileInfo = current ? variantInfo[current.id] ?? { src: null, size: null } : { src, size };
  const label = current ? current.label : resume.label;
  const description = current ? current.description ?? "" : resume.description;
  const downloadName = current ? current.downloadName : resume.downloadName;
  const awaiting = Boolean(current && !current.file);
  const master = variants.find((v) => variantInfo[v.id]?.src);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = variants.length;
    const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % n : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setSelected(variants[next].id);
    radios.current[next]?.focus();
  };
  const onDownload = () => {
    try {
      track("Resume download", { version: current?.id ?? "master" });
    } catch {
      /* analytics must never affect the download */
    }
  };

  const btn =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-chip px-5 text-sm transition-[background-color,border-color,color] duration-200 ease-premium";
  return (
    <div>
      {variants.length > 1 && (
        <div className="mb-8">
          <p id="resume-choose" className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-fg-muted">
            {resume.labels.choose ?? "Choose a version"}
          </p>
          <div role="radiogroup" aria-labelledby="resume-choose" className="flex flex-wrap gap-2">
            {variants.map((v, i) => {
              const on = v.id === selected;
              const ready = Boolean(variantInfo[v.id]?.src);
              return (
                <button
                  key={v.id}
                  ref={(el) => { radios.current[i] = el; }}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setSelected(v.id)}
                  onKeyDown={(e) => onKey(e, i)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-chip border px-4 text-sm transition-[background-color,border-color,color] duration-200 ease-premium ${
                    on ? "border-lavender bg-violet/20 text-fg" : "border-line-strong text-fg-muted hover:border-lavender hover:text-fg"
                  }`}
                >
                  {v.label}
                  {!ready && <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-fg-subtle">soon</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,38rem)_minmax(0,22rem)] lg:items-start lg:gap-12">
        <div ref={panel} className="overflow-hidden rounded-panel border border-line bg-surface/55 shadow-card backdrop-blur-[3px]">
          {info.src ? (
            // The panel grows with the rendered page, so the whole page shows with no inner scroll.
            // The PDF engine and file load only when the visitor approaches this section.
            near ? <PdfViewer key={info.src} src={info.src} /> : <ViewerStatus kind="loading">Loading document…</ViewerStatus>
          ) : (
            <div className="px-6 py-16">
              <ViewerStatus kind={awaiting ? "info" : "error"}>
                {awaiting && resume.labels.awaiting ? fill(resume.labels.awaiting, { role: label }) : resume.labels.missing}
              </ViewerStatus>
              {awaiting && master && (
                <div className="mt-6 flex justify-center">
                  <button type="button" onClick={() => setSelected(master.id)} className={`${btn} border border-line-strong text-fg hover:border-lavender`}>
                    {resume.labels.useMaster ?? master.label}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-28" aria-live="polite">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-lavender">{current ? `${label} Résumé` : label}</p>
          {description && <p className="mt-3 leading-relaxed text-fg-muted">{description}</p>}
          {info.size && <p className="tabular mt-2 font-mono text-xs text-fg-subtle">{fill(resume.labels.meta, { size: info.size })}</p>}
          {info.src && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col">
              <a href={info.src} download={downloadName} onClick={onDownload} className={`${btn} bg-violet text-on-violet hover:bg-lavender`}>
                {current ? `Download ${label} Résumé` : resume.labels.download} <span aria-hidden="true">↓</span>
              </a>
              <a href={info.src} target="_blank" rel="noopener noreferrer" className={`${btn} border border-line-strong text-fg hover:border-lavender`}>
                {resume.labels.open} <span aria-hidden="true">↗</span>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
