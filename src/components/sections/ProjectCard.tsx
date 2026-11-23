"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { ProjectFile, ResourceFileType } from "@/content/types";
import { useUi } from "@/lib/content/client";
import { ProjectImage } from "@/components/ui/ProjectImage";

const DocumentViewer = dynamic(() => import("@/components/viewers/DocumentViewer"), { ssr: false });

const FILE_TYPES: Record<string, ResourceFileType> = {
  pdf: "pdf",
  xls: "xls",
  xlsx: "xlsx",
  doc: "doc",
  docx: "docx",
  ppt: "ppt",
  pptx: "pptx",
};

const panel = "group flex h-full w-full rounded-card border border-line bg-surface/55 text-left shadow-card backdrop-blur-[3px]";
const interactive =
  "transition-[transform,border-color,background-color] duration-300 ease-premium hover:-translate-y-0.5 hover:border-violet/55 hover:bg-surface/80 focus-visible:-translate-y-0.5 focus-visible:border-violet/55";

/**
 * One project card. Where it leads is set per project in
 * content/projects/<name>.json → "link":
 *   case-study → the case-study page · link → a website (new tab)
 *   file → the file in the in-site viewer · none → not clickable
 */
export function ProjectCard({ project }: { project: ProjectFile }) {
  const ui = useUi();
  const { link } = project;
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  // With a picture: picture left + text right (picture on top on phones). Without: text only.
  const surface = `${panel} ${project.image ? "flex-col gap-5 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5" : "flex-col p-6"}`;

  const text = (
    <>
      <div className="flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="text-lavender">{project.category}</span>
        <span className="flex items-center gap-2">
          {(project.statusLabel || project.status) && (
            <span className="rounded-chip border border-line px-2 py-0.5 text-[10px] tracking-[0.12em] text-fg-muted">{project.statusLabel || project.status}</span>
          )}
          <span className="tabular text-fg-subtle">{project.date}</span>
        </span>
      </div>
      <h4 className="mt-4 font-display text-[1.45rem] leading-tight text-fg">{project.title}</h4>
      <p className="mt-3 text-sm leading-relaxed text-fg-muted">{project.summary}</p>
      {project.labels?.map((label) => (
        <span
          key={label}
          className="mt-4 inline-flex w-fit rounded-chip border border-violet/40 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-lavender"
        >
          {label}
        </span>
      ))}
      {link.type !== "none" && link.label && <LinkLine external={link.type === "link"}>{link.label}</LinkLine>}
    </>
  );
  const body = project.image ? (
    <>
      <ProjectImage
        src={project.image}
        alt={project.imageAlt ?? ""}
        position={project.imagePosition}
        sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 92vw"
        className="shrink-0 rounded-[12px] border border-line sm:w-1/2"
      />
      <div className="flex min-w-0 flex-1 flex-col self-stretch">{text}</div>
    </>
  ) : (
    text
  );

  if (link.type === "page" && link.href) {
    return (
      <Link href={link.href} className={`${surface} ${interactive}`}>
        {body}
      </Link>
    );
  }
  if (link.type === "case-study" && project.caseStudy) {
    return (
      <Link href={`/projects/${project.slug}`} className={`${surface} ${interactive}`}>
        {body}
      </Link>
    );
  }
  if (link.type === "link" && link.href) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={`${surface} ${interactive}`}>
        {body}
        <span className="sr-only"> {ui.resources.opensInNewTab}</span>
      </a>
    );
  }
  if (link.type === "file" && link.href) {
    const ext = link.href.split(".").pop()?.toLowerCase() ?? "";
    const fileType = FILE_TYPES[ext];
    if (!fileType) {
      return (
        <a href={link.href} target="_blank" rel="noopener noreferrer" className={`${surface} ${interactive}`}>
          {body}
        </a>
      );
    }
    return (
      <>
        <button type="button" aria-haspopup="dialog" onClick={(e) => setOpener(e.currentTarget)} className={`${surface} ${interactive}`}>
          {body}
        </button>
        {opener && (
          <DocumentViewer
            resource={{ title: project.title, fileType, href: link.href, action: "open" }}
            onClose={() => setOpener(null)}
            returnFocus={opener}
          />
        )}
      </>
    );
  }
  return <article className={surface}>{body}</article>;
}

/** Card action: "→" for pages on this site, "↗" for other websites. */
function LinkLine({ children, external }: { children: ReactNode; external: boolean }) {
  return (
    <span className="mt-auto flex items-center gap-2 pt-6 text-sm text-fg">
      {children}
      <span
        aria-hidden="true"
        className={`inline-block transition-transform duration-300 ease-premium group-hover:translate-x-1 group-focus-visible:translate-x-1 ${
          external ? "group-hover:-translate-y-0.5 group-focus-visible:-translate-y-0.5" : ""
        }`}
      >
        {external ? "↗" : "→"}
      </span>
    </span>
  );
}
