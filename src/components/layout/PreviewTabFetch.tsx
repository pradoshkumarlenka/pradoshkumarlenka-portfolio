"use client";

import { useEffect } from "react";
import { installTabFetch } from "@/components/admin/tab-session";

// Inside the admin's preview iframe (same tab, so same sessionStorage): in-frame client
// navigations carry the tab proof, so they keep showing drafts. Rendered only in a draft preview.
installTabFetch();

export function PreviewTabFetch() {
  // The ?_pv= ticket is only needed for the frame's first document load. Remove it from the
  // address once loaded, so "Open frame in new tab" or a copied frame URL cannot carry the
  // ticket into another tab (the preview's ↻ Reload re-creates the frame from its src).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("_pv")) return;
    url.searchParams.delete("_pv");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  return null;
}
