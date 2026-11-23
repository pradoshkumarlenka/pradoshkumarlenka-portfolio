"use client";

import { useRef } from "react";
import { EASE_PREMIUM, gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { useUi } from "@/lib/content/client";

type Stock = { name: string; beta: number; note: string };
const MAX = 1.3; // axis maximum (β)

/** Horizontal beta bars with a β = 1 market reference. Documented values only. */
export function BetaChart({ stocks, caption }: { stocks: Stock[]; caption: string }) {
  const ui = useUi();
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const bars = gsap.utils.toArray<HTMLElement>("[data-bar]", root.current);
        gsap.set(bars, { scaleX: 0 });
        ScrollTrigger.create({
          trigger: root.current,
          start: "top 85%",
          once: true,
          onEnter: () => gsap.to(bars, { scaleX: 1, duration: 0.9, ease: EASE_PREMIUM, stagger: 0.09 }),
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <figure ref={root} className="rounded-card border border-line bg-surface/55 p-5 backdrop-blur-[3px] sm:p-7">
      <figcaption className="font-mono text-xs uppercase tracking-[0.18em] text-lavender">{ui.charts.beta.title}</figcaption>
      <div className="relative mt-6 space-y-4">
        {/* β = 1 reference, aligned with the bar track */}
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-2 -top-2 left-[7.5rem] right-[3.5rem]">
          <span className="absolute inset-y-0 border-l border-dashed border-fg-subtle/70" style={{ left: `${(1 / MAX) * 100}%` }} />
          <span className="absolute -top-5 -translate-x-1/2 font-mono text-[10px] text-fg-subtle" style={{ left: `${(1 / MAX) * 100}%` }}>
            β = 1
          </span>
        </div>
        {stocks.map((s) => (
          <div key={s.name} tabIndex={0} className="group relative flex items-center gap-3 rounded-[6px] outline-offset-4" aria-label={`${s.name}: beta ${s.beta}. ${s.note}`}>
            <span className="w-[6.75rem] shrink-0 truncate text-sm text-fg">{s.name}</span>
            <div className="h-3 flex-1">
              <div data-bar className="h-full origin-left rounded-r-[4px] bg-violet" style={{ width: `${(s.beta / MAX) * 100}%` }} />
            </div>
            <span className="tabular w-[2.75rem] shrink-0 text-right font-mono text-sm text-fg">{s.beta.toFixed(2)}</span>
            {/* Hover / focus tooltip */}
            <span
              role="tooltip"
              className="pointer-events-none absolute -top-9 left-[7.5rem] z-10 whitespace-nowrap rounded-[6px] border border-line-strong bg-canvas-2 px-2.5 py-1 text-xs text-fg opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              {s.name} · β {s.beta.toFixed(2)} · {s.note}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-5 text-xs text-fg-subtle">{caption}</p>
      <table className="sr-only">
        <caption>Beta by stock</caption>
        <thead>
          <tr>
            <th>Stock</th>
            <th>Beta</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((s) => (
            <tr key={s.name}>
              <td>{s.name}</td>
              <td>{s.beta}</td>
              <td>{s.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
