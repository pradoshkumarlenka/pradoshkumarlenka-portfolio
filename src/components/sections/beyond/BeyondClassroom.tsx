"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BeyondFile, BeyondItem } from "@/content/types";
import dynamic from "next/dynamic";

// The WebGL carousel (and its ogl library, ~36 KB gzipped) loads on the client only, so it
// does not weigh on the first load; the stage keeps its fixed height, so nothing shifts.
const FlexCarousel = dynamic(() => import("@/components/reactbits/FlexCarousel"), {
  ssr: false,
  loading: () => <div className="flex-carousel" aria-hidden="true" />,
});
import { PhotoFrame } from "@/components/ui/PhotoFrame";
import { useMediaQuery, useScrollTrack } from "@/lib/useScrollTrack";
import { useAnimationConfig } from "@/lib/content/client";

type Labels = BeyondFile["labels"];

const pad = (n: number) => String(n).padStart(2, "0");
// Scroll per photo, stage height and lens settings: beyondCarousel in src/lib/animation/config.ts.

/**
 * BEYOND THE CLASSROOM — experience photos (content/beyond.json) in React Bits'
 * FlexCarousel. The section is held on screen while page scroll plays through
 * every photo in order: scrolling down brings each next photo in from the left
 * (the row travels left → right), scrolling up reverses it. After the last photo
 * the page carries on to the Résumé Library. Photos keep their natural shape.
 * Reduced motion or no WebGL2: a simple swipe strip instead.
 */
export function BeyondClassroom({ items, labels }: { items: BeyondItem[]; labels: Labels }) {
  const [fallback, setFallback] = useState(false);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  if (items.length === 0) return null;
  if (fallback || reduced) return <Strip items={items} labels={labels} />;
  return <Pinned items={items} labels={labels} onUnsupported={() => setFallback(true)} />;
}

function Pinned({ items, labels, onUnsupported }: { items: BeyondItem[]; labels: Labels; onUnsupported: () => void }) {
  // Narrow screens: a gentler lens so the bend never pushes a photo into its caption.
  const narrow = useMediaQuery("(max-width: 639px)");
  const cfg = useAnimationConfig().beyondCarousel;
  const STEP_PX = cfg.stepPx;
  const STAGE_H = cfg.stageHeightPx;
  const n = items.length;
  const drive = useRef<((t: number) => void) | null>(null);
  // Passed in reverse so that moving the row rightwards reveals photo 1, 2, 3 … from the left.
  const reversed = useMemo(
    () => [...items].reverse().map((item) => ({ src: item.image, alt: item.imageAlt, title: item.title, subtitle: item.caption })),
    [items],
  );
  const onProgress = useCallback((v: number) => drive.current?.(n > 1 ? v / (n - 1) : 0), [n]);
  const { trackRef, index, go, spacerHeight } = useScrollTrack({ count: n, stepPx: STEP_PX, halfHeight: STAGE_H / 2, active: true, onProgress });
  // The WebGL carousel (39 photo textures) is created only when the section comes within
  // ~1500 px of the screen, not during the first load. The stage has a fixed height, so
  // nothing shifts and the pinned scrolling is unaffected.
  const stage = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = stage.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setNear(true); }, { rootMargin: "1500px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  return (
    <div ref={trackRef}>
      <div
        className="sticky"
        style={{ top: `calc(50vh - ${STAGE_H / 2}px)` }}
        onKeyDownCapture={(e) => {
          // ←/→ scroll the page to the previous/next photo (the row follows the page).
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            e.stopPropagation();
            go(index + (e.key === "ArrowRight" ? 1 : -1));
          }
        }}
      >
        {/* Full screen width so the row bends off the screen edges, not the content column. */}
        <div ref={stage} className="relative ml-[calc(50%-50vw)] w-screen" style={{ height: STAGE_H }}>
          {near ? <FlexCarousel
            items={reversed}
            driveRef={drive}
            reverseCount
            label={labels.stack}
            preset={narrow ? cfg.mobile.preset : cfg.desktop.preset}
            bend={narrow ? cfg.mobile.bend : undefined}
            intro="rise"
            fit="natural"
            cardHeight={narrow ? cfg.mobile.cardHeight : cfg.desktop.cardHeight}
            gap={cfg.gap}
            radius={cfg.radius}
            dispersion={cfg.dispersion}
            squeeze={cfg.squeeze}
            focusOnClick
            captions
            captureWheel={false}
            onUnsupported={onUnsupported}
          /> : <div className="flex-carousel" aria-hidden="true" />}
        </div>
        <div aria-hidden="true" className="mx-auto mt-2 h-px w-48 overflow-hidden bg-line-strong">
          <div className="h-full origin-left bg-lavender transition-transform duration-200" style={{ transform: `scaleX(${n > 1 ? index / (n - 1) : 1})` }} />
        </div>
      </div>
      {/* Scroll distance while the section is held (one step per photo). */}
      <div aria-hidden="true" style={{ height: spacerHeight }} />
      {/* Every card's full text for screen readers (the carousel announces only the current title). */}
      <ol className="sr-only">
        {items.map((item) => (
          <li key={item.id}>
            {item.title}
            {item.category ? ` (${item.category})` : ""}: {item.caption}
          </li>
        ))}
      </ol>
    </div>
  );
}

