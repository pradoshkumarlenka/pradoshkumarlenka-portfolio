"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/*
 * Admin requests that used to be plain form posts / download links. Plain navigations
 * cannot carry the tab proof, so these use fetch (which the admin tab signs, see
 * tab-session.ts) and then continue in THIS tab.
 */

/** Turns on Draft Mode, then opens the preview page in this tab. */
export function StartPreviewButton({ path, label, className, disabled, title }: { path: string; label: string; className?: string; disabled?: boolean; title?: string }) {
  const router = useRouter();
  const here = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("path", path);
      const r = await fetch("/admin/preview/enable", { method: "POST", body, redirect: "manual", credentials: "same-origin" });
      if (r.type !== "opaqueredirect" && !r.ok) throw new Error(String(r.status));
      const target = `/admin/preview?path=${encodeURIComponent(path)}`;
      if (here === "/admin/preview") router.refresh();
      else router.push(target);
    } catch {
      setError("Preview could not be started. Reload and try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button type="button" className={className} disabled={disabled || busy} title={title} onClick={start}>{busy ? "Starting…" : label}</button>
      {error && <span role="alert" className="text-xs text-negative">{error}</span>}
    </>
  );
}

/** Downloads the JSON backup (published content + drafts). */
export function ExportButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/admin/content/export", { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const name = /filename="([^"]+)"/.exec(r.headers.get("content-disposition") ?? "")?.[1] ?? "site-content.json";
      const url = URL.createObjectURL(await r.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError("The backup could not be downloaded. Reload and try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button type="button" className={className} disabled={busy} onClick={run}>{busy ? "Preparing…" : "Download all content (JSON backup) ↓"}</button>
      {error && <span role="alert" className="text-xs text-negative">{error}</span>}
    </>
  );
}
