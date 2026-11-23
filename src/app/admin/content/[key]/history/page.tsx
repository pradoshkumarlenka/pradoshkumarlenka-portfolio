import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/auth";
import { CONTENT_TITLES, isContentKey } from "@/lib/admin/content-data";
import { createClient } from "@/lib/supabase/server";
import { HistoryList, type HistoryEntry } from "@/components/admin/content/HistoryList";

export const dynamic = "force-dynamic";

/** Changed fields between two versions of a block (paths like "links › 1 › href"). */
function changedPaths(a: unknown, b: unknown, path: string[] = [], out: string[] = []): string[] {
  if (out.length > 40) return out;
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  const objA = a && typeof a === "object", objB = b && typeof b === "object";
  if (!objA || !objB || Array.isArray(a) !== Array.isArray(b)) {
    out.push(path.join(" › ") || "whole block");
    return out;
  }
  const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
  for (const k of keys) changedPaths((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], [...path, /^\d+$/.test(k) ? `#${Number(k) + 1}` : k], out);
  return out;
}

export default async function HistoryPage({ params }: { params: Promise<{ key: string }> }) {
  await requireAdminPage();
  const { key } = await params;
  if (!isContentKey(key)) notFound();
  const supabase = await createClient();
  const [{ data: rows, error }, { data: live }] = await Promise.all([
    supabase.from("content_versions").select("id, version, operation, source, note, changed_at, data, content_hash").eq("key", key).order("id", { ascending: false }).limit(100),
    supabase.from("content_published").select("version").eq("key", key).maybeSingle(),
  ]);
  const list = rows ?? [];
  const entries: HistoryEntry[] = list.map((r, i) => {
    const previous = list.slice(i + 1).find((x) => x.operation !== "DELETE");
    return {
      id: String(r.id),
      version: r.version,
      operation: r.operation,
      source: r.source,
      note: r.note,
      changedAt: r.changed_at,
      hash: (r.content_hash ?? "").slice(0, 12),
      changes: previous ? changedPaths(previous.data, r.data) : ["first version"],
      json: JSON.stringify(r.data, null, 2),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/content/${key}`} className="text-sm text-fg-muted hover:text-fg">← Back to editor</Link>
        <h1 className="mt-3 font-display text-4xl">History · {CONTENT_TITLES[key]}</h1>
        <p className="mt-2 text-sm text-fg-muted">Every published version, newest first. Restoring an old version publishes it again as a new version — nothing is ever deleted from this list.</p>
      </div>
      {error ? <p role="alert" className="text-sm text-negative">The history could not be loaded.</p> : <HistoryList blockKey={key} liveVersion={live?.version ?? null} entries={entries} />}
    </div>
  );
}
