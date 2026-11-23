import type { CSSProperties } from "react";
import { resolveAsset } from "@/lib/assets.server";
import { getContent, getSection } from "@/lib/content/server";
import { Container } from "@/components/ui/Section";
import { HeroName } from "./HeroName";
import { HalftonePortrait } from "./HalftonePortrait";
import { HeroActions } from "./HeroActions";
import { HeroReplayGuard } from "./HeroReplayGuard";

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/**
 * HERO — status, name, statement, specialisation, location, actions and
 * portrait. Text is server-rendered and animated with CSS
 * so it is readable immediately; 3D loads afterwards.
 */
export async function Hero() {
  const [hero, resume, ui, intro] = await Promise.all([getContent("hero"), getContent("resume"), getContent("ui"), getSection("intro")]);
  const { person } = hero;
  const resumeHref = resolveAsset(resume.file);
  const portrait = resolveAsset(hero.portrait.image);

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="relative isolate flex min-h-[calc(100svh-var(--nav-height))] items-center overflow-hidden py-16 sm:py-24"
    >
      <HeroReplayGuard />
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-10">
          {/* Text */}
          <div className="min-w-0">
            <p
              className="hero-in inline-flex items-center gap-2 rounded-chip border border-positive/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-positive sm:text-[11px] sm:tracking-[0.14em]"
              style={d(0)}
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-positive" />
              {person.statusLine}
            </p>

            <h1 id="hero-heading" className="sr-only">
              {person.name}
            </h1>
            <div className="mt-6">
              <HeroName firstNames={person.firstNames} lastName={person.highlightedName} />
            </div>

            <p className="mt-7 max-w-xl text-lg text-fg-muted sm:text-xl">
              <span className="mask-line">
                <span style={d(560)}>{person.brandLine}</span>
              </span>
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs uppercase tracking-[0.18em]">
              <span className="hero-in text-fg-muted" style={d(760)}>
                {person.tagline}
              </span>
              <span className="hero-in flex items-center gap-2 text-fg-subtle" style={d(840)}>
                <span aria-hidden="true" className="h-px w-4 bg-fg-subtle/60" />
                {person.location}
              </span>
            </div>

            <div className="hero-in mt-10" style={d(920)}>
              <HeroActions
                primaryLabel={hero.buttons.primary}
                secondaryLabel={hero.buttons.secondary}
                resumeHref={resumeHref}
                resumeDownloadName={resume.downloadName}
                resumePendingNote={hero.buttons.resumePendingNote}
                targetId="research-work"
                watchLabel={intro?.visible ? hero.introVideo.watchLabel : undefined}
                watchTargetId="intro"
              />
            </div>
          </div>

          {/* Visual: portrait, 540px tall on desktop (4:5 → 432×540) */}
          <div className="flex justify-center lg:justify-end">
            <div className="hero-in w-full max-w-[300px] sm:max-w-[360px] lg:max-w-none lg:w-[432px]" style={d(300)}>
              <HalftonePortrait src={portrait} alt={hero.portrait.alt} expectedPath={hero.portrait.image} backdropColor={hero.portrait.backdropColor} placeholderLabel={ui.placeholders.portrait} delay={350} />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
