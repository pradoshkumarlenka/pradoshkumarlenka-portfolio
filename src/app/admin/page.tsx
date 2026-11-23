import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { ItemRow } from "@/lib/admin/types";
import { StateBadge } from "@/components/admin/StateBadge";
import { MoveButtons } from "@/components/admin/ItemControls";
import { CleanupButton } from "@/components/admin/CleanupButton";
import { card, primaryBtn } from "@/components/admin/styles";

export const dynamic = "force-dynamic";

/** Dashboard home: every item (draft, published, archived) in display order. */
export default async function AdminHome({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const session = await requireAdminPage();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .select("id, slug, title, category, state, work_status, sort_order, updated_at, attachments(count)")
    .order("sort_order")
    .order("created_at");
  const items = (data ?? []) as (Pick<ItemRow, "id" | "slug" | "title" | "category" | "state" | "work_status" | "updated_at"> & { attachments: { count: number }[] })[];
  const { deleted } = await searchParams;
  const counts = { published: 0, draft: 0, archived: 0 };
  items.forEach((i) => counts[i.state]++);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-lavender">Signed in as {session.email}</p>
          <h1 className="mt-2 font-display text-4xl">Research &amp; Selected Work</h1>
          <p className="mt-2 text-sm text-fg-muted">
            {items.length} items · {counts.published} published · {counts.draft} draft · {counts.archived} archived
          </p>
        </div>
        <Link href="/admin/items/new" className={primaryBtn}>+ New item</Link>
      </div>

      {deleted && <p role="status" className="mt-6 text-sm text-positive">Item deleted.</p>}
      {error && <p role="alert" className="mt-6 text-sm text-negative">The items could not be loaded. Please refresh.</p>}

      {!error && items.length === 0 ? (
        <div className={`${card} mt-8 p-10 text-center`}>
          <p className="text-fg">No items yet.</p>
          <p className="mt-1 text-sm text-fg-muted">Create your first item; it stays a private draft until you publish it.</p>
        </div>
      ) : (
        <ol className={`${card} mt-8 divide-y divide-line`}>
          {items.map((item, i) => (
            <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap">
              <span className="tabular w-6 shrink-0 font-mono text-xs text-fg-subtle">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0 basis-[calc(100%-2.5rem)] sm:basis-auto sm:flex-1">
                <Link href={`/admin/items/${item.id}`} className="block text-fg hover:text-lavender sm:truncate">{item.title}</Link>
                <p className="truncate text-xs text-fg-subtle">
                  {item.category || "No category"} · {item.attachments?.[0]?.count ?? 0} files · updated {new Date(item.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <StateBadge state={item.state} />
              <MoveButtons id={item.id} title={item.title} first={i === 0} last={i === items.length - 1} />
              <span className="flex gap-3 text-sm">
                <Link href={`/admin/items/${item.id}`} className="text-fg-muted hover:text-fg">Edit</Link>
                <Link href={`/admin/items/${item.id}/preview`} className="text-fg-muted hover:text-fg">Preview</Link>
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-10 border-t border-line pt-6">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-muted">Storage</h2>
        <p className="mb-3 mt-1 text-xs text-fg-subtle">Removes files no item uses any more (e.g. an upload interrupted before it finished). Files in use are never touched.</p>
        <CleanupButton />
      </div>
    </div>
  );
}
