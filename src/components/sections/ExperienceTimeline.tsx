"use client";

import { useRef } from "react";
import type { ExperienceItem } from "@/content/types";
import { Badge } from "@/components/ui/Card";
import { EASE_PREMIUM, gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";

/*
 * Geometry: the line and every marker share one x-coordinate (LINE_X), so
 * they stay aligned at every width. Mobile: 2rem marker column. Desktop:
 * 11rem date column + 3rem marker column.
 */
const LINE_X = "left-4 md:left-[12.5rem]";

/**
 * EXPERIENCE TIMELINE (content: `experience` in content.ts).
 * - Line: scroll-linked, draws from the top and reverses when scrolling up.
 * - Markers + text: one-time reveal per entry, in reading order
 *   (company → role → dates/location → description → outcome → bullets).
 * - Reduced motion: everything shown immediately, line fully drawn.
 */
export function ExperienceTimeline({ items }: { items: ExperienceItem[] }) {
  const root = useRef<HTMLOListElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          "[data-line]",
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: { trigger: el, start: "top 72%", end: "bottom 65%", scrub: 0.6 },
          },
        );

        gsap.utils.toArray<HTMLElement>("[data-entry]", el).forEach((entry) => {
          const marker = entry.querySelector("[data-marker]");
          const panel = entry.querySelector("article");
          const steps = gsap.utils
            .toArray<HTMLElement>("[data-step]", entry)
            .filter((s) => s.offsetParent !== null) // skip the hidden (other-breakpoint) date block
            .sort((a, b) => Number(a.dataset.step) - Number(b.dataset.step));
          gsap.set(marker, { autoAlpha: 0, scale: 0.55 });
          gsap.set(panel, { autoAlpha: 0 });
          gsap.set(steps, { autoAlpha: 0, y: 16 });
          const tl = gsap.timeline({ paused: true, defaults: { ease: EASE_PREMIUM } });
          tl.to(marker, { autoAlpha: 1, scale: 1, duration: 0.4 })
            .to(panel, { autoAlpha: 1, duration: 0.45 }, 0)
            .to(
            steps,
            { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.07 },
            0.08,
          );
          ScrollTrigger.create({ trigger: entry, start: "top 78%", once: true, onEnter: () => void tl.play() });
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <ol ref={root} className="relative space-y-10 md:space-y-14">
      {/* Track + drawn line (transform only: no layout change while drawing). */}
      <div aria-hidden="true" className={`absolute bottom-2 top-2 w-px -translate-x-1/2 bg-line ${LINE_X}`}>
        <div data-line className="h-full w-full origin-top bg-gradient-to-b from-lavender/70 via-violet/45 to-violet/10" />
      </div>

      {items.map((item) => {
        const dates = `${item.start} – ${item.end}`;
        return (
          <li key={item.company} data-entry className="relative grid grid-cols-[2rem_minmax(0,1fr)] md:grid-cols-[11rem_3rem_minmax(0,1fr)]">
            {/* Desktop date column */}
            <div data-step="3" className="hidden pr-6 pt-1 text-right md:block">
              <p className="tabular font-mono text-xs uppercase leading-relaxed tracking-[0.14em] text-fg-muted">
                {item.start} –{" "}
                <br />
                {item.end}
              </p>
              <p className="mt-1.5 text-xs text-fg-subtle">{item.location}</p>
            </div>

            {/* Marker column (marker centred on the line) */}
            <div className="relative">
              <span
                data-marker
                aria-hidden="true"
                className={`absolute left-1/2 top-[0.55rem] h-3 w-3 -translate-x-1/2 rounded-full border ${
                  item.marker === "current"
                    ? "border-lavender bg-violet shadow-[0_0_0_4px_rgb(7_10_20)]"
                    : "border-lavender/80 bg-canvas shadow-[0_0_0_4px_rgb(7_10_20)]"
                }`}
              />
            </div>

            {/* Role */}
            <article className="rounded-card border border-line bg-surface/55 p-5 shadow-card backdrop-blur-[3px] sm:p-7">
              <h3 data-step="1" className="font-display text-2xl leading-tight text-fg sm:text-[1.7rem]">
                {item.company}
              </h3>
              <p data-step="2" className="mt-1.5 text-base text-lavender">
                {item.title}
              </p>
              <p data-step="3" className="tabular mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-muted md:hidden">
                {dates} · {item.location}
              </p>
              <p data-step="4" className="mt-4 max-w-2xl text-fg-muted">
                {item.summary}
              </p>
              <div data-step="5" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                <Badge tone={item.marker === "current" ? "positive" : "accent"}>
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                  {item.outcome}
                </Badge>
                {item.note && <span className="text-xs text-fg-subtle">{item.note}</span>}
              </div>
              <ul data-step="6" className="mt-5 space-y-2.5 border-t border-line pt-5">
                {item.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3 text-sm leading-relaxed text-fg-muted">
                    <span aria-hidden="true" className="mt-[0.6rem] h-px w-3 shrink-0 bg-violet/70" />
                    {bullet}
                  </li>
                ))}
              </ul>
              <ul data-step="6" className="mt-5 flex flex-wrap gap-2" aria-label="Skills">
                {item.tags.map((tag) => (
                  <li key={tag} className="rounded-chip border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-subtle">
                    {tag}
                  </li>
                ))}
              </ul>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
