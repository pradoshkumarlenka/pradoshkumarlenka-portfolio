import type { Metadata } from "next";

/** Page metadata replaces the inherited Open Graph object, so the social image is set again here. */
const SOCIAL_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "Pradosh Kumar Lenka — Finance & Research" };
import { notFound } from "next/navigation";
import { getCaseStudyProjects, getContent } from "@/lib/content/server";
import { resolveResources } from "@/lib/assets.server";
import { attachmentResources, getPublishedItem, getPublishedItems, nextItem } from "@/lib/work/public";
import { WorkUnavailable } from "@/components/ui/WorkUnavailable";
import {
  BulletList,
  CaseStudyLayout,
  Chips,
  FrameworkStrip,
  Note,
  Prose,
  ResultGrid,
  type CaseBlock,
} from "@/components/case-study/CaseStudyLayout";
import { RateShock } from "@/components/case-study/RateShock";
import { BetaChart } from "@/components/case-study/BetaChart";

/**
 * PROJECT PAGE — the rich hand-written layout (content/projects/<slug>.json:
 * context, approach, results, charts) for items that are PUBLISHED in the
 * database. The database supplies the title, summary, status and attachments;
 * unpublished or unknown slugs → 404.
 */

type Params = { slug: string };

/** Re-checked at least every 60 s, and immediately after any admin change. */
export const revalidate = 60;

export async function generateStaticParams(): Promise<Params[]> {
  return (await getCaseStudyProjects()).map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await getPublishedItem(slug);
  if (!r.ok || !r.data) return {};
  return { title: r.data.item.title, description: r.data.item.summary, alternates: { canonical: `/projects/${slug}` }, openGraph: { type: "article", url: `/projects/${slug}`, title: r.data.item.title, description: r.data.item.summary, images: [SOCIAL_IMAGE] }, twitter: { card: "summary_large_image", title: r.data.item.title, description: r.data.item.summary, images: [SOCIAL_IMAGE.url] } };
}

export default async function ProjectPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const [projects, ui] = await Promise.all([getCaseStudyProjects(), getContent("ui")]);
  const project = projects.find((p) => p.slug === slug);
  if (!project?.caseStudy) notFound();
  const [found, all] = await Promise.all([getPublishedItem(slug), getPublishedItems()]);
  if (!found.ok || !all.ok) return <WorkUnavailable page />;
  if (!found.data) notFound(); // draft, archived or deleted in the dashboard
  const { item, attachments } = found.data;
  const cs = project.caseStudy;
  const h = ui.caseStudy.headings;
  const ex = cs.exhibit;

  const blocks: CaseBlock[] = [
    { id: "context", heading: h.context, content: <Prose>{cs.context}</Prose> },
    { id: "role", heading: h.role, content: <Prose>{cs.role}</Prose> },
    {
      id: "approach",
      heading: h.approach,
      content: (
        <>
          <BulletList items={cs.approach} />
          {ex?.kind === "frameworks" && <FrameworkStrip steps={ex.steps} />}
          {ex?.kind === "positions" && <Chips items={ex.tickers} label={ui.caseStudy.positionsLabel} />}
        </>
      ),
    },
    {
      id: "results",
      heading: h.results,
      content: (
        <>
          {cs.results.length > 0 && <ResultGrid results={cs.results} />}
          {ex?.kind === "rate-shock" && <RateShock modifiedDuration={ex.modifiedDuration} convexity={ex.convexity} anchor={ex.anchor} />}
          {ex?.kind === "beta" && <BetaChart stocks={ex.stocks} caption={ex.caption} />}
          {cs.resultsNote && <Note>{cs.resultsNote}</Note>}
        </>
      ),
    },
  ];
  if (cs.learned.length > 0) blocks.push({ id: "learned", heading: h.learned, content: <BulletList items={cs.learned} /> });

  return (
    <CaseStudyLayout
      eyebrow={`${project.context} · ${project.date}`}
      title={item.title}
      status={`${item.work_status} · ${project.date}`}
      statusTone={item.work_status === "Ongoing" ? "ongoing" : "complete"}
      labels={project.labels}
      stickyNotice={project.stickyNotice}
      intro={item.summary}
      blocks={blocks}
      resources={[...attachmentResources(attachments), ...resolveResources(project.resources, project.slug)]}
      next={nextItem(all.data, slug)}
    />
  );
}
