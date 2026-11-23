import Link from "next/link";
import type { ReactNode } from "react";
import type { ProjectResource } from "@/content/types";
import { Container } from "@/components/ui/Section";
import { Badge } from "@/components/ui/Card";
import { ProjectResources } from "@/components/ui/ProjectResources";
import { ProjectImage } from "@/components/ui/ProjectImage";
import { Reveal } from "@/components/motion/Reveal";
import { getContent } from "@/lib/content/server";
import { getAnimationConfig } from "@/lib/animation/server";

const BACK = "/#research-work";

export interface CaseBlock {
  id: string;
  heading: string;
  content: ReactNode;
}

interface CaseStudyLayoutProps {
  eyebrow: string;
  title: string;
  status: string;
  /** "ongoing" shows the status in lavender, "complete" in green. */
  statusTone: "ongoing" | "complete";
  /** Honest labels shown as badges. */
  labels?: string[];
  /** Optional message pinned to the top while scrolling. */
  stickyNotice?: string;
  intro: string;
  blocks: CaseBlock[];
  resources: ProjectResource[];
  next?: { href: string; label: string };
  /** Optional cover picture under the header (items created in the admin dashboard). */
  cover?: { src: string; alt: string };
}

/**
 * Shared case-study page: header → Context → My Role → Approach → Results →
 * (What I Learned) → Resources → back link. Pages pass only blocks that have
 * real content, so nothing is padded.
 */
export async function CaseStudyLayout({ eyebrow, title, status, statusTone, labels = [], stickyNotice, intro, blocks, resources, next, cover }: CaseStudyLayoutProps) {
  const [ui, motion] = await Promise.all([getContent("ui"), getAnimationConfig()]);
  const reveal = motion.reveal.section;
  return (
    <article className="pb-24 pt-12 sm:pt-16">
      {stickyNotice && (
        <div className="sticky top-[calc(var(--nav-height)+0.75rem)] z-40 flex justify-center px-4">
          <p role="note" className="rounded-chip border border-violet/50 bg-canvas-2/90 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-lavender shadow-card backdrop-blur-md">
            {stickyNotice}
          </p>
        </div>
      )}
      <Container>
        <BackLink label={ui.caseStudy.backLink} />
        <Reveal {...reveal} className="mt-10 max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-lavender">{eyebrow}</p>
          <h1 className="mt-4 font-display text-4xl leading-[1.08] text-fg sm:text-[3.4rem]">{title}</h1>
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge tone={statusTone === "ongoing" ? "accent" : "positive"}>
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
              {status}
            </Badge>
            {labels.map((label) => (
              <Badge key={label} tone="accent">
                {label}
              </Badge>
            ))}
          </div>
          <p className="mt-6 text-lg leading-relaxed text-fg-muted">{intro}</p>
        </Reveal>
        {cover && (
          <Reveal {...reveal} className="mt-10 max-w-3xl">
            <ProjectImage src={cover.src} alt={cover.alt} sizes="(min-width: 768px) 768px, 92vw" className="rounded-panel border border-line" />
          </Reveal>
        )}

        <div className="mt-16 space-y-16">
          {blocks.map((block) => (
            <section key={block.id} aria-labelledby={`case-${block.id}`} className="grid gap-6 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-10">
              <Reveal {...reveal}>
                <h2 id={`case-${block.id}`} className="font-mono text-xs uppercase tracking-[0.2em] text-fg-muted md:pt-1.5">
                  {block.heading}
                </h2>
              </Reveal>
              <Reveal {...reveal} delay={0.06} className="min-w-0 space-y-6">
                {block.content}
              </Reveal>
            </section>
          ))}
          {resources.length > 0 && (
            <div className="md:ml-[calc(12rem+2.5rem)]">
              <ProjectResources resources={resources} />
            </div>
          )}
        </div>

        <nav aria-label="Case study navigation" className="mt-20 flex flex-col gap-8 border-t border-line pt-10 sm:flex-row sm:items-end sm:justify-between">
          <BackLink label={ui.caseStudy.backLink} />
          {next && (
            <Link href={next.href} className="group sm:text-right">
              <span className="block font-mono text-xs uppercase tracking-[0.2em] text-fg-subtle">{ui.caseStudy.nextLabel}</span>
              <span className="mt-2 block font-display text-2xl text-fg transition-colors group-hover:text-lavender sm:text-3xl">
                {next.label}{" "}
                <span aria-hidden="true" className="inline-block transition-transform duration-300 ease-premium group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                  ↗
                </span>
              </span>
            </Link>
          )}
        </nav>
      </Container>
    </article>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link href={BACK} className="tap-target group inline-flex items-center gap-2 text-sm text-fg-muted transition-colors hover:text-fg">
      <span aria-hidden="true" className="inline-block transition-transform duration-300 ease-premium group-hover:-translate-x-0.5">
        ←
      </span>
      {label}
    </Link>
  );
}

/* ----------------------------------------------------------- Shared blocks */

export function Prose({ children }: { children: ReactNode }) {
  return <p className="max-w-2xl text-lg leading-relaxed text-fg-muted">{children}</p>;
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="max-w-2xl space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 leading-relaxed text-fg-muted">
          <span aria-hidden="true" className="mt-[0.7rem] h-px w-3 shrink-0 bg-violet/70" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function ResultGrid({ results }: { results: { label: string; value: string; note?: string }[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {results.map((r) => (
        <div key={r.label} className="rounded-card border border-line bg-surface/55 p-5 backdrop-blur-[3px]">
          <dt className="text-sm text-fg-muted">{r.label}</dt>
          <dd className="tabular mt-2 font-display text-3xl leading-none text-fg">{r.value}</dd>
          {r.note && <dd className="mt-2 text-xs text-fg-subtle">{r.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-2xl rounded-card border border-dashed border-line-strong px-5 py-4 text-sm text-fg-subtle">{children}</p>
  );
}

export function Chips({ items, label }: { items: string[]; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item} className="rounded-chip border border-line bg-surface/55 px-3 py-1.5 text-sm text-fg">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function FrameworkStrip({ steps }: { steps: { name: string; focus: string }[] }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))]" aria-label="Analytical frameworks, in order">
      {steps.map((s, i) => (
        <li key={s.name} className="relative rounded-card border border-line bg-surface/55 p-5 backdrop-blur-[3px]">
          <span className="font-mono text-[11px] text-fg-subtle">0{i + 1}</span>
          <p className="mt-2 font-display text-xl text-fg">{s.name}</p>
          <p className="mt-1 text-sm text-fg-muted">{s.focus}</p>
          {i < steps.length - 1 && (
            <span aria-hidden="true" className="absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-fg-subtle sm:block">
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
