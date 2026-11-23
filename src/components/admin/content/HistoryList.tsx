"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { restoreContentVersion, type ContentActionResult } from "@/lib/admin/content-actions";
import { card, secondaryBtn } from "../styles";

export interface HistoryEntry {
  id: string;
  version: number;
  operation: string;
  source: string;
  note: string | null;
  changedAt: string;
  hash: string;
  changes: string[];
  json: string;
}

const SOURCE: Record<string, string> = { migration: "Imported from site files", publish: "Published", rollback: "Restored", script: "Server script" };
const when = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function HistoryList({ blockKey, liveVersion, entries }: { blockKey: string; liveVersion: number | null; entries: HistoryEntry[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ContentActionResult | null>(null);
  const restore = (v: number) => {
    if (liveVersion === null || !confirm(`Restore version ${v}? It will be published again as a new version and visitors will see it immediately.`)) return;
    start(async () => {
      try {
        const r = await restoreContentVersion(blockKey, v, liveVersion);
        setResult(r);
        if (r.ok) router.refresh();
      } catch {
        setResult({ ok: false, error: "Not authorised, or the connection failed." });
      }
    });
  };
  if (!entries.length) return <p className={`${card} p-6 text-sm text-fg-muted`}>No history yet.</p>;
  return (
    <div className="space-y-4">
      {result && <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-positive" : "text-negative"}`}>{result.ok ? result.message : result.error}</p>}
      <ol className={`${card} divide-y divide-line`}>
        {entries.map((e) => (
          <li key={e.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-mono text-sm text-fg">v{e.version}</span>
              {e.version === liveVersion && e.operation !== "DELETE" && <span className="rounded-chip border border-positive/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-positive">Live</span>}
              <span className="text-sm text-fg-muted">{e.operation === "DELETE" ? "Removed" : SOURCE[e.source] ?? e.source}</span>
              <span className="text-xs text-fg-subtle">{when(e.changedAt)}</span>
              <span className="font-mono text-[10px] text-fg-subtle" title="Fingerprint of this version">#{e.hash}</span>
              <span className="flex-1" />
              {e.operation !== "DELETE" && e.version !== liveVersion && (
                <button type="button" className={secondaryBtn} disabled={pending} onClick={() => restore(e.version)}>Restore</button>
              )}
            </div>
            {e.note && <p className="mt-1 text-sm text-fg">“{e.note}”</p>}
            <p className="mt-1 text-xs text-fg-subtle">Changed: {e.changes.length ? e.changes.slice(0, 12).join(", ") + (e.changes.length > 12 ? " …" : "") : "nothing (same content)"}</p>
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-fg-muted hover:text-fg">Show content</summary>
              <pre className="mt-2 max-h-80 overflow-auto rounded-control bg-canvas/60 p-3 text-[11px] leading-relaxed text-fg-muted">{e.json}</pre>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}