function CardText({ item, index, total }: { item: BeyondItem; index: number; total: number }) {
  return (
    <div className="flex min-w-0 flex-col p-5">
      <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.16em]">
        {item.category && <span className="text-lavender">{item.category}</span>}
        <span className="tabular text-fg-subtle">
          {pad(index + 1)} / {pad(total)}
        </span>
      </div>
      <h3 className="mt-3 font-display text-[1.4rem] leading-[1.12] text-fg">{item.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">{item.caption}</p>
    </div>
  );
}

function Controls({ index, total, labels, onGo }: { index: number; total: number; labels: Labels; onGo: (i: number) => void }) {
  const btn =
    "inline-flex h-11 w-11 items-center justify-center rounded-chip border border-line-strong text-fg transition-colors duration-200 hover:border-lavender disabled:cursor-not-allowed disabled:opacity-30";
  return (
    <div className="mt-6 flex items-center gap-4">
      <button type="button" className={btn} onClick={() => onGo(index - 1)} disabled={index <= 0} aria-label={labels.previous}>
        ←
      </button>
      <button type="button" className={btn} onClick={() => onGo(index + 1)} disabled={index >= total - 1} aria-label={labels.next}>
        →
      </button>
      <p className="tabular font-mono text-xs text-fg-muted" aria-live="polite">
        <span className="text-fg">{pad(index + 1)}</span> / {pad(total)}
      </p>
    </div>
  );
}

/* ------------------------------------------- Fallback strip (no WebGL2) */
function Strip({ items, labels }: { items: BeyondItem[]; labels: Labels }) {
  const scroller = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const n = items.length;

  const step = () => {
    const first = scroller.current?.children[0] as HTMLElement | undefined;
    return first ? first.offsetWidth + 16 : 300;
  };
  const go = (i: number) => {
    const el = scroller.current;
    if (!el || i < 0 || i >= n) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: i * step(), behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div>
      <ul
        ref={scroller}
        aria-label={labels.stack}
        onScroll={(e) => setIndex(Math.min(n - 1, Math.round(e.currentTarget.scrollLeft / step())))}
        tabIndex={0}
        className="-mx-[var(--gutter)] flex snap-x snap-mandatory scroll-px-[var(--gutter)] gap-4 overflow-x-auto overscroll-x-contain px-[var(--gutter)] pb-2 [scrollbar-width:none] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-lavender"
      >
        {items.map((item, i) => (
          <li
            key={item.id}
            aria-current={i === index ? "true" : undefined}
            className="flex w-[min(84vw,22rem)] shrink-0 snap-start flex-col overflow-hidden rounded-card border border-line bg-surface/80 shadow-card transition-[border-color] duration-300 aria-[current=true]:border-violet/55"
          >
            <PhotoFrame src={item.image} alt={item.imageAlt} position={item.imagePosition} sizes="(min-width: 640px) 352px, 84vw" className="aspect-[4/5] w-full border-b border-line" />
            <CardText item={item} index={i} total={n} />
          </li>
        ))}
      </ul>
      <Controls index={index} total={n} labels={labels} onGo={go} />
    </div>
  );
}
