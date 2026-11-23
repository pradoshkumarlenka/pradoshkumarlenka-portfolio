"use client";

import { useAnimationConfig } from "@/lib/content/client";

import { useMemo, useRef } from "react";
import type { ProofItem } from "@/content/types";
import { EASE_PREMIUM, gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";

const DIGITS = "0123456789".split("");

/**
 * PROOF BAR — the record (content/proof.json). Everything plays once:
 *  - cards rise in sequence (85 ms apart);
 *  - numeric values roll into place digit by digit, like a mechanical counter;
 *    text values (e.g. "PPO") fade in instead;
 *  - an optional dot grid lights `lit` of `total` dots in step with the roll;
 *  - on mouse hover, a soft light follows the cursor along the card border.
 * Final values are server-rendered (correct without JS); reduced motion shows
 * them immediately.
 */
export function ProofBar({ items }: { items: ProofItem[] }) {
  const root = useRef<HTMLDivElement>(null);
  const ROLL_SECONDS = useAnimationConfig().proofBar.rollSeconds;

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const cards = gsap.utils.toArray<HTMLElement>("[data-proof-item]", el);
        const values = gsap.utils.toArray<HTMLElement>("[data-proof-value]", el);
        const columns = gsap.utils.toArray<HTMLElement>("[data-digit]", el);
        const dots = gsap.utils.toArray<HTMLElement>("[data-dot-lit]", el);
        gsap.set(cards, { autoAlpha: 0, y: 16 });
        gsap.set(values, { autoAlpha: 0, y: 10, filter: "blur(6px)" });
        gsap.set(columns, { y: 0, yPercent: 0 }); // every digit starts at 0 (replaces the server-rendered final position)
        gsap.set(dots, { "--lit": 0 });

        const trigger = ScrollTrigger.create({
          trigger: el,
          start: "top 85%",
          once: true,
          onEnter: () => {
            // Clear GSAP's inline transform/translate afterwards so the CSS hover lift works.
            gsap.to(cards, { autoAlpha: 1, y: 0, duration: 0.6, ease: EASE_PREMIUM, stagger: 0.085, clearProps: "transform,translate" });
            values.forEach((v) => {
              const i = Number(v.dataset.index);
              gsap.to(v, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.7, ease: EASE_PREMIUM, delay: 0.12 + i * 0.085 });
            });
            columns.forEach((col) => {
              const i = Number(col.dataset.index);
              const pos = Number(col.dataset.pos);
              // One full turn, then settle on the target digit (rightmost column turns most).
              const target = 10 + Number(col.dataset.digit);
              gsap.to(col, {
                yPercent: -(target / 20) * 100,
                duration: ROLL_SECONDS + pos * 0.12,
                ease: EASE_PREMIUM,
                delay: 0.18 + i * 0.085,
              });
            });
            dots.forEach((d) => {
              const i = Number(d.dataset.index);
              gsap.to(d, { "--lit": 1, duration: 0.35, ease: "power1.out", delay: 0.25 + i * 0.085 + Number(d.dataset.order) * (ROLL_SECONDS / 30) });
            });
          },
        });

        return () => {
          trigger.kill();
        };
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  // Border light follows the cursor (CSS variables only — no React re-renders).
  const onPointerMove = (e: React.PointerEvent<HTMLLIElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <div
      ref={root}
      tabIndex={0}
      className="-mx-[var(--gutter)] overflow-x-auto overscroll-x-contain px-[var(--gutter)] pb-2 [scrollbar-width:none] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-lavender lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0"
    >
      <ul className="grid auto-cols-[min(80vw,18rem)] grid-flow-col gap-3 sm:auto-cols-[minmax(17rem,1fr)] lg:grid-flow-row lg:grid-cols-4 lg:gap-4">
        {items.map((item, i) => (
          <li
            key={item.label}
            data-proof-item
            onPointerMove={onPointerMove}
            className="proof-card group relative flex snap-start flex-col rounded-card border border-line bg-surface/60 px-5 py-6 shadow-card backdrop-blur-[3px] transition-[translate,border-color] duration-300 ease-premium hover:-translate-y-0.5 hover:border-violet/70"
          >
            {/* Cursor-following border light (mouse only; see .proof-card in globals.css) */}
            <span aria-hidden="true" className="proof-card-light" />

            <p className="font-display text-[2.6rem] leading-none text-fg sm:text-[2.75rem]">
              <span className="sr-only">{item.value}</span>
              <span aria-hidden="true" data-proof-value={item.count ? undefined : ""} data-index={i} className="inline-block">
                {item.count ? <RollingValue item={item} index={i} /> : item.value}
              </span>
            </p>
            <p className="mt-4 text-sm font-medium leading-snug text-fg">{item.label}</p>
            {item.detail && <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">{item.detail}</p>}
            {item.dots && <DotGrid total={item.dots.total} lit={item.dots.lit} index={i} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "22 of 216": digits roll like a counter; the suffix is slightly dimmer. */
function RollingValue({ item, index }: { item: ProofItem; index: number }) {
  const count = item.count!;
  const digits = String(count.to).split("");
  return (
    <span className="tabular inline-flex items-baseline">
      {count.prefix}
      {digits.map((d, pos) =>
        /\d/.test(d) ? (
          <span key={pos} className="relative inline-block [clip-path:inset(0_-30%)]" style={{ height: "1em" }}>
            {/* Sizer: the final digit decides the column width, so nothing shifts. */}
            <span className="invisible">{d}</span>
            <span
              data-digit={d}
              data-pos={digits.length - 1 - pos}
              data-index={index}
              className="absolute left-0 top-0 flex flex-col items-center"
              style={{ transform: `translateY(${-((10 + Number(d)) / 20) * 100}%)` }}
            >
              {[...DIGITS, ...DIGITS].map((n, k) => (
                <span key={k} className="block h-[1em] leading-none">
                  {n}
                </span>
              ))}
            </span>
          </span>
        ) : (
          <span key={pos}>{d}</span>
        ),
      )}
      {/* Flex drops leading spaces, so the gap is explicit when the suffix starts with one. */}
      {count.suffix && (
        <span className={`text-fg-muted ${/^\s/.test(count.suffix) ? "ml-[0.25em]" : ""}`}>{count.suffix.trim()}</span>
      )}
    </span>
  );
}

/** Seeded scatter: `lit` of `total` dots light up (the same pattern on every visit). */
function DotGrid({ total, lit, index }: { total: number; lit: number; index: number }) {
  const order = useMemo(() => {
    let seed = 216_2026;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const ids = Array.from({ length: total }, (_, k) => k);
    for (let k = ids.length - 1; k > 0; k--) {
      const j = Math.floor(rand() * (k + 1));
      [ids[k], ids[j]] = [ids[j], ids[k]];
    }
    const chosen = new Map(ids.slice(0, lit).map((id, n) => [id, n]));
    return chosen;
  }, [total, lit]);
  const cols = Math.min(24, Math.ceil(Math.sqrt(total * 2.7)));
  return (
    <div aria-hidden="true" className="mt-auto pt-5">
      <div className="grid w-fit gap-[5px]" style={{ gridTemplateColumns: `repeat(${cols}, 4px)` }}>
        {Array.from({ length: total }, (_, k) => {
          const n = order.get(k);
          return n === undefined ? (
            <span key={k} className="h-1 w-1 rounded-full bg-fg-subtle/25" />
          ) : (
            <span key={k} data-dot-lit data-index={index} data-order={n} className="proof-dot h-1 w-1 rounded-full" style={{ "--lit": 1 } as React.CSSProperties} />
          );
        })}
      </div>
    </div>
  );
}
