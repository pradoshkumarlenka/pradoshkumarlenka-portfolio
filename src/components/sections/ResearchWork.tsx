import Link from "next/link";
import type { ProjectFile } from "@/content/types";
import type { ProjectFile as Project, ResearchFile, UiFile } from "@/content/types";
import { getContent, getProjects } from "@/lib/content/server";
import { getAnimationConfig } from "@/lib/animation/server";
import type { AnimationConfig } from "@/lib/animation/config";
import { Reveal } from "@/components/motion/Reveal";
import { PairedBars } from "./PairedBars";
import { ProjectCard } from "./ProjectCard";
import { ResearchVisual } from "./ResearchVisual";
import { resolveAsset } from "@/lib/assets.server";
import { getPublishedItems, type PublicItem } from "@/lib/work/public";
import { WorkUnavailable } from "@/components/ui/WorkUnavailable";

/** Restrained in-section reveals (src/lib/animation/config.ts → reveal.section). */
type SectionReveal = AnimationConfig["reveal"]["section"];

/**
 * RESEARCH & SELECTED WORK — the published items from the database (Supabase),
 * in the order set in the admin dashboard. Each card merges the database record
 * (title, category, summary, status, cover) with the hand-written extras of the
 * six original items (context/date/labels in content/projects/*.json).
 * The featured Securitization X-Ray block shows only while that item is published.
 */
function toCard(item: PublicItem, projects: Project[], research: ResearchFile, ui: UiFile): ProjectFile {
  const rich = projects.find((p) => p.slug === item.slug);
  const year = item.published_at ? String(new Date(item.published_at).getFullYear()) : "";
  return {
    slug: item.slug,
    order: item.sort_order,
    title: item.title,
    shortTitle: item.title,
    context: rich?.context ?? item.category,
    date: rich?.date ?? (item.slug === research.slug ? research.year : year),
    role: "",
    summary: item.summary,
    keyFacts: [],
    resources: [],
    labels: rich?.labels,
    category: item.category,
    status: item.work_status === "Ongoing" ? "Ongoing" : "Completed",
    statusLabel: item.work_status,
    image: item.coverUrl,
    imageAlt: item.cover_alt,
    link: { type: "page", label: ui.selectedWork.action, href: item.href },
  };
}

export async function ResearchWork() {
  const [result, projects, research, ui, motion] = await Promise.all([getPublishedItems(), getProjects(), getContent("research"), getContent("ui"), getAnimationConfig()]);
  const reveal = motion.reveal.section;
  if (!result.ok) return <WorkUnavailable />;
  const items = result.data;
  const featured = items.some((i) => i.slug === research.slug);
  return (
    <div className="space-y-16">
      {featured && <FeaturedResearch research={research} reveal={reveal} />}
      <div>
        <Reveal {...reveal} className="mb-6 flex items-baseline justify-between gap-4">
          <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-fg-muted">{ui.selectedWork.heading}</h3>
          <span className="font-mono text-[11px] text-fg-subtle">
            {items.length} {ui.selectedWork.countLabel}
          </span>
        </Reveal>
        {items.length === 0 ? (
          <p className="rounded-card border border-line bg-surface/55 px-6 py-10 text-center text-sm text-fg-muted">New work is on its way.</p>
        ) : (
          <Reveal {...reveal} className="grid gap-4 lg:grid-cols-2">
            {items.map((item) => (
              <ProjectCard key={item.id} project={toCard(item, projects, research, ui)} />
            ))}
          </Reveal>
        )}
      </div>
    </div>
  );
}

function FeaturedResearch({ research, reveal }: { research: ResearchFile; reveal: SectionReveal }) {
  const researchStatusLabels = research.statusLabels;
  const { progress, card } = research;
  const image = resolveAsset(research.image);
  const columns = [
    { key: "completed", items: progress.completed, tone: "text-positive" },
    { key: "planned", items: progress.planned, tone: "text-lavender" },
    { key: "pending", items: progress.pending, tone: "text-fg-subtle" },
  ] as const;
  return (
    <article className="grid gap-10 rounded-panel border border-line bg-surface/50 p-6 shadow-card backdrop-blur-[3px] sm:p-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
      <Reveal {...reveal}>
        <p className="inline-flex items-center gap-2 rounded-chip border border-violet/40 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-lavender">
          <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-lavender motion-reduce:animate-none" />
          {researchStatusLabels[research.status]} · {research.mode} · {research.year}
        </p>
        <h3 className="mt-5 font-display text-[1.7rem] leading-[1.15] text-fg sm:text-[2.1rem]">{research.fullTitle}</h3>
        <p className="mt-5 text-lg leading-relaxed text-fg-muted">{research.question}</p>
        <p className="mt-3 text-sm text-fg-subtle">{research.data}</p>
        <dl className="mt-7 grid gap-3 border-t border-line pt-6 text-sm sm:grid-cols-3">
          {columns.map(({ key, items, tone }) => (
            <div key={key}>
              <dt className={`font-mono text-[11px] uppercase tracking-[0.14em] ${tone}`}>{card.progressLabels[key]}</dt>
              <dd className="mt-1 text-fg-muted">
                {card.progressSummary[key]}
                <span className="sr-only"> ({items.length})</span>
              </dd>
            </div>
          ))}
        </dl>
        <Link
          href={`/research/${research.slug}`}
          className="tap-target group mt-8 inline-flex items-center gap-2 text-sm text-fg underline decoration-line-strong underline-offset-[6px] transition-colors hover:decoration-lavender"
        >
          {card.linkLabel}
          <span aria-hidden="true" className="inline-block transition-transform duration-300 ease-premium group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
            ↗
          </span>
        </Link>
      </Reveal>
      <Reveal {...reveal} delay={0.25} className="space-y-3 self-center">
        {image && (
          <ResearchVisual
            src={image}
            alt={research.imageAlt ?? ""}
            position={research.imagePosition}
            href={`/research/${research.slug}`}
            label={`${card.linkLabel}: ${research.title}`}
          />
        )}
        {research.findings.map((f) => (
          <PairedBars key={f.label} finding={f} />
        ))}
        <p className="pt-1 text-[11px] text-fg-subtle">{card.footnote}</p>
      </Reveal>
    </article>
  );
}
