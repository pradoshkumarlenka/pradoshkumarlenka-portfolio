"use client";

import type { ProjectResource } from "@/content/types";
import { ViewerModal, ViewerStatus } from "./ViewerModal";
import { PdfViewer } from "./PdfViewer";
import { SheetViewer } from "./SheetViewer";
import { DocxViewer } from "./DocxViewer";
import { useUi } from "@/lib/content/client";

/** File name from a /public path, decoded for display. */
export const fileNameOf = (href: string) => decodeURIComponent(href.split("/").pop() ?? href);

/** True when the resource can be shown inside the site (vs. download only). */
export function canPreview(r: ProjectResource) {
  switch (r.fileType) {
    case "pdf":
    case "xls":
    case "xlsx":
    case "docx":
      return true;
    case "ppt":
    case "pptx":
    case "doc":
      return Boolean(r.preview);
    default:
      return false;
  }
}

/**
 * One viewer for every supported format, inside the shared modal. Opened from
 * a resource row; lazy-loaded so viewer code never weighs on the page.
 */
export default function DocumentViewer({
  resource,
  onClose,
  returnFocus,
}: {
  resource: ProjectResource;
  onClose: () => void;
  returnFocus: HTMLElement | null;
}) {
  const ui = useUi();
  const { fileType, href, preview, title } = resource;
  let body;
  if (fileType === "pdf") body = <PdfViewer src={href} />;
  else if (fileType === "xls" || fileType === "xlsx") body = <SheetViewer src={href} />;
  else if (fileType === "docx") body = <DocxViewer src={href} />;
  else if ((fileType === "ppt" || fileType === "pptx" || fileType === "doc") && preview)
    body = <PdfViewer src={preview} unit={fileType === "doc" ? "page" : "slide"} />;
  else
    body = (
      <ViewerStatus kind="info">
        {ui.viewer.noPreview}
      </ViewerStatus>
    );

  return (
    <ViewerModal title={title} filename={resource.fileName ?? fileNameOf(href)} downloadHref={resource.downloadHref ?? href} onClose={onClose} returnFocus={returnFocus}>
      {body}
    </ViewerModal>
  );
}
