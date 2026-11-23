import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/auth";
import { getItemForAdmin } from "@/lib/admin/data";
import { UUID } from "@/lib/admin/validate";
import { StateBadge } from "@/components/admin/StateBadge";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = { pdf: "Read Report", doc: "Read Report", docx: "Read Report", ppt: "View Presentation", pptx: "View Presentation", xls: "Open Financial Model", xlsx: "Open Financial Model" };

/** Admin-only preview of an item's page — works for drafts too. Visitors never reach it. */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await getItemForAdmin(id);
  if (!data) notFound();
  const { item, attachments, coverUrl, urls } = data;
  const paragraphs = item.description.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <article>
      <div className="mb-8 flex flex-wrap items-center gap-3 rounded-card border border-lavender/40 bg-violet/10 px-4 py-3 text-sm">
        <span>Preview</span>
        <StateBadge state={item.state} />
        <span className="text-fg-muted">{item.state === "published" ? "This is what visitors see." : "Not visible to visitors until published."}</span>
        <Link href={`/admin/items/${item.id}`} className="ml-auto text-lavender hover:text-fg">← Back to editing</Link>
      </div>

      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-lavender">
        {item.category || "Uncategorised"} · {item.work_status}
      </p>
      <h1 className="mt-3 max-w-3xl font-display text-5xl leading-[1.05]">{item.title}</h1>
      {item.summary && <p className="mt-5 max-w-2xl text-lg text-fg-muted">{item.summary}</p>}

      {coverUrl && (
        <div className="mt-8 aspect-[3/2] max-w-3xl overflow-hidden rounded-panel border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
          <img src={coverUrl} alt={item.cover_alt || ""} className="h-full w-full object-cover" />
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4 text-fg-muted">
          {paragraphs.length ? paragraphs.map((p, i) => <p key={i} className="leading-relaxed">{p}</p>) : <p className="text-fg-subtle">No overview written yet.</p>}
          {item.highlights.length > 0 && (
            <ul className="mt-6 space-y-2">
              {item.highlights.map((h) => (
                <li key={h} className="flex gap-3"><span aria-hidden="true" className="mt-[0.65rem] h-px w-4 shrink-0 bg-violet" />{h}</li>
              ))}
            </ul>
          )}
        </div>
        {attachments.length > 0 && (
          <aside aria-labelledby="files-h">
            <h2 id="files-h" className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-muted">Files &amp; attachments</h2>
            <ul className="mt-4 space-y-2">
              {attachments.map((a) => (
                <li key={a.id}>
                  {urls[a.id] ? (
                    <a href={urls[a.id]} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-card border border-line px-4 py-3 text-sm hover:border-lavender">
                      <span>
                        <span className="block text-fg">{a.label || LABEL[a.kind]}</span>
                        <span className="block text-xs text-fg-subtle">{a.title} · {a.kind.toUpperCase()}</span>
                      </span>
                      <span aria-hidden="true">↗</span>
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </article>
  );
}
