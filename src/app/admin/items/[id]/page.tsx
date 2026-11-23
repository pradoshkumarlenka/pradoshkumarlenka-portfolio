import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/auth";
import { getItemForAdmin } from "@/lib/admin/data";
import { updateItem } from "@/lib/admin/item-actions";
import { UUID } from "@/lib/admin/validate";
import { ItemForm } from "@/components/admin/ItemForm";
import { DeleteItem, StateButtons } from "@/components/admin/ItemControls";
import { AttachmentList, CoverRemove } from "@/components/admin/AttachmentList";
import { FileUploader } from "@/components/admin/FileUploader";
import { StateBadge } from "@/components/admin/StateBadge";
import { card } from "@/components/admin/styles";

export const dynamic = "force-dynamic";

export default async function EditItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await getItemForAdmin(id);
  if (!data) notFound();
  const { item, attachments, coverUrl, urls } = data;
  const { created } = await searchParams;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin" className="text-sm text-fg-muted hover:text-fg">← All items</Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl">{item.title}</h1>
          <StateBadge state={item.state} />
        </div>
        <p className="mt-2 text-sm text-fg-muted">
          {item.state === "published" && item.published_at ? `Published ${new Date(item.published_at).toLocaleString("en-IN")} · ` : ""}
          Last saved {new Date(item.updated_at).toLocaleString("en-IN")} ·{" "}
          <Link href={`/admin/items/${item.id}/preview`} className="text-lavender hover:text-fg">Preview page ↗</Link>
        </p>
        {created && <p role="status" className="mt-3 text-sm text-positive">Draft created. Add a cover and files, then publish.</p>}
      </div>

      <section className={`${card} p-6`} aria-labelledby="h-status">
        <h2 id="h-status" className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-muted">Publication</h2>
        <StateButtons id={item.id} state={item.state} />
        <p className="mt-3 text-xs text-fg-subtle">Only published items are visible to visitors. Drafts and archived items stay private.</p>
      </section>

      <section className={`${card} p-6`} aria-labelledby="h-details">
        <h2 id="h-details" className="mb-5 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-muted">Details</h2>
        <ItemForm action={updateItem.bind(null, item.id)} item={item} submitLabel="Save changes" />
      </section>

      <section className={`${card} p-6`} aria-labelledby="h-cover">
        <h2 id="h-cover" className="mb-5 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-muted">Cover image</h2>
        <div className="grid gap-5 sm:grid-cols-[18rem_1fr] sm:items-start">
          <div className="relative aspect-[3/2] overflow-hidden rounded-card border border-line bg-canvas-2">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from the private bucket
              <img src={coverUrl} alt={item.cover_alt || ""} className="h-full w-full object-cover" />
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-fg-subtle">No cover yet</p>
            )}
          </div>
          <div className="space-y-3">
            <FileUploader itemId={item.id} purpose="cover" accept=".jpg,.jpeg,.png,.webp" buttonLabel={coverUrl ? "Replace cover" : "Choose cover"} />
            {coverUrl && <CoverRemove itemId={item.id} />}
            <p className="text-xs text-fg-subtle">JPG, PNG or WebP · up to 5 MB · 3:2 (e.g. 1200 × 800) fits the cards best. Illustrations are decorative, not data.</p>
          </div>
        </div>
      </section>

      <section className={`${card} p-6`} aria-labelledby="h-files">
        <h2 id="h-files" className="mb-5 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-muted">Files &amp; attachments</h2>
        <AttachmentList itemId={item.id} attachments={attachments} urls={urls} />
      </section>

      <section className="rounded-card border border-negative/30 p-6" aria-labelledby="h-danger">
        <h2 id="h-danger" className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-negative">Delete</h2>
        <DeleteItem id={item.id} slug={item.slug} title={item.title} state={item.state} updatedAt={item.updated_at} />
      </section>
    </div>
  );
}
