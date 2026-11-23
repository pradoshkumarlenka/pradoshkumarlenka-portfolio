"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * True once the element comes within `margin` of the viewport (and stays true).
 * Used to start heavy, below-the-fold work (e.g. rendering a PDF) only when the
 * visitor is about to reach it, so it never competes with the first view.
 */
export function useNearViewport(ref: RefObject<Element | null>, margin = "1000px 0px") {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setNear(true);
        io.disconnect();
      }
    }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin, near]);
  return near;
}
