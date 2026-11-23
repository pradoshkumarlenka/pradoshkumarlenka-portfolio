"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { ProjectResource, ResourceFileType } from "@/content/types";
import { canPreview, fileNameOf } from "@/components/viewers/DocumentViewer";
import { useUi } from "@/lib/content/client";

const DocumentViewer = dynamic(() => import("@/components/viewers/DocumentViewer"), { ssr: false });

const TYPE_LABEL: Record<ResourceFileType, string> = {
  ppt: "PPT",
  pptx: "PPTX",
  xls: "XLS",
  xlsx: "XLSX",
  pdf: "PDF",
  doc: "DOC",
  docx: "DOCX",
  link: "Link",
};

/** File-specific open label: report, presentation or financial model. */
function openLabel(type: ResourceFileType, a: { report: string; presentation: string; model: string }) {
  if (type === "ppt" || type === "pptx") return a.presentation;
  if (type === "xls" || type === "xlsx") return a.model;
  return a.report;
}

const action =
  "inline-flex items-center gap-1.5 rounded-chip border px-3 py-1.5 text-xs transition-colors duration-200 ease-premium";

/** One compact resource row: name + type, Preview (in-site viewer) and Download original. */
export function ResourceRow({ resource }: { resource: ProjectResource }) {
  const ui = useUi();
  // The button that opened the viewer (focus returns to it on close); null = closed.
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const external = resource.fileType === "link";
  const previewable = !external && canPreview(resource);

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 shrink-0 rounded-[6px] border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-muted">
          {TYPE_LABEL[resource.fileType]}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-fg">{resource.title}</p>
          {!external && <p className="truncate font-mono text-[11px] text-fg-subtle">{resource.fileName ?? fileNameOf(resource.href)}</p>}
          {resource.description && <p className="mt-1 text-xs text-fg-muted">{resource.description}</p>}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {external ? (
          <a href={resource.href} target="_blank" rel="noopener noreferrer" className={`${action} border-line-strong text-fg hover:border-lavender`}>
            {resource.label ?? ui.resources.openLink} <span aria-hidden="true">↗</span>
            <span className="sr-only"> {ui.resources.opensInNewTab}</span>
          </a>
        ) : (
          <>
            {previewable && (
              <button
                type="button"
                onClick={(e) => setOpener(e.currentTarget)}
                aria-haspopup="dialog"
                className={`${action} border-violet/50 bg-violet/10 text-lavender hover:border-lavender hover:text-fg`}
              >
                {resource.label ?? openLabel(resource.fileType, ui.resources.actions)}
              </button>
            )}
            {previewable ? (
              <a href={resource.downloadHref ?? resource.href} download className={`${action} border-line text-fg-muted hover:border-lavender hover:text-fg`}>
                {ui.resources.downloadOriginal} <span aria-hidden="true">↓</span>
              </a>
            ) : (
              // No in-site preview for this format: the file-specific label downloads the original.
              <a href={resource.downloadHref ?? resource.href} download className={`${action} border-violet/50 bg-violet/10 text-lavender hover:border-lavender hover:text-fg`}>
                {resource.label ?? openLabel(resource.fileType, ui.resources.actions)} <span aria-hidden="true">↓</span>
              </a>
            )}
          </>
        )}
      </div>
      {opener && <DocumentViewer resource={resource} onClose={() => setOpener(null)} returnFocus={opener} />}
    </li>
  );
}
