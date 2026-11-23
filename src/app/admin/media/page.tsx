import { requireAdminPage } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { mediaUsage } from "@/lib/admin/media-data";
import { mediaUrl, mediaViewUrl } from "@/lib/media/paths";
import { previewToken } from "@/lib/media/server";
import { MediaLibrary, type MediaItem } from "@/components/admin/media/MediaLibrary";

export const dynamic = "force-dynamic";

/** Images and PDFs used by the site's content, stored in the private site-media bucket. */
export default async function MediaPage() {
  await requireAdminPage();
  const supabase = await createClient();
  const [{ data, error }, usage] = await Promise.all([
    supabase.from("media").select("id, path, kind, mime, bytes, width, height, title, alt, created_at, updated_at, privacy_review").order("created_at", { ascending: false }).limit(500),
    mediaUsage(supabase),
  ]);
  const items: MediaItem[] = (data ?? []).map((m) => ({
    id: m.id,
    url: mediaUrl(m.id, m.path),
    view: mediaViewUrl(m.id, m.path, previewToken(m.id)),
    kind: m.kind,
    mime: m.mime,
    bytes: Number(m.bytes),
    width: m.width,
    height: m.height,
    title: m.title,
    alt: m.alt,
    updatedAt: m.updated_at,
    usedBy: usage.get(m.id) ?? [],
    approved: m.privacy_review === "approved",
  }));
  return (
    <div>
      <h1 className="font-display text-4xl">Media library</h1>
      <p className="mt-2 max-w-2xl text-sm text-fg-muted">
        Images (JPG, PNG, WebP, AVIF — up to 10 MB) and PDFs (up to 15 MB) for the site. Files are private until published content uses them.
        Choose a file in any content editor with “Library”. Files in use cannot be deleted.
      </p>
      <p className="mt-2 max-w-2xl text-xs text-fg-subtle">
        Photo location and camera data are removed on upload. Nothing is blurred automatically: every file starts as “review pending” and is never shown publicly until you approve it after checking for signatures, enrolment or roll numbers, certificate codes, dates of birth and other personal IDs. Blur or replace a file first if needed.
      </p>
      {error ? <p role="alert" className="mt-6 text-sm text-negative">The library could not be loaded. Please refresh.</p> : <MediaLibrary items={items} />}
    </div>
  );
}
