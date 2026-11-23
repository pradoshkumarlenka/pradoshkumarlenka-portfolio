"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getLenis } from "@/lib/lenis";
import { useUi } from "@/lib/content/client";

const CLOSE_MS = 180;
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

interface ViewerModalProps {
  title: string;
  /** Original filename shown under the title. */
  filename?: string;
  /** Original file for the separate "Download original" action. */
  downloadHref?: string;
  downloadLabel?: string;
  onClose: () => void;
  /** Element that opened the viewer; focus returns to it on close. */
  returnFocus?: HTMLElement | null;
  /** Extra controls placed in the header (e.g. page navigation). */
  toolbar?: ReactNode;
  children: ReactNode;
}

/**
 * Shared document-viewer dialog: portal, focus trap, Escape to close, focus
 * restore, background scroll lock (incl. Lenis), restrained fade/scale.
 */
export function ViewerModal({
  title,
  filename,
  downloadHref,
  downloadLabel: downloadLabelProp,
  onClose,
  returnFocus,
  toolbar,
  children,
}: ViewerModalProps) {
  const ui = useUi();
  const downloadLabel = downloadLabelProp ?? ui.resources.downloadOriginal;
  const dialog = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const closing = useRef(false);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setShown(false);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(onClose, reduced ? 0 : CLOSE_MS);
  }, [onClose]);

  // Open: lock scroll, focus inside, animate in. Close: restore everything.
  useEffect(() => {
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    getLenis()?.stop();
    const raf = requestAnimationFrame(() => {
      setShown(true);
      dialog.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      html.style.overflow = previousOverflow;
      getLenis()?.start();
      returnFocus?.focus();
    };
  }, [returnFocus]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab" || !dialog.current) return;
    const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center p-2 transition-opacity duration-200 ease-premium sm:p-6 ${
        shown ? "opacity-100" : "opacity-0"
      }`}
      onKeyDown={onKeyDown}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-canvas/80 backdrop-blur-sm" onClick={close} />
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="viewer-title"
        data-lenis-prevent
        className={`relative flex h-full max-h-[min(92dvh,60rem)] w-full max-w-6xl flex-col overflow-hidden rounded-panel border border-line-strong bg-canvas-2 shadow-raised transition-transform duration-200 ease-premium ${
          shown ? "scale-100" : "scale-[0.98]"
        }`}
      >
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id="viewer-title" className="truncate text-sm font-medium text-fg sm:text-base">
              {title}
            </h2>
            {filename && <p className="truncate font-mono text-[11px] text-fg-subtle">{filename}</p>}
          </div>
          {toolbar}
          <div className="flex items-center gap-2">
            {downloadHref && (
              <a
                href={downloadHref}
                download
                className="rounded-chip border border-line-strong px-3 py-1.5 text-xs text-fg transition-colors hover:border-lavender"
              >
                {downloadLabel} <span aria-hidden="true">↓</span>
              </a>
            )}
            <button
              type="button"
              data-autofocus
              onClick={close}
              aria-label={ui.viewer.close}
              className="inline-flex h-8 w-8 items-center justify-center rounded-chip border border-line text-fg-muted transition-colors hover:border-lavender hover:text-fg"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </header>
        <div className="relative min-h-0 flex-1">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Centered loading / error message used by every viewer. */
export function ViewerStatus({ kind, children }: { kind: "loading" | "error" | "info"; children: ReactNode }) {
  return (
    <div role={kind === "error" ? "alert" : "status"} className="flex h-full min-h-48 items-center justify-center p-8 text-center">
      <div className="max-w-md">
        {kind === "loading" && (
          <span aria-hidden="true" className="mx-auto mb-4 block h-6 w-6 animate-spin rounded-full border-2 border-line border-t-lavender" />
        )}
        <div className={`text-sm ${kind === "error" ? "text-fg" : "text-fg-muted"}`}>{children}</div>
      </div>
    </div>
  );
}
