import type { Metadata } from "next";

/** Page metadata replaces the inherited Open Graph object, so the social image is set again here. */
const SOCIAL_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "Pradosh Kumar Lenka — Finance & Research" };
import { notFound } from "next/navigation";
import { getContent } from "@/lib/content/server";
import { resolveResources } from "@/lib/assets.server";
import { attachmentResources, getPublishedItem, getPublishedItems, nextItem } from "@/lib/work/public";
import { WorkUnavailable } from "@/components/ui/WorkUnavailable";
import { BulletList, CaseStudyLayout, Chips, Note, Prose, type CaseBlock } from "@/components/case-study/CaseStudyLayout";
import { PairedBars } from "@/components/sections/PairedBars";

/**
 * RESEARCH NOTE — Securitization X-Ray. The rich content (findings, charts,
 * method, progress) comes from content/research.json; the page exists only
 * while the item is PUBLISHED in the database, which also supplies its
 * status and attachments.
 */

type Params = { slug: string };

/** Re-checked at least every 60 s, and immediately after any admin change. */
export const revalidate = 60;

export async function generateStaticParams(): Promise<Params[]> {
  return [{ slug: (await getContent("research")).slug }];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const research = await getContent("research");
  if (slug !== research.slug) return {};
  const r = await getPublishedItem(slug);
  if (!r.ok || !r.data) return {};
  return { title: r.data.item.title, description: research.question, alternates: { canonical: `/research/${slug}` }, openGraph: { type: "article", url: `/research/${slug}`, title: r.data.item.title, description: research.question, images: [SOCIAL_IMAGE] }, twitter: { card: "summary_large_image", title: r.data.item.title, description: research.question, images: [SOCIAL_IMAGE.url] } };
}

export default async function ResearchPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const research = await getContent("research");
  const researchStatusLabels = research.statusLabels;
  if (slug !== research.slug) notFound();
  const [found, all] = await Promise.all([getPublishedItem(slug), getPublishedItems()]);
  if (!found.ok || !all.ok) return <WorkUnavailable page />;
  if (!found.data) notFound(); // draft, archived or deleted in the dashboard
  const { item, attachments } = found.data;
  const { progress, page, card } = research;
  const h = page.headings;

  const blocks: CaseBlock[] = [
    { id: "question", heading: h.question, content: <Prose>{research.question}</Prose> },
    {
      id: "data",
      heading: h.data,
      content: (
        <>
          <Prose>{research.data}</Prose>
          <Chips items={research.signals} label={page.signalsLabel} />
        </>
      ),
    },
    {
      id: "evidence",
      heading: h.evidence,
      content: (
        <>
          <div className="grid gap-3 lg:grid-cols-3">
            {research.findings.map((f) => (
              <PairedBars key={f.label} finding={f} />
            ))}
          </div>
          <Note>{page.evidenceNote}</Note>
        </>
      ),
    },
    {
      id: "method",
      heading: h.method,
      content: (
        <>
          <Prose>{research.method}</Prose>
          <ol className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-fg" aria-label="Model specifications, in order">
            {page.models.map((m, i) => (
              <li key={m} className="flex items-center gap-2">
                <span className="rounded-chip border border-line-strong px-3 py-1.5">{m}</span>
                {i < page.models.length - 1 && <span aria-hidden="true" className="text-fg-subtle">→</span>}
              </li>
            ))}
          </ol>
        </>
      ),
    },
    {
      id: "status",
      heading: h.status,
      content: (
        <div className="grid gap-6 sm:grid-cols-3">
          {(
            [
              [card.progressLabels.completed, progress.completed, "text-positive"],
              [card.progressLabels.planned, progress.planned, "text-lavender"],
              [card.progressLabels.pending, progress.pending, "text-fg-subtle"],
            ] as const
          ).map(([label, items, tone]) => (
            <div key={label}>
              <h3 className={`mb-3 font-mono text-[11px] uppercase tracking-[0.16em] ${tone}`}>{label}</h3>
              <BulletList items={[...items]} />
            </div>
          ))}
        </div>
      ),
    },
    { id: "integrity", heading: h.integrity, content: <Prose>{research.integrity}</Prose> },
  ];

  return (
    <CaseStudyLayout
      eyebrow={`${page.eyebrow} · ${research.mode} · ${research.year}`}
      title={research.fullTitle}
      status={item.work_status === "Ongoing" ? researchStatusLabels.ongoing : item.work_status}
      statusTone={item.work_status === "Ongoing" ? "ongoing" : "complete"}
      intro={page.intro}
      blocks={blocks}
      resources={[...attachmentResources(attachments), ...resolveResources(research.resources, research.slug)]}
      next={nextItem(all.data, slug)}
    />
  );
}
