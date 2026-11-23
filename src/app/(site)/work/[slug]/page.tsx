import type { Metadata } from "next";

/** Page metadata replaces the inherited Open Graph object, so the social image is set again here. */
const SOCIAL_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "Pradosh Kumar Lenka — Finance & Research" };
import { notFound, permanentRedirect } from "next/navigation";
import { attachmentResources, detailHref, getPublishedItem, getPublishedItems, nextItem } from "@/lib/work/public";
import { BulletList, CaseStudyLayout, Prose, type CaseBlock } from "@/components/case-study/CaseStudyLayout";
import { WorkUnavailable } from "@/components/ui/WorkUnavailable";

/**
 * WORK PAGE — for items created in the admin dashboard (no hand-written
 * layout): overview, highlights, cover and files, all from the database.
 * Only published items are shown; anything else → 404.
 */

type Params = { slug: string };

/** Re-checked at least every 60 s, and immediately after any admin change. */
export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await getPublishedItem(slug);
  if (!r.ok || !r.data) return {};
  return { title: r.data.item.title, description: r.data.item.summary, alternates: { canonical: `/work/${slug}` }, openGraph: { type: "article", url: `/work/${slug}`, title: r.data.item.title, description: r.data.item.summary, images: [SOCIAL_IMAGE] }, twitter: { card: "summary_large_image", title: r.data.item.title, description: r.data.item.summary, images: [SOCIAL_IMAGE.url] } };
}

export default async function WorkPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) notFound();
  // The six original items keep their richer pages.
  const href = await detailHref(slug);
  if (href !== `/work/${slug}`) permanentRedirect(href);
  const [found, all] = await Promise.all([getPublishedItem(slug), getPublishedItems()]);
  if (!found.ok || !all.ok) return <WorkUnavailable page />;
  if (!found.data) notFound();
  const { item, attachments } = found.data;

  const paragraphs = item.description.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const blocks: CaseBlock[] = [];
  if (paragraphs.length) blocks.push({ id: "overview", heading: "Overview", content: <>{paragraphs.map((p, i) => <Prose key={i}>{p}</Prose>)}</> });
  if (item.highlights.length) blocks.push({ id: "highlights", heading: "Highlights", content: <BulletList items={item.highlights} /> });
  const year = item.published_at ? new Date(item.published_at).getFullYear() : "";

  return (
    <CaseStudyLayout
      eyebrow={[item.category, year].filter(Boolean).join(" · ")}
      title={item.title}
      status={item.work_status}
      statusTone={item.work_status === "Ongoing" ? "ongoing" : "complete"}
      intro={item.summary}
      cover={item.coverUrl ? { src: item.coverUrl, alt: item.cover_alt } : undefined}
      blocks={blocks}
      resources={attachmentResources(attachments)}
      next={nextItem(all.data, slug)}
    />
  );
}
