"use client";

import { useEffect, useState } from "react";
import { ViewerStatus } from "./ViewerModal";
import { fill } from "@/lib/content/selectors";
import { useUi } from "@/lib/content/client";

/**
 * Word (.docx) preview: converts the real document to semantic HTML with
 * mammoth (headings, paragraphs, lists, tables, images). Layout is simplified;
 * exact Word page layout is not reproduced.
 */
export function DocxViewer({ src }: { src: string }) {
  const ui = useUi();
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ default: mammoth }, res] = await Promise.all([import("mammoth"), fetch(src)]);
        if (!res.ok) throw new Error(`file not found (HTTP ${res.status})`);
        const result = await mammoth.convertToHtml({ arrayBuffer: await res.arrayBuffer() });
        // Links from the document are data: open safely in a new tab, never as scripts.
        const doc = new DOMParser().parseFromString(result.value, "text/html");
        doc.querySelectorAll("script, iframe, object, embed").forEach((n) => n.remove());
        doc.querySelectorAll("a[href]").forEach((a) => {
          const href = a.getAttribute("href") ?? "";
          if (!/^https?:|^mailto:|^#/i.test(href)) a.removeAttribute("href");
          a.setAttribute("target", "_blank");
          a.setAttribute("rel", "noopener noreferrer");
        });
        if (!cancelled) setHtml(doc.body.innerHTML);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (error) return <ViewerStatus kind="error">{fill(ui.viewer.documentError, { error })}</ViewerStatus>;
  if (html === null) return <ViewerStatus kind="loading">{ui.viewer.loadingDocument}</ViewerStatus>;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-auto bg-canvas p-3 sm:p-6" tabIndex={0}>
        <article
          className="docx-preview mx-auto max-w-3xl rounded-card bg-[#f6f5fb] px-6 py-8 text-[15px] leading-relaxed text-[#1b1d29] sm:px-12 sm:py-12"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
      <p className="shrink-0 border-t border-line px-4 py-2 text-[11px] text-fg-subtle">
        {ui.viewer.documentNote}
      </p>
    </div>
  );
}
