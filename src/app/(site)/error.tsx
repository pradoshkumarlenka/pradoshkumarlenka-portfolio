"use client";

import Link from "next/link";

/**
 * Shown if a public page fails unexpectedly while rendering. Plain words only:
 * no stack traces or technical details reach visitors (Next.js keeps those in
 * the server logs, identified by the digest).
 */
export default function SiteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="py-32">
      <div className="mx-auto max-w-[var(--container-max)] px-[var(--gutter)]">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-lavender">Something went wrong</p>
        <h1 className="mt-4 font-display text-5xl text-fg">This page could not be shown right now.</h1>
        <p className="mt-4 max-w-xl text-fg-muted">Please try again in a moment. The rest of the site is still available.</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="inline-flex min-h-11 items-center rounded-chip bg-violet px-5 text-sm text-on-violet hover:bg-lavender">
            Try again
          </button>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-chip border border-line-strong px-5 text-sm text-fg hover:border-lavender">
            Go to the home page
          </Link>
        </div>
      </div>
    </section>
  );
}
