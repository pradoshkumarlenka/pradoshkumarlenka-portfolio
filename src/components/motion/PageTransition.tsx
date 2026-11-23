"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * PAGE TRANSITION — a line wipe between public pages (home ⇄ case studies).
 *
 * It never delays navigation: it plays AFTER the new page has rendered, as a
 * thin accent line sweeping across with a fading veil (~550 ms) over content
 * that is already there and fully interactive (pointer-events: none).
 * Back/forward and scroll restoration are untouched. Focus moves to the new
 * page's main region (without scrolling) so keyboard and screen-reader users
 * start at the new content; Next.js announces the new page title.
 * Off with reduced motion; never runs on the first page load or in the admin.
 */
export function PageTransition() {
  const pathname = usePathname();
  const first = useRef(true);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const main = document.getElementById("main");
    if (main && (document.activeElement === document.body || !main.contains(document.activeElement))) {
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // A new key restarts the CSS animation on every navigation.
    const id = window.requestAnimationFrame(() => setRun((n) => n + 1));
    return () => window.cancelAnimationFrame(id);
  }, [pathname]);

  if (!run) return null;
  return (
    <div key={run} className="page-wipe" aria-hidden="true">
      <span className="page-wipe__veil" />
      <span className="page-wipe__line" />
    </div>
  );
}
