"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

const PRIVATE = /^\/(admin|auth|media)(\/|$)/;

/**
 * Privacy-friendly page views (Vercel Web Analytics: no cookies, no cross-site
 * tracking, aggregate only). Rendered in the public site frame only, never in the
 * admin or during a draft preview. Private routes are dropped and query strings /
 * fragments are removed before anything is sent. It only records once Web
 * Analytics is enabled for the project in Vercel; locally it does nothing.
 * If the script fails to load, nothing else on the page depends on it.
 */
function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const url = new URL(event.url);
    if (PRIVATE.test(url.pathname)) return null;
    url.search = "";
    url.hash = "";
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}

export function SiteAnalytics() {
  return <Analytics beforeSend={beforeSend} debug={false} />;
}
