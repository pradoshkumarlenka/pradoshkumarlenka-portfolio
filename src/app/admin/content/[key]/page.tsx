import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/auth";
import { CONTENT_TITLES, getContentForEdit, isContentKey } from "@/lib/admin/content-data";
import { CONTENT_REGISTRY } from "@/lib/content/registry";
import { schemaFor } from "@/lib/content/validate";
import { ContentEditor } from "@/components/admin/content/ContentEditor";

export const dynamic = "force-dynamic";

export default async function EditContentPage({ params }: { params: Promise<{ key: string }> }) {
  await requireAdminPage();
  const { key } = await params;
  if (!isContentKey(key)) notFound();
  const { ok, published, draft, fallback } = await getContentForEdit(key);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/content" className="text-sm text-fg-muted hover:text-fg">← All content</Link>
        <h1 className="mt-3 font-display text-4xl">{CONTENT_TITLES[key]}</h1>
        <p className="mt-2 text-sm text-fg-muted">{CONTENT_REGISTRY[key].usedBy}</p>
      </div>
      {!ok ? (
        <p role="alert" className="text-sm text-negative">The content could not be loaded. Please refresh.</p>
      ) : (
        <ContentEditor
          blockKey={key}
          schema={schemaFor(key)}
          published={published ? { data: published.data, version: published.version, updatedAt: published.updated_at } : null}
          draft={draft ? { data: draft.data, baseVersion: draft.base_version, updatedAt: draft.updated_at } : null}
          fallback={fallback}
        />
      )}
    </div>
  );
}
