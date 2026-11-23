"use client";

import { scrollToTarget } from "@/lib/lenis";

export function BackToTop({ label }: { label: string }) {
  return (
    <a
      href="#top"
      onClick={(e) => {
        e.preventDefault();
        scrollToTarget(0);
      }}
      className="tap-target text-fg-muted transition-colors hover:text-fg"
    >
      {label} <span aria-hidden="true">↑</span>
    </a>
  );
}
