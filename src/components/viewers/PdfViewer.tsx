"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { ViewerStatus } from "./ViewerModal";
import { fill } from "@/lib/content/selectors";
import { useUi } from "@/lib/content/client";

const ZOOMS = [1, 1.25, 1.5, 2, 3];

/**
 * Real PDF page rendering with PDF.js. Only the current page is rendered (on
 * demand), sized to the viewer width × zoom at device resolution, so pages
 * keep their exact proportions. Also used for slide decks converted to PDF.
 */
export function PdfViewer({ src, unit: unitKey = "page" }: { src: string; unit?: "page" | "slide" }) {
  const ui = useUi();
  const unit = ui.viewer[unitKey];
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(0); // index into ZOOMS
  const [rendering, setRendering] = useState(true);
  const [width, setWidth] = useState(0);

  // Load the document once.
  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
        // PDF.js v6 never evaluates code from the file; content is rendered only.
        task = pdfjs.getDocument({ url: src });
        const loaded = await task.promise;
        if (!cancelled) setDoc(loaded);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error");
      }
    })();
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [src]);

  // Track available width (fit-to-width base size).
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Render the current page.
  useEffect(() => {
    if (!doc || !canvas.current || width === 0) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    (async () => {
      setRendering(true);
      const pdfPage = await doc.getPage(page);
      if (cancelled) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const cssWidth = Math.min(width, 1100) * ZOOMS[zoom];
      const scale = cssWidth / base.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = pdfPage.getViewport({ scale: scale * dpr });
      const c = canvas.current;
      if (!c) return;
      c.width = Math.floor(viewport.width);
      c.height = Math.floor(viewport.height);
      c.style.width = `${Math.floor(cssWidth)}px`;
      c.style.height = `${Math.floor(cssWidth * (base.height / base.width))}px`;
      task = pdfPage.render({ canvas: c, viewport });
      try {
        await task.promise;
        if (!cancelled) setRendering(false);
      } catch {
        /* superseded by a newer render */
      }
    })().catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Unknown error"));
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page, zoom, width]);

  const total = doc?.numPages ?? 0;
  const go = useCallback((delta: number) => setPage((p) => Math.min(Math.max(1, p + delta), total || 1)), [total]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
    if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
  };

  if (error) return <ViewerStatus kind="error">{fill(ui.viewer.pdfError, { error })}</ViewerStatus>;

  const btn =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-chip border border-line px-2.5 text-xs text-fg transition-colors hover:border-lavender disabled:cursor-not-allowed disabled:opacity-35";

  return (
    <div className="flex h-full flex-col" onKeyDown={onKeyDown}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2 sm:px-5">
        <div className="flex items-center gap-2" role="group" aria-label={`${unit} navigation`}>
          {total > 1 && (
            <>
              <button type="button" className={btn} onClick={() => go(-1)} disabled={page <= 1} aria-label={`Previous ${unit.toLowerCase()}`}>
                ←
              </button>
              <button type="button" className={btn} onClick={() => go(1)} disabled={page >= total} aria-label={`Next ${unit.toLowerCase()}`}>
                →
              </button>
            </>
          )}
          <p className="tabular font-mono text-xs text-fg-muted" aria-live="polite">
            {total ? `${unit} ${page} ${ui.viewer.of} ${total}` : ui.viewer.loadingPdf}
          </p>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Zoom">
          <button type="button" className={btn} onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} aria-label="Zoom out">
            −
          </button>
          <span className="tabular w-12 text-center font-mono text-xs text-fg-muted">{Math.round(ZOOMS[zoom] * 100)}%</span>
          <button type="button" className={btn} onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoom === ZOOMS.length - 1} aria-label="Zoom in">
            +
          </button>
        </div>
      </div>
      <div ref={frame} className="relative min-h-0 flex-1 overflow-auto bg-canvas p-3 sm:p-5" tabIndex={0} role="region" aria-label={`${unit} ${page} ${ui.viewer.of} ${total || "…"}`}>
        {!doc && <ViewerStatus kind="loading">{ui.viewer.loadingPdf}</ViewerStatus>}
        <canvas
          ref={canvas}
          className={`mx-auto block bg-white shadow-raised transition-opacity duration-200 ${doc ? "" : "hidden"} ${rendering ? "opacity-60" : "opacity-100"}`}
        />
      </div>
    </div>
  );
}
