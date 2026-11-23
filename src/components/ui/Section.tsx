import type { ReactNode } from "react";
import type { SectionConfig } from "@/content/types";
import { Reveal } from "@/components/motion/Reveal";

/** Centred page-width wrapper with the site gutter. */
export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter)] ${className}`}>{children}</div>;
}

interface SectionProps {
  /** Section entry from content.ts (provides id, eyebrow and title). */
  config: SectionConfig;
  children?: ReactNode;
  /** "band" uses the secondary background to separate neighbouring sections. */
  tone?: "default" | "band";
  /** Hide the heading visually (still read by screen readers). */
  hideHeading?: boolean;
  /** Reveal the content block on scroll (turn off when the content animates its own items). */
  animateContent?: boolean;
  /** "compact" = less vertical space (e.g. a strip right under the Hero). */
  spacing?: "default" | "compact";
  className?: string;
}

/**
 * Standard page section: anchor id, eyebrow, heading and content area.
 * Every homepage section is wrapped in this so spacing stays consistent.
 */
export function Section({
  config,
  children,
  tone = "default",
  hideHeading = false,
  animateContent = true,
  spacing = "default",
  className = "",
}: SectionProps) {
  const headingId = `${config.id}-heading`;
  return (
    <section
      id={config.id}
      aria-labelledby={headingId}
      className={`${spacing === "compact" ? "py-14 sm:py-20" : "py-24 sm:py-32"} ${tone === "band" ? "bg-canvas-2/25" : ""} ${className}`}
    >
      <Container>
        <Reveal stagger={0.08} className={hideHeading ? "sr-only" : `${spacing === "compact" ? "mb-8 sm:mb-10" : "mb-12 sm:mb-16"} max-w-3xl`}>
          {config.eyebrow && (
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-lavender">{config.eyebrow}</p>
          )}
          <h2 id={headingId} className="font-display text-4xl leading-[1.05] text-fg sm:text-5xl">
            {config.title}
          </h2>
          {config.intro && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-fg-muted">{config.intro}</p>}
        </Reveal>
        {animateContent ? <Reveal delay={0.12}>{children}</Reveal> : children}
      </Container>
    </section>
  );
}
