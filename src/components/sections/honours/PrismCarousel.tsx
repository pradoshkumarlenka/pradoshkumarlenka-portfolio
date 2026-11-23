"use client";

import { useCallback, useRef, useState } from "react";
import type { Honour } from "@/content/types";
import { fill } from "@/lib/content/selectors";
import { useAnimationConfig } from "@/lib/content/client";
import { SCROLL_STACK_QUERY, useMediaQuery, useScrollTrack } from "@/lib/useScrollTrack";

// Page scroll per card and the block's half-height: honoursCarousel in src/lib/animation/config.ts.

interface Labels {
  previous: string;
  next: string;
  position: string;
}

/**
 * FINITE PRISM CAROUSEL — honours as cards on a gentle 3D arc.
 * Desktop: the block pins and page scroll drives it (down = cards move right→left,
 * up = reverse). Finite: at the first/last card the pin releases and the page
 * scrolls on. Prev/Next and ←/→ scroll the page to that card's position.
 * Elsewhere: a native horizontal strip with the same buttons.
 */
export function PrismCarousel({ items, labels, active }: { items: Honour[]; labels: Labels; active: boolean }) {
  const prism = useMediaQuery(SCROLL_STACK_QUERY);
  return prism ? <Prism items={items} labels={labels} active={active} /> : <Strip items={items} labels={labels} />;
}

function HonourCard({ honour, index, total }: { honour: Honour; index: number; total: number }) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.16em]">
        <span className="text-lavender">{honour.category}</span>
        <span className="tabular text-fg-subtle">
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </div>
      <h3 className="mt-5 font-display text-[1.55rem] leading-[1.15] text-fg">{honour.title}</h3>
      {honour.detail && <p className="mt-3 text-sm leading-relaxed text-fg-muted">{honour.detail}</p>}
    </>
  );
}

function Controls({ index, total, labels, onGo }: { index: number; total: number; labels: Labels; onGo: (i: number) => void }) {
  const btn =
    "inline-flex h-10 w-10 items-center justify-center rounded-chip border border-line-strong text-fg transition-colors duration-200 hover:border-lavender disabled:cursor-not-allowed disabled:opacity-30";
  return (
    <div className="mt-6 flex items-center justify-center gap-4">
      <button type="button" className={btn} onClick={() => onGo(index - 1)} disabled={index <= 0} aria-label={labels.previous}>
        ←
      </button>
      <p className="tabular w-20 text-center font-mono text-xs text-fg-muted" aria-live="polite">
        {fill(labels.position, { n: index + 1, total })}
      </p>
      <button type="button" className={btn} onClick={() => onGo(index + 1)} disabled={index >= total - 1} aria-label={labels.next}>
        →
      </button>
    </div>
  );
}

/* --------------------------------------------------------------- Prism */
function Prism({ items, labels, active }: { items: Honour[]; labels: Labels; active: boolean }) {
  const { stepPx: STEP_PX, halfHeightPx: HALF_HEIGHT } = useAnimationConfig().honoursCarousel;
  const cards = useRef<(HTMLLIElement | null)[]>([]);
  const n = items.length;

  const layout = useCallback((v: number) => {
    cards.current.forEach((el, i) => {
      if (!el) return;
      const d = i - v;
      const ad = Math.abs(d);
      const x = Math.sign(d) * (ad <= 1 ? ad * 410 : 410 + (ad - 1) * 120);
      const rot = Math.max(-62, Math.min(62, -d * 38));
      const z = -Math.min(ad, 4) * 170;
      el.style.transform = `translate(-50%, -50%) translate3d(${x}px, 0, ${z}px) rotateY(${rot}deg)`;
      // Depth by dimming (cards stay opaque so overlapping text never shows through).
      el.style.filter = `brightness(${1 - Math.min(ad, 3) * 0.2})`;
      el.style.opacity = String(Math.max(0, Math.min(1, 3.6 - ad)));
      el.style.zIndex = String(100 - Math.round(ad * 10));
      el.dataset.active = ad < 0.5 ? "true" : "false";
    });
  }, []);

  const { trackRef, index, go, spacerHeight } = useScrollTrack({ count: n, stepPx: STEP_PX, halfHeight: HALF_HEIGHT, active, onProgress: layout });

  return (
    <div ref={trackRef}>
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={fill(labels.position, { n: index + 1, total: n })}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(index + 1);
          if (e.key === "ArrowLeft") go(index - 1);
        }}
        className="sticky rounded-panel outline-offset-8"
        style={{ top: `calc(50vh - ${HALF_HEIGHT}px)` }}
      >
        <ul
          className="relative h-[330px] [perspective:1500px] [transform-style:preserve-3d]"
          aria-label={labels.position.replace(/\{.*?\}/g, "").trim() || undefined}
        >
          {items.map((h, i) => (
            <li
              key={h.title}
              ref={(node) => void (cards.current[i] = node)}
              aria-hidden={i !== index}
              className="absolute left-1/2 top-1/2 flex h-[250px] w-[min(380px,80vw)] flex-col rounded-card border border-line bg-surface p-6 shadow-raised transition-[border-color] duration-300 will-change-transform data-[active=true]:border-violet/60"
              style={{
                transform: `translate(-50%, -50%) translate3d(${i * 410}px, 0, 0)`,
                opacity: i === 0 ? 1 : 0,
              }}
            >
              <HonourCard honour={h} index={i} total={n} />
            </li>
          ))}
        </ul>
        <Controls index={index} total={n} labels={labels} onGo={go} />
      </div>
      {/* Scroll distance while the block is held (a sticky block cannot move into padding). */}
      <div aria-hidden="true" style={{ height: spacerHeight }} />
    </div>
  );
}

/* --------------------------------------------------------------- Strip */
function Strip({ items, labels }: { items: Honour[]; labels: Labels }) {
  const scroller = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const n = items.length;

  const step = () => {
    const el = scroller.current;
    const first = el?.children[0] as HTMLElement | undefined;
    return first ? first.offsetWidth + 12 : 300;
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
        onScroll={(e) => setIndex(Math.min(n - 1, Math.round(e.currentTarget.scrollLeft / step())))}
        tabIndex={0}
        className="-mx-[var(--gutter)] flex snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain px-[var(--gutter)] pb-2 [scrollbar-width:none] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-lavender"
      >
        {items.map((h, i) => (
          <li
            key={h.title}
            className="flex w-[min(80vw,20rem)] shrink-0 snap-start flex-col rounded-card border border-line bg-surface/70 p-6 shadow-card"
          >
            <HonourCard honour={h} index={i} total={n} />
          </li>
        ))}
      </ul>
      <Controls index={index} total={n} labels={labels} onGo={go} />
    </div>
  );
}
