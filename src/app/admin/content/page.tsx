import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/auth";
import { getContentOverview } from "@/lib/admin/content-data";
import { card } from "@/components/admin/styles";
import { ExportButton } from "@/components/admin/AdminRequests";

export const dynamic = "force-dynamic";

const date = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Every editable content block, with its published version and any pending draft. */
export default async function ContentHome() {
  await requireAdminPage();
  const { ok, rows } = await getContentOverview();
  const drafts = rows.filter((r) => r.draft).length;

  return (
    <div>
      <h1 className="font-display text-4xl">Site content</h1>
      <p className="mt-2 max-w-2xl text-sm text-fg-muted">
        Edit the words, lists and links of each part of the site. Changes are saved as a private draft first; visitors see them only after you publish.
        {drafts > 0 && <> · <span className="text-lavender">{drafts} unpublished draft{drafts === 1 ? "" : "s"}</span></>}
      </p>
      <p className="mt-3 flex flex-wrap gap-4 text-sm">
        {/* A file download: a plain link (next/link would prefetch it in the background). */}
        <ExportButton className="text-fg-muted hover:text-fg" />
        <a href="/admin/preview" className="text-fg-muted hover:text-fg">Preview drafts</a>
      </p>
      {!ok && <p role="alert" className="mt-6 text-sm text-negative">The content could not be loaded. Please refresh.</p>}
      <ul className={`${card} mt-8 divide-y divide-line`}>
        {rows.map((r) => (
          <li key={r.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
            <div className="min-w-0 flex-1">
              <Link href={`/admin/content/${r.key}`} className="text-fg hover:text-lavender">{r.title}</Link>
              <p className="truncate text-xs text-fg-subtle">{r.usedBy}</p>
            </div>
            {r.draft && <span className="rounded-chip border border-lavender/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-lavender">Draft</span>}
            <span className="font-mono text-[11px] text-fg-subtle">
              {r.published ? `v${r.published.version} · ${date(r.published.updated_at)}` : "Not in database (site file used)"}
            </span>
            <Link href={`/admin/content/${r.key}`} className="text-sm text-fg-muted hover:text-fg">Edit</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
